import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, PLANS } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

// Disable Next.js body parsing — Stripe needs the raw body
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;

        if (session.mode === "payment") {
          // One-time credit top-up
          const userId = session.metadata?.user_id;
          const credits = parseInt(session.metadata?.credits ?? "0", 10);
          const pack = session.metadata?.pack ?? "unknown";

          if (userId && credits > 0) {
            await serviceClient.rpc("add_credits", {
              p_user_id:      userId,
              p_action:       "topup",
              p_amount:       credits,
              p_plan_credits: 0,
              p_period_start: null,
              p_period_end:   null,
              p_metadata:     { stripe_session_id: session.id, pack },
            });
          }
          break;
        }

        // Subscription checkout
        const subscriptionId = session.subscription as string;

        // Look up the user by customer ID
        const { data: sub } = await serviceClient
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
          const plan = stripeSub.items.data[0]?.plan.interval === "year" ? "yearly" : "monthly";

          await serviceClient
            .from("subscriptions")
            .update({
              stripe_subscription_id: subscriptionId,
              status: stripeSub.status as any,
              plan,
              current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: stripeSub.cancel_at_period_end,
            })
            .eq("user_id", sub.user_id);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const plan = subscription.items.data[0]?.plan.interval === "year" ? "yearly" : "monthly";

        await serviceClient
          .from("subscriptions")
          .update({
            status: subscription.status as any,
            plan,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await serviceClient
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Update subscription status
        await serviceClient
          .from("subscriptions")
          .update({ status: "active" })
          .eq("stripe_customer_id", customerId);

        // Reset credits for the new billing period
        const { data: sub } = await serviceClient
          .from("subscriptions")
          .select("user_id, plan")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub?.user_id) {
          const plan = sub.plan === "yearly" ? PLANS.yearly : PLANS.monthly;
          const periodStart = invoice.period_start
            ? new Date(invoice.period_start * 1000).toISOString()
            : null;
          const periodEnd = invoice.period_end
            ? new Date(invoice.period_end * 1000).toISOString()
            : null;

          await serviceClient.rpc("add_credits", {
            p_user_id:      sub.user_id,
            p_action:       "plan_reset",
            p_amount:       plan.credits,
            p_plan_credits: plan.credits,
            p_period_start: periodStart,
            p_period_end:   periodEnd,
            p_metadata:     { stripe_invoice_id: invoice.id, plan: sub.plan },
          });
        }
        break;
      }

      default:
        // Unhandled event type — safe to ignore
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
