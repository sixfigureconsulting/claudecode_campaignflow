import Papa from "papaparse";
import type { CSVParseResult } from "@/types";

export function parseCSVFile(file: File): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings for manual mapping control
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        const rows = results.data as Record<string, string>[];
        resolve({
          headers,
          rows,
          rowCount: rows.length,
        });
      },
      error: (error) => {
        reject(new Error(`CSV parse error: ${error.message}`));
      },
    });
  });
}

export function parseCSVText(text: string): CSVParseResult {
  const results = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  return {
    headers: results.meta.fields ?? [],
    rows: results.data,
    rowCount: results.data.length,
  };
}

export interface ColumnAggregationResult {
  [column: string]: number;
}

type AggregationMethod = "sum" | "average" | "last";

/**
 * Aggregate CSV rows into a single numeric value per selected column.
 * Multi-row CSVs (e.g. weekly data) can be summed, averaged, or last-value.
 */
export function aggregateCSVColumns(
  rows: Record<string, string>[],
  selectedColumns: string[],
  method: AggregationMethod = "sum"
): ColumnAggregationResult {
  const result: ColumnAggregationResult = {};

  for (const col of selectedColumns) {
    const values = rows
      .map((row) => row[col])
      .filter((v) => v !== undefined && v !== "" && v !== null)
      .map((v) => parseFloat(v.replace(/[$,%\s]/g, "")))
      .filter((v) => !isNaN(v));

    if (values.length === 0) {
      result[col] = 0;
      continue;
    }

    switch (method) {
      case "sum":
        result[col] = values.reduce((a, b) => a + b, 0);
        break;
      case "average":
        result[col] = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case "last":
        result[col] = values[values.length - 1];
        break;
      default:
        result[col] = values.reduce((a, b) => a + b, 0);
    }
  }

  return result;
}

/**
 * Detect likely metric types from column names for smarter auto-mapping
 */
export function autoDetectColumnCategory(
  columnName: string
): import("@/types").MetricCategory {
  const lower = columnName.toLowerCase();

  if (/traffic|visitor|session|impression|click|view|reach|pageview/.test(lower)) {
    return "traffic";
  }
  if (/lead|opt.?in|signup|subscribe|form|contact/.test(lower)) {
    return "leads";
  }
  if (/revenue|sale|income|gmv|mrr|arr|ltv/.test(lower)) {
    return "revenue";
  }
  if (/cost|spend|budget|cpc|cpm|cpa|cpl|cac|ad.?spend/.test(lower)) {
    return "cost";
  }

  return "custom";
}

/**
 * Clean a column name for use as a metric_name (remove special chars, trim)
 */
export function cleanColumnName(name: string): string {
  return name
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
