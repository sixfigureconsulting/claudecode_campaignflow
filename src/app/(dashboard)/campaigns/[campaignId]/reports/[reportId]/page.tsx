import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FunnelVisualization } from "@/components/charts/FunnelVisualization";
import { MetricsList } from "@/components/reports/MetricsList";
import { CSVUploadSection } from "@/components/reports/CSVUploadSection";
import { ManualMetricsForm } from "@/components/reports/ManualMetricsForm";
import { AIRecommendationSection } from "@/components/ai/AIRecommendationSection";
import { computeFunnelMetrics } from "@/lib/funnel";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Calendar } from "lucide-react";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage({
  params,
}: {
  params: Promise<{ campaignId: string; reportId: string }>;
}) {
  const { campaignId, reportId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: report } = await supabase
    .from("reports")
    .select(`
      *,
      report_metrics(*),
      projects!inner(id, name, project_type, clients!inner(user_id))
    `)
    .eq("id", reportId)
    .eq("project_id", campaignId)
    .single();

  if (!report || (report as any).projects.clients.user_id !== user.id) notFound();

  const campaign = (report as any).projects;
  const metrics = report.report_metrics ?? [];
  const funnelMetrics = computeFunnelMetrics(metrics);
  const customMetrics = metrics.filter((m: any) => m.metric_category === "custom");

  const { data: aiRecommendation } = await supabase
    .from("ai_recommendations")
    .select("*")
    .eq("report_id", reportId)
    .eq("user_id", user.id)
    .single();

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

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/campaigns" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Campaigns
        </Link>
        <span>/</span>
        <Link href={`/campaigns/${campaignId}`} className="hover:text-foreground">
          {campaign.name}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{report.name}</span>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">{report.name}</h1>
          <Badge variant="outline">{report.report_type}</Badge>
        </div>
        <p className="text-muted-foreground text-sm flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(report.report_date)} · {campaign.name}
        </p>
        {report.notes && (
          <p className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border">
            {report.notes}
          </p>
        )}
      </div>

      {/* Add metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CSVUploadSection reportId={reportId} />
        <ManualMetricsForm reportId={reportId} />
      </div>

      {/* Funnel & metrics */}
      {metrics.length > 0 && (
        <>
          <FunnelVisualization metrics={funnelMetrics} customMetrics={customMetrics} />
          <MetricsList metrics={metrics} reportId={reportId} />
        </>
      )}

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
