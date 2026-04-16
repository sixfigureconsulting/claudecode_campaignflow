import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

interface HeyreachParticipant {
  linkedinUrl?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}

interface HeyreachMessage {
  id?: string | number;
  text?: string;
  content?: string;
  createdAt?: string;
  sentAt?: string;
  isFromMe?: boolean;
  fromMe?: boolean;
}

interface HeyreachConversation {
  id?: string | number;
  conversationId?: string;
  participant?: HeyreachParticipant;
  leadLinkedinUrl?: string;
  leadFirstName?: string;
  leadLastName?: string;
  lastMessage?: HeyreachMessage;
  messages?: HeyreachMessage[];
  updatedAt?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

async function fetchHeyreachConversations(
  apiKey: string,
  offset = 0,
  limit = 20
): Promise<HeyreachConversation[]> {
  const res = await fetch(
    "https://api.heyreach.io/api/public/v2/inbox/get-conversations",
    {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ offset, limit }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Heyreach API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  // Handle both { items: [] } and [] shapes
  return (data?.items ?? data ?? []) as HeyreachConversation[];
}

async function syncAccountConversations(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  apiKey: string
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  const conversations = await fetchHeyreachConversations(apiKey, 0, 50);

  for (const conv of conversations) {
    try {
      const externalId = String(conv.id ?? conv.conversationId ?? "");
      if (!externalId) continue;

      const participant = conv.participant;
      const contactName =
        participant?.fullName ??
        [participant?.firstName, participant?.lastName].filter(Boolean).join(" ") ??
        conv.leadFirstName
          ? [conv.leadFirstName, conv.leadLastName].filter(Boolean).join(" ")
          : null;
      const contactLinkedinUrl =
        participant?.linkedinUrl ?? conv.leadLinkedinUrl ?? null;
      const lastMsgAt =
        conv.lastMessageAt ?? conv.updatedAt ?? new Date().toISOString();

      // Upsert conversation
      const { data: convoRow, error: convoErr } = await supabase
        .from("inbox_conversations")
        .upsert(
          {
            user_id: userId,
            account_id: accountId,
            external_thread_id: externalId,
            contact_name: contactName ?? null,
            contact_linkedin_url: contactLinkedinUrl,
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

      // Sync individual messages if present
      const messages = conv.messages ?? (conv.lastMessage ? [conv.lastMessage] : []);
      let newMessages = 0;

      for (const msg of messages) {
        const externalMsgId = String(msg.id ?? "");
        const body = msg.text ?? msg.content ?? "";
        if (!body) continue;

        const direction = (msg.isFromMe ?? msg.fromMe) ? "outbound" : "inbound";
        const sentAt = msg.createdAt ?? msg.sentAt ?? new Date().toISOString();

        // Skip if already stored (idempotent)
        if (externalMsgId) {
          const { count } = await supabase
            .from("inbox_messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", convoRow.id)
            .eq("external_message_id", externalMsgId);

          if ((count ?? 0) > 0) continue;
        }

        await supabase.from("inbox_messages").insert({
          conversation_id: convoRow.id,
          user_id: userId,
          external_message_id: externalMsgId || null,
          direction,
          sender_name: direction === "inbound" ? (contactName ?? null) : null,
          body,
          sent_at: sentAt,
        });

        newMessages++;
      }

      // Update message_count
      if (newMessages > 0) {
        await supabase
          .from("inbox_conversations")
          .update({
            message_count: (convoRow.message_count ?? 0) + newMessages,
            is_read: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", convoRow.id);
      }

      synced++;
    } catch (err) {
      console.error("LinkedIn sync: conversation error", err);
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET /api/inbox/sync/linkedin ─────────────────────────────────────────────
// Callable by: authenticated user (syncs their own accounts)
//              OR cron (x-cron-user-id header + CRON_SECRET bearer)

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isCron =
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`;

  let supabase: SupabaseClient;
  let userId: string | null = null;

  if (isCron) {
    supabase = createServiceClient();
    const rawUserId = request.headers.get("x-cron-user-id");
    // Validate that x-cron-user-id is a real UUID to prevent injection
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

  // Fetch active LinkedIn inbox accounts
  let query = supabase
    .from("inbox_accounts")
    .select("id, user_id, access_token_encrypted")
    .eq("provider", "linkedin")
    .eq("is_active", true);

  if (userId) query = query.eq("user_id", userId);

  const { data: accounts, error: accErr } = await query;
  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ message: "No active LinkedIn accounts", synced: 0 });
  }

  const results: Array<{ accountId: string; synced: number; errors: number; error?: string }> = [];

  for (const account of accounts) {
    // Safety: ensure account belongs to the requested user (guards against service-client cross-user access)
    if (userId && account.user_id !== userId) continue;

    if (!account.access_token_encrypted) {
      results.push({ accountId: account.id, synced: 0, errors: 0, error: "No API key stored" });
      continue;
    }

    try {
      const apiKey = decryptApiKey(account.access_token_encrypted);
      const { synced, errors } = await syncAccountConversations(
        supabase,
        account.id,
        account.user_id,
        apiKey
      );
      results.push({ accountId: account.id, synced, errors });
    } catch (err) {
      console.error("LinkedIn sync error for account", account.id, err);
      results.push({
        accountId: account.id,
        synced: 0,
        errors: 1,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const totalSynced = results.reduce((s, r) => s + r.synced, 0);
  return NextResponse.json({ synced: totalSynced, accounts: results.length, results });
}
