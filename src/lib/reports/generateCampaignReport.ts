import { createServiceClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/encryption";
import { sendCampaignReportEmail } from "@/lib/email/resend";
import { postReportToSlack } from "@/lib/notifications/slack";

export type InstantlyStats = {
  campaign_name: string;
  emails_sent: number;
  open_count: number;
  reply_count: number;
  bounce_count: number;
  open_rate: number;
  reply_rate: number;
  bounce_rate: number;
};

export async function fetchInstantlyStats(
  campaignId: string,
  apiKey: string
): Promise<InstantlyStats | null> {
  try {
    // Fetch campaign details for name
    const [nameRes, analyticsRes] = await Promise.all([
      fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}/analytics`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    ]);

    const nameData = nameRes.ok ? await nameRes.json() : {};
    const analytics = analyticsRes.ok ? await analyticsRes.json() : {};

    const emails_sent = analytics.total_leads_contacted ?? analytics.emails_sent ?? 0;
    const open_count = analytics.total_opened ?? analytics.open_count ?? 0;
    const reply_count = analytics.total_replied ?? analytics.reply_count ?? 0;
    const bounce_count = analytics.total_bounced ?? analytics.bounce_count ?? 0;

    return {
      campaign_name: nameData.name ?? "Campaign",
      emails_sent,
      open_count,
      reply_count,
      bounce_count,
      open_rate: emails_sent > 0 ? (open_count / emails_sent) * 100 : 0,
      reply_rate: emails_sent > 0 ? (reply_count / emails_sent) * 100 : 0,
      bounce_rate: emails_sent > 0 ? (bounce_count / emails_sent) * 100 : 0,
    };
  } catch {
    return null;
  }
}

type GenerateReportOptions = {
  campaignRunId: string;
  /** If provided, also sends email + Slack */
  notify?: boolean;
  /** Manual override stats (skips Instantly API fetch) */
  manualStats?: Partial<InstantlyStats>;
};

export async function generateCampaignReport({
  campaignRunId,
  notify = false,
  manualStats,
}: GenerateReportOptions) {
  const supabase = createServiceClient();

  // Load campaign run + project + client + user
  const { data: run } = await supabase
    .from("campaign_runs")
    .select(`
      *,
      projects!inner(
        id, name, client_id,
        clients!inner(id, name, user_id)
      )
    `)
    .eq("id", campaignRunId)
    .single();

  if (!run) throw new Error("Campaign run not found");

  const project = run.projects as any;
  const client = project.clients as any;
  const userId: string = client.user_id;

  // Get Instantly API key for this project
  const { data: keyRow } = await supabase
    .from("integration_configs")
    .select("api_key_encrypted")
    .eq("project_id", project.id)
    .eq("service", "instantly")
    .single();

  let stats: InstantlyStats | null = null;

  if (manualStats) {
    const emails_sent = manualStats.emails_sent ?? run.leads_pushed ?? 0;
    const open_count = manualStats.open_count ?? 0;
    const reply_count = manualStats.reply_count ?? 0;
    const bounce_count = manualStats.bounce_count ?? 0;
    stats = {
      campaign_name: manualStats.campaign_name ?? "Campaign",
      emails_sent,
      open_count,
      reply_count,
      bounce_count,
      open_rate: emails_sent > 0 ? (open_count / emails_sent) * 100 : 0,
      reply_rate: emails_sent > 0 ? (reply_count / emails_sent) * 100 : 0,
      bounce_rate: emails_sent > 0 ? (bounce_count / emails_sent) * 100 : 0,
    };
  } else if (keyRow && run.instantly_campaign_id) {
    const apiKey = decryptApiKey(keyRow.api_key_encrypted);
    stats = await fetchInstantlyStats(run.instantly_campaign_id, apiKey);
  }

  if (!stats) throw new Error("Could not fetch campaign stats");

  const weekOf = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Create report in the reports table
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      project_id: project.id,
      name: `${stats.campaign_name} — Week of ${weekOf}`,
      report_type: "weekly",
      report_date: new Date().toISOString().slice(0, 10),
      notes: `Auto-generated from Instantly campaign "${stats.campaign_name}". ${stats.emails_sent} emails sent, ${stats.reply_rate.toFixed(1)}% reply rate.`,
    })
    .select()
    .single();

  if (reportError || !report) throw new Error(`Failed to create report: ${reportError?.message}`);

  // Insert report metrics
  const metrics = [
    { metric_name: "Emails Sent", metric_value: stats.emails_sent, metric_category: "leads", display_order: 1 },
    { metric_name: "Emails Opened", metric_value: stats.open_count, metric_category: "leads", display_order: 2 },
    { metric_name: "Replies", metric_value: stats.reply_count, metric_category: "leads", display_order: 3 },
    { metric_name: "Bounces", metric_value: stats.bounce_count, metric_category: "leads", display_order: 4 },
    { metric_name: "Open Rate %", metric_value: Math.round(stats.open_rate * 10) / 10, metric_category: "custom", display_order: 5 },
    { metric_name: "Reply Rate %", metric_value: Math.round(stats.reply_rate * 10) / 10, metric_category: "custom", display_order: 6 },
  ];

  await supabase.from("report_metrics").insert(
    metrics.map((m) => ({ ...m, report_id: report.id }))
  );

  // Link report back to campaign run
  await supabase
    .from("campaign_runs")
    .update({
      report_id: report.id,
      last_stats_pulled_at: new Date().toISOString(),
      next_stats_pull_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignRunId);

  // Send notifications if requested
  if (notify) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const projectUrl = `${appUrl}/clients/${client.id}/projects/${project.id}`;

    // Get user email
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    const userEmail = user?.email;
    const userName = user?.user_metadata?.full_name ?? userEmail?.split("@")[0] ?? "there";

    // Get Slack webhook if configured
    const { data: slackRow } = await supabase
      .from("integration_configs")
      .select("api_key_encrypted")
      .eq("project_id", project.id)
      .eq("service", "slack")
      .single();

    const notifyPayload = {
      campaignName: stats.campaign_name,
      clientName: client.name,
      projectName: project.name,
      weekOf,
      stats: {
        leads_count: run.leads_pushed ?? 0,
        emails_sent: stats.emails_sent,
        open_count: stats.open_count,
        reply_count: stats.reply_count,
        bounce_count: stats.bounce_count,
        open_rate: stats.open_rate,
        reply_rate: stats.reply_rate,
        bounce_rate: stats.bounce_rate,
        new_leads_contacted: run.leads_pushed ?? 0,
      },
      projectUrl,
    };

    const tasks: Promise<void>[] = [];

    if (userEmail) {
      tasks.push(
        sendCampaignReportEmail({
          to: userEmail,
          userName,
          ...notifyPayload,
        }).catch(console.error)
      );
    }

    if (slackRow) {
      const webhookUrl = decryptApiKey(slackRow.api_key_encrypted);
      tasks.push(
        postReportToSlack(webhookUrl, notifyPayload).catch(console.error)
      );
    }

    await Promise.all(tasks);
  }

  return { reportId: report.id, stats };
}
