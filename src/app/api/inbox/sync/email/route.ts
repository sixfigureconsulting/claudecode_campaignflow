import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

interface InstantlyEmail {
  id?: string;
  from_address?: string;
  from_name?: string;
  to_address?: string;
  subject?: string;
  body?: string;
  timestamp?: string;
  created_at?: string;
  is_reply?: boolean;
  campaign_id?: string;
  thread_id?: string;
  lead_id?: string;
}

async function fetchInstantlyReplies(
  apiKey: string,
  limit = 100
): Promise<InstantlyEmail[]> {
  // Fetch emails from Instantly v2 inbox — filter to replied/received emails
  const url = new URL("https://api.instantly.ai/api/v2/emails");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("email_type", "received"); // 'received' = inbound replies

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instantly API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data?.items ?? data?.data ?? data ?? []) as InstantlyEmail[];
}

async function getOrCreateEmailAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  // Check if an 'email' inbox_account exists for this user
  const { data: existing } = await supabase
    .from("inbox_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "email")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Auto-create one (it carries no credentials — credentials come from integration_configs)
  const { data: created, error } = await supabase
    .from("inbox_accounts")
    .insert({
      user_id: userId,
      provider: "email",
      account_label: "Instantly Email Inbox",
      extra_config: { source: "instantly_integration" },
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}

async function syncUserInstantlyInbox(
  supabase: SupabaseClient,
  userId: string,
  apiKey: string
): Promise<{ synced: number; errors: number }> {
  const accountId = await getOrCreateEmailAccount(supabase, userId);
  if (!accountId) return { synced: 0, errors: 1 };

  let synced = 0;
  let errors = 0;

  const emails = await fetchInstantlyReplies(apiKey, 100);

  for (const email of emails) {
    try {
      // Use thread_id or id as the external thread identifier
      const externalThreadId = email.thread_id ?? email.id ?? "";
      if (!externalThreadId) continue;

      const subject = email.subject ?? null;
      const contactEmail = email.from_address ?? null;
      const contactName = email.from_name ?? null;
      const lastMsgAt = email.timestamp ?? email.created_at ?? new Date().toISOString();

      // Upsert conversation
      const { data: convoRow, error: convoErr } = await supabase
        .from("inbox_conversations")
        .upsert(
          {
            user_id: userId,
            account_id: accountId,
            external_thread_id: externalThreadId,
            subject,
            contact_name: contactName,
            contact_email: contactEmail,
            last_message_at: lastMsgAt,
          },
          { onConflict: "account_id,external_thread_id", ignoreDuplicates: false }
        )
        .select("id, message_count")
        .single();

      if (convoErr || !convoRow) {
        errors++;
        continue;
      }

      // Store the email as an inbound message (idempotent by external_message_id)
      const externalMsgId = email.id ?? "";
      if (externalMsgId) {
        const { count } = await supabase
          .from("inbox_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convoRow.id)
          .eq("external_message_id", externalMsgId);

        if ((count ?? 0) > 0) {
          synced++;
          continue;
        }
      }

      const body = email.body ?? "";
      if (!body) {
        synced++;
        continue;
      }

      await supabase.from("inbox_messages").insert({
        conversation_id: convoRow.id,
        user_id: userId,
        external_message_id: externalMsgId || null,
        direction: "inbound",
        sender_name: contactName,
        sender_email: contactEmail,
        body,
        sent_at: lastMsgAt,
      });

      // Bump message count and mark unread
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
      console.error("Email sync: message error", err);
      errors++;
    }
  }

  // Update last_synced_at for the account
  await supabase
    .from("inbox_accounts")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", accountId);

  return { synced, errors };
}

// Resolve Instantly API key for a user — checks integration_configs
async function getInstantlyKey(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  // Use global __integrations__ project for this user
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "__default__")
    .single();
  if (!client) return null;

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", client.id)
    .eq("name", "__integrations__")
    .single();
  if (!project) return null;

  const { data: config } = await supabase
    .from("integration_configs")
    .select("api_key_encrypted")
    .eq("project_id", project.id)
    .eq("service", "instantly")
    .single();
  if (!config) return null;

  try {
    return decryptApiKey(config.api_key_encrypted);
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET /api/inbox/sync/email ────────────────────────────────────────────────
// Callable by: authenticated user (syncs their own Instantly inbox)
//              OR cron (CRON_SECRET bearer, optional x-cron-user-id)

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isCron =
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`;

  let supabase: SupabaseClient;
  let targetUserIds: string[] = [];

  if (isCron) {
    supabase = createServiceClient();
    const cronUserId = request.headers.get("x-cron-user-id");
    if (cronUserId) {
      if (!UUID_RE.test(cronUserId)) {
        return NextResponse.json({ error: "Invalid x-cron-user-id" }, { status: 400 });
      }
      targetUserIds = [cronUserId];
    } else {
      // Find all users who have an Instantly integration key
      const { data: integrations } = await supabase
        .from("integration_configs")
        .select("project_id, projects!inner(client_id, clients!inner(user_id))")
        .eq("service", "instantly");

      const rawIds = (integrations ?? [])
        .map(
          (i: {
            projects: {
              clients: { user_id: string };
            };
          }) => i.projects?.clients?.user_id as string | undefined
        )
        .filter((uid: string | undefined): uid is string => typeof uid === "string");
      targetUserIds = [...new Set(rawIds)] as string[];
    }
  } else {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    targetUserIds = [user.id];
  }

  if (targetUserIds.length === 0) {
    return NextResponse.json({ message: "No users with Instantly integration", synced: 0 });
  }

  const results: Array<{
    userId: string;
    synced: number;
    errors: number;
    error?: string;
  }> = [];

  for (const uid of targetUserIds) {
    try {
      const apiKey = await getInstantlyKey(supabase, uid);
      if (!apiKey) {
        results.push({ userId: uid, synced: 0, errors: 0, error: "No Instantly API key" });
        continue;
      }
      const { synced, errors } = await syncUserInstantlyInbox(supabase, uid, apiKey);
      results.push({ userId: uid, synced, errors });
    } catch (err) {
      console.error("Email sync error for user", uid, err);
      results.push({
        userId: uid,
        synced: 0,
        errors: 1,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const totalSynced = results.reduce((s, r) => s + r.synced, 0);
  return NextResponse.json({ synced: totalSynced, users: results.length, results });
}
