"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { ReportMetric } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  traffic: "bg-blue-100 text-blue-700",
  leads: "bg-green-100 text-green-700",
  revenue: "bg-emerald-100 text-emerald-700",
  cost: "bg-red-100 text-red-700",
  custom: "bg-gray-100 text-gray-700",
};

export function MetricsList({
  metrics,
  reportId,
}: {
  metrics: ReportMetric[];
  reportId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const sorted = [...metrics].sort((a, b) => a.display_order - b.display_order);

  const handleDelete = async (metricId: string) => {
    setDeleting(metricId);
    const supabase = createClient();
    await supabase.from("report_metrics").delete().eq("id", metricId);
    setDeleting(null);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Metrics ({metrics.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {sorted.map((metric) => (
            <div key={metric.id} className="flex items-center justify-between py-2.5 group">
              <div className="flex items-center gap-3">
                <Badge
                  className={`text-xs ${CATEGORY_COLORS[metric.metric_category] ?? CATEGORY_COLORS.custom}`}
                  variant="outline"
                >
                  {metric.metric_category}
                </Badge>
                <span className="text-sm">{metric.metric_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">
                  {metric.metric_value.toLocaleString()}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                  onClick={() => handleDelete(metric.id)}
                  disabled={deleting === metric.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
