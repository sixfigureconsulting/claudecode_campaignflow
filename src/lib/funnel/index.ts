import type { ReportMetric, FunnelMetrics } from "@/types";

// Standard metric name mappings to funnel slots
const METRIC_ALIASES: Record<string, keyof Pick<FunnelMetrics, "traffic" | "leads" | "opportunities" | "customers" | "revenue" | "spend">> = {
  // Traffic
  traffic: "traffic",
  visitors: "traffic",
  sessions: "traffic",
  impressions: "traffic",
  clicks: "traffic",
  pageviews: "traffic",
  "page views": "traffic",
  // Leads
  leads: "leads",
  "form submissions": "leads",
  "opt-ins": "leads",
  optins: "leads",
  signups: "leads",
  "email signups": "leads",
  "new leads": "leads",
  // Opportunities
  opportunities: "opportunities",
  "sales calls": "opportunities",
  "discovery calls": "opportunities",
  meetings: "opportunities",
  demos: "opportunities",
  proposals: "opportunities",
  "qualified leads": "opportunities",
  sql: "opportunities",
  // Customers
  customers: "customers",
  sales: "customers",
  conversions: "customers",
  purchases: "customers",
  "new customers": "customers",
  closed: "customers",
  "deals closed": "customers",
  // Revenue
  revenue: "revenue",
  "total revenue": "revenue",
  mrr: "revenue",
  arr: "revenue",
  income: "revenue",
  "gross revenue": "revenue",
  "net revenue": "revenue",
  // Spend
  spend: "spend",
  "ad spend": "spend",
  cost: "spend",
  "total cost": "spend",
  "total spend": "spend",
  budget: "spend",
  "marketing spend": "spend",
  "advertising cost": "spend",
};

function normalizeMetricName(name: string): string {
  return name.toLowerCase().trim();
}

function resolveMetricSlot(
  metricName: string
): keyof Pick<FunnelMetrics, "traffic" | "leads" | "opportunities" | "customers" | "revenue" | "spend"> | null {
  const normalized = normalizeMetricName(metricName);
  return METRIC_ALIASES[normalized] ?? null;
}

/**
 * Compute full funnel metrics from a list of raw report metrics.
 * Returns FunnelMetrics with all calculated rates and costs.
 */
export function computeFunnelMetrics(metrics: ReportMetric[]): FunnelMetrics {
  const slots: Record<string, number> = {
    traffic: 0,
    leads: 0,
    opportunities: 0,
    customers: 0,
    revenue: 0,
    spend: 0,
  };

  // Accumulate values into funnel slots
  for (const metric of metrics) {
    const slot = resolveMetricSlot(metric.metric_name);
    if (slot) {
      slots[slot] += metric.metric_value;
    } else {
      // Use category as fallback
      if (metric.metric_category === "traffic" && slots.traffic === 0) {
        slots.traffic += metric.metric_value;
      } else if (metric.metric_category === "leads" && slots.leads === 0) {
        slots.leads += metric.metric_value;
      } else if (metric.metric_category === "revenue") {
        slots.revenue += metric.metric_value;
      } else if (metric.metric_category === "cost") {
        slots.spend += metric.metric_value;
      }
    }
  }

  const { traffic, leads, opportunities, customers, revenue, spend } = slots;

  // Conversion rates (0-100%)
  const trafficToLeadRate = traffic > 0 ? (leads / traffic) * 100 : 0;
  const leadToOpportunityRate = leads > 0 ? (opportunities / leads) * 100 : 0;
  const opportunityToCustomerRate = opportunities > 0 ? (customers / opportunities) * 100 : 0;
  const overallConversionRate = traffic > 0 ? (customers / traffic) * 100 : 0;

  // Cost metrics
  const cpl = leads > 0 && spend > 0 ? spend / leads : 0;
  const cac = customers > 0 && spend > 0 ? spend / customers : 0;
  const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
  const roas = spend > 0 ? revenue / spend : 0;
  const avgOrderValue = customers > 0 ? revenue / customers : 0;
  const revenuePerLead = leads > 0 ? revenue / leads : 0;

  return {
    traffic,
    leads,
    opportunities,
    customers,
    revenue,
    spend,
    trafficToLeadRate: round(trafficToLeadRate, 2),
    leadToOpportunityRate: round(leadToOpportunityRate, 2),
    opportunityToCustomerRate: round(opportunityToCustomerRate, 2),
    overallConversionRate: round(overallConversionRate, 4),
    cpl: round(cpl, 2),
    cac: round(cac, 2),
    roi: round(roi, 2),
    roas: round(roas, 2),
    avgOrderValue: round(avgOrderValue, 2),
    revenuePerLead: round(revenuePerLead, 2),
  };
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Compare two periods of funnel metrics and return delta objects
 */
export function compareFunnelMetrics(
  current: FunnelMetrics,
  previous: FunnelMetrics
): Record<keyof FunnelMetrics, { value: number; delta: number; deltaPercent: number }> {
  const keys = Object.keys(current) as Array<keyof FunnelMetrics>;
  const result = {} as Record<keyof FunnelMetrics, { value: number; delta: number; deltaPercent: number }>;

  for (const key of keys) {
    const curr = current[key];
    const prev = previous[key];
    const delta = curr - prev;
    const deltaPercent = prev !== 0 ? (delta / prev) * 100 : 0;
    result[key] = {
      value: curr,
      delta: round(delta, 2),
      deltaPercent: round(deltaPercent, 2),
    };
  }

  return result;
}

/**
 * Identify the weakest metric in the funnel
 */
export function identifyWeakestMetric(metrics: FunnelMetrics): {
  metric: string;
  value: number;
  label: string;
  suggestion: string;
} {
  const candidates = [
    {
      metric: "trafficToLeadRate",
      value: metrics.trafficToLeadRate,
      label: "Traffic → Lead Conversion Rate",
      suggestion: "Improve landing page CTA, messaging, or lead magnet relevance",
    },
    {
      metric: "leadToOpportunityRate",
      value: metrics.leadToOpportunityRate,
      label: "Lead → Opportunity Conversion Rate",
      suggestion: "Optimize nurture sequences, lead qualification, or follow-up speed",
    },
    {
      metric: "opportunityToCustomerRate",
      value: metrics.opportunityToCustomerRate,
      label: "Opportunity → Customer Conversion Rate",
      suggestion: "Improve sales process, handle objections, or tighten pricing",
    },
  ].filter((c) => c.value > 0);

  if (candidates.length === 0) {
    return {
      metric: "traffic",
      value: metrics.traffic,
      label: "Top-of-Funnel Traffic",
      suggestion: "Increase traffic through paid ads, SEO, or outbound prospecting",
    };
  }

  return candidates.reduce((min, c) => (c.value < min.value ? c : min));
}

/**
 * Format a currency value for display
 */
export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a percentage value for display
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}
