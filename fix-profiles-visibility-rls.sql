-- Hotfix: allow operational roles to resolve user names for cross-role UI joins
-- Run this in Supabase SQL Editor on existing environments.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Operational roles can view basic profiles'
  ) THEN
    CREATE POLICY "Operational roles can view basic profiles" ON profiles
      FOR SELECT USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'compliance_reviewer', 'marketing_sales', 'liaison_officer', 'campaign_management')
      );
  END IF;
END
$$;