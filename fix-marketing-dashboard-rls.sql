-- Hotfix: enable Marketing/Sales dashboard forms (HCP create + Task create/update) under RLS
-- Run this in Supabase SQL Editor on existing environments.

ALTER TABLE hcp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hcp_contacts'
      AND policyname = 'Marketing team can insert HCPs'
  ) THEN
    CREATE POLICY "Marketing team can insert HCPs" ON hcp_contacts
      FOR INSERT TO authenticated
      WITH CHECK (
        created_by = auth.uid() AND
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'liaison_officer', 'campaign_management', 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tasks'
      AND policyname = 'Users can create tasks'
  ) THEN
    CREATE POLICY "Users can create tasks" ON tasks
      FOR INSERT TO authenticated
      WITH CHECK (
        created_by = auth.uid() AND
        (assigned_to IS NULL OR assigned_to = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tasks'
      AND policyname = 'Users can update own tasks'
  ) THEN
    CREATE POLICY "Users can update own tasks" ON tasks
      FOR UPDATE USING (
        assigned_to = auth.uid() OR
        created_by = auth.uid() OR
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      )
      WITH CHECK (
        assigned_to = auth.uid() OR
        created_by = auth.uid() OR
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END
$$;