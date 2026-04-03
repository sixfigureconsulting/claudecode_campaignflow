-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Outbound Restructure
-- - Add user_id directly to projects (campaigns now owned directly by users)
-- - Make client_id nullable (remove client layer requirement)
-- - Update project_type enum to outbound-only types
-- - Update RLS policies to use user_id directly
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add user_id to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill user_id from existing client relationships
UPDATE projects p
SET user_id = c.user_id
FROM clients c
WHERE c.id = p.client_id;

-- 3. Make user_id NOT NULL now that it's backfilled
ALTER TABLE projects ALTER COLUMN user_id SET NOT NULL;

-- 4. Make client_id nullable (optional grouping, no longer required)
ALTER TABLE projects ALTER COLUMN client_id DROP NOT NULL;

-- 5. Add index on user_id for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- 6. Update project_type enum to outbound-only values
-- First rename old enum, create new one, migrate data
ALTER TYPE project_type RENAME TO project_type_old;

CREATE TYPE project_type AS ENUM (
  'cold_email',
  'linkedin',
  'multi_channel',
  'cold_call',
  'custom'
);

ALTER TABLE projects
  ALTER COLUMN project_type DROP DEFAULT,
  ALTER COLUMN project_type TYPE project_type
    USING CASE project_type::text
      WHEN 'outbound'   THEN 'cold_email'::project_type
      WHEN 'email'      THEN 'cold_email'::project_type
      WHEN 'seo'        THEN 'custom'::project_type
      WHEN 'ads'        THEN 'custom'::project_type
      WHEN 'social'     THEN 'custom'::project_type
      ELSE project_type::text::project_type
    END,
  ALTER COLUMN project_type SET DEFAULT 'cold_email';

DROP TYPE project_type_old;

-- 7. Drop old projects RLS policy and replace with user_id-based policy
DROP POLICY IF EXISTS "Users can manage projects of their clients" ON projects;

CREATE POLICY "Users can manage their own campaigns"
  ON projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. Update RLS policies for downstream tables to use new projects.user_id path

-- Reports
DROP POLICY IF EXISTS "Users can manage reports of their projects" ON reports;
CREATE POLICY "Users can manage reports of their projects"
  ON reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = reports.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = reports.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Report metrics
DROP POLICY IF EXISTS "Users can manage metrics of their reports" ON report_metrics;
CREATE POLICY "Users can manage metrics of their reports"
  ON report_metrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM reports
      JOIN projects ON projects.id = reports.project_id
      WHERE reports.id = report_metrics.report_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reports
      JOIN projects ON projects.id = reports.project_id
      WHERE reports.id = report_metrics.report_id
        AND projects.user_id = auth.uid()
    )
  );

-- Integration configs (from migration 004)
DROP POLICY IF EXISTS "Users manage their own integration_configs" ON integration_configs;
CREATE POLICY "Users manage their own integration_configs"
  ON integration_configs FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Executions (from migration 004)
DROP POLICY IF EXISTS "Users manage their own executions" ON executions;
CREATE POLICY "Users manage their own executions"
  ON executions FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Campaign runs (from migration 005)
DROP POLICY IF EXISTS "Users manage their own campaign_runs" ON campaign_runs;
CREATE POLICY "Users manage their own campaign_runs"
  ON campaign_runs FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
