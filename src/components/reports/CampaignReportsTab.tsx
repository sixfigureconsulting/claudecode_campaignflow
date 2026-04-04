"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddReportDialog } from "@/components/reports/AddReportDialog";
import { FunnelVisualization } from "@/components/charts/FunnelVisualization";
import { MetricsList } from "@/components/reports/MetricsList";
import { CSVUploadSection } from "@/components/reports/CSVUploadSection";
import { ManualMetricsForm } from "@/components/reports/ManualMetricsForm";
import { SyncReportCard } from "@/components/reports/SyncReportCard";
import { AIRecommendationSection } from "@/components/ai/AIRecommendationSection";
import { computeFunnelMetrics } from "@/lib/funnel";
import { formatDate } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "@/components/ui/toast";
import { FileText, Calendar, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { ReportWithMetrics } from "@/types";

interface CampaignReportsTabProps {
  projectId: string;
  reports: ReportWithMetrics[];
  isSubscribed: boolean;
  hasInstantly?: boolean;
  hasSmartlead?: boolean;
}

function ReportRow({
  report,
  projectId,
  hasInstantly,
  hasSmartlead,
  isSubscribed,
}: {
  report: ReportWithMetrics;
  projectId: string;
  isSubscribed: boolean;
  hasInstantly?: boolean;
  hasSmartlead?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [aiRec, setAiRec] = useState<any>(null);
  const [loadedAi, setLoadedAi] = useState(false);
  const router = useRouter();

  const metrics = report.report_metrics ?? [];
  const funnelMetrics = computeFunnelMetrics(metrics);
  const customMetrics = metrics.filter((m: any) => m.metric_category === "custom");

  const handleExpand = async () => {
    if (!expanded && !loadedAi) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("ai_recommendations")
          .select("*")
          .eq("report_id", report.id)
          .eq("user_id", user.id)
          .single();
        setAiRec(data ?? null);
      }
      setLoadedAi(true);
    }
    setExpanded((v) => !v);
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/reports/${report.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Report deleted", variant: "success" });
      setDeleteOpen(false);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ title: body.error ?? "Failed to delete report", variant: "destructive" });
    }
  };

  return (
    <>
      <Card className={`transition-all ${expanded ? "border-brand-200 shadow-sm" : "hover:border-brand-200 hover:shadow-sm"}`}>
        <CardContent className="p-0">
          {/* Header row — always visible */}
          <button
            className="w-full text-left p-4 flex items-center gap-4 group"
            onClick={handleExpand}
          >
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-brand-600" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-medium text-sm group-hover:text-brand-600 transition-colors truncate">
                  {report.name}
                </h3>
                <Badge variant="outline" className="text-xs shrink-0">{report.report_type}</Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(report.report_date)}
                <span className="ml-2">{metrics.length} metric{metrics.length !== 1 ? "s" : ""}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {metrics.length > 0 && funnelMetrics.leads > 0 && (
                <div className="hidden sm:block text-right">
                  <p className="text-xs text-muted-foreground">Leads</p>
                  <p className="text-sm font-semibold">{funnelMetrics.leads.toLocaleString()}</p>
                </div>
              )}
              <button
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-red-50 rounded-md transition-colors"
                onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {expanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              }
            </div>
          </button>

          {/* Expanded content */}
          {expanded && (
            <div className="px-4 pb-6 space-y-6 border-t border-border pt-4">
              {/* Add metrics — 3 ways */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SyncReportCard
                  reportId={report.id}
                  hasInstantly={!!hasInstantly}
                  hasSmartlead={!!hasSmartlead}
                />
                <CSVUploadSection reportId={report.id} />
                <ManualMetricsForm reportId={report.id} />
              </div>

              {/* Funnel & metrics */}
              {metrics.length > 0 && (
                <>
                  <FunnelVisualization metrics={funnelMetrics} customMetrics={customMetrics} />
                  <MetricsList metrics={metrics} reportId={report.id} />
                </>
              )}

              {/* AI Recommendations */}
              {loadedAi && (
                <AIRecommendationSection
                  reportId={report.id}
                  hasMetrics={metrics.length > 0}
                  isSubscribed={isSubscribed}
                  existingRecommendation={aiRec}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete report?"
        description="This will permanently delete the report and all its metrics and AI recommendations."
        onConfirm={handleDelete}
      />
    </>
  );
}

export function CampaignReportsTab({ projectId, reports, isSubscribed, hasInstantly, hasSmartlead }: CampaignReportsTabProps) {
  const sorted = [...reports].sort(
    (a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reports ({reports.length})</h2>
        <AddReportDialog projectId={projectId} />
      </div>

      {sorted.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No reports yet.</p>
          <p className="text-muted-foreground text-xs mt-1">Add a report to start tracking metrics.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              projectId={projectId}
              hasInstantly={hasInstantly}
              hasSmartlead={hasSmartlead}
              isSubscribed={isSubscribed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
