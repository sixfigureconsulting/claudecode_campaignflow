"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pause, ExternalLink, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CAMPAIGN_TYPE_CONFIG, getCampaignSubtype } from "@/components/campaigns/campaignTypes";

interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  project_type: string;
  reports: any[];
  sent: number;
  opens: number;
  openRate: number;
  replies: number;
  replyRate: number;
  pipeline: number;
  opportunities: number;
}

export function CampaignAnalyticsTable({ campaigns }: { campaigns: CampaignRow[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-base">Campaign analytics</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-muted-foreground text-sm">No campaigns yet</p>
          <Link href="/campaigns">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create your first campaign
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-base">Campaign analytics</h2>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            View all <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campaign</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prospects</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opened</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Replied</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opportunities</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {campaigns.map((campaign) => {
              const config = CAMPAIGN_TYPE_CONFIG[getCampaignSubtype(campaign)] ?? CAMPAIGN_TYPE_CONFIG.custom;
              return (
                <tr key={campaign.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${config.color}`}>
                        {campaign.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          className="font-medium hover:text-brand-600 transition-colors truncate block max-w-[220px]"
                        >
                          {campaign.name}
                        </Link>
                        <Badge variant="secondary" className="text-[10px] mt-0.5 font-normal">
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums">
                    {campaign.sent.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    <span className="font-semibold">{campaign.opens.toLocaleString()}</span>
                    {campaign.sent > 0 && (
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        {campaign.openRate.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    <span className="font-semibold">{campaign.replies.toLocaleString()}</span>
                    {campaign.sent > 0 && (
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        {campaign.replyRate.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    <span className="font-semibold">{campaign.opportunities}</span>
                    {campaign.pipeline > 0 && (
                      <span className="text-emerald-600 ml-1.5 text-xs font-medium">
                        {formatCurrency(campaign.pipeline)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/campaigns/${campaign.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </Link>
                      <Link href={`/campaigns/${campaign.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
