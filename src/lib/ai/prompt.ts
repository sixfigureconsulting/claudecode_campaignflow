import type { Client, Project, ReportWithMetrics, FunnelMetrics } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/funnel";

export interface PromptContext {
  client: Client;
  project: Project;
  currentReport: ReportWithMetrics;
  previousReport?: ReportWithMetrics | null;
  funnelMetrics: FunnelMetrics;
  previousFunnelMetrics?: FunnelMetrics | null;
}

/**
 * Builds the structured system + user prompt for AI analysis.
 * Returns { system, user } for both OpenAI and Anthropic compatibility.
 */
export function buildRecommendationPrompt(ctx: PromptContext): {
  system: string;
  user: string;
} {
  const { client, project, currentReport, previousReport, funnelMetrics, previousFunnelMetrics } = ctx;

  const system = `You are a world-class marketing performance analyst and growth strategist. You specialize in diagnosing funnel inefficiencies, identifying revenue bottlenecks, and providing precise, actionable marketing recommendations.

You communicate in a clear, direct, data-driven style. You avoid vague advice. Every recommendation must be tied directly to the data provided.

Your analysis follows this exact JSON structure (return ONLY valid JSON, no markdown code fences, no preamble):
{
  "executive_summary": "2-3 sentence summary of overall performance",
  "kpi_analysis": "Detailed paragraph analyzing each key KPI and what it means for the business",
  "weakest_metric": "The single most critical underperforming metric",
  "bottleneck_explanation": "Paragraph explaining the primary bottleneck and its root cause",
  "action_steps": [
    "Step 1: Specific tactical action",
    "Step 2: Specific tactical action",
    "Step 3: Specific tactical action",
    "Step 4: Specific tactical action",
    "Step 5: Specific tactical action"
  ],
  "strategic_improvements": [
    "Strategic improvement 1",
    "Strategic improvement 2",
    "Strategic improvement 3"
  ]
}`;

  const metricsSection = currentReport.report_metrics
    .map((m) => `  - ${m.metric_name}: ${m.metric_value} (${m.metric_category})`)
    .join("\n");

  const funnelSection = `
FUNNEL PERFORMANCE:
  Traffic: ${funnelMetrics.traffic.toLocaleString()}
  Leads: ${funnelMetrics.leads.toLocaleString()}
  Opportunities: ${funnelMetrics.opportunities.toLocaleString()}
  Customers: ${funnelMetrics.customers.toLocaleString()}

CONVERSION RATES:
  Traffic → Lead: ${formatPercent(funnelMetrics.trafficToLeadRate)}
  Lead → Opportunity: ${formatPercent(funnelMetrics.leadToOpportunityRate)}
  Opportunity → Customer: ${formatPercent(funnelMetrics.opportunityToCustomerRate)}
  Overall Conversion: ${formatPercent(funnelMetrics.overallConversionRate, 4)}

FINANCIAL METRICS:
  Total Revenue: ${formatCurrency(funnelMetrics.revenue)}
  Total Spend: ${formatCurrency(funnelMetrics.spend)}
  Cost per Lead (CPL): ${funnelMetrics.cpl > 0 ? formatCurrency(funnelMetrics.cpl) : "N/A"}
  Customer Acquisition Cost (CAC): ${funnelMetrics.cac > 0 ? formatCurrency(funnelMetrics.cac) : "N/A"}
  Return on Investment (ROI): ${funnelMetrics.roi !== 0 ? formatPercent(funnelMetrics.roi) : "N/A"}
  Return on Ad Spend (ROAS): ${funnelMetrics.roas > 0 ? `${funnelMetrics.roas.toFixed(2)}x` : "N/A"}
  Average Order Value: ${funnelMetrics.avgOrderValue > 0 ? formatCurrency(funnelMetrics.avgOrderValue) : "N/A"}
  Revenue per Lead: ${funnelMetrics.revenuePerLead > 0 ? formatCurrency(funnelMetrics.revenuePerLead) : "N/A"}`;

  let comparisonSection = "";
  if (previousReport && previousFunnelMetrics) {
    const trafficDelta = funnelMetrics.traffic - previousFunnelMetrics.traffic;
    const leadsDelta = funnelMetrics.leads - previousFunnelMetrics.leads;
    const revenueDelta = funnelMetrics.revenue - previousFunnelMetrics.revenue;
    const roiDelta = funnelMetrics.roi - previousFunnelMetrics.roi;

    comparisonSection = `
WEEK-OVER-WEEK / PERIOD COMPARISON (vs. "${previousReport.name}" on ${previousReport.report_date}):
  Traffic change: ${trafficDelta >= 0 ? "+" : ""}${trafficDelta.toLocaleString()} (${trafficDelta >= 0 ? "+" : ""}${previousFunnelMetrics.traffic > 0 ? ((trafficDelta / previousFunnelMetrics.traffic) * 100).toFixed(1) : "N/A"}%)
  Leads change: ${leadsDelta >= 0 ? "+" : ""}${leadsDelta.toLocaleString()} (${leadsDelta >= 0 ? "+" : ""}${previousFunnelMetrics.leads > 0 ? ((leadsDelta / previousFunnelMetrics.leads) * 100).toFixed(1) : "N/A"}%)
  Revenue change: ${revenueDelta >= 0 ? "+" : ""}${formatCurrency(revenueDelta)}
  ROI change: ${roiDelta >= 0 ? "+" : ""}${roiDelta.toFixed(2)}pp
  Previous Traffic → Lead: ${formatPercent(previousFunnelMetrics.trafficToLeadRate)}
  Previous Lead → Opportunity: ${formatPercent(previousFunnelMetrics.leadToOpportunityRate)}
  Previous Opportunity → Customer: ${formatPercent(previousFunnelMetrics.opportunityToCustomerRate)}`;
  }

  const user = `Analyze the following marketing performance report and provide recommendations.

CLIENT CONTEXT:
  Client Name: ${client.name}
  Industry: ${client.industry || "Not specified"}
  Primary Offer: ${client.primary_offer || "Not specified"}
  Website: ${client.website || "Not specified"}

CAMPAIGN CONTEXT:
  Project Name: ${project.name}
  Project Type: ${project.project_type}
  Report Name: ${currentReport.name}
  Report Period: ${currentReport.report_type} (${currentReport.report_date})
  ${currentReport.notes ? `Notes: ${currentReport.notes}` : ""}

RAW METRICS:
${metricsSection}
${funnelSection}
${comparisonSection}

Analyze this data. Identify the biggest performance gap. Provide actionable intelligence.`;

  return { system, user };
}
