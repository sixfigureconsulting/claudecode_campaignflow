import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BillingPanel } from "@/components/billing/BillingPanel";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your subscription and billing details
        </p>
      </div>

      {params.success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
          Subscription activated successfully. Welcome to CampaignFlow Pro!
        </div>
      )}
      {params.canceled && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
          Checkout was canceled. No charge was made.
        </div>
      )}

      <BillingPanel subscription={subscription} />
    </div>
  );
}
