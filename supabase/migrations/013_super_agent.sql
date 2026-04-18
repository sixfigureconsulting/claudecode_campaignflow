-- ============================================================
-- CampaignFlow Pro — Super AI Agent
-- Migration 013
-- ============================================================
-- Stores agent sessions and message history for the Super Agent
-- chat interface. Each session represents one autonomous run
-- that researches an ICP, builds lead lists, generates sequences,
-- creates campaigns and automations, then presents an outreach plan.
-- ============================================================

CREATE TYPE super_agent_status AS ENUM (
  'running',
  'awaiting_approval',
  'approved',
  'launched',
  'failed'
);

-- ── Sessions ─────────────────────────────────────────────────────────────────
-- One row per agent run. Stores the user's inputs, the final plan,
-- and the IDs of all resources the agent created (for approval launch).

CREATE TABLE super_agent_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User's initial inputs
  offer           TEXT NOT NULL,
  icp             TEXT NOT NULL,
  goals           TEXT NOT NULL,
  channels        TEXT[] NOT NULL DEFAULT '{}',

  -- Lifecycle state
  status          super_agent_status NOT NULL DEFAULT 'running',

  -- Final structured plan (set when agent completes)
  outreach_plan   JSONB,

  -- IDs of resources created in draft (for approval)
  created_list_ids        UUID[] NOT NULL DEFAULT '{}',
  created_campaign_ids    UUID[] NOT NULL DEFAULT '{}',
  created_automation_ids  UUID[] NOT NULL DEFAULT '{}',

  -- Token usage for billing transparency
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_super_agent_sessions_user_id ON super_agent_sessions(user_id);
CREATE INDEX idx_super_agent_sessions_status  ON super_agent_sessions(status);

-- ── Messages ──────────────────────────────────────────────────────────────────
-- Append-only message log. Stores every Claude turn (including tool calls
-- and results) as raw Anthropic ContentBlock arrays so the agent loop can
-- replay history accurately. Also stores display-layer data for the UI.

CREATE TABLE super_agent_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES super_agent_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Claude API role
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool_result')),

  -- Raw Anthropic ContentBlock[] — used to replay into Claude on each turn
  content         JSONB NOT NULL,

  -- Display-layer fields for fast UI rendering (denormalised)
  display_type    TEXT CHECK (display_type IN (
    'user_message', 'agent_thinking', 'tool_start', 'tool_result', 'agent_text', 'plan_ready'
  )),
  display_data    JSONB NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_super_agent_messages_session ON super_agent_messages(session_id, created_at);

-- ── Updated-at trigger for sessions ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_super_agent_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER super_agent_sessions_updated_at
  BEFORE UPDATE ON super_agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_super_agent_sessions_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE super_agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own super agent sessions"
  ON super_agent_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE super_agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own super agent messages"
  ON super_agent_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
