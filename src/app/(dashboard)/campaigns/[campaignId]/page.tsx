import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { getCampaignSubtype, CAMPAIGN_TYPE_LABELS, getDisplayDescription } from "@/components/campaigns/campaignTypes";
import { CampaignWorkflow } from "@/components/executions/CampaignWorkflow";
import { ExecutionHistory } from "@/components/executions/ExecutionHistory";

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
    .select("*, clients!inner(user_id)")
    .eq("id", campaignId)
    .eq("clients.user_id", user.id)
    .single();

  if (!campaign) notFound();

  // Read which services are connected (global integrations project)
  let integrationConfigs: { service: string }[] = [];
  try {
    const { data: defaultClient } = await supabase
      .from("clients").select("id")
      .eq("user_id", user.id).eq("name", "__default__").single();

    if (defaultClient) {
      const { data: intProject } = await supabase
        .from("projects").select("id")
        .eq("client_id", defaultClient.id).eq("name", "__integrations__").single();

      if (intProject) {
        const { data: configs } = await supabase
          .from("integration_configs").select("service")
          .eq("project_id", intProject.id);
        integrationConfigs = configs ?? [];
      }
    }
  } catch {}

  const { data: executions } = await supabase
    .from("executions").select("*")
    .eq("project_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(20)
    .then((r) => ({ data: r.data ?? [] }));

  const hasKey = (s: string) => integrationConfigs.some((c) => c.service === s);
  const subtype = getCampaignSubtype(campaign);

  const typeLabel = CAMPAIGN_TYPE_LABELS[subtype] ?? subtype;

  return (
    <div className="space-y-8 animate-fade-in">
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
        <p className="text-sm text-muted-foreground mt-2">
          Build and run your outbound workflow below. View performance and reports on the{" "}
          <Link href="/dashboard" className="text-brand-600 hover:underline font-medium">Dashboard</Link>.
        </p>
      </div>

      {/* Workflow — full page, no tabs */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Outbound Workflow</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Run the 6-step pipeline — lead sourcing → qualify → exclusions → sequences → push → report.
          </p>
        </div>
        <CampaignWorkflow
          projectId={campaignId}
          campaignType={subtype}
          hasApolloKey={hasKey("apollo")}
          hasApifyKey={hasKey("apify")}
          hasOpenAIKey={hasKey("openai")}
          hasHeyreachKey={hasKey("heyreach")}
          hasInstantlyKey={hasKey("instantly")}
          hasHubSpotKey={hasKey("hubspot")}
          hasSlackKey={hasKey("slack")}
        />
      </div>

      {/* Execution history */}
      {executions && executions.length > 0 && (
        <ExecutionHistory executions={executions} />
      )}
    </div>
  );
}
