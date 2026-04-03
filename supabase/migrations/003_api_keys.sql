-- ============================================================
-- CampaignFlow Pro — API Keys
-- ============================================================

CREATE TABLE api_keys (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  key_hash        TEXT        NOT NULL UNIQUE,  -- SHA-256 of the full key
  key_prefix      TEXT        NOT NULL,          -- first 12 chars for display
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own API keys"
  ON api_keys
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
