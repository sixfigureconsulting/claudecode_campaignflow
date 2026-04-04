import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CampaignLead } from "@/types/database";

// GET /api/lists — fetch all lists for the current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("lead_lists")
    .select("id, name, source, lead_count, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lists: data ?? [] });
}

// POST /api/lists — create a new list with leads
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, source, leads } = await request.json() as {
    name: string;
    source?: string;
    leads: CampaignLead[];
  };

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!Array.isArray(leads) || leads.length === 0) return NextResponse.json({ error: "leads array is required" }, { status: 400 });

  // Create the list header
  const { data: list, error: listErr } = await supabase
    .from("lead_lists")
    .insert({ user_id: user.id, name: name.trim(), source: source ?? null, lead_count: leads.length })
    .select("id")
    .single();

  if (listErr || !list) return NextResponse.json({ error: listErr?.message ?? "Failed to create list" }, { status: 500 });

  // Insert contacts in batches of 500
  const rows = leads.map((l) => ({
    list_id: list.id,
    first_name: l.first_name ?? "",
    last_name: l.last_name ?? "",
    email: l.email ?? "",
    company: l.company ?? "",
    title: l.title ?? "",
    linkedin_url: l.linkedin_url ?? null,
    website: l.website ?? null,
    phone: l.phone ?? null,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error: insertErr } = await supabase
      .from("lead_list_contacts")
      .insert(rows.slice(i, i + 500));
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: list.id, lead_count: leads.length });
}
