import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptApiKey, encryptApiKey } from "@/lib/encryption";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TwitterDMEvent {
  id: string;
  text: string;
  created_at: string;
  sender_id: string;
  dm_conversation_id: string;
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

async function refreshTwitterToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(clientId)}`,
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.access_token) return null;

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 7200) * 1000).toISOString();
  await supabase
    .from("oauth_connections")
    .update({
      access_token_encrypted: encryptApiKey(data.access_token),
      ...(data.refresh_token ? { refresh_token_encrypted: encryptApiKey(data.refresh_token) } : {}),
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("platform", "twitter");

  return data.access_token;
}

async function fetchTwitterDMEvents(
  accessToken: string,
  maxResults = 50
): Promise<{ events: TwitterDMEvent[]; users: TwitterUser[] }> {
  const params = new URLSearchParams({
    "dm_event.fields": "id,text,created_at,sender_id,dm_conversation_id",
    expansions: "sender_id",
    "user.fields": "id,name,username",
    max_results: String(maxResults),
  });

  const res = await fetch(`https://api.twitter.com/2/dm_events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitter API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    events: (data?.data ?? []) as TwitterDMEvent[],
    users: (data?.includes?.users ?? []) as TwitterUser[],
  };
}

async function getOrCreateTwitterAccount(
  supabase: SupabaseClient,
  userId: string,
  username: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("inbox_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "twitter")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("inbox_accounts")
    .insert({
      user_id: userId,
      provider: "twitter",
      account_label: `Twitter — @${username}`,
      extra_config: { source: "twitter_oauth" },
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}

async function syncUserTwitterInbox(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  platformUserId: string,
  username: string
): Promise<{ synced: number; errors: number }> {
  let token = accessToken;
  let events: TwitterDMEvent[];
  let users: TwitterUser[];

  try {
    ({ events, users } = await fetchTwitterDMEvents(token));
  } catch (err) {
    if (refreshToken && String(err).includes("401")) {
      const newToken = await refreshTwitterToken(supabase, userId, refreshToken);
      if (!newToken) return { synced: 0, errors: 1 };
      token = newToken;
      ({ events, users } = await fetchTwitterDMEvents(token));
    } else {
      throw err;
    }
  }

  if (events.length === 0) return { synced: 0, errors: 0 };

  const accountId = await getOrCreateTwitterAccount(supabase, userId, username);
  if (!accountId) return { synced: 0, errors: 1 };

  const userMap = new Map(users.map((u) => [u.id, u]));
  let synced = 0;
  let errors = 0;

  for (const event of events) {
    try {
      const threadId = event.dm_conversation_id;
      const sender = userMap.get(event.sender_id);
      const senderName = sender ? `${sender.name} (@${sender.username})` : event.sender_id;
      const isOutbound = event.sender_id === platformUserId;

      const { data: convoRow, error: convoErr } = await supabase
        .from("inbox_conversations")
        .upsert(
          {
            user_id: userId,
            account_id: accountId,
            external_thread_id: threadId,
            contact_name: isOutbound ? null : senderName,
            last_message_at: event.created_at,
          },
          { onConflict: "account_id,external_thread_id", ignoreDuplicates: false }
        )
        .select("id, message_count")
        .single();

      if (convoErr || !convoRow) {
        errors++;
        continue;
      }

      // Idempotency check
      const { count } = await supabase
        .from("inbox_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convoRow.id)
        .eq("external_message_id", event.id);

      if ((count ?? 0) > 0) {
        synced++;
        continue;
      }

      await supabase.from("inbox_messages").insert({
        conversation_id: convoRow.id,
        user_id: userId,
        external_message_id: event.id,
        direction: isOutbound ? "outbound" : "inbound",
        sender_name: isOutbound ? null : senderName,
        body: event.text,
        sent_at: event.created_at,
      });

      await supabase
        .from("inbox_conversations")
        .update({
          message_count: (convoRow.message_count ?? 0) + 1,
          is_read: isOutbound ? true : false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", convoRow.id);

      synced++;
    } catch (err) {
      console.error("Twitter sync: event error", err);
      errors++;
    }
  }

  await supabase
    .from("inbox_accounts")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", accountId);

  return { synced, errors };
}

// ─── GET /api/inbox/sync/twitter ──────────────────────────────────────────────

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
    .select("user_id, access_token_encrypted, refresh_token_encrypted, platform_user_id, platform_username")
    .eq("platform", "twitter");

  if (userId) query = query.eq("user_id", userId);

  const { data: connections, error: connErr } = await query;
  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 });
  if (!connections || connections.length === 0) {
    return NextResponse.json({ message: "No Twitter connections found", synced: 0 });
  }

  const results: Array<{ userId: string; synced: number; errors: number; error?: string }> = [];

  for (const conn of connections) {
    if (userId && conn.user_id !== userId) continue;
    if (!conn.access_token_encrypted || !conn.platform_user_id) {
      results.push({ userId: conn.user_id, synced: 0, errors: 0, error: "Missing token or platform_user_id" });
      continue;
    }

    try {
      const accessToken = decryptApiKey(conn.access_token_encrypted);
      const refreshToken = conn.refresh_token_encrypted
        ? decryptApiKey(conn.refresh_token_encrypted)
        : null;

      const { synced, errors } = await syncUserTwitterInbox(
        supabase,
        conn.user_id,
        accessToken,
        refreshToken,
        conn.platform_user_id,
        conn.platform_username ?? "user"
      );
      results.push({ userId: conn.user_id, synced, errors });
    } catch (err) {
      console.error("Twitter sync error for user", conn.user_id, err);
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
