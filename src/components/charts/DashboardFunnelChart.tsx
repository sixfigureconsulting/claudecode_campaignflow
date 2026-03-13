"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["#6470f1", "#818cf8", "#a5bbfc", "#c7d7fe", "#e0e9ff"];

interface DashboardFunnelChartProps {
  data: Array<{ name: string; revenue: number }>;
}

export function DashboardFunnelChart({ data }: DashboardFunnelChartProps) {
  const hasData = data.some((d) => d.revenue > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue by Client</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No revenue data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {data.map((_, index) => (
                  <Cell
                    key={index}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
