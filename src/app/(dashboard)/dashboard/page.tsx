import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { OutboundAreaChart } from "@/components/charts/OutboundAreaChart";
import { CampaignAnalyticsTable } from "@/components/dashboard/CampaignAnalyticsTable";
import { DashboardReports } from "@/components/dashboard/DashboardReports";
import { computeFunnelMetrics } from "@/lib/funnel";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaigns } = await supabase
    .from("projects")
    .select(`*, clients!inner(user_id), reports(*, report_metrics(*))`)
    .eq("clients.user_id", user.id)
    .order("created_at", { ascending: false });

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

  // Exclude system projects from display
  const allCampaigns = (campaigns ?? []).filter(
    (c: any) => c.name !== "__integrations__"
  );

  // ── Aggregate stats ──────────────────────────────────────────────────────────
  let totalSent = 0, totalTraffic = 0, totalRevenue = 0, totalSpend = 0;
  let totalReports = 0, totalCustom = 0;

  const campaignRows = allCampaigns.map((campaign: any) => {
    let sent = 0, opens = 0, replies = 0, pipeline = 0, opportunities = 0;

    (campaign.reports ?? []).forEach((report: any) => {
      totalReports++;
      const metrics = report.report_metrics ?? [];
      const funnel = computeFunnelMetrics(metrics);
      const leadsVal = metrics.filter((m: any) => m.metric_category === "leads").reduce((s: number, m: any) => s + m.metric_value, 0);
      const trafficVal = metrics.filter((m: any) => m.metric_category === "traffic").reduce((s: number, m: any) => s + m.metric_value, 0);
      const revenueVal = metrics.filter((m: any) => m.metric_category === "revenue").reduce((s: number, m: any) => s + m.metric_value, 0);
      const customVal = metrics.filter((m: any) => m.metric_category === "custom").reduce((s: number, m: any) => s + m.metric_value, 0);
      sent += leadsVal; opens += trafficVal; replies += customVal; pipeline += revenueVal;
      opportunities += funnel.customers;
      totalSent += leadsVal; totalTraffic += trafficVal; totalRevenue += revenueVal;
      totalSpend += funnel.spend; totalCustom += customVal;
    });

    return {
      ...campaign,
      sent,
      opens,
      openRate: sent > 0 ? (opens / sent) * 100 : 0,
      replies,
      replyRate: sent > 0 ? (replies / sent) * 100 : 0,
      pipeline,
      opportunities,
    };
  });

  const openRate = totalSent > 0 ? (totalTraffic / totalSent) * 100 : 0;
  const replyRate = totalSent > 0 ? (totalCustom / totalSent) * 100 : 0;
  const meetingsBooked = campaignRows.reduce((s: number, c: any) => s + c.opportunities, 0);

  const stats = {
    totalClients: allCampaigns.length,
    totalProjects: allCampaigns.length,
    totalReports,
    totalRevenue,
    totalLeads: totalSent,
    totalSpend,
    avgROI: replyRate,
    avgConversionRate: openRate,
    totalSent,
    openRate,
    replyRate,
    meetingsBooked,
  };

  // ── Time-series chart data ───────────────────────────────────────────────────
  const byDate: Record<string, { sent: number; opens: number; replies: number }> = {};
  allCampaigns.forEach((campaign: any) => {
    (campaign.reports ?? []).forEach((report: any) => {
      const dateKey = report.report_date?.slice(0, 10) ?? "";
      if (!dateKey) return;
      if (!byDate[dateKey]) byDate[dateKey] = { sent: 0, opens: 0, replies: 0 };
      const metrics = report.report_metrics ?? [];
      byDate[dateKey].sent += metrics.filter((m: any) => m.metric_category === "leads").reduce((s: number, m: any) => s + m.metric_value, 0);
      byDate[dateKey].opens += metrics.filter((m: any) => m.metric_category === "traffic").reduce((s: number, m: any) => s + m.metric_value, 0);
      byDate[dateKey].replies += metrics.filter((m: any) => m.metric_category === "custom").reduce((s: number, m: any) => s + m.metric_value, 0);
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
            Last {Math.min(chartData.length, 12)} reports
          </span>
        </div>
        <OutboundAreaChart data={chartData} />
      </div>

      {/* Campaign analytics table */}
      <CampaignAnalyticsTable campaigns={campaignRows} />

      {/* Reports — inline per campaign */}
      <DashboardReports campaigns={allCampaigns} isSubscribed={!!isSubscribed} />
    </div>
  );
}
