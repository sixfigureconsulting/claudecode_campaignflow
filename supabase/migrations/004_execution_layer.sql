-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Execution Layer Phase 1
-- Adds integration_configs and executions tables
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Integration configs (per-project API keys for Apollo, Heyreach, Instantly)
CREATE TABLE IF NOT EXISTS integration_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  service           TEXT NOT NULL,  -- 'apollo' | 'heyreach' | 'instantly'
  api_key_encrypted TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, service)
);

ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own integration_configs"
  ON integration_configs
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

-- 2. Executions log
CREATE TABLE IF NOT EXISTS executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action_type     TEXT NOT NULL,  -- 'apollo_enrich' | 'sfc_sequence_builder'
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed'
  inputs_summary  TEXT,
  outputs_summary TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own executions"
  ON executions
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
