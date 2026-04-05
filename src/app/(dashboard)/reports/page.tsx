import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewStandaloneReportDialog } from "@/components/reports/NewStandaloneReportDialog";
import { ReportsListClient } from "@/components/reports/ReportsListClient";
import { FileBarChart2 } from "lucide-react";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all reports across all user campaigns (excluding hidden system projects)
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, name, clients!inner(user_id, name), reports(id, name, report_type, report_date, report_metrics(id), ai_recommendations(id))")
    .eq("clients.user_id", user.id)
    .neq("name", "__integrations__")
    .order("created_at", { ascending: false });

  // Flatten reports, annotate with campaign name and whether standalone
  const reports: import("@/components/reports/ReportsListClient").ReportRow[] = [];
  for (const project of allProjects ?? []) {
    const isStandalone = project.name === "__standalone__";
    for (const report of (project.reports ?? []) as any[]) {
      reports.push({
        id: report.id,
        name: report.name,
        report_type: report.report_type,
        report_date: report.report_date,
        projectId: project.id,
        campaignName: isStandalone ? "Standalone" : project.name,
        isStandalone,
        metricsCount: (report.report_metrics ?? []).length,
        hasAI: (report.ai_recommendations ?? []).length > 0,
      });
    }
  }

  // Sort by date descending
  reports.sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All reports across your campaigns — or create a standalone report from any outbound tool.
          </p>
        </div>
        <NewStandaloneReportDialog />
      </div>

      {reports.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl py-16 text-center">
          <FileBarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No reports yet</p>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">
            Create a campaign and sync your outbound data, or create a standalone report to analyze any Instantly, HeyReach, Smartlead, or Lemlist campaign.
          </p>
        </div>
      ) : (
        <ReportsListClient initialReports={reports} />
      )}
    </div>
  );
}
