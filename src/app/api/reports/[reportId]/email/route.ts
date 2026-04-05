import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendCampaignReportEmail } from "@/lib/email/resend";
import { postReportToSlack } from "@/lib/notifications/slack";
import { decryptApiKey } from "@/lib/encryption";

// Keyword helpers (same as dashboard)
function metricSum(metrics: any[], keywords: string[]): number {
  return metrics
    .filter((m: any) => keywords.some((kw) => m.metric_name.toLowerCase().includes(kw)))
    .reduce((s: number, m: any) => s + (m.metric_value ?? 0), 0);
}

const SENT_KW    = ["sent", "email sent", "cold email", "emails sent", "outreach", "contacted", "sequence"];
const OPEN_KW    = ["open", "opened", "view", "unique open"];
const REPLY_KW   = ["repl", "response", "responded"];
const MEETING_KW = ["book", "booked", "meeting", "demo", "call", "scheduled"];
const BOUNCE_KW  = ["bounce", "bounced"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch report + metrics + campaign (verify ownership via RLS)
    const { data: report } = await supabase
      .from("reports")
      .select(`
        *,
        report_metrics(*),
        projects!inner(
          id, name,
          clients!inner(id, name, user_id)
        )
      `)
      .eq("id", reportId)
      .single();

    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const project = (report as any).projects;
    const client = project.clients;
    if (client.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const metrics = (report as any).report_metrics ?? [];

    // Compute stats from metrics using keyword matching
    const emails_sent  = metricSum(metrics, SENT_KW);
    const open_count   = metricSum(metrics, OPEN_KW);
    const reply_count  = metricSum(metrics, REPLY_KW);
    const bounce_count = metricSum(metrics, BOUNCE_KW);
    const meetings     = metricSum(metrics, MEETING_KW);

    const open_rate   = emails_sent > 0 ? (open_count   / emails_sent) * 100 : 0;
    const reply_rate  = emails_sent > 0 ? (reply_count  / emails_sent) * 100 : 0;
    const bounce_rate = emails_sent > 0 ? (bounce_count / emails_sent) * 100 : 0;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://campaignflowpro.com";
    const reportUrl = `${appUrl}/campaigns/${project.id}/reports/${reportId}`;
    const campaignName = project.name === "__standalone__" ? report.name : project.name;
    const weekOf = new Date(report.report_date).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });

    // Send email
    await sendCampaignReportEmail({
      to: user.email!,
      userName: user.email!.split("@")[0],
      projectName: project.name === "__standalone__" ? "Standalone Report" : project.name,
      clientName: client.name === "__standalone__" ? "Standalone" : client.name,
      campaignName,
      weekOf,
      stats: {
        leads_count: emails_sent,
        emails_sent,
        open_count,
        reply_count,
        bounce_count,
        open_rate,
        reply_rate,
        bounce_rate,
        new_leads_contacted: emails_sent,
      },
      projectUrl: reportUrl,
    });

    // Post to Slack if connected
    let slackSent = false;
    try {
      const { data: defaultClient } = await supabase
        .from("clients").select("id")
        .eq("user_id", user.id).eq("name", "__default__").single();
      if (defaultClient) {
        const { data: intProject } = await supabase
          .from("projects").select("id")
          .eq("client_id", defaultClient.id).eq("name", "__integrations__").single();
        if (intProject) {
          const { data: slackConfig } = await supabase
            .from("integration_configs").select("api_key_encrypted")
            .eq("project_id", intProject.id).eq("service", "slack").single();
          if (slackConfig) {
            const webhookUrl = decryptApiKey(slackConfig.api_key_encrypted);
            await postReportToSlack(webhookUrl, {
              campaignName,
              clientName: client.name === "__standalone__" ? "Standalone" : client.name,
              projectName: project.name === "__standalone__" ? "Standalone Report" : project.name,
              weekOf,
              stats: { emails_sent, open_rate, reply_rate, bounce_rate, reply_count },
              projectUrl: reportUrl,
            });
            slackSent = true;
          }
        }
      }
    } catch {
      // Slack is optional — don't fail the whole request
    }

    return NextResponse.json({ success: true, emailSent: true, slackSent });
  } catch (err: any) {
    console.error("Send report email error:", err);
    return NextResponse.json({ error: err.message ?? "Failed to send email" }, { status: 500 });
  }
}
