import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BillingPanel } from "@/components/billing/BillingPanel";
import { CreditTopUpPanel } from "@/components/billing/CreditTopUpPanel";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; topup?: string; credits?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: subscription }, { data: creditsRow }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", user.id).single(),
    supabase.from("user_credits").select("balance").eq("user_id", user.id).single(),
  ]);

  const creditBalance: number = creditsRow?.balance ?? 0;

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
      {params.topup === "success" && params.credits && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
          {parseInt(params.credits, 10).toLocaleString()} credits added to your account.
        </div>
      )}
      {params.topup === "canceled" && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
          Credit purchase canceled. No charge was made.
        </div>
      )}

      <BillingPanel subscription={subscription} />
      <CreditTopUpPanel creditBalance={creditBalance} />
    </div>
  );
}
