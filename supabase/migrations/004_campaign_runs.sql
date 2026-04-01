-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: Campaign Runs
-- Stores per-project campaign run state for weekly reporting
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  instantly_campaign_id TEXT,               -- stored at push time, used for weekly stats pull
  leads_pushed          INTEGER DEFAULT 0,
  report_id             UUID REFERENCES reports(id) ON DELETE SET NULL,
  last_stats_pulled_at  TIMESTAMPTZ,
  next_stats_pull_at    TIMESTAMPTZ,        -- set to now() + 7 days when run is created
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campaign_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own campaign_runs"
  ON campaign_runs
  FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE c.user_id = auth.uid()
    )
  );
