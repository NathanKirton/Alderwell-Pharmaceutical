-- Hotfix: allow campaign management role to update campaign records
-- Run this in Supabase SQL Editor on existing environments.

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'campaigns'
      AND policyname = 'Campaign management can update campaigns'
  ) THEN
    CREATE POLICY "Campaign management can update campaigns" ON campaigns
      FOR UPDATE TO authenticated
      USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('campaign_management', 'admin')
      )
      WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('campaign_management', 'admin')
      );
  END IF;
END
$$;
