"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { metricsArraySchema, type MetricsArrayFormData } from "@/lib/validations";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, PenLine } from "lucide-react";

const PRESET_METRICS = [
  { name: "Traffic", category: "traffic" as const },
  { name: "Leads", category: "leads" as const },
  { name: "Opportunities", category: "leads" as const },
  { name: "Customers", category: "leads" as const },
  { name: "Revenue", category: "revenue" as const },
  { name: "Ad Spend", category: "cost" as const },
];

export function ManualMetricsForm({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, control, setValue, reset, formState: { isSubmitting } } =
    useForm<MetricsArrayFormData>({
      resolver: zodResolver(metricsArraySchema),
      defaultValues: {
        metrics: [{ metric_name: "", metric_value: 0, metric_category: "custom" }],
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: "metrics" });

  const onSubmit = async (data: MetricsArrayFormData) => {
    setError(null);
    const supabase = createClient();

    const rows = data.metrics.map((m, i) => ({
      report_id: reportId,
      metric_name: m.metric_name,
      metric_value: m.metric_value,
      metric_category: m.metric_category,
      display_order: i,
    }));

    const { error: insertError } = await supabase.from("report_metrics").insert(rows);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess(true);
    reset();
    setTimeout(() => setSuccess(false), 3000);
    router.refresh();
  };

  const addPreset = (preset: (typeof PRESET_METRICS)[0]) => {
    append({ metric_name: preset.name, metric_value: 0, metric_category: preset.category });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="h-4 w-4" />
          Manual Input
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <p className="w-full text-xs text-muted-foreground mb-1">Quick add:</p>
          {PRESET_METRICS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => addPreset(p)}
              className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-brand-50 hover:text-brand-600 transition-colors"
            >
              + {p.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {error && (
            <div className="p-2 rounded-lg bg-red-50 text-xs text-red-600 border border-red-100">
              {error}
            </div>
          )}

          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <Input
                placeholder="Metric name"
                className="flex-1 h-8 text-sm"
                {...register(`metrics.${index}.metric_name`)}
              />
              <Input
                type="number"
                placeholder="0"
                className="w-24 h-8 text-sm"
                step="any"
                {...register(`metrics.${index}.metric_value`)}
              />
              <Select
                defaultValue="custom"
                onValueChange={(v) =>
                  setValue(`metrics.${index}.metric_category`, v as any)
                }
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="traffic">Traffic</SelectItem>
                  <SelectItem value="leads">Leads</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="cost">Cost</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() =>
              append({ metric_name: "", metric_value: 0, metric_category: "custom" })
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Row
          </Button>

          <Button
            type="submit"
            size="sm"
            className="w-full"
            loading={isSubmitting}
            disabled={success}
          >
            {success ? "Saved!" : "Save Metrics"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
