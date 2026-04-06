import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { getCampaignSubtype, CAMPAIGN_TYPE_LABELS, getDisplayDescription } from "@/components/campaigns/campaignTypes";
import { CampaignWorkflow } from "@/components/executions/CampaignWorkflow";
import { CampaignScheduler } from "@/components/executions/CampaignScheduler";
import { ExecutionHistory } from "@/components/executions/ExecutionHistory";

export const metadata: Metadata = { title: "Workflow" };

export default async function CampaignWorkflowPage({
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

  // Get the report (if any) so we can link back to it
  const { data: existingReports } = await supabase
    .from("reports")
    .select("id")
    .eq("project_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1);

  const reportId = existingReports?.[0]?.id ?? null;

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

  const CALLING_PLATFORM_IDS = ["retell", "vapi", "bland", "synthflow", "air", "twilio"];
  const connectedCallingServices = CALLING_PLATFORM_IDS.filter(hasKey);

  const subtype = getCampaignSubtype(campaign);
  const typeLabel = CAMPAIGN_TYPE_LABELS[subtype] ?? subtype;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/campaigns" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Campaigns
        </Link>
        <span>/</span>
        {reportId ? (
          <Link href={`/campaigns/${campaignId}/reports/${reportId}`} className="hover:text-foreground">
            {campaign.name}
          </Link>
        ) : (
          <span className="text-foreground font-medium">{campaign.name}</span>
        )}
        <span>/</span>
        <span className="text-foreground font-medium">Workflow</span>
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
        {reportId && (
          <p className="text-sm text-muted-foreground mt-2">
            Running a new workflow will update your{" "}
            <Link href={`/campaigns/${campaignId}/reports/${reportId}`} className="text-brand-600 hover:underline font-medium">
              campaign report
            </Link>.
          </p>
        )}
      </div>

      {/* Workflow */}
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
          hasHunterKey={hasKey("hunter")}
          hasPhantomBusterKey={hasKey("phantombuster")}
          hasSmartleadKey={hasKey("smartlead")}
          hasLemlistKey={hasKey("lemlist")}
          hasSlackKey={hasKey("slack")}
          connectedCallingServices={connectedCallingServices}
        />
      </div>

      {/* Campaign Schedule */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Automation & Schedule</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set it and forget it — configure a schedule and CampaignFlow runs the pipeline automatically.
          </p>
        </div>
        <CampaignScheduler projectId={campaignId} />
      </div>

      {executions && executions.length > 0 && (
        <ExecutionHistory executions={executions} />
      )}
    </div>
  );
}
