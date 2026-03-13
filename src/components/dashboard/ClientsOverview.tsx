"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInitials, formatCurrency } from "@/lib/utils";
import { computeFunnelMetrics } from "@/lib/funnel";
import { ArrowRight, Plus } from "lucide-react";

export function ClientsOverview({ clients }: { clients: any[] }) {
  const enriched = clients.slice(0, 5).map((client) => {
    let totalRevenue = 0;
    let totalReports = 0;

    (client.projects ?? []).forEach((p: any) => {
      (p.reports ?? []).forEach((r: any) => {
        totalReports++;
        const f = computeFunnelMetrics(r.report_metrics ?? []);
        totalRevenue += f.revenue;
      });
    });

    return { ...client, totalRevenue, totalReports };
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Clients</CardTitle>
        <Link href="/clients">
          <Button variant="ghost" size="sm">
            View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {enriched.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">No clients yet</p>
            <Link href="/clients">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add your first client
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {enriched.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <div className="w-9 h-9 bg-brand-100 text-brand-700 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
                  {getInitials(client.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {client.projects?.length ?? 0} project{(client.projects?.length ?? 0) !== 1 ? "s" : ""} · {client.totalReports} report{client.totalReports !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(client.totalRevenue)}</p>
                  {client.industry && (
                    <Badge variant="secondary" className="text-xs">{client.industry}</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
