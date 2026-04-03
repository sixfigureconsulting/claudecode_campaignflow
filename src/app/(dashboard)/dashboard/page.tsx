import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { CampaignsOverview } from "@/components/dashboard/CampaignsOverview";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { DashboardFunnelChart } from "@/components/charts/DashboardFunnelChart";
import { computeFunnelMetrics } from "@/lib/funnel";
import type { DashboardStats as DashboardStatsType } from "@/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all campaigns owned by this user (via their clients)
  const { data: campaigns } = await supabase
    .from("projects")
    .select(`
      *,
      clients!inner(user_id),
      reports (
        *,
        report_metrics (*)
      )
    `)
    .eq("clients.user_id", user.id)
    .order("created_at", { ascending: false });

  // Compute aggregate stats
  let totalRevenue = 0;
  let totalLeads = 0;
  let totalSpend = 0;
  let totalROI = 0;
  let roiCount = 0;
  let totalReports = 0;

  (campaigns ?? []).forEach((campaign: any) => {
    (campaign.reports ?? []).forEach((report: any) => {
      totalReports++;
      const funnel = computeFunnelMetrics(report.report_metrics ?? []);
      totalRevenue += funnel.revenue;
      totalLeads += funnel.leads;
      totalSpend += funnel.spend;
      if (funnel.roi !== 0) { totalROI += funnel.roi; roiCount++; }
    });
  });

  const stats: DashboardStatsType = {
    totalClients: campaigns?.length ?? 0,
    totalProjects: campaigns?.length ?? 0,
    totalReports,
    totalRevenue,
    totalLeads,
    totalSpend,
    avgROI: roiCount > 0 ? totalROI / roiCount : 0,
    avgConversionRate: 0,
  };

  const revenueByName = (campaigns ?? []).map((c: any) => {
    let rev = 0;
    (c.reports ?? []).forEach((r: any) => {
      rev += computeFunnelMetrics(r.report_metrics ?? []).revenue;
    });
    return { name: c.name.slice(0, 14), revenue: rev };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Outbound performance overview
          </p>
        </div>
        <Link href="/campaigns">
          <Button variant="gradient" size="sm">
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <DashboardStats stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardFunnelChart data={revenueByName} />
        <CampaignsOverview campaigns={campaigns ?? []} />
      </div>

      <RecentActivity campaigns={campaigns ?? []} />
    </div>
  );
}
