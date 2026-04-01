-- Rollback: restore profiles RLS policies to original baseline
-- Run this in Supabase SQL Editor.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Remove all profile policies that may conflict
DROP POLICY IF EXISTS "Operational roles can view basic profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Baseline policies (from initial setup)
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Operational roles can view basic profiles" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin',
      'compliance_reviewer',
      'marketing_sales',
      'liaison_officer',
      'campaign_management'
    )
  );

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Optional: ensure your admin account has role set after rollback
-- UPDATE profiles SET role = 'admin' WHERE lower(email) = lower('admin@alderwell.com');

-- Optional diagnostics
-- SELECT id, email, role FROM profiles WHERE lower(email) = lower('admin@alderwell.com');
-- SELECT id, email, role FROM profiles WHERE id = auth.uid();
