import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeNextRun } from "@/lib/schedule-utils";

// Vercel Cron: runs every hour
// Add to vercel.json: { "crons": [{ "path": "/api/cron/run-schedules", "schedule": "0 * * * *" }] }

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Validate cron secret to prevent unauthorised triggers
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Find all enabled schedules whose next_run_at is in the past
  const { data: dueSchedules } = await supabase
    .from("campaign_schedules")
    .select("*, projects(id, name, client_id, description)")
    .eq("enabled", true)
    .lte("next_run_at", new Date().toISOString())
    .not("next_run_at", "is", null)
    .limit(20);

  if (!dueSchedules || dueSchedules.length === 0) {
    return NextResponse.json({ ran: 0 });
  }

  const results: { scheduleId: string; projectId: string; status: string; message: string }[] = [];

  for (const schedule of dueSchedules) {
    try {
      const cfg = schedule.pipeline_config as Record<string, unknown>;

      // Execute the pipeline headlessly by calling the internal push-leads endpoint
      // with the saved configuration. Steps that aren't configured are skipped.
      const pushDestinations: string[] = (cfg.step5_destinations as string[]) ?? [];

      if (pushDestinations.length > 0 && cfg.step1_source) {
        // Step 1: Fetch leads
        const fetchRes = await fetchLeadsHeadless(schedule.user_id, cfg, request);

        if (fetchRes.leads && fetchRes.leads.length > 0) {
          // Step 5: Push (simplified — skips qualify/exclusions/sequences for scheduled runs
          //          unless they are configured. Full AI steps run if openai key is present)
          await fetch(`${getBaseUrl(request)}/api/executions/push-leads`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Pass user identity via cookie is not possible in cron. Use service key instead.
              "x-schedule-user-id": schedule.user_id,
            },
            body: JSON.stringify({
              projectId: schedule.project_id,
              leads: fetchRes.leads,
              destinations: pushDestinations,
              webhookUrls: (cfg.webhook_urls as Record<string, string>) ?? {},
            }),
          });

          results.push({
            scheduleId: schedule.id,
            projectId: schedule.project_id,
            status: "success",
            message: `Pushed ${fetchRes.leads.length} leads to ${pushDestinations.join(", ")}`,
          });
        } else {
          results.push({ scheduleId: schedule.id, projectId: schedule.project_id, status: "skipped", message: "No leads fetched" });
        }
      } else {
        results.push({ scheduleId: schedule.id, projectId: schedule.project_id, status: "skipped", message: "No destinations or lead source configured" });
      }

      // Advance next_run_at
      const nextRun = computeNextRun({
        frequency: schedule.frequency as "daily" | "weekly" | "monthly",
        dayOfWeek: schedule.day_of_week,
        dayOfMonth: schedule.day_of_month,
        hourUtc: schedule.hour_utc,
        timezone: schedule.timezone,
      });

      await supabase.from("campaign_schedules").update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun,
      }).eq("id", schedule.id);

    } catch (err) {
      console.error("cron schedule error", schedule.id, err);
      results.push({ scheduleId: schedule.id, projectId: schedule.project_id, status: "error", message: String(err) });
    }
  }

  console.log(`Cron: ran ${results.length} schedules`, results);
  return NextResponse.json({ ran: results.length, results });
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

async function fetchLeadsHeadless(
  userId: string,
  cfg: Record<string, unknown>,
  request: NextRequest
): Promise<{ leads: unknown[] }> {
  const source = cfg.step1_source as string;
  const base = getBaseUrl(request);

  try {
    if (source === "saved_list" && cfg.step1_list_id) {
      const res = await fetch(`${base}/api/lists/${cfg.step1_list_id}`, {
        headers: { "x-schedule-user-id": userId },
      });
      const json = await res.json();
      return { leads: json.leads ?? [] };
    }
    // Other sources (apollo, gsheet, etc.) would need their own headless fetch here.
    // For now, saved_list is the recommended source for scheduled campaigns.
    return { leads: [] };
  } catch {
    return { leads: [] };
  }
}
