import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/schedules/[id] — toggle enabled or update next_run
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await request.json();

  // Whitelist allowed fields — prevent mass-assignment of user_id, project_id, etc.
  const allowed: Record<string, unknown> = {};
  if (raw.enabled !== undefined)          allowed.enabled = Boolean(raw.enabled);
  if (raw.next_run_at !== undefined)      allowed.next_run_at = raw.next_run_at;
  if (raw.hour_utc !== undefined)         allowed.hour_utc = Number(raw.hour_utc);
  if (raw.frequency !== undefined)        allowed.frequency = raw.frequency;
  if (raw.day_of_week !== undefined)      allowed.day_of_week = raw.day_of_week;
  if (raw.day_of_month !== undefined)     allowed.day_of_month = raw.day_of_month;
  if (raw.timezone !== undefined)         allowed.timezone = raw.timezone;
  if (raw.pipeline_config !== undefined)  allowed.pipeline_config = raw.pipeline_config;

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("campaign_schedules")
    .update(allowed)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

// DELETE /api/schedules/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("campaign_schedules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
