"use client";

import { Info } from "lucide-react";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import type { DashboardStats } from "@/types";

interface MetricCardProps {
  label: string;
  value: string;
  secondary?: string;
  dotColor: string;
  info?: string;
}

function MetricCard({ label, dotColor, value, secondary, info }: MetricCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotColor)} />
          <span className="text-sm text-muted-foreground font-medium">{label}</span>
        </div>
        <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        {secondary && (
          <>
            <span className="text-muted-foreground text-sm">|</span>
            <span className="text-sm font-semibold text-emerald-600">{secondary}</span>
          </>
        )}
      </div>
    </div>
  );
}

interface DashboardStatsExtended extends DashboardStats {
  totalSent: number;
  openRate: number;
  replyRate: number;
  meetingsBooked: number;
}

export function DashboardStats({ stats }: { stats: DashboardStatsExtended }) {
  const cards: MetricCardProps[] = [
    {
      label: "Total Sent",
      value: formatNumber(stats.totalSent),
      dotColor: "bg-amber-400",
    },
    {
      label: "Open Rate",
      value: `${Math.round(stats.openRate * 10) / 10}%`,
      dotColor: "bg-blue-500",
    },
    {
      label: "Reply Rate",
      value: `${Math.round(stats.replyRate * 10) / 10}%`,
      dotColor: "bg-slate-400",
    },
    {
      label: "Meetings Booked",
      value: formatNumber(stats.meetingsBooked),
      secondary: stats.totalRevenue > 0 ? formatCurrency(stats.totalRevenue) : undefined,
      dotColor: "bg-purple-500",
    },
    {
      label: "Pipeline Generated",
      value: formatCurrency(stats.totalRevenue),
      dotColor: "bg-emerald-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  );
}
