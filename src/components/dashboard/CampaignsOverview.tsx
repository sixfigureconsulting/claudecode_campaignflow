"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { computeFunnelMetrics } from "@/lib/funnel";
import { ArrowRight, Plus } from "lucide-react";
import { CAMPAIGN_TYPE_CONFIG, getCampaignSubtype } from "@/components/campaigns/campaignTypes";

export function CampaignsOverview({ campaigns }: { campaigns: any[] }) {
  const enriched = campaigns.slice(0, 5).map((campaign) => {
    let totalRevenue = 0;
    let totalReports = 0;
    (campaign.reports ?? []).forEach((r: any) => {
      totalReports++;
      totalRevenue += computeFunnelMetrics(r.report_metrics ?? []).revenue;
    });
    return { ...campaign, totalRevenue, totalReports };
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Campaigns</CardTitle>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm">
            View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {enriched.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">No campaigns yet</p>
            <Link href="/campaigns">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Create your first campaign
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {enriched.map((campaign) => {
              const config = CAMPAIGN_TYPE_CONFIG[getCampaignSubtype(campaign)] ?? CAMPAIGN_TYPE_CONFIG.custom;
              return (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${config.color}`}>
                    {campaign.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.totalReports} report{campaign.totalReports !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    {campaign.totalRevenue > 0 && (
                      <p className="text-sm font-semibold">{formatCurrency(campaign.totalRevenue)}</p>
                    )}
                    <Badge variant="secondary" className="text-xs">{config.label}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
