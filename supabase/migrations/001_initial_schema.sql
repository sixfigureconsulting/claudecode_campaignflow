-- ============================================================
-- CampaignFlow Pro — Initial Schema
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE project_type AS ENUM (
  'outbound',
  'seo',
  'ads',
  'social',
  'email',
  'custom'
);

CREATE TYPE report_type AS ENUM (
  'weekly',
  'monthly',
  'custom'
);

CREATE TYPE metric_category AS ENUM (
  'traffic',
  'leads',
  'revenue',
  'cost',
  'custom'
);

CREATE TYPE ai_provider AS ENUM (
  'openai',
  'anthropic'
);

CREATE TYPE subscription_plan AS ENUM (
  'monthly',
  'yearly'
);

CREATE TYPE subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused'
);

-- ============================================================
-- TABLES
-- ============================================================

-- clients
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  industry    TEXT,
  website     TEXT,
  primary_offer TEXT,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- projects
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  project_type project_type NOT NULL DEFAULT 'custom',
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- reports
CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  report_type  report_type NOT NULL DEFAULT 'monthly',
  report_date  DATE NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- report_metrics
CREATE TABLE report_metrics (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id        UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  metric_name      TEXT NOT NULL,
  metric_value     NUMERIC NOT NULL DEFAULT 0,
  metric_category  metric_category NOT NULL DEFAULT 'custom',
  display_order    INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ai_configs (stores encrypted user API keys)
CREATE TABLE ai_configs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        ai_provider NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  model_preference TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- ai_recommendations (cached AI output per report)
CREATE TABLE ai_recommendations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id       UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        ai_provider NOT NULL,
  model_used      TEXT,
  executive_summary    TEXT,
  kpi_analysis         TEXT,
  weakest_metric       TEXT,
  bottleneck_explanation TEXT,
  action_steps         JSONB,   -- array of 5 tactical steps
  strategic_improvements JSONB, -- array of 3 strategic improvements
  raw_response         TEXT,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- subscriptions
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan                  subscription_plan,
  status                subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at         TIMESTAMPTZ,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_reports_project_id ON reports(project_id);
CREATE INDEX idx_report_metrics_report_id ON report_metrics(report_id);
CREATE INDEX idx_ai_configs_user_id ON ai_configs(user_id);
CREATE INDEX idx_ai_recommendations_report_id ON ai_recommendations(report_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_ai_configs_updated_at
  BEFORE UPDATE ON ai_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- CLIENTS
CREATE POLICY "Users can manage their own clients"
  ON clients FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- PROJECTS (via client ownership)
CREATE POLICY "Users can manage projects of their clients"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = projects.client_id
        AND clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = projects.client_id
        AND clients.user_id = auth.uid()
    )
  );

-- REPORTS (via project -> client ownership)
CREATE POLICY "Users can manage reports of their projects"
  ON reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      JOIN clients ON clients.id = projects.client_id
      WHERE projects.id = reports.project_id
        AND clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      JOIN clients ON clients.id = projects.client_id
      WHERE projects.id = reports.project_id
        AND clients.user_id = auth.uid()
    )
  );

-- REPORT METRICS (via report -> project -> client)
CREATE POLICY "Users can manage metrics of their reports"
  ON report_metrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM reports
      JOIN projects ON projects.id = reports.project_id
      JOIN clients ON clients.id = projects.client_id
      WHERE reports.id = report_metrics.report_id
        AND clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reports
      JOIN projects ON projects.id = reports.project_id
      JOIN clients ON clients.id = projects.client_id
      WHERE reports.id = report_metrics.report_id
        AND clients.user_id = auth.uid()
    )
  );

-- AI CONFIGS
CREATE POLICY "Users can manage their own AI configs"
  ON ai_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- AI RECOMMENDATIONS
CREATE POLICY "Users can manage their own AI recommendations"
  ON ai_recommendations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- SUBSCRIPTIONS
CREATE POLICY "Users can view their own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- HELPER FUNCTION: auto-create subscription on user signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, trial_ends_at)
  VALUES (
    NEW.id,
    'trialing',
    NOW() + INTERVAL '7 days'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
