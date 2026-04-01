-- Hotfix: allow compliance approvals to pass activity log inserts under RLS
-- Run this in Supabase SQL Editor on your existing database.

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'activity_logs'
      AND policyname = 'Authenticated users can insert activity logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert activity logs"
      ON activity_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION log_activity(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_details JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, resource_type, resource_id, details, timestamp)
  VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_details, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Compatibility overload for triggers that pass UUID resource ids (e.g., profiles.id).
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_details JSONB
)
RETURNS void AS $$
BEGIN
  PERFORM log_activity(p_user_id, p_action, p_resource_type, p_resource_id::TEXT, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION log_activity(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_activity(UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;
