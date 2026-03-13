-- ============================================================
-- Migration 002 — Unique constraint on ai_recommendations
-- ============================================================

-- One AI recommendation per (report, provider) — upsertable
ALTER TABLE ai_recommendations
  ADD CONSTRAINT ai_recommendations_report_provider_unique
  UNIQUE (report_id, provider);

-- Update RLS policy for ai_recommendations to also allow upsert
DROP POLICY IF EXISTS "Users can manage their own AI recommendations" ON ai_recommendations;

CREATE POLICY "Users can manage their own AI recommendations"
  ON ai_recommendations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_report_provider
  ON ai_recommendations(report_id, provider);
