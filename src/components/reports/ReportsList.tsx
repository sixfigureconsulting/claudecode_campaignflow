"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeFunnelMetrics } from "@/lib/funnel";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText, TrendingUp, Calendar, MoreVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "@/components/ui/toast";
import type { ReportWithMetrics } from "@/types";

interface ReportsListProps {
  reports: ReportWithMetrics[];
  clientId?: string;
  projectId: string;
}

export function ReportsList({ reports, clientId, projectId }: ReportsListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sorted = [...reports].sort(
    (a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/reports/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Report deleted", variant: "success" });
      setDeleteId(null);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ title: body.error ?? "Failed to delete report", variant: "destructive" });
    }
  };

  if (sorted.length === 0) {
    return (
      <div className="border-2 border-dashed border-border rounded-xl py-12 text-center">
        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">No reports yet.</p>
        <p className="text-muted-foreground text-xs mt-1">
          Create a report to start tracking metrics.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {sorted.map((report) => {
          const funnel = computeFunnelMetrics(report.report_metrics ?? []);
          const metricCount = report.report_metrics?.length ?? 0;

          return (
            <div key={report.id} className="relative group/row">
              <Link href={`/campaigns/${projectId}/reports/${report.id}`}>
                <Card className="hover:shadow-md hover:border-brand-200 transition-all cursor-pointer group">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-brand-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm group-hover:text-brand-600 transition-colors truncate">
                            {report.name}
                          </h3>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {report.report_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(report.report_date)}
                          </span>
                          <span>{metricCount} metric{metricCount !== 1 ? "s" : ""}</span>
                        </div>
                      </div>

                      {/* KPI summary */}
                      <div className="hidden sm:flex items-center gap-4 text-sm pr-8">
                        {funnel.revenue > 0 && (
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Revenue</p>
                            <p className="font-semibold text-green-600">{formatCurrency(funnel.revenue)}</p>
                          </div>
                        )}
                        {funnel.leads > 0 && (
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Leads</p>
                            <p className="font-semibold">{funnel.leads.toLocaleString()}</p>
                          </div>
                        )}
                        {funnel.roi !== 0 && (
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">ROI</p>
                            <p className={`font-semibold flex items-center gap-0.5 ${funnel.roi >= 0 ? "text-green-600" : "text-red-500"}`}>
                              <TrendingUp className="h-3 w-3" />
                              {funnel.roi.toFixed(1)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              {/* Actions menu */}
              <div
                className="absolute top-3 right-3 z-10"
                onClick={(e) => e.preventDefault()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/row:opacity-100 transition-opacity focus:opacity-100"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem
                      onSelect={() => setDeleteId(report.id)}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete report?"
        description="This will permanently delete the report and all its metrics and AI recommendations. This cannot be undone."
        onConfirm={handleDelete}
      />
    </>
  );
}
