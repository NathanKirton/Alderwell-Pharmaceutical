-- Hotfix: allow campaign tagging for interaction logs
-- Run in Supabase SQL Editor on existing environments.

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interactions_campaign ON interactions(campaign_id);
