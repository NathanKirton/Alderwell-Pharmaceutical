-- Hotfix: allow admins to hard-delete tasks under RLS
-- Run this in the Supabase SQL Editor on existing environments.

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;

CREATE POLICY "Admins can delete tasks" ON tasks
  FOR DELETE TO authenticated
  USING (
    COALESCE((SELECT lower(role) FROM profiles WHERE id = auth.uid()), '') IN (
      'admin'
    )
  );