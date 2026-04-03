"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Mail, Linkedin, Layers, Phone, MoreVertical, Pencil, Trash2, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "@/components/ui/toast";
import { CAMPAIGN_TYPE_CONFIG, getCampaignSubtype, getDisplayDescription } from "./campaignTypes";
import { AddCampaignDialog } from "./AddCampaignDialog";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  cold_email: <Mail className="h-5 w-5" />,
  linkedin: <Linkedin className="h-5 w-5" />,
  multi_channel: <Layers className="h-5 w-5" />,
  cold_call: <Phone className="h-5 w-5" />,
  custom: <FileText className="h-5 w-5" />,
};

export function CampaignsList({ campaigns }: { campaigns: any[] }) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/projects/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Campaign deleted", variant: "success" });
      setDeleteId(null);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ title: body.error ?? "Failed to delete campaign", variant: "destructive" });
    }
  };

  if (campaigns.length === 0) {
    return (
      <div className="border-2 border-dashed border-border rounded-xl py-16 text-center">
        <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">No campaigns yet</p>
        <p className="text-muted-foreground text-sm mt-1 mb-5">
          Create your first outbound campaign to get started.
        </p>
        <AddCampaignDialog />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((campaign) => {
          const subtype = getCampaignSubtype(campaign);
          const config = CAMPAIGN_TYPE_CONFIG[subtype] ?? CAMPAIGN_TYPE_CONFIG.custom;
          const icon = TYPE_ICONS[subtype] ?? TYPE_ICONS.custom;
          const reportCount = campaign.reports?.length ?? 0;

          return (
            <div key={campaign.id} className="relative group/card">
              <Link href={`/campaigns/${campaign.id}`}>
                <Card className="h-full hover:shadow-md hover:border-brand-200 transition-all cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.color}`}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0 pr-7">
                        <h3 className="font-semibold text-sm leading-snug group-hover:text-brand-600 transition-colors truncate">
                          {campaign.name}
                        </h3>
                        <Badge variant="secondary" className="mt-1.5 text-xs">
                          {config.label}
                        </Badge>
                      </div>
                    </div>

                    {getDisplayDescription(campaign.description) && (
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                        {getDisplayDescription(campaign.description)}
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        {reportCount} report{reportCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <div className="absolute top-3 right-3 z-10" onClick={(e) => e.preventDefault()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/card:opacity-100 transition-opacity focus:opacity-100"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setDeleteId(campaign.id)}
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
        title="Delete campaign?"
        description="This will permanently delete the campaign and all its reports, metrics, and execution history. This cannot be undone."
        onConfirm={handleDelete}
      />
    </>
  );
}
