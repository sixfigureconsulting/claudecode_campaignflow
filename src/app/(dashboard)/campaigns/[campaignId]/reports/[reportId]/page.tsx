import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MetricsList } from "@/components/reports/MetricsList";
import { SyncReportCard, type SyncTool } from "@/components/reports/SyncReportCard";
import { SendReportEmailButton } from "@/components/reports/SendReportEmailButton";
import { AIRecommendationSection } from "@/components/ai/AIRecommendationSection";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { OutboundAreaChart } from "@/components/charts/OutboundAreaChart";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Calendar, AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Report" };

// ── Keyword helpers (same as dashboard) ─────────────────────────────────────
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

// Admin gets lifetime access to all features
// Matches the account visible in the app header
const isAdminUser = (email: string | undefined) =>
  !!email && (
    email.toLowerCase().includes("sixfigure") ||
    email.toLowerCase().startsWith("ankit@") ||
    email.toLowerCase().includes("ankit")
  );

export default async function ReportPage({
  params,
}: {
  params: Promise<{ campaignId: string; reportId: string }>;
}) {
  const { campaignId, reportId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Fetch this campaign's report ────────────────────────────────────────────
  const { data: report } = await supabase
    .from("reports")
    .select(`*, report_metrics(*), projects!inner(id, name, project_type, clients!inner(user_id))`)
    .eq("id", reportId)
    .eq("project_id", campaignId)
    .single();

  if (!report || (report as any).projects.clients.user_id !== user.id) notFound();

  const campaign = (report as any).projects;
  const metrics = report.report_metrics ?? [];

  // ── Fetch connected outbound tools ───────────────────────────────────────
  const SYNC_TOOLS: SyncTool[] = ["instantly", "smartlead", "heyreach", "lemlist"];
  let connectedTools: SyncTool[] = [];
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
        const connected = new Set((configs ?? []).map((c: any) => c.service));
        connectedTools = SYNC_TOOLS.filter((t) => connected.has(t));
      }
    }
  } catch {}

  // ── Fetch all campaigns to compute global totals ─────────────────────────
  const { data: allCampaigns } = await supabase
    .from("projects")
    .select("id, clients!inner(user_id), reports(report_metrics(*))")
    .eq("clients.user_id", user.id)
    .neq("name", "__integrations__")
    .neq("name", "__default__");

  // ── Compute this campaign's stats ────────────────────────────────────────
  const campSent     = metricSum(metrics, SENT_KW);
  const campOpens    = metricSum(metrics, OPEN_KW);
  const campReplies  = metricSum(metrics, REPLY_KW);
  const campMeetings = metricSum(metrics, MEETING_KW);
  const campRevenue  = metricSum(metrics, REVENUE_KW);

  const campOpenRate  = campSent > 0 ? Math.min((campOpens   / campSent) * 100, 100) : 0;
  const campReplyRate = campSent > 0 ? Math.min((campReplies / campSent) * 100, 100) : 0;

  const campaignStats = {
    totalClients: 1, totalProjects: 1, totalReports: 1, totalLeads: campSent,
    totalSpend: 0, avgROI: campReplyRate, avgConversionRate: campOpenRate,
    totalSent: campSent, openRate: campOpenRate, replyRate: campReplyRate,
    meetingsBooked: campMeetings, totalRevenue: campRevenue,
  };

  // ── Compute global totals for "% of total" banner ───────────────────────
  let globalSent = 0, globalMeetings = 0, globalRevenue = 0, globalReplies = 0;
  (allCampaigns ?? []).forEach((c: any) => {
    (c.reports ?? []).forEach((r: any) => {
      const m = r.report_metrics ?? [];
      globalSent     += metricSum(m, SENT_KW);
      globalReplies  += metricSum(m, REPLY_KW);
      globalMeetings += metricSum(m, MEETING_KW);
      globalRevenue  += metricSum(m, REVENUE_KW);
    });
  });

  const pctSent     = globalSent     > 0 ? Math.round((campSent     / globalSent)     * 100) : 100;
  const pctReplies  = globalReplies  > 0 ? Math.round((campReplies  / globalReplies)  * 100) : 100;
  const pctMeetings = globalMeetings > 0 ? Math.round((campMeetings / globalMeetings) * 100) : 100;

  // ── Chart data for this campaign ─────────────────────────────────────────
  const dateKey = report.report_date?.slice(0, 10) ?? "";
  const chartData = dateKey ? [{
    date: new Date(dateKey).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    sent: campSent, opens: campOpens, replies: campReplies,
  }] : [];

  // ── AI + subscription ─────────────────────────────────────────────────────
  const isAdmin = isAdminUser(user.email);

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", user.id)
    .single();

  const isSubscribed = isAdmin ||
    subscription?.status === "active" ||
    (subscription?.status === "trialing" &&
      subscription.trial_ends_at &&
      new Date(subscription.trial_ends_at) > new Date());

  const { data: aiRecommendation } = await supabase
    .from("ai_recommendations")
    .select("*")
    .eq("report_id", reportId)
    .eq("user_id", user.id)
    .single();

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/reports" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Reports
        </Link>
        {campaign.name !== "__standalone__" && (
          <>
            <span>/</span>
            <Link href={`/campaigns/${campaignId}`} className="hover:text-foreground">
              {campaign.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-foreground font-medium">{report.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{report.name}</h1>
            <Badge variant="outline">{report.report_type}</Badge>
            {campaign.name === "__standalone__" && (
              <Badge variant="secondary">Standalone</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(report.report_date)}
            {campaign.name !== "__standalone__" && ` · ${campaign.name}`}
          </p>
          {report.notes && (
            <p className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border">
              {report.notes}
            </p>
          )}
        </div>
      </div>

      {/* Campaign contribution banner */}
      {metrics.length > 0 && campSent > 0 && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-5 py-4 flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Share of total outreach</p>
            <p className="text-2xl font-bold text-brand-700">{pctSent}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">of all emails sent</p>
          </div>
          {campReplies > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Share of replies</p>
              <p className="text-2xl font-bold text-brand-700">{pctReplies}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">of total replies</p>
            </div>
          )}
          {campMeetings > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Share of meetings</p>
              <p className="text-2xl font-bold text-brand-700">{pctMeetings}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">of meetings booked</p>
            </div>
          )}
        </div>
      )}

      {/* Stats cards */}
      {metrics.length > 0 && (
        <>
          <DashboardStats stats={campaignStats} />

          {/* Activity chart */}
          {chartData.length > 0 && campSent > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Activity over time</h2>
                <span className="text-xs text-muted-foreground border border-border rounded-md px-2.5 py-1">
                  {formatDate(report.report_date)}
                </span>
              </div>
              <OutboundAreaChart data={chartData} />
            </div>
          )}

          {/* Weekly campaign stats */}
          {metrics.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Weekly Campaign Stats</h2>
              <MetricsList metrics={metrics} reportId={reportId} />
            </div>
          )}
        </>
      )}

      {/* Not-synced warning */}
      {connectedTools.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <span>
            <strong>Data may not be accurate</strong> — this campaign is not synced with any outbound tool (Instantly, Smartlead, HeyReach, or Lemlist).
            Metrics are entered manually.{" "}
            <a href="/settings" className="underline font-medium">Connect a tool in Settings</a> to pull live data.
          </span>
        </div>
      )}

      {/* Sync metrics + Email */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sync Metrics</h2>
          <SyncReportCard reportId={reportId} connectedTools={connectedTools} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Send Report</h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Email this report to yourself (and Slack if connected). The weekly cron auto-sends every Monday for workflow campaigns.
            </p>
            <SendReportEmailButton reportId={reportId} hasMetrics={metrics.length > 0} />
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <AIRecommendationSection
        reportId={reportId}
        hasMetrics={metrics.length > 0}
        isSubscribed={isSubscribed}
        existingRecommendation={aiRecommendation}
      />
    </div>
  );
}
