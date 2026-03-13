export * from "./database";

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CSVColumnMapping {
  csvColumn: string;
  metricName: string;
  metricCategory: import("./database").MetricCategory;
}

export interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}
