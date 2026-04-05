"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DeleteReportButton } from "@/components/reports/DeleteReportButton";
import { formatDate } from "@/lib/utils";
import { BarChart2, Calendar, Sparkles } from "lucide-react";

export type ReportRow = {
  id: string;
  name: string;
  report_type: string;
  report_date: string;
  projectId: string;
  campaignName: string;
  isStandalone: boolean;
  metricsCount: number;
  hasAI: boolean;
};

export function ReportsListClient({ initialReports }: { initialReports: ReportRow[] }) {
  const [reports, setReports] = useState(initialReports);

  const handleDeleted = (reportId: string) =>
    setReports((prev) => prev.filter((r) => r.id !== reportId));

  return (
    <div className="space-y-2">
      {reports.map((report) => (
        <div key={report.id} className="relative group">
          <Link
            href={`/campaigns/${report.projectId}/reports/${report.id}`}
            className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-brand-300 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
              <BarChart2 className="h-4 w-4 text-brand-600" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm group-hover:text-brand-600 transition-colors truncate">
                  {report.name}
                </span>
                <Badge variant="outline" className="text-xs shrink-0">{report.report_type}</Badge>
                {report.isStandalone && (
                  <Badge variant="secondary" className="text-xs shrink-0">Standalone</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(report.report_date)}
                </span>
                {!report.isStandalone && (
                  <span className="truncate">{report.campaignName}</span>
                )}
                <span>{report.metricsCount} metric{report.metricsCount !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {report.hasAI && (
              <div className="flex items-center gap-1 text-xs text-brand-600 shrink-0 mr-2">
                <Sparkles className="h-3.5 w-3.5" />
                AI report
              </div>
            )}
          </Link>

          {/* Delete button — only standalone reports, sits outside Link to avoid nav */}
          {report.isStandalone && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <DeleteReportButton
                reportId={report.id}
                reportName={report.name}
                onDeleted={handleDeleted}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
