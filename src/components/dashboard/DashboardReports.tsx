"use client";

import Link from "next/link";
import { ChevronRight, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CAMPAIGN_TYPE_CONFIG, getCampaignSubtype } from "@/components/campaigns/campaignTypes";
import { cn } from "@/lib/utils";

interface DashboardReportsProps {
  campaigns: any[];
  isSubscribed: boolean;
  hasInstantly?: boolean;
  hasSmartlead?: boolean;
}

export function DashboardReports({ campaigns, isSubscribed, hasInstantly, hasSmartlead }: DashboardReportsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track metrics and get AI insights across all campaigns.
          </p>
        </div>
        <Link href="/campaigns">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Campaign
          </Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl py-14 text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-medium">No campaigns yet</p>
          <p className="text-muted-foreground text-xs mt-1">Create a campaign to start tracking reports.</p>
          <Link href="/campaigns" className="mt-4 inline-block">
            <Button variant="gradient" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create your first campaign
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign) => {
            const config = CAMPAIGN_TYPE_CONFIG[getCampaignSubtype(campaign)] ?? CAMPAIGN_TYPE_CONFIG.custom;
            const reports = campaign.reports ?? [];
            const firstReportId = reports[0]?.id ?? null;
            const href = firstReportId
              ? `/campaigns/${campaign.id}/reports/${firstReportId}`
              : `/campaigns/${campaign.id}/workflow`;

            return (
              <Link
                key={campaign.id}
                href={href}
                className="flex items-center gap-3 px-5 py-4 border border-border rounded-xl hover:bg-muted/30 hover:border-brand-200 transition-all group"
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0", config.color)}>
                  {campaign.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate group-hover:text-brand-600 transition-colors">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {config.label} · {reports.length} report{reports.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-brand-600 transition-colors shrink-0">
                  {firstReportId ? "View report" : "Open workflow"}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-600 transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
