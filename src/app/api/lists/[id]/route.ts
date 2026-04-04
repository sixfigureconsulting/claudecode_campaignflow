import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/lists/[id] — fetch a single list with all its leads
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: list, error: listErr } = await supabase
    .from("lead_lists")
    .select("id, name, source, lead_count, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (listErr || !list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  const { data: contacts, error: contactsErr } = await supabase
    .from("lead_list_contacts")
    .select("first_name, last_name, email, company, title, linkedin_url, website, phone")
    .eq("list_id", id)
    .order("created_at", { ascending: true });

  if (contactsErr) return NextResponse.json({ error: contactsErr.message }, { status: 500 });

  return NextResponse.json({ list, leads: contacts ?? [] });
}

// DELETE /api/lists/[id] — delete a list and its contacts
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS ensures only owner can delete
  const { error } = await supabase
    .from("lead_lists")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
