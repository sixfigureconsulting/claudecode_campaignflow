import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/inbox/conversations/[id] — fetch conversation + messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: convo, error } = await supabase
    .from("inbox_conversations")
    .select(`
      *,
      inbox_accounts ( id, provider, account_label, email ),
      inbox_messages ( id, direction, sender_name, sender_email, body, body_html, sent_at )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .order("sent_at", { referencedTable: "inbox_messages", ascending: true })
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Mark as read
  await supabase
    .from("inbox_conversations")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ conversation: convo });
}

// PATCH /api/inbox/conversations/[id] — mark read/archived/blocked
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.is_read     === "boolean") updates.is_read     = body.is_read;
  if (typeof body.is_archived === "boolean") updates.is_archived = body.is_archived;
  if (typeof body.is_blocked  === "boolean") updates.is_blocked  = body.is_blocked;

  const { error } = await supabase
    .from("inbox_conversations")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
