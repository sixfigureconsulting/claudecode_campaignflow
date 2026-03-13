"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseCSVFile, aggregateCSVColumns, autoDetectColumnCategory, cleanColumnName } from "@/lib/csv/parser";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Check, X, ChevronDown } from "lucide-react";
import type { MetricCategory } from "@/types";

interface ColumnMapping {
  csvColumn: string;
  metricName: string;
  category: MetricCategory;
  include: boolean;
}

type Step = "upload" | "map" | "review" | "done";

export function CSVUploadSection({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [aggregation, setAggregation] = useState<"sum" | "average" | "last">("sum");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a .csv file");
      return;
    }
    try {
      const result = await parseCSVFile(file);
      setHeaders(result.headers);
      setRows(result.rows);

      const initialMappings: ColumnMapping[] = result.headers.map((col) => ({
        csvColumn: col,
        metricName: cleanColumnName(col),
        category: autoDetectColumnCategory(col),
        include: true,
      }));
      setMappings(initialMappings);
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse CSV");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const includedMappings = mappings.filter((m) => m.include);
    const includedColumns = includedMappings.map((m) => m.csvColumn);
    const aggregated = aggregateCSVColumns(rows, includedColumns, aggregation);

    const metricsToInsert = includedMappings.map((m, i) => ({
      report_id: reportId,
      metric_name: m.metricName,
      metric_value: aggregated[m.csvColumn] ?? 0,
      metric_category: m.category,
      display_order: i,
    }));

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("report_metrics")
      .insert(metricsToInsert);

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setStep("done");
    router.refresh();
  };

  if (step === "done") {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-8 text-center">
          <Check className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-green-700">CSV imported successfully</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-xs"
            onClick={() => {
              setStep("upload");
              setHeaders([]);
              setRows([]);
              setMappings([]);
            }}
          >
            Import another CSV
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "upload") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            CSV Upload
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 p-2 rounded bg-red-50 text-xs text-red-600 border border-red-100">
              {error}
            </div>
          )}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging ? "border-brand-400 bg-brand-50" : "border-border hover:border-brand-300 hover:bg-muted/40"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("csv-file-input")?.click()}
          >
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">Drop your CSV here</p>
            <p className="text-xs text-muted-foreground">or click to browse</p>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Supports any CSV with column headers
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Map Columns
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
            <X className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{rows.length} rows · {headers.length} columns detected</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="p-2 rounded bg-red-50 text-xs text-red-600 border border-red-100">
            {error}
          </div>
        )}

        {/* Aggregation method */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <span className="text-xs text-muted-foreground flex-1">Aggregate {rows.length} rows by:</span>
          <Select value={aggregation} onValueChange={(v) => setAggregation(v as any)}>
            <SelectTrigger className="w-28 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sum">Sum</SelectItem>
              <SelectItem value="average">Average</SelectItem>
              <SelectItem value="last">Last value</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Column mappings */}
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
          {mappings.map((mapping, i) => (
            <div
              key={mapping.csvColumn}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                mapping.include ? "bg-background border-border" : "bg-muted/30 border-transparent opacity-50"
              }`}
            >
              <input
                type="checkbox"
                checked={mapping.include}
                onChange={(e) => {
                  const updated = [...mappings];
                  updated[i] = { ...updated[i], include: e.target.checked };
                  setMappings(updated);
                }}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground w-24 truncate shrink-0">
                {mapping.csvColumn}
              </span>
              <span className="text-muted-foreground text-xs">→</span>
              <Input
                value={mapping.metricName}
                onChange={(e) => {
                  const updated = [...mappings];
                  updated[i] = { ...updated[i], metricName: e.target.value };
                  setMappings(updated);
                }}
                className="flex-1 h-7 text-xs"
                disabled={!mapping.include}
              />
              <Select
                value={mapping.category}
                onValueChange={(v) => {
                  const updated = [...mappings];
                  updated[i] = { ...updated[i], category: v as MetricCategory };
                  setMappings(updated);
                }}
                disabled={!mapping.include}
              >
                <SelectTrigger className="w-24 h-7 text-xs">
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
            </div>
          ))}
        </div>

        <Button
          className="w-full"
          size="sm"
          onClick={handleSave}
          loading={saving}
          disabled={!mappings.some((m) => m.include)}
        >
          Import {mappings.filter((m) => m.include).length} Metrics
        </Button>
      </CardContent>
    </Card>
  );
}
