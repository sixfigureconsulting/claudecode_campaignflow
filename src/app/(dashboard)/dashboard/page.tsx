import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { OutboundAreaChart } from "@/components/charts/OutboundAreaChart";
import { CampaignAnalyticsTable } from "@/components/dashboard/CampaignAnalyticsTable";
import { DashboardReports } from "@/components/dashboard/DashboardReports";
import { SocialCampaignCards } from "@/components/dashboard/SocialCampaignCards";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Dashboard" };

// ── Keyword-based metric detection ─────────────────────────────────────────
// Matches metric names regardless of which category the user picked
function metricSum(metrics: any[], keywords: string[]): number {
  return metrics
    .filter((m: any) => keywords.some((kw) => m.metric_name.toLowerCase().includes(kw)))
    .reduce((s: number, m: any) => s + (m.metric_value ?? 0), 0);
}

const SENT_KW    = ["sent", "email sent", "cold email", "emails sent", "outreach", "contacted", "sequence"];
const OPEN_KW    = ["open", "opened", "view"];
const REPLY_KW   = ["repl", "response", "responded"];
const MEETING_KW = ["book", "booked", "meeting", "demo", "call", "scheduled", "appointment"];
const REVENUE_KW = ["revenue", "pipeline", "deal won", "won", "closed", "arr", "mrr", "value"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaigns } = await supabase
    .from("projects")
    .select(`*, clients!inner(user_id), reports(*, report_metrics(*))`)
    .eq("clients.user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: socialCampaigns } = await supabase
    .from("social_campaigns")
    .select("id, name, channel, status, total_leads, sent_count, reply_count, failed_count, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", user.id)
    .single();

  const isSubscribed =
    subscription?.status === "active" ||
    (subscription?.status === "trialing" &&
      subscription.trial_ends_at &&
      new Date(subscription.trial_ends_at) > new Date());

  // Exclude hidden system projects (include __standalone__ so its reports count in totals)
  const allCampaigns = (campaigns ?? []).filter(
    (c: any) => c.name !== "__integrations__" && c.name !== "__default__" && c.clients?.name !== "__default__"
  );

  // Check which email sync tools are connected
  let hasInstantly = false;
  let hasSmartlead = false;
  try {
    const { data: defaultClient } = await supabase
      .from("clients").select("id")
      .eq("user_id", user.id).eq("name", "__default__").single();
    if (defaultClient) {
      const { data: intProject } = await supabase
        .from("projects").select("id")
        .eq("client_id", defaultClient.id).eq("name", "__integrations__").single();
      if (intProject) {
        const { data: configs } = await supabase
          .from("integration_configs").select("service")
          .eq("project_id", intProject.id);
        hasInstantly = (configs ?? []).some((c: any) => c.service === "instantly");
        hasSmartlead = (configs ?? []).some((c: any) => c.service === "smartlead");
      }
    }
  } catch {}

  // ── Aggregate stats ──────────────────────────────────────────────────────────
  let totalSent = 0, totalOpens = 0, totalReplies = 0, totalMeetings = 0, totalRevenue = 0;
  let totalReports = 0;

  const campaignRows = allCampaigns.map((campaign: any) => {
    let sent = 0, opens = 0, replies = 0, meetings = 0, pipeline = 0;

    (campaign.reports ?? []).forEach((report: any) => {
      totalReports++;
      const metrics = report.report_metrics ?? [];

      const s = metricSum(metrics, SENT_KW);
      const o = metricSum(metrics, OPEN_KW);
      const r = metricSum(metrics, REPLY_KW);
      const m = metricSum(metrics, MEETING_KW);
      const rev = metricSum(metrics, REVENUE_KW);

      sent += s; opens += o; replies += r; meetings += m; pipeline += rev;
      totalSent += s; totalOpens += o; totalReplies += r; totalMeetings += m; totalRevenue += rev;
    });

    return {
      ...campaign,
      sent,
      opens,
      openRate: sent > 0 ? Math.min((opens / sent) * 100, 100) : 0,
      replies,
      replyRate: sent > 0 ? Math.min((replies / sent) * 100, 100) : 0,
      pipeline,
      opportunities: meetings,
    };
  });

  const openRate  = totalSent > 0 ? Math.min((totalOpens   / totalSent) * 100, 100) : 0;
  const replyRate = totalSent > 0 ? Math.min((totalReplies / totalSent) * 100, 100) : 0;

  const stats = {
    totalClients: allCampaigns.length,
    totalProjects: allCampaigns.length,
    totalReports,
    totalRevenue,
    totalLeads: totalSent,
    totalSpend: 0,
    avgROI: replyRate,
    avgConversionRate: openRate,
    totalSent,
    openRate,
    replyRate,
    meetingsBooked: totalMeetings,
  };

  // ── Time-series chart data ───────────────────────────────────────────────────
  const byDate: Record<string, { sent: number; opens: number; replies: number }> = {};
  allCampaigns.forEach((campaign: any) => {
    (campaign.reports ?? []).forEach((report: any) => {
      const dateKey = report.report_date?.slice(0, 10) ?? "";
      if (!dateKey) return;
      if (!byDate[dateKey]) byDate[dateKey] = { sent: 0, opens: 0, replies: 0 };
      const metrics = report.report_metrics ?? [];
      byDate[dateKey].sent    += metricSum(metrics, SENT_KW);
      byDate[dateKey].opens   += metricSum(metrics, OPEN_KW);
      byDate[dateKey].replies += metricSum(metrics, REPLY_KW);
    });
  });

  const chartData = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([date, vals]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...vals,
    }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Outbound performance overview</p>
        </div>
        <Link href="/campaigns">
          <Button variant="gradient" size="sm">
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Metric cards */}
      <DashboardStats stats={stats} />

      {/* Area chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Activity over time</h2>
          <span className="text-xs text-muted-foreground border border-border rounded-md px-2.5 py-1">
            Last {Math.min(chartData.length, 12)} report{chartData.length !== 1 ? "s" : ""}
          </span>
        </div>
        <OutboundAreaChart data={chartData} />
      </div>

      {/* Campaign analytics table */}
      <CampaignAnalyticsTable campaigns={campaignRows} />

      {/* Social campaign channel cards */}
      <SocialCampaignCards campaigns={socialCampaigns ?? []} />

      {/* Reports — inline per campaign */}
      <DashboardReports
        campaigns={allCampaigns}
        isSubscribed={!!isSubscribed}
        hasInstantly={hasInstantly}
        hasSmartlead={hasSmartlead}
      />
    </div>
  );
}
