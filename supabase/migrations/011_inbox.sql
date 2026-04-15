-- ── Inbox Feature ────────────────────────────────────────────────────────────
-- Tables: inbox_accounts, inbox_conversations, inbox_messages, inbox_settings

-- Connected accounts (Gmail OAuth, HeyReach/LinkedIn, ManyChat, form webhooks)
CREATE TABLE IF NOT EXISTS inbox_accounts (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider               TEXT NOT NULL,             -- 'gmail' | 'linkedin' | 'manychat' | 'form'
  account_label          TEXT NOT NULL,             -- e.g. "Work Gmail", "Personal Gmail"
  email                  TEXT,                      -- for gmail accounts
  access_token_encrypted TEXT,                      -- OAuth access token (AES-256)
  refresh_token_encrypted TEXT,                     -- OAuth refresh token (AES-256)
  extra_config           JSONB DEFAULT '{}',        -- provider-specific extras (scopes, account_id, etc.)
  is_active              BOOLEAN DEFAULT true,
  last_synced_at         TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_accounts_user ON inbox_accounts(user_id);

-- Thread-level conversation groupings with AI prospect classification
CREATE TABLE IF NOT EXISTS inbox_conversations (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id             UUID REFERENCES inbox_accounts(id) ON DELETE CASCADE NOT NULL,
  external_thread_id     TEXT,                      -- provider's thread ID for dedup
  subject                TEXT,
  contact_name           TEXT,
  contact_email          TEXT,
  contact_linkedin_url   TEXT,
  contact_company        TEXT,
  -- AI classification
  classification         TEXT DEFAULT 'unclassified',  -- 'prospect' | 'not_prospect' | 'warmup' | 'unclassified'
  classification_reason  TEXT,
  classification_score   INT,                        -- 0-100 confidence
  -- State
  is_read                BOOLEAN DEFAULT false,
  is_archived            BOOLEAN DEFAULT false,
  is_blocked             BOOLEAN DEFAULT false,
  last_message_at        TIMESTAMPTZ DEFAULT NOW(),
  message_count          INT DEFAULT 0,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, external_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_convos_user      ON inbox_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_convos_class     ON inbox_conversations(user_id, classification);
CREATE INDEX IF NOT EXISTS idx_inbox_convos_last_msg  ON inbox_conversations(user_id, last_message_at DESC);

-- Individual messages within a conversation
CREATE TABLE IF NOT EXISTS inbox_messages (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id        UUID REFERENCES inbox_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id                UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  external_message_id    TEXT,
  direction              TEXT NOT NULL,             -- 'inbound' | 'outbound'
  sender_name            TEXT,
  sender_email           TEXT,
  body                   TEXT NOT NULL,
  body_html              TEXT,
  sent_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_msgs_convo ON inbox_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_inbox_msgs_user  ON inbox_messages(user_id);

-- Per-user ICP config, keyword lists, and block rules
CREATE TABLE IF NOT EXISTS inbox_settings (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  icp_description        TEXT DEFAULT '',           -- Free-text: what an ideal prospect looks like
  sales_keywords         TEXT[] DEFAULT ARRAY['proposal', 'demo', 'appointment', 'meeting', 'pricing', 'quote', 'interested', 'schedule', 'call'],
  blocked_senders        TEXT[] DEFAULT ARRAY[]::TEXT[],   -- email addresses/domains
  block_warmup_tools     BOOLEAN DEFAULT true,      -- auto-block Instantly, Smartlead warmup signals
  auto_classify          BOOLEAN DEFAULT true,      -- classify on arrival using AI
  ai_provider            TEXT DEFAULT 'anthropic',  -- 'anthropic' | 'openai'
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE inbox_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_settings      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inbox_accounts_owner"      ON inbox_accounts      USING (user_id = auth.uid());
CREATE POLICY "inbox_conversations_owner" ON inbox_conversations USING (user_id = auth.uid());
CREATE POLICY "inbox_messages_owner"      ON inbox_messages      USING (user_id = auth.uid());
CREATE POLICY "inbox_settings_owner"      ON inbox_settings      USING (user_id = auth.uid());
