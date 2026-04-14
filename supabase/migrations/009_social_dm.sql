-- ============================================================
-- CampaignFlow Pro — Social DM Outreach Infrastructure
-- Migration 009
-- ============================================================
-- Tables: social_campaigns, social_campaign_leads, oauth_connections
-- ============================================================

-- ── ENUMS ─────────────────────────────────────────────────────────────────────

CREATE TYPE social_channel AS ENUM (
  'linkedin',
  'reddit',
  'twitter',
  'email',
  'instagram',
  'facebook'
);

CREATE TYPE social_campaign_status AS ENUM (
  'draft',
  'active',
  'paused',
  'completed',
  'failed'
);

CREATE TYPE social_lead_status AS ENUM (
  'pending',
  'sent',
  'replied',
  'failed',
  'skipped'
);

-- ── social_campaigns ──────────────────────────────────────────────────────────
-- One record per DM outreach campaign. Each campaign targets a single channel
-- and references a lead list. message_config stores the Super DM Setter
-- settings (tone, industry, message_type, etc.) used to generate messages.

CREATE TABLE social_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  channel          social_channel NOT NULL,
  status           social_campaign_status NOT NULL DEFAULT 'draft',

  -- Link to existing lead list (optional — may also have inline leads)
  list_id          UUID REFERENCES lead_lists(id) ON DELETE SET NULL,

  -- Super DM Setter config: tone, industry, message_type, channel, model, etc.
  message_config   JSONB NOT NULL DEFAULT '{}',

  -- Schedule config: send_immediately, send_at, daily_limit, delay_between_sends_sec
  schedule_config  JSONB NOT NULL DEFAULT '{}',

  -- Running stats (denormalised for fast dashboard reads)
  total_leads      INTEGER NOT NULL DEFAULT 0,
  sent_count       INTEGER NOT NULL DEFAULT 0,
  reply_count      INTEGER NOT NULL DEFAULT 0,
  failed_count     INTEGER NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_campaigns_user_id ON social_campaigns(user_id);
CREATE INDEX idx_social_campaigns_status  ON social_campaigns(status);
CREATE INDEX idx_social_campaigns_channel ON social_campaigns(channel);

-- ── social_campaign_leads ─────────────────────────────────────────────────────
-- One row per lead per campaign. Stores the generated message, send status,
-- and platform-specific identifiers (reddit username, twitter handle, etc.).

CREATE TABLE social_campaign_leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES social_campaigns(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core contact fields (mirrors lead_list_contacts)
  first_name          TEXT NOT NULL DEFAULT '',
  last_name           TEXT NOT NULL DEFAULT '',
  email               TEXT NOT NULL DEFAULT '',
  company             TEXT NOT NULL DEFAULT '',
  title               TEXT NOT NULL DEFAULT '',

  -- Platform-specific handles — populated depending on channel
  linkedin_url        TEXT,
  reddit_username     TEXT,
  twitter_handle      TEXT,
  instagram_handle    TEXT,
  facebook_profile    TEXT,

  -- AI-generated message for this specific lead
  generated_message   TEXT,

  -- Send tracking
  status              social_lead_status NOT NULL DEFAULT 'pending',
  platform_message_id TEXT,   -- ID returned by platform after successful send
  error_message       TEXT,   -- Failure reason if status = 'failed'
  sent_at             TIMESTAMPTZ,
  replied_at          TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_campaign_leads_campaign_id ON social_campaign_leads(campaign_id);
CREATE INDEX idx_social_campaign_leads_user_id     ON social_campaign_leads(user_id);
CREATE INDEX idx_social_campaign_leads_status      ON social_campaign_leads(status);

-- ── oauth_connections ─────────────────────────────────────────────────────────
-- Stores encrypted OAuth tokens for platforms that require user-level OAuth
-- (Reddit, Twitter/X). One row per user per platform.
-- Tokens are encrypted using the same AES-256 scheme as api_key_encrypted.

CREATE TABLE oauth_connections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Platform identifier: 'reddit' | 'twitter' | 'instagram' | 'facebook'
  platform                TEXT NOT NULL,

  -- Encrypted OAuth tokens (use encryptApiKey / decryptApiKey from src/lib/encryption)
  access_token_encrypted  TEXT NOT NULL,
  refresh_token_encrypted TEXT,

  -- When the access token expires (NULL = non-expiring)
  token_expires_at        TIMESTAMPTZ,

  -- The authenticated user's identity on the platform
  platform_user_id        TEXT,
  platform_username       TEXT,

  -- Granted OAuth scopes as an array (e.g. ['privatemessages', 'identity'])
  scopes                  TEXT[] NOT NULL DEFAULT '{}',

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, platform)
);

CREATE INDEX idx_oauth_connections_user_id  ON oauth_connections(user_id);
CREATE INDEX idx_oauth_connections_platform ON oauth_connections(platform);

-- ── UPDATED_AT TRIGGERS ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_social_campaigns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER social_campaigns_updated_at
  BEFORE UPDATE ON social_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_social_campaigns_updated_at();

CREATE OR REPLACE FUNCTION update_oauth_connections_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER oauth_connections_updated_at
  BEFORE UPDATE ON oauth_connections
  FOR EACH ROW EXECUTE FUNCTION update_oauth_connections_updated_at();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

ALTER TABLE social_campaigns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_connections     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own social campaigns"
  ON social_campaigns FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own social campaign leads"
  ON social_campaign_leads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own OAuth connections"
  ON oauth_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
