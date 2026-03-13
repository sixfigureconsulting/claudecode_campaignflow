"use client";

import { TrendingUp, Users, FileText, DollarSign, Target, BarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { DashboardStats } from "@/types";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  description?: string;
}

function StatCard({ label, value, icon, color, description }: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={cn("p-2.5 rounded-xl", color)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardStats({ stats }: { stats: DashboardStats }) {
  const cards: StatCardProps[] = [
    {
      label: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: <DollarSign className="h-5 w-5 text-green-600" />,
      color: "bg-green-50",
      description: "Across all reports",
    },
    {
      label: "Total Leads",
      value: formatNumber(stats.totalLeads),
      icon: <Users className="h-5 w-5 text-blue-600" />,
      color: "bg-blue-50",
    },
    {
      label: "Total Spend",
      value: formatCurrency(stats.totalSpend),
      icon: <BarChart2 className="h-5 w-5 text-orange-600" />,
      color: "bg-orange-50",
    },
    {
      label: "Avg ROI",
      value: `${stats.avgROI.toFixed(1)}%`,
      icon: <TrendingUp className="h-5 w-5 text-brand-600" />,
      color: "bg-brand-50",
      description: "Across all campaigns",
    },
    {
      label: "Active Clients",
      value: formatNumber(stats.totalClients),
      icon: <Target className="h-5 w-5 text-purple-600" />,
      color: "bg-purple-50",
    },
    {
      label: "Total Reports",
      value: formatNumber(stats.totalReports),
      icon: <FileText className="h-5 w-5 text-pink-600" />,
      color: "bg-pink-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
