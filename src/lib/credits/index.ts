import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// ── Credit costs per action ───────────────────────────────────────────────────
// These mirror the pricing table in the dev log / Notion board.
// Keep in sync with the product's billing page copy.

export const CREDIT_COSTS = {
  push_lead:            1,    // per lead pushed to Heyreach / Instantly
  qualify_lead:         2,    // per lead run through AI ICP filter
  generate_sequence:    3,    // per lead sequence generated
  apollo_enrich:        1,    // per lead Apollo enrichment call
  check_exclusions:     1,    // per lead exclusion check (rounds up from 0.5)
  sfc_sequence:         15,   // per SFC sequence + push run
  ai_recommend:         10,   // per AI report recommendation
  super_dm_single:      5,    // Super DM Setter — single conversation
  super_dm_screenshot:  8,    // Super DM Setter — screenshot analysis (Vision AI)
  super_dm_csv_lead:    3,    // Super DM Setter — CSV batch, per lead
  social_dm_send:       1,    // per DM sent via social campaign
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

// ── Check balance without deducting ──────────────────────────────────────────

export async function checkCredits(
  supabase: SupabaseClient,
  userId: string,
  action: CreditAction,
  quantity = 1
): Promise<{ ok: boolean; balance: number; required: number }> {
  const required = CREDIT_COSTS[action] * quantity;

  const { data } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  const balance = data?.balance ?? 0;
  return { ok: balance >= required, balance, required };
}

// ── Deduct credits (atomic via Postgres RPC) ──────────────────────────────────
// IMPORTANT: call this ONLY after a successful API response — never on failure.
// The Postgres function locks the row, checks the balance, deducts, and writes
// the transaction ledger entry atomically. Returns success=false if insufficient.

export async function deductCredits(
  supabase: SupabaseClient,
  userId: string,
  action: CreditAction,
  quantity = 1,
  metadata: Record<string, unknown> = {}
): Promise<{ success: boolean; balance: number }> {
  const amount = CREDIT_COSTS[action] * quantity;

  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id:  userId,
    p_action:   action,
    p_amount:   amount,
    p_metadata: metadata,
  });

  if (error || !data) {
    console.error("deductCredits RPC error:", error?.message);
    return { success: false, balance: 0 };
  }

  return {
    success: data.success as boolean,
    balance: data.balance as number,
  };
}

// ── Convenience: check then deduct in one call ────────────────────────────────
// Returns { allowed: false } if balance is insufficient so the caller can
// return a 402 before doing any expensive API work.

export async function requireCredits(
  supabase: SupabaseClient,
  userId: string,
  action: CreditAction,
  quantity = 1
): Promise<{ allowed: boolean; balance: number; required: number }> {
  const { ok, balance, required } = await checkCredits(supabase, userId, action, quantity);
  return { allowed: ok, balance, required };
}
