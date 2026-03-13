"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PLAN_CONFIG, PLAN_FEATURES } from "@/lib/stripe/plans";
import { Check, CreditCard, ExternalLink, Zap } from "lucide-react";
import type { Subscription } from "@/types";

// PLAN_FEATURES imported from @/lib/stripe/plans

export function BillingPanel({ subscription }: { subscription: Subscription | null }) {
  const [loading, setLoading] = useState<"monthly" | "yearly" | "portal" | null>(null);

  const isActive = subscription?.status === "active";
  const isTrialing =
    subscription?.status === "trialing" &&
    subscription.trial_ends_at != null &&
    new Date(subscription.trial_ends_at) > new Date();

  const handleCheckout = async (plan: "monthly" | "yearly") => {
    setLoading(plan);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(null);
  };

  const handlePortal = async () => {
    setLoading("portal");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(null);
  };

  return (
    <div className="space-y-6">
      {/* Current plan status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Current Plan</CardTitle>
            {isActive && <Badge variant="success">Active</Badge>}
            {isTrialing && <Badge variant="info">Trial</Badge>}
            {!isActive && !isTrialing && <Badge variant="warning">Inactive</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscription ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{subscription.status}</span>
              </div>
              {subscription.plan && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium capitalize">{subscription.plan}</span>
                </div>
              )}
              {isTrialing && subscription.trial_ends_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trial ends</span>
                  <span className="font-medium">{formatDate(subscription.trial_ends_at)}</span>
                </div>
              )}
              {isActive && subscription.current_period_end && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next billing</span>
                  <span className="font-medium">{formatDate(subscription.current_period_end)}</span>
                </div>
              )}
              {subscription.cancel_at_period_end && (
                <p className="text-amber-600 text-xs">
                  Your subscription will cancel at the end of the current period.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No subscription found.</p>
          )}

          {isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePortal}
              loading={loading === "portal"}
              className="mt-3"
            >
              <CreditCard className="h-4 w-4" />
              Manage Billing
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Upgrade plans */}
      {!isActive && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Choose a Plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Monthly */}
            <Card className="border-2 hover:border-brand-400 transition-colors">
              <CardContent className="p-6">
                <div className="mb-4">
                  <p className="font-semibold text-lg">Monthly</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold">$19</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  {PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  onClick={() => handleCheckout("monthly")}
                  loading={loading === "monthly"}
                >
                  Start Monthly Plan
                </Button>
              </CardContent>
            </Card>

            {/* Yearly */}
            <Card className="border-2 border-brand-400 bg-brand-50/30 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="default" className="bg-brand-600 text-white shadow-md px-3">
                  <Zap className="h-3 w-3 mr-1" />
                  Best Value
                </Badge>
              </div>
              <CardContent className="p-6">
                <div className="mb-4">
                  <p className="font-semibold text-lg">Yearly</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold">$97</span>
                    <span className="text-muted-foreground">/year</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Save $131 vs monthly
                  </p>
                </div>
                <ul className="space-y-2 mb-6">
                  {PLAN_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="gradient"
                  className="w-full"
                  onClick={() => handleCheckout("yearly")}
                  loading={loading === "yearly"}
                >
                  Start Yearly Plan
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
