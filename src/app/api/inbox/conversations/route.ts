import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/inbox/conversations
// Query params: filter=all|prospect|not_prospect|warmup|unread|archived
//               account_id, page, limit
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const filter = sp.get("filter") ?? "all";
  const accountId = sp.get("account_id");
  const page = parseInt(sp.get("page") ?? "0");
  const limit = Math.min(parseInt(sp.get("limit") ?? "50"), 100);

  let query = supabase
    .from("inbox_conversations")
    .select(`
      id, account_id, subject, contact_name, contact_email, contact_company,
      contact_linkedin_url, classification, classification_reason, classification_score,
      is_read, is_archived, is_blocked, last_message_at, message_count, created_at,
      inbox_accounts ( provider, account_label, email )
    `)
    .eq("user_id", user.id)
    .eq("is_blocked", false)
    .order("last_message_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (accountId) query = query.eq("account_id", accountId);

  switch (filter) {
    case "prospect":     query = query.eq("classification", "prospect").eq("is_archived", false); break;
    case "not_prospect": query = query.eq("classification", "not_prospect").eq("is_archived", false); break;
    case "warmup":       query = query.eq("classification", "warmup").eq("is_archived", false); break;
    case "unread":       query = query.eq("is_read", false).eq("is_archived", false); break;
    case "archived":     query = query.eq("is_archived", true); break;
    default:             query = query.eq("is_archived", false); break;
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

// POST /api/inbox/conversations — manually create a conversation (e.g. from form webhook)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { account_id, contact_name, contact_email, contact_company, subject, message_body } = body;

  if (!account_id || !message_body) {
    return NextResponse.json({ error: "account_id and message_body are required" }, { status: 400 });
  }

  // Verify account belongs to user
  const { data: account } = await supabase
    .from("inbox_accounts")
    .select("id")
    .eq("id", account_id)
    .eq("user_id", user.id)
    .single();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const { data: convo, error: convoErr } = await supabase
    .from("inbox_conversations")
    .insert({
      user_id: user.id,
      account_id,
      subject: subject ?? null,
      contact_name: contact_name ?? null,
      contact_email: contact_email ?? null,
      contact_company: contact_company ?? null,
      classification: "unclassified",
      message_count: 1,
    })
    .select("id")
    .single();

  if (convoErr) return NextResponse.json({ error: convoErr.message }, { status: 500 });

  await supabase.from("inbox_messages").insert({
    conversation_id: convo.id,
    user_id: user.id,
    direction: "inbound",
    sender_name: contact_name ?? null,
    sender_email: contact_email ?? null,
    body: message_body,
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ conversation_id: convo.id }, { status: 201 });
}
