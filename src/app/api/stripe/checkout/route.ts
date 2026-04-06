import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { stripe, PLANS, createOrRetrieveCustomer, createCheckoutSession } from "@/lib/stripe";
import { z } from "zod";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const checkoutSchema = z.object({
  plan: z.enum(["monthly", "yearly"]),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 5 checkout attempts per user per 10 minutes
    const rl = rateLimit(`checkout:${user.id}`, { limit: 5, windowMs: 10 * 60_000 });
    if (!rl.success) return rateLimitResponse(rl.resetAt);

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const { plan } = parsed.data;
    const priceId = PLANS[plan].priceId;

    if (!priceId) {
      return NextResponse.json({ error: "Price not configured" }, { status: 500 });
    }

    // Get existing subscription record for customer ID
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

    // Update customer ID if newly created
    if (!subscription?.stripe_customer_id) {
      const serviceClient = createServiceClient();
      await serviceClient
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const session = await createCheckoutSession({
      customerId,
      priceId,
      userId: user.id,
      successUrl: `${appUrl}/billing?success=true`,
      cancelUrl: `${appUrl}/billing?canceled=true`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
