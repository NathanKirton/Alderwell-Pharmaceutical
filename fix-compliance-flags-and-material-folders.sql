-- Hotfix: compliance flagging RLS + campaign material assignment + material folders
-- Run this in Supabase SQL Editor on existing environments.

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_flags ENABLE ROW LEVEL SECURITY;

-- 1) Ensure materials can be created by operational roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materials'
      AND policyname = 'Operational roles can insert materials'
  ) THEN
    CREATE POLICY "Operational roles can insert materials" ON materials
      FOR INSERT TO authenticated
      WITH CHECK (
        uploaded_by = auth.uid() AND
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'campaign_management', 'liaison_officer', 'compliance_reviewer', 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'materials'
      AND policyname = 'Campaign managers can reassign campaign and folder'
  ) THEN
    CREATE POLICY "Campaign managers can reassign campaign and folder" ON materials
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

-- 2) Ensure compliance flags can be created and updated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_flags'
      AND policyname = 'Operational roles can insert flags'
  ) THEN
    CREATE POLICY "Operational roles can insert flags" ON compliance_flags
      FOR INSERT TO authenticated
      WITH CHECK (
        flagged_by = auth.uid() AND
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'campaign_management', 'liaison_officer', 'compliance_reviewer', 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_flags'
      AND policyname = 'Compliance team can update flags'
  ) THEN
    CREATE POLICY "Compliance team can update flags" ON compliance_flags
      FOR UPDATE TO authenticated
      USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('compliance_reviewer', 'admin')
      )
      WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('compliance_reviewer', 'admin')
      );
  END IF;
END
$$;

-- 3) Material folders table + column on materials
CREATE TABLE IF NOT EXISTS material_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (campaign_id, name)
);

ALTER TABLE material_folders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'material_folders'
      AND policyname = 'Operational roles can view material folders'
  ) THEN
    CREATE POLICY "Operational roles can view material folders" ON material_folders
      FOR SELECT USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'campaign_management', 'liaison_officer', 'compliance_reviewer', 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'material_folders'
      AND policyname = 'Campaign managers can create material folders'
  ) THEN
    CREATE POLICY "Campaign managers can create material folders" ON material_folders
      FOR INSERT TO authenticated
      WITH CHECK (
        created_by = auth.uid() AND
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('campaign_management', 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'material_folders'
      AND policyname = 'Campaign managers can update material folders'
  ) THEN
    CREATE POLICY "Campaign managers can update material folders" ON material_folders
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

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES material_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_materials_folder ON materials(folder_id);
CREATE INDEX IF NOT EXISTS idx_material_folders_campaign ON material_folders(campaign_id);
