"use client";

import { Zap, TrendingDown, TrendingUp } from "lucide-react";

interface Transaction {
  id: string;
  action: string;
  credits_used: number;
  balance_after: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  qualify_lead: "Qualify lead",
  push_lead: "Push lead",
  generate_sequences: "Generate sequences",
  apollo_enrich: "Apollo enrich",
  ai_recommend: "AI report recommendation",
  sfc_sequence: "SFC sequence run",
  super_dm_single: "Super DM — single",
  super_dm_screenshot: "Super DM — screenshot",
  super_dm_csv: "Super DM — CSV batch",
  check_exclusions: "Exclusion check",
  plan_reset: "Plan credit reset",
  topup: "Credit top-up",
};

function formatAction(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function CreditTransactionHistory({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        No transactions yet. Credits are logged every time you use an AI feature.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
            <th className="pb-2 font-medium pr-4">Action</th>
            <th className="pb-2 font-medium pr-4 text-right">Credits</th>
            <th className="pb-2 font-medium pr-4 text-right">Balance after</th>
            <th className="pb-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {transactions.map((tx) => {
            const isCredit = tx.credits_used < 0;
            return (
              <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    {isCredit ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-foreground">{formatAction(tx.action)}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  <span className={isCredit ? "text-emerald-500 font-semibold" : "text-foreground"}>
                    {isCredit ? "+" : "-"}{Math.abs(tx.credits_used).toLocaleString()}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                  <span className="flex items-center justify-end gap-1">
                    <Zap className="h-3 w-3" />
                    {tx.balance_after.toLocaleString()}
                  </span>
                </td>
                <td className="py-2.5 text-muted-foreground text-xs">{formatDate(tx.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
