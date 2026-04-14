import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

export const PLANS = {
  monthly: {
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID ?? "price_1TIX4XFbe6nSVDckIaCZVYYH",
    amount: 9700, // $97.00
    label: "$97/month",
    interval: "month" as const,
    credits: 1000, // credits granted per billing period
  },
  yearly: {
    priceId: process.env.STRIPE_YEARLY_PRICE_ID ?? "price_1T0gxMFbe6nSVDckqE6KZrBF",
    amount: 49700, // $497.00
    label: "$497/year",
    interval: "year" as const,
    credits: 12000, // credits granted per billing period (1000/month × 12)
  },
} as const;

// One-time credit top-up packs
export const CREDIT_PACKS = {
  starter: {
    priceId: process.env.STRIPE_CREDITS_STARTER_PRICE_ID ?? "",
    credits: 500,
    amount: 900,   // $9.00
    label: "500 credits",
    price: "$9",
  },
  growth: {
    priceId: process.env.STRIPE_CREDITS_GROWTH_PRICE_ID ?? "",
    credits: 2000,
    amount: 2900,  // $29.00
    label: "2,000 credits",
    price: "$29",
    popular: true,
  },
  pro: {
    priceId: process.env.STRIPE_CREDITS_PRO_PRICE_ID ?? "",
    credits: 5000,
    amount: 5900,  // $59.00
    label: "5,000 credits",
    price: "$59",
  },
} as const;

export type CreditPackKey = keyof typeof CREDIT_PACKS;

export async function createOrRetrieveCustomer(
  userId: string,
  email: string,
  existingCustomerId?: string | null
): Promise<string> {
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });

  return customer.id;
}

export async function createCheckoutSession({
  customerId,
  priceId,
  userId,
  successUrl,
  cancelUrl,
}: {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    billing_address_collection: "auto",
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { supabase_user_id: userId },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
