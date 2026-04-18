-- ============================================================
-- CampaignFlow Pro — Comment-to-DM Automations
-- Migration 012
-- ============================================================
-- Stores Instagram & Facebook keyword-triggered comment→DM rules.
-- When a user comments a keyword on a monitored post, the
-- automation fires a DM via ManyChat (IG) or Meta Graph API (FB).
-- ============================================================

CREATE TYPE automation_platform AS ENUM ('instagram', 'facebook');
CREATE TYPE automation_status   AS ENUM ('active', 'paused', 'draft');

CREATE TABLE comment_automations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Display name for the automation rule
  name            TEXT NOT NULL,

  -- Which platform this rule applies to
  platform        automation_platform NOT NULL,

  -- Keyword that triggers the DM (case-insensitive match in comment text)
  keyword         TEXT NOT NULL,

  -- The DM message sent when the keyword is matched
  reply_dm        TEXT NOT NULL,

  -- Optional: only trigger on this specific post URL/ID (NULL = any post)
  post_id         TEXT,
  post_url        TEXT,

  -- Current state of the automation
  status          automation_status NOT NULL DEFAULT 'active',

  -- Running counters
  trigger_count   INTEGER NOT NULL DEFAULT 0,
  dm_sent_count   INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comment_automations_user_id  ON comment_automations(user_id);
CREATE INDEX idx_comment_automations_platform ON comment_automations(platform);
CREATE INDEX idx_comment_automations_status   ON comment_automations(status);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_comment_automations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER comment_automations_updated_at
  BEFORE UPDATE ON comment_automations
  FOR EACH ROW EXECUTE FUNCTION update_comment_automations_updated_at();

-- RLS
ALTER TABLE comment_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own comment automations"
  ON comment_automations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
