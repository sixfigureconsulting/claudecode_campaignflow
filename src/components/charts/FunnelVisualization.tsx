"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { FunnelMetrics, ReportMetric } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/funnel";

interface FunnelStage {
  label: string;
  value: number;
  rate?: string;
  color: string;
  textColor: string;
}

export function FunnelVisualization({
  metrics,
  customMetrics = [],
}: {
  metrics: FunnelMetrics;
  customMetrics?: ReportMetric[];
}) {
  const standardStages: FunnelStage[] = [
    {
      label: "Traffic",
      value: metrics.traffic,
      color: "bg-brand-100",
      textColor: "text-brand-800",
    },
    {
      label: "Leads",
      value: metrics.leads,
      rate: metrics.trafficToLeadRate > 0 ? formatPercent(metrics.trafficToLeadRate) : undefined,
      color: "bg-brand-200",
      textColor: "text-brand-800",
    },
    {
      label: "Opportunities",
      value: metrics.opportunities,
      rate: metrics.leadToOpportunityRate > 0 ? formatPercent(metrics.leadToOpportunityRate) : undefined,
      color: "bg-brand-400",
      textColor: "text-white",
    },
    {
      label: "Customers",
      value: metrics.customers,
      rate: metrics.opportunityToCustomerRate > 0 ? formatPercent(metrics.opportunityToCustomerRate) : undefined,
      color: "bg-brand-600",
      textColor: "text-white",
    },
  ].filter((s) => s.value > 0);

  const customStages: FunnelStage[] = customMetrics
    .filter((m) => m.metric_value > 0)
    .map((m) => ({
      label: m.metric_name,
      value: m.metric_value,
      color: "bg-slate-100",
      textColor: "text-slate-700",
    }));

  const maxValue = Math.max(
    ...standardStages.map((s) => s.value),
    ...customStages.map((s) => s.value),
    1
  );

  const hasStandard = standardStages.length > 0;
  const hasCustom = customStages.length > 0;
  const hasCostMetrics = metrics.cpl > 0 || metrics.cac > 0 || metrics.roi !== 0 || metrics.roas > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Funnel Visualization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Standard funnel stages */}
          {standardStages.map((stage, i) => {
            const width = Math.max(25, (stage.value / maxValue) * 100);
            return (
              <div key={stage.label} className="space-y-1">
                {i > 0 && stage.rate && (
                  <div className="flex items-center gap-2 pl-4">
                    <div className="h-3 w-px bg-border" />
                    <span className="text-xs text-muted-foreground">{stage.rate} conversion</span>
                  </div>
                )}
                <div
                  className={`h-10 rounded-lg flex items-center justify-between px-4 transition-all duration-500 ${stage.color}`}
                  style={{ width: `${width}%`, minWidth: "120px" }}
                >
                  <span className={`text-sm font-medium ${stage.textColor}`}>{stage.label}</span>
                  <span className={`text-sm font-bold ${stage.textColor}`}>
                    {stage.value.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Custom metric stages */}
          {hasCustom && (
            <>
              <div className={`${hasStandard ? "pt-3" : ""} pb-1 flex items-center gap-2`}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Custom Activity Metrics
                </p>
                <div className="flex-1 h-px bg-border" />
              </div>
              {customStages.map((stage) => {
                const width = Math.max(20, (stage.value / maxValue) * 100);
                return (
                  <div
                    key={stage.label}
                    className={`h-10 rounded-lg flex items-center justify-between px-4 transition-all duration-500 border border-slate-200 ${stage.color}`}
                    style={{ width: `${width}%`, minWidth: "140px" }}
                  >
                    <span className={`text-sm font-medium ${stage.textColor} truncate pr-2`}>
                      {stage.label}
                    </span>
                    <span className={`text-sm font-bold ${stage.textColor} shrink-0`}>
                      {stage.value.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Cost metrics */}
        {hasCostMetrics && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {metrics.cpl > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">CPL</p>
                <p className="text-sm font-bold">{formatCurrency(metrics.cpl)}</p>
              </div>
            )}
            {metrics.cac > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">CAC</p>
                <p className="text-sm font-bold">{formatCurrency(metrics.cac)}</p>
              </div>
            )}
            {metrics.roi !== 0 && (
              <div className={`rounded-lg p-3 text-center ${metrics.roi >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                <p className="text-xs text-muted-foreground">ROI</p>
                <p className={`text-sm font-bold ${metrics.roi >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {formatPercent(metrics.roi)}
                </p>
              </div>
            )}
            {metrics.roas > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">ROAS</p>
                <p className="text-sm font-bold">{metrics.roas.toFixed(2)}x</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
