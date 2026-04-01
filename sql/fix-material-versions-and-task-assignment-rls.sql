-- Hotfix: add material version history + allow campaign managers to assign tasks cross-role
-- Run in Supabase SQL Editor.

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 1) Material versions table for immutable history snapshots.
CREATE TABLE IF NOT EXISTS material_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  change_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_material_versions_material ON material_versions(material_id);
CREATE INDEX IF NOT EXISTS idx_material_versions_created_at ON material_versions(created_at DESC);

ALTER TABLE material_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'material_versions'
      AND policyname = 'Operational roles can view material versions'
  ) THEN
    CREATE POLICY "Operational roles can view material versions" ON material_versions
      FOR SELECT
      USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'campaign_management', 'liaison_officer', 'compliance_reviewer', 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'material_versions'
      AND policyname = 'Operational roles can insert material versions'
  ) THEN
    CREATE POLICY "Operational roles can insert material versions" ON material_versions
      FOR INSERT TO authenticated
      WITH CHECK (
        uploaded_by = auth.uid() AND
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'campaign_management', 'liaison_officer', 'compliance_reviewer', 'admin')
      );
  END IF;
END
$$;

-- 2) Task assignment policy update: campaign managers and admins can assign tasks to other users.
DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Operational roles can create tasks" ON tasks;

CREATE POLICY "Operational roles can create tasks" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('campaign_management', 'admin') OR
      assigned_to IS NULL OR
      assigned_to = auth.uid()
    )
  );
