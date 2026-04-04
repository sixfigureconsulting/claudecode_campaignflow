import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { ArrowLeft } from "lucide-react";
import { getCampaignSubtype, CAMPAIGN_TYPE_LABELS, getDisplayDescription } from "@/components/campaigns/campaignTypes";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("projects")
    .select("*, clients!inner(user_id), reports(*, report_metrics(*))")
    .eq("id", campaignId)
    .eq("clients.user_id", user.id)
    .single();

  if (!campaign) notFound();

  const { data: integrationConfigs } = await supabase
    .from("integration_configs")
    .select("service, masked_key:api_key_encrypted, updated_at")
    .eq("project_id", campaignId)
    .then((r) => ({ data: r.data ?? [] }));

  const { data: executions } = await supabase
    .from("executions")
    .select("*")
    .eq("project_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(20)
    .then((r) => ({ data: r.data ?? [] }));

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", user.id)
    .single();

  const isSubscribed =
    subscription?.status === "active" ||
    (subscription?.status === "trialing" &&
      subscription.trial_ends_at &&
      new Date(subscription.trial_ends_at) > new Date());

  const subtype = getCampaignSubtype(campaign);
  const typeLabel = CAMPAIGN_TYPE_LABELS[subtype] ?? subtype;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/campaigns" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{campaign.name}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{campaign.name}</h1>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge variant="secondary">{typeLabel}</Badge>
          {getDisplayDescription(campaign.description) && (
            <p className="text-sm text-muted-foreground">{getDisplayDescription(campaign.description)}</p>
          )}
        </div>
      </div>

      {/* Tabs: Integrations | Actions | Reports */}
      <ProjectTabs
        projectId={campaign.id}
        clientId=""
        reports={campaign.reports ?? []}
        integrationConfigs={integrationConfigs ?? []}
        executions={executions ?? []}
        hasAnthropicKey={false}
      />
    </div>
  );
}
