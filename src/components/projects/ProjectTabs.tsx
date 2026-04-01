"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { AddReportDialog } from "@/components/reports/AddReportDialog";
import { ReportsList } from "@/components/reports/ReportsList";
import { MetricsCharts } from "@/components/charts/MetricsCharts";
import { CampaignWorkflow } from "@/components/executions/CampaignWorkflow";
import { ExecutionHistory } from "@/components/executions/ExecutionHistory";
import { IntegrationConfigForm } from "@/components/integrations/IntegrationConfigForm";
import type { Execution } from "@/types/database";

type ServiceConfig = {
  service: string;
  masked_key: string;
  updated_at: string;
};

type ProjectTabsProps = {
  projectId: string;
  clientId: string;
  reports: any[];
  integrationConfigs: ServiceConfig[];
  executions: Execution[];
  hasAnthropicKey: boolean;
};

export function ProjectTabs({
  projectId,
  clientId,
  reports,
  integrationConfigs,
  executions,
}: ProjectTabsProps) {
  const hasKey = (service: string) => integrationConfigs.some((c) => c.service === service);

  return (
    <Tabs defaultValue="integrations" className="space-y-6">
      <TabsList className="flex gap-1 border-b border-border w-full pb-0">
        {["integrations", "actions", "reports"].map((tab) => (
          <TabsTrigger
            key={tab}
            value={tab}
            className="px-4 py-2 text-sm font-medium text-muted-foreground capitalize border-b-2 border-transparent data-[state=active]:border-brand-500 data-[state=active]:text-foreground transition-colors hover:text-foreground -mb-px"
          >
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* ── Integrations tab ── */}
      <TabsContent value="integrations" className="mt-0">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your tools. Keys are encrypted and stored per project.
          </p>
        </div>
        <IntegrationConfigForm projectId={projectId} existingConfigs={integrationConfigs} />
      </TabsContent>

      {/* ── Actions tab ── */}
      <TabsContent value="actions" className="space-y-6 mt-0">
        <div>
          <h2 className="text-lg font-semibold">Campaign Workflow</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Build and launch outbound campaigns in 5 steps — no Clay, no Make, no n8n required.
          </p>
        </div>
        <CampaignWorkflow
          projectId={projectId}
          hasApolloKey={hasKey("apollo")}
          hasOpenAIKey={hasKey("openai")}
          hasHeyreachKey={hasKey("heyreach")}
          hasInstantlyKey={hasKey("instantly")}
          hasHubSpotKey={hasKey("hubspot")}
          hasSlackKey={hasKey("slack")}
        />
        <ExecutionHistory executions={executions} />
      </TabsContent>

      {/* ── Reports tab ── */}
      <TabsContent value="reports" className="space-y-6 mt-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reports ({reports.length})</h2>
          <AddReportDialog projectId={projectId} />
        </div>
        {reports.length >= 2 && <MetricsCharts reports={reports} />}
        <ReportsList reports={reports} clientId={clientId} projectId={projectId} />
      </TabsContent>
    </Tabs>
  );
}
