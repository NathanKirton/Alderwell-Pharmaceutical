-- Hotfix: allow operational roles to resolve user names for cross-role UI joins
-- Run this in Supabase SQL Editor on existing environments.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Ensure core profile policies exist so users can always resolve their own account.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile" ON profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles" ON profiles
      FOR SELECT USING (
        COALESCE((SELECT lower(role) FROM profiles WHERE id = auth.uid()), '') = 'admin'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile" ON profiles
      FOR UPDATE USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can update any profile'
  ) THEN
    CREATE POLICY "Admins can update any profile" ON profiles
      FOR UPDATE USING (
        COALESCE((SELECT lower(role) FROM profiles WHERE id = auth.uid()), '') = 'admin'
      )
      WITH CHECK (
        COALESCE((SELECT lower(role) FROM profiles WHERE id = auth.uid()), '') = 'admin'
      );
  END IF;
END
$$;

DROP POLICY IF EXISTS "Operational roles can view basic profiles" ON profiles;

CREATE POLICY "Operational roles can view basic profiles" ON profiles
  FOR SELECT USING (
    COALESCE((SELECT lower(role) FROM profiles WHERE id = auth.uid()), '') IN (
      'admin',
      'compliance_reviewer',
      'marketing_sales',
      'marketing & sales',
      'marketing_and_sales',
      'liaison_officer',
      'campaign_management',
      'campaign_manager'
    )
  );

-- Optional recovery checks (run manually if a user is stuck on Access Denied):
-- 1) Verify current user's profile + role.
-- SELECT id, email, role FROM profiles WHERE id = auth.uid();
--
-- 2) If role is NULL or no_role, assign a valid role for that account.
-- UPDATE profiles SET role = 'campaign_management' WHERE email = 'user@example.com';
--
-- 3) If UPDATE affects 0 rows, the profile row may not exist.
--    This upserts from auth.users and forces admin role for a known email.
-- INSERT INTO profiles (id, email, full_name, role)
-- SELECT
--   u.id,
--   u.email,
--   COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
--   'admin'
-- FROM auth.users u
-- WHERE lower(u.email) = lower('admin@alderwell.com')
-- ON CONFLICT (id)
-- DO UPDATE SET
--   email = EXCLUDED.email,
--   role = 'admin';