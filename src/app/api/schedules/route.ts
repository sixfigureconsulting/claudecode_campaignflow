import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeNextRun } from "@/lib/schedule-utils";

// GET /api/schedules?projectId=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { data } = await supabase
    .from("campaign_schedules")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ schedules: data ?? [] });
}

// POST /api/schedules — create or update schedule for a project
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { projectId, frequency, dayOfWeek, dayOfMonth, hourUtc, timezone, pipelineConfig, enabled } = body;

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const nextRun = frequency !== "manual"
    ? computeNextRun({ frequency, dayOfWeek, dayOfMonth, hourUtc: hourUtc ?? 9, timezone: timezone ?? "UTC" })
    : null;

  // Upsert: one schedule per project
  const { data: existing } = await supabase
    .from("campaign_schedules")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  const record = {
    project_id: projectId,
    user_id: user.id,
    frequency: frequency ?? "manual",
    day_of_week: dayOfWeek ?? null,
    day_of_month: dayOfMonth ?? null,
    hour_utc: hourUtc ?? 9,
    timezone: timezone ?? "UTC",
    pipeline_config: pipelineConfig ?? {},
    next_run_at: nextRun,
    enabled: enabled ?? true,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("campaign_schedules")
      .update(record)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedule: data });
  } else {
    const { data, error } = await supabase
      .from("campaign_schedules")
      .insert(record)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedule: data });
  }
}
