-- Hotfix: allow operational roles to replace material files under RLS
-- Run this in Supabase SQL Editor on existing environments.

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

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

-- Replace existing policies so stale restrictive policies do not remain active.
DROP POLICY IF EXISTS "Operational roles can view material versions" ON material_versions;
DROP POLICY IF EXISTS "Operational roles can insert material versions" ON material_versions;
DROP POLICY IF EXISTS "Uploaders and admins can update materials" ON materials;

CREATE POLICY "Operational roles can view material versions" ON material_versions
  FOR SELECT
  USING (
    COALESCE((SELECT lower(role) FROM profiles WHERE id = auth.uid()), '') IN (
      'marketing_sales',
      'marketing & sales',
      'marketing_and_sales',
      'campaign_management',
      'campaign_manager',
      'liaison_officer',
      'compliance_reviewer',
      'admin'
    )
  );

CREATE POLICY "Operational roles can insert material versions" ON material_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    uploaded_by = auth.uid()
  );

CREATE POLICY "Uploaders and admins can update materials" ON materials
  FOR UPDATE
  USING (
    uploaded_by = auth.uid() OR
    COALESCE((SELECT lower(role) FROM profiles WHERE id = auth.uid()), '') IN (
      'campaign_management',
      'campaign_manager',
      'compliance_reviewer',
      'admin'
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid() OR
    COALESCE((SELECT lower(role) FROM profiles WHERE id = auth.uid()), '') IN (
      'campaign_management',
      'campaign_manager',
      'compliance_reviewer',
      'admin'
    )
  );