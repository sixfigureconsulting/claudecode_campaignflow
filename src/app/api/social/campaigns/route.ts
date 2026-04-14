import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/social/campaigns — list the user's social campaigns
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("social_campaigns")
    .select("id, name, channel, status, list_id, message_config, schedule_config, total_leads, sent_count, reply_count, failed_count, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}

// POST /api/social/campaigns — create a new social campaign and populate leads
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    name: string;
    channel: string;
    list_id: string;
    message_config: Record<string, unknown>;
    schedule_config: Record<string, unknown>;
  };

  const { name, channel, list_id, message_config, schedule_config } = body;

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!channel) return NextResponse.json({ error: "channel is required" }, { status: 400 });
  if (!list_id) return NextResponse.json({ error: "list_id is required" }, { status: 400 });

  // Verify the list belongs to this user
  const { data: list, error: listErr } = await supabase
    .from("lead_lists")
    .select("id, lead_count")
    .eq("id", list_id)
    .eq("user_id", user.id)
    .single();

  if (listErr || !list) {
    return NextResponse.json({ error: "Lead list not found" }, { status: 404 });
  }

  // Create the campaign
  const { data: campaign, error: campErr } = await supabase
    .from("social_campaigns")
    .insert({
      user_id: user.id,
      name: name.trim(),
      channel,
      list_id,
      message_config: message_config ?? {},
      schedule_config: schedule_config ?? {},
      total_leads: list.lead_count,
      status: "draft",
    })
    .select("id")
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({ error: campErr?.message ?? "Failed to create campaign" }, { status: 500 });
  }

  // Copy contacts from the lead list into social_campaign_leads
  const { data: contacts, error: contactsErr } = await supabase
    .from("lead_list_contacts")
    .select("first_name, last_name, email, company, title, linkedin_url")
    .eq("list_id", list_id)
    .limit(500); // Cap at 500 for now — batch processing for larger lists TBD

  if (contactsErr) {
    return NextResponse.json({ error: contactsErr.message }, { status: 500 });
  }

  if (contacts && contacts.length > 0) {
    const leadRows = contacts.map((c) => ({
      campaign_id: campaign.id,
      user_id: user.id,
      first_name: c.first_name ?? "",
      last_name: c.last_name ?? "",
      email: c.email ?? "",
      company: c.company ?? "",
      title: c.title ?? "",
      linkedin_url: c.linkedin_url ?? null,
    }));

    const { error: insertErr } = await supabase
      .from("social_campaign_leads")
      .insert(leadRows);

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: campaign.id, total_leads: contacts?.length ?? 0 }, { status: 201 });
}
