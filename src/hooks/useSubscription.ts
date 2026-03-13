"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Subscription } from "@/types";

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchSubscription() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setSubscription(data);
      setLoading(false);
    }

    fetchSubscription();
  }, []);

  const isActive =
    subscription?.status === "active" ||
    (subscription?.status === "trialing" &&
      subscription.trial_ends_at != null &&
      new Date(subscription.trial_ends_at) > new Date());

  const isTrialing = subscription?.status === "trialing";
  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return { subscription, loading, isActive, isTrialing, trialDaysLeft };
}
