"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignReportsTab } from "@/components/reports/CampaignReportsTab";
import { CAMPAIGN_TYPE_CONFIG, getCampaignSubtype } from "@/components/campaigns/campaignTypes";
import { cn } from "@/lib/utils";

interface DashboardReportsProps {
  campaigns: any[];
  isSubscribed: boolean;
  hasInstantly?: boolean;
  hasSmartlead?: boolean;
}

function CampaignReportSection({
  campaign,
  isSubscribed,
  hasInstantly,
  hasSmartlead,
}: {
  campaign: any;
  isSubscribed: boolean;
  hasInstantly?: boolean;
  hasSmartlead?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const config = CAMPAIGN_TYPE_CONFIG[getCampaignSubtype(campaign)] ?? CAMPAIGN_TYPE_CONFIG.custom;
  const reportCount = campaign.reports?.length ?? 0;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Campaign header row */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0", config.color)}>
          {campaign.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{campaign.name}</p>
          <p className="text-xs text-muted-foreground">
            {config.label} · {reportCount} report{reportCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/campaigns/${campaign.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-muted-foreground hover:text-brand-600 transition-colors px-2 py-1 rounded hover:bg-muted"
          >
            Open workflow
          </Link>
          {open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </button>

      {/* Reports — inline expansion */}
      {open && (
        <div className="border-t border-border px-5 py-5 bg-muted/10">
          <CampaignReportsTab
            projectId={campaign.id}
            reports={campaign.reports ?? []}
            isSubscribed={isSubscribed}
            hasInstantly={hasInstantly}
            hasSmartlead={hasSmartlead}
          />
        </div>
      )}
    </div>
  );
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
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <CampaignReportSection
              key={campaign.id}
              campaign={campaign}
              isSubscribed={isSubscribed}
              hasInstantly={hasInstantly}
              hasSmartlead={hasSmartlead}
            />
          ))}
        </div>
      )}
    </div>
  );
}
