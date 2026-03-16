-- Hotfix: normalize and enforce valid profile role values (including campaign_management)
-- Run this in Supabase SQL Editor on existing environments.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Normalize common campaign role variants to the canonical value used by the app routing.
UPDATE profiles
SET role = 'campaign_management'
WHERE lower(role) IN ('campaign manager', 'campaign-manager', 'campaign_manager', 'campaign_management ');

-- Move any unknown role values to no_role so constraint creation does not fail.
UPDATE profiles
SET role = 'no_role'
WHERE role NOT IN ('admin', 'marketing_sales', 'compliance_reviewer', 'campaign_management', 'liaison_officer', 'no_role');

DO $$
DECLARE
  c RECORD;
BEGIN
  -- Drop older role check constraints that can block campaign_management assignments.
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
      AND conname <> 'profiles_role_allowed_check'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_allowed_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_role_allowed_check
      CHECK (role IN ('admin', 'marketing_sales', 'compliance_reviewer', 'campaign_management', 'liaison_officer', 'no_role'));
  END IF;
END
$$;