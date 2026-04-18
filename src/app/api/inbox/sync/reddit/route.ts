import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptApiKey, encryptApiKey } from "@/lib/encryption";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RedditMessage {
  id: string;
  name: string; // fullname e.g. t4_abc123
  author: string;
  dest: string;
  subject: string;
  body: string;
  body_html?: string;
  created_utc: number;
  first_message_name: string | null; // thread root fullname
  parent_id: string | null;
  was_comment: boolean;
}

async function refreshRedditToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "CampaignFlowPro/1.0",
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.access_token) return null;

  // Persist refreshed token
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: encryptApiKey(data.access_token),
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("platform", "reddit");

  return data.access_token;
}

async function fetchRedditInbox(accessToken: string, limit = 25): Promise<RedditMessage[]> {
  const res = await fetch(
    `https://oauth.reddit.com/message/inbox?limit=${limit}&mark=false`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "CampaignFlowPro/1.0",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Reddit API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const children = data?.data?.children ?? [];
  return children
    .filter((c: { kind: string }) => c.kind === "t4") // t4 = private message
    .map((c: { data: RedditMessage }) => c.data) as RedditMessage[];
}

async function getOrCreateRedditAccount(
  supabase: SupabaseClient,
  userId: string,
  username: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("inbox_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "reddit")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("inbox_accounts")
    .insert({
      user_id: userId,
      provider: "reddit",
      account_label: `Reddit — u/${username}`,
      extra_config: { source: "reddit_oauth" },
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}

async function syncUserRedditInbox(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  username: string
): Promise<{ synced: number; errors: number }> {
  let token = accessToken;
  let messages: RedditMessage[];

  try {
    messages = await fetchRedditInbox(token);
  } catch (err) {
    // Try token refresh on auth failure
    if (refreshToken && String(err).includes("401")) {
      const newToken = await refreshRedditToken(supabase, userId, refreshToken);
      if (!newToken) return { synced: 0, errors: 1 };
      token = newToken;
      messages = await fetchRedditInbox(token);
    } else {
      throw err;
    }
  }

  const accountId = await getOrCreateRedditAccount(supabase, userId, username);
  if (!accountId) return { synced: 0, errors: 1 };

  let synced = 0;
  let errors = 0;

  for (const msg of messages) {
    try {
      if (msg.was_comment) continue; // skip comment replies, only DMs

      // Thread ID: use first_message_name if present, else the message's own fullname
      const threadId = msg.first_message_name ?? msg.name;
      const sentAt = new Date(msg.created_utc * 1000).toISOString();

      const { data: convoRow, error: convoErr } = await supabase
        .from("inbox_conversations")
        .upsert(
          {
            user_id: userId,
            account_id: accountId,
            external_thread_id: threadId,
            subject: msg.subject ?? null,
            contact_name: msg.author,
            last_message_at: sentAt,
          },
          { onConflict: "account_id,external_thread_id", ignoreDuplicates: false }
        )
        .select("id, message_count")
        .single();

      if (convoErr || !convoRow) {
        errors++;
        continue;
      }

      // Idempotency check by external_message_id (fullname)
      const { count } = await supabase
        .from("inbox_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convoRow.id)
        .eq("external_message_id", msg.name);

      if ((count ?? 0) > 0) {
        synced++;
        continue;
      }

      // Direction: if sender is our user → outbound, else inbound
      const direction = msg.author === username ? "outbound" : "inbound";

      await supabase.from("inbox_messages").insert({
        conversation_id: convoRow.id,
        user_id: userId,
        external_message_id: msg.name,
        direction,
        sender_name: msg.author,
        body: msg.body,
        sent_at: sentAt,
      });

      await supabase
        .from("inbox_conversations")
        .update({
          message_count: (convoRow.message_count ?? 0) + 1,
          is_read: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", convoRow.id);

      synced++;
    } catch (err) {
      console.error("Reddit sync: message error", err);
      errors++;
    }
  }

  await supabase
    .from("inbox_accounts")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", accountId);

  return { synced, errors };
}

// ─── GET /api/inbox/sync/reddit ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isCron =
    process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

  let supabase: SupabaseClient;
  let userId: string | null = null;

  if (isCron) {
    supabase = createServiceClient();
    const rawUserId = request.headers.get("x-cron-user-id");
    if (rawUserId && !UUID_RE.test(rawUserId)) {
      return NextResponse.json({ error: "Invalid x-cron-user-id" }, { status: 400 });
    }
    userId = rawUserId;
  } else {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;
  }

  let query = supabase
    .from("oauth_connections")
    .select("user_id, access_token_encrypted, refresh_token_encrypted, platform_username")
    .eq("platform", "reddit");

  if (userId) query = query.eq("user_id", userId);

  const { data: connections, error: connErr } = await query;
  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 });
  if (!connections || connections.length === 0) {
    return NextResponse.json({ message: "No Reddit connections found", synced: 0 });
  }

  const results: Array<{ userId: string; synced: number; errors: number; error?: string }> = [];

  for (const conn of connections) {
    if (userId && conn.user_id !== userId) continue;
    if (!conn.access_token_encrypted) {
      results.push({ userId: conn.user_id, synced: 0, errors: 0, error: "No token" });
      continue;
    }

    try {
      const accessToken = decryptApiKey(conn.access_token_encrypted);
      const refreshToken = conn.refresh_token_encrypted
        ? decryptApiKey(conn.refresh_token_encrypted)
        : null;
      const username = conn.platform_username ?? "unknown";

      const { synced, errors } = await syncUserRedditInbox(
        supabase,
        conn.user_id,
        accessToken,
        refreshToken,
        username
      );
      results.push({ userId: conn.user_id, synced, errors });
    } catch (err) {
      console.error("Reddit sync error for user", conn.user_id, err);
      results.push({
        userId: conn.user_id,
        synced: 0,
        errors: 1,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const totalSynced = results.reduce((s, r) => s + r.synced, 0);
  return NextResponse.json({ synced: totalSynced, users: results.length, results });
}
