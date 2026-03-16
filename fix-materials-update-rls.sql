-- Hotfix: allow material uploaders (and admins) to replace/edit material files under RLS
-- Run this in Supabase SQL Editor on existing environments.

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materials'
      AND policyname = 'Uploaders and admins can update materials'
  ) THEN
    CREATE POLICY "Uploaders and admins can update materials" ON materials
      FOR UPDATE USING (
        uploaded_by = auth.uid() OR
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      )
      WITH CHECK (
        uploaded_by = auth.uid() OR
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END
$$;