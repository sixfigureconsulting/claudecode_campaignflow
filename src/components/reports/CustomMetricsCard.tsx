"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Trash2 } from "lucide-react";
import type { ReportMetric } from "@/types";

export function CustomMetricsCard({ metrics }: { metrics: ReportMetric[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  if (metrics.length === 0) return null;

  const handleDelete = async (metricId: string) => {
    setDeleting(metricId);
    const supabase = createClient();
    await supabase.from("report_metrics").delete().eq("id", metricId);
    setDeleting(null);
    router.refresh();
  };

  const formatValue = (value: number) =>
    value % 1 === 0
      ? value.toLocaleString()
      : value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Custom Metrics
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {metrics.length} metric{metrics.length !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className="group relative bg-brand-50 border border-brand-100 rounded-xl p-3 text-center"
            >
              {/* Delete button — appears on hover */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 p-0"
                onClick={() => handleDelete(metric.id)}
                disabled={deleting === metric.id}
              >
                <Trash2 className="h-3 w-3" />
              </Button>

              <p
                className="text-xs text-muted-foreground mb-1.5 truncate leading-tight pr-4"
                title={metric.metric_name}
              >
                {metric.metric_name}
              </p>
              <p className="text-xl font-bold text-brand-700">
                {deleting === metric.id ? "…" : formatValue(metric.metric_value)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
