import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { ClientsOverview } from "@/components/dashboard/ClientsOverview";
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

  // Fetch all clients with nested data
  const { data: clients } = await supabase
    .from("clients")
    .select(`
      *,
      projects (
        *,
        reports (
          *,
          report_metrics (*)
        )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Compute aggregate stats
  let totalRevenue = 0;
  let totalLeads = 0;
  let totalSpend = 0;
  let totalROI = 0;
  let roiCount = 0;
  let totalConversionRate = 0;
  let conversionCount = 0;
  let totalReports = 0;
  let totalProjects = 0;

  const allMetrics: Array<{ name: string; value: number; category: string }> = [];

  (clients ?? []).forEach((client: any) => {
    (client.projects ?? []).forEach((project: any) => {
      totalProjects++;
      (project.reports ?? []).forEach((report: any) => {
        totalReports++;
        const metrics = report.report_metrics ?? [];
        const funnel = computeFunnelMetrics(metrics);

        totalRevenue += funnel.revenue;
        totalLeads += funnel.leads;
        totalSpend += funnel.spend;

        if (funnel.roi !== 0) {
          totalROI += funnel.roi;
          roiCount++;
        }
        if (funnel.overallConversionRate > 0) {
          totalConversionRate += funnel.overallConversionRate;
          conversionCount++;
        }

        metrics.forEach((m: any) => {
          allMetrics.push({ name: m.metric_name, value: m.metric_value, category: m.metric_category });
        });
      });
    });
  });

  const stats: DashboardStatsType = {
    totalClients: clients?.length ?? 0,
    totalProjects,
    totalReports,
    totalRevenue,
    totalLeads,
    totalSpend,
    avgROI: roiCount > 0 ? totalROI / roiCount : 0,
    avgConversionRate: conversionCount > 0 ? totalConversionRate / conversionCount : 0,
  };

  // Build chart data: aggregate revenue by client
  const revenueByClient = (clients ?? []).map((client: any) => {
    let rev = 0;
    (client.projects ?? []).forEach((p: any) => {
      (p.reports ?? []).forEach((r: any) => {
        const f = computeFunnelMetrics(r.report_metrics ?? []);
        rev += f.revenue;
      });
    });
    return { name: client.name.slice(0, 12), revenue: rev };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Performance overview across all clients
          </p>
        </div>
        <Link href="/clients">
          <Button variant="gradient" size="sm">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </Link>
      </div>

      {/* KPI stats */}
      <DashboardStats stats={stats} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardFunnelChart data={revenueByClient} />
        <ClientsOverview clients={clients ?? []} />
      </div>

      {/* Recent activity */}
      <RecentActivity clients={clients ?? []} />
    </div>
  );
}
