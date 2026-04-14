import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripe, CREDIT_PACKS, createOrRetrieveCustomer } from "@/lib/stripe";
import { z } from "zod";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const topupSchema = z.object({
  pack: z.enum(["starter", "growth", "pro"]),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = rateLimit(`topup:${user.id}`, { limit: 10, windowMs: 10 * 60_000 });
    if (!rl.success) return rateLimitResponse(rl.resetAt);

    const body = await request.json();
    const parsed = topupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
    }

    const pack = CREDIT_PACKS[parsed.data.pack];

    // Resolve Stripe customer ID
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    const customerId = await createOrRetrieveCustomer(
      user.id,
      user.email!,
      subscription?.stripe_customer_id
    );

    if (!subscription?.stripe_customer_id) {
      const serviceClient = createServiceClient();
      await serviceClient
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Create a one-time payment checkout session
    // If priceId is configured, use it; otherwise fall back to inline price_data
    const lineItem = pack.priceId
      ? { price: pack.priceId, quantity: 1 }
      : {
          price_data: {
            currency: "usd",
            unit_amount: pack.amount,
            product_data: { name: `CampaignFlow Credits — ${pack.label}` },
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [lineItem],
      mode: "payment",
      metadata: {
        user_id: user.id,
        credits: String(pack.credits),
        pack: parsed.data.pack,
      },
      success_url: `${appUrl}/billing?topup=success&credits=${pack.credits}`,
      cancel_url: `${appUrl}/billing?topup=canceled`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Topup checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
