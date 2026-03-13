"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { FileText, Calendar } from "lucide-react";

export function RecentActivity({ clients }: { clients: any[] }) {
  // Flatten all reports from all clients/projects, sorted by created_at
  const allReports: Array<{
    id: string;
    name: string;
    report_date: string;
    report_type: string;
    clientName: string;
    clientId: string;
    projectName: string;
    projectId: string;
  }> = [];

  clients.forEach((client) => {
    (client.projects ?? []).forEach((project: any) => {
      (project.reports ?? []).forEach((report: any) => {
        allReports.push({
          id: report.id,
          name: report.name,
          report_date: report.report_date,
          report_type: report.report_type,
          clientName: client.name,
          clientId: client.id,
          projectName: project.name,
          projectId: project.id,
        });
      });
    });
  });

  const recent = allReports
    .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())
    .slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Reports</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No reports yet. Create a client and add a project to get started.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((report) => (
              <Link
                key={report.id}
                href={`/clients/${report.clientId}/projects/${report.projectId}/reports/${report.id}`}
                className="flex items-center gap-4 py-3 hover:bg-muted -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{report.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.clientName} → {report.projectName}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className="text-xs mb-1">
                    {report.report_type}
                  </Badge>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <Calendar className="h-3 w-3" />
                    {formatDate(report.report_date)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
