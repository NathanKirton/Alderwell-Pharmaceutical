-- Emergency access restore for environments stuck on No Access
-- Run this entire script in Supabase SQL Editor.
-- This version hard-resets ALL profiles policies to avoid recursive RLS loops.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop every existing policy on profiles (including unknown/legacy names)
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', p.policyname);
  END LOOP;
END
$$;

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure every auth user has a profile row
INSERT INTO profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'no_role'
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Normalize known legacy aliases into canonical app roles
UPDATE profiles
SET role = CASE lower(COALESCE(role, ''))
  WHEN 'marketing & sales' THEN 'marketing_sales'
  WHEN 'marketing_and_sales' THEN 'marketing_sales'
  WHEN 'campaign_manager' THEN 'campaign_management'
  ELSE role
END
WHERE lower(COALESCE(role, '')) IN ('marketing & sales', 'marketing_and_sales', 'campaign_manager');

-- Emergency access restore: temporarily grant a usable role
-- Change 'marketing_sales' to any default role you prefer.
UPDATE profiles
SET role = 'marketing_sales'
WHERE role IS NULL OR lower(role) = 'no_role';

-- Ensure the known admin account is admin (if it exists)
UPDATE profiles
SET role = 'admin'
WHERE lower(email) = lower('admin@alderwell.com');

-- Verification
SELECT role, COUNT(*) AS users
FROM profiles
GROUP BY role
ORDER BY role;

SELECT id, email, role
FROM profiles
WHERE lower(email) = lower('admin@alderwell.com');
