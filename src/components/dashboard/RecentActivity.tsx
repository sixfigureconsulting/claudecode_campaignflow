"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { FileText, Calendar } from "lucide-react";

export function RecentActivity({ campaigns }: { campaigns: any[] }) {
  const allReports: Array<{
    id: string;
    name: string;
    report_date: string;
    report_type: string;
    campaignName: string;
    campaignId: string;
  }> = [];

  campaigns.forEach((campaign) => {
    (campaign.reports ?? []).forEach((report: any) => {
      allReports.push({
        id: report.id,
        name: report.name,
        report_date: report.report_date,
        report_type: report.report_type,
        campaignName: campaign.name,
        campaignId: campaign.id,
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
            No reports yet. Create a campaign and add a report to get started.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((report) => (
              <Link
                key={report.id}
                href={`/campaigns/${report.campaignId}/reports/${report.id}`}
                className="flex items-center gap-4 py-3 hover:bg-muted -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{report.name}</p>
                  <p className="text-xs text-muted-foreground">{report.campaignName}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className="text-xs mb-1">{report.report_type}</Badge>
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
