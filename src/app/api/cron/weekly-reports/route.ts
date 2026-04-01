import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateCampaignReport } from "@/lib/reports/generateCampaignReport";

/**
 * Weekly cron job — called by Vercel Cron every Monday at 9am UTC.
 * Finds all campaign_runs where next_stats_pull_at <= now() and generates reports.
 *
 * Protected by CRON_SECRET env var.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find all campaign runs due for a report pull
  const { data: dueCampaigns, error } = await supabase
    .from("campaign_runs")
    .select("id, project_id, instantly_campaign_id")
    .lte("next_stats_pull_at", new Date().toISOString())
    .not("instantly_campaign_id", "is", null);

  if (error) {
    console.error("Cron: failed to fetch due campaigns", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dueCampaigns || dueCampaigns.length === 0) {
    return NextResponse.json({ message: "No campaigns due for reporting", processed: 0 });
  }

  const results: Array<{ campaignRunId: string; success: boolean; error?: string }> = [];

  for (const run of dueCampaigns) {
    try {
      await generateCampaignReport({
        campaignRunId: run.id,
        notify: true, // Send email + Slack on weekly auto-reports
      });
      results.push({ campaignRunId: run.id, success: true });
    } catch (err) {
      console.error(`Cron: failed for campaign run ${run.id}`, err);
      results.push({
        campaignRunId: run.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`Cron: processed ${successCount}/${results.length} campaign reports`);

  return NextResponse.json({
    message: `Processed ${successCount}/${results.length} campaign reports`,
    results,
  });
}
