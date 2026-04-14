"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

const PACKS = [
  { key: "starter" as const, label: "Starter", credits: 500, price: "$9", perCredit: "$0.018" },
  { key: "growth"  as const, label: "Growth",  credits: 2000, price: "$29", perCredit: "$0.0145", popular: true },
  { key: "pro"     as const, label: "Pro",      credits: 5000, price: "$59", perCredit: "$0.012" },
];

export function CreditTopUpPanel({ creditBalance }: { creditBalance: number }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (pack: "starter" | "growth" | "pro") => {
    setLoading(pack);
    try {
      const res = await fetch("/api/stripe/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const { url, error } = await res.json();
      if (error) { alert(error); return; }
      if (url) window.location.href = url;
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand-500" />
            Credits
          </CardTitle>
          <span className="text-sm font-semibold tabular-nums">
            {creditBalance.toLocaleString()} remaining
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Credits are consumed when you use AI features. Top up any time — they never expire.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PACKS.map((pack) => (
            <div
              key={pack.key}
              className={`relative flex flex-col gap-2 rounded-xl border p-4 ${
                pack.popular
                  ? "border-brand-400 bg-brand-50/30"
                  : "border-border"
              }`}
            >
              {pack.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="bg-brand-600 text-white text-[10px] px-2 py-0">
                    Most popular
                  </Badge>
                </div>
              )}
              <div>
                <p className="font-semibold text-sm">{pack.label}</p>
                <p className="text-2xl font-bold mt-0.5">{pack.price}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pack.credits.toLocaleString()} credits · {pack.perCredit}/credit
                </p>
              </div>
              <Button
                size="sm"
                variant={pack.popular ? "gradient" : "outline"}
                className="w-full mt-auto"
                loading={loading === pack.key}
                onClick={() => handleBuy(pack.key)}
              >
                Buy
              </Button>
            </div>
          ))}
        </div>

        <div className="pt-1 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Credit costs:</span>{" "}
            Push lead (1) · Qualify lead (2) · Generate sequence (3) · Apollo enrich (1) ·
            AI recommendation (10) · SFC sequence (15) · Super DM (5–8)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
