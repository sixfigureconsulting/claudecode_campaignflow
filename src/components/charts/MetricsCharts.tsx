"use client";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { ReportWithMetrics } from "@/types";
import { computeFunnelMetrics } from "@/lib/funnel";
import { formatDate } from "@/lib/utils";

interface MetricsChartsProps {
  reports: ReportWithMetrics[];
}

export function MetricsCharts({ reports }: MetricsChartsProps) {
  const sortedReports = [...reports].sort(
    (a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime()
  );

  const chartData = sortedReports.map((report) => {
    const f = computeFunnelMetrics(report.report_metrics ?? []);
    return {
      date: formatDate(report.report_date, { month: "short", day: "numeric" }),
      revenue: f.revenue,
      spend: f.spend,
      leads: f.leads,
      customers: f.customers,
      roi: f.roi,
      conversionRate: f.trafficToLeadRate,
    };
  });

  if (chartData.length < 2) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Add at least 2 reports to see trend charts
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Revenue vs Spend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue vs. Spend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6470f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6470f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name === "revenue" ? "Revenue" : "Spend"]}
                contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6470f1" fill="url(#revGradient)" strokeWidth={2} name="revenue" />
              <Area type="monotone" dataKey="spend" stroke="#f97316" fill="url(#spendGradient)" strokeWidth={2} name="spend" />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Leads & Customers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Leads & Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Leads" />
              <Line type="monotone" dataKey="customers" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Customers" />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ROI over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">ROI Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, "ROI"]}
                contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
              />
              <Area type="monotone" dataKey="roi" stroke="#10b981" fill="url(#roiGradient)" strokeWidth={2} name="ROI" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Traffic → Lead Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)}%`, "Conversion Rate"]}
                contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
              />
              <Line type="monotone" dataKey="conversionRate" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="Conversion Rate" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
