-- ============================================================
-- CampaignFlow Pro — Credit System
-- Migration 010
-- ============================================================
-- Tables:   user_credits, credit_transactions
-- Function: deduct_credits() — atomic balance check + deduction
-- ============================================================

-- ── user_credits ──────────────────────────────────────────────────────────────
-- One row per user. balance is the live spendable credit count.
-- plan_credits is reset each billing period by the Stripe webhook.

CREATE TABLE user_credits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Current spendable balance
  balance        INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),

  -- Credits allocated by the user's active plan per period
  plan_credits   INTEGER NOT NULL DEFAULT 0,

  -- Billing period boundaries (synced from Stripe on invoice.payment_succeeded)
  period_start   TIMESTAMPTZ,
  period_end     TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);

-- ── credit_transactions ───────────────────────────────────────────────────────
-- Immutable ledger. Every deduction and top-up is recorded here.
-- credits_used > 0 = deduction, credits_used < 0 = credit added (top-up / reset).

CREATE TABLE credit_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Action that triggered this transaction (matches CREDIT_COSTS keys in TS)
  action        TEXT NOT NULL,

  -- Credits consumed (positive = spent, negative = granted)
  credits_used  INTEGER NOT NULL,

  -- Balance after this transaction (snapshot for audit trail)
  balance_after INTEGER NOT NULL,

  -- Optional context: campaign_id, lead_id, report_id, etc.
  metadata      JSONB NOT NULL DEFAULT '{}',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user_id    ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_action     ON credit_transactions(action);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_user_credits_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW EXECUTE FUNCTION update_user_credits_updated_at();

-- ── deduct_credits() — atomic RPC ────────────────────────────────────────────
-- Called from src/lib/credits/index.ts via supabase.rpc('deduct_credits', ...)
-- Checks balance, deducts atomically, writes the transaction record.
-- Returns: { success: bool, balance: int }
-- NEVER deducts if balance is insufficient — returns success=false instead.

CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id  UUID,
  p_action   TEXT,
  p_amount   INTEGER,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance     INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the row to prevent concurrent deductions racing
  SELECT balance INTO v_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- No credits row yet — treat as zero balance
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'balance', 0);
  END IF;

  -- Insufficient balance
  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'balance', v_balance);
  END IF;

  v_new_balance := v_balance - p_amount;

  -- Deduct
  UPDATE user_credits
  SET balance = v_new_balance
  WHERE user_id = p_user_id;

  -- Write immutable ledger entry
  INSERT INTO credit_transactions (user_id, action, credits_used, balance_after, metadata)
  VALUES (p_user_id, p_action, p_amount, v_new_balance, p_metadata);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance);
END;
$$;

-- ── add_credits() — atomic RPC ────────────────────────────────────────────────
-- Used by Stripe webhook to reset/top-up credits.
-- p_amount > 0 always (adding credits, not subtracting).

CREATE OR REPLACE FUNCTION add_credits(
  p_user_id     UUID,
  p_action      TEXT,   -- e.g. 'plan_reset' | 'topup'
  p_amount      INTEGER,
  p_plan_credits INTEGER DEFAULT NULL,
  p_period_start TIMESTAMPTZ DEFAULT NULL,
  p_period_end   TIMESTAMPTZ DEFAULT NULL,
  p_metadata     JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  INSERT INTO user_credits (user_id, balance, plan_credits, period_start, period_end)
  VALUES (p_user_id, p_amount, COALESCE(p_plan_credits, p_amount), p_period_start, p_period_end)
  ON CONFLICT (user_id) DO UPDATE
    SET balance      = CASE
                         -- plan_reset: replace balance entirely
                         WHEN p_action = 'plan_reset' THEN p_amount
                         -- topup: add to existing balance
                         ELSE user_credits.balance + p_amount
                       END,
        plan_credits  = COALESCE(p_plan_credits, user_credits.plan_credits),
        period_start  = COALESCE(p_period_start, user_credits.period_start),
        period_end    = COALESCE(p_period_end,   user_credits.period_end)
  RETURNING balance INTO v_new_balance;

  INSERT INTO credit_transactions (user_id, action, credits_used, balance_after, metadata)
  VALUES (p_user_id, p_action, -p_amount, v_new_balance, p_metadata);

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance);
END;
$$;

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

ALTER TABLE user_credits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own balance
CREATE POLICY "Users can view own credits"
  ON user_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role / RPC functions can write credit rows
CREATE POLICY "Service role manages credits"
  ON user_credits FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read their own transaction history
CREATE POLICY "Users can view own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role / RPC functions can write transactions
CREATE POLICY "Service role manages transactions"
  ON credit_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- ── Seed credits row on new user signup ───────────────────────────────────────
-- Extend the existing handle_new_user trigger to also create a credits row.
-- New users start with 0 credits (Stripe webhook adds plan credits on checkout).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, trial_ends_at)
  VALUES (
    NEW.id,
    'trialing',
    NOW() + INTERVAL '7 days'
  );

  INSERT INTO public.user_credits (user_id, balance, plan_credits)
  VALUES (NEW.id, 0, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
