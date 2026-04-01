-- ============================================================================
-- ALDERWELL PHARMACEUTICALS - COMPLETE DATABASE SETUP
-- ============================================================================
-- Copy and paste this entire script into Supabase SQL Editor
-- Execute in order (Top to Bottom)
-- ============================================================================

-- ============================================================================
-- 1. PROFILES TABLE (Extended Supabase Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'no_role',
  avatar_url TEXT,
  profile_picture_url TEXT,
  department TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
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

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Self profile access
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin access
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Operational roles can view basic profiles" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'compliance_reviewer', 'marketing_sales', 'liaison_officer', 'campaign_management')
  );

-- Self update
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin update
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- 2. CAMPAIGNS TABLE
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS campaign_seq START 1;

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY DEFAULT ('CMP-' || LPAD(CAST(NEXTVAL('campaign_seq') AS TEXT), 3, '0')),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'Active', 'On Hold', 'Archived')),
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12, 2),
  category TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view campaigns" ON campaigns
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owners and admins can update campaigns" ON campaigns
  FOR UPDATE USING (
    auth.uid() = owner_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- 3. MATERIALS TABLE
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS material_seq START 1;

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY DEFAULT ('MAT-' || LPAD(CAST(NEXTVAL('material_seq') AS TEXT), 4, '0')),
  campaign_id TEXT REFERENCES campaigns(id),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected')),
  submission_date TIMESTAMP DEFAULT NOW(),
  reviewed_by UUID REFERENCES profiles(id),
  review_notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view materials" ON materials
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'compliance_reviewer', 'campaign_management', 'admin') OR
    uploaded_by = auth.uid()
  );

CREATE POLICY "Compliance can update materials" ON materials
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('compliance_reviewer', 'admin')
  );

CREATE POLICY "Uploaders and admins can update materials" ON materials
  FOR UPDATE USING (
    uploaded_by = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    uploaded_by = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- 4. SUBMISSIONS TABLE
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS submission_seq START 1;

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY DEFAULT ('SUB-' || LPAD(CAST(NEXTVAL('submission_seq') AS TEXT), 3, '0')),
  material_id TEXT REFERENCES materials(id),
  campaign_id TEXT REFERENCES campaigns(id),
  submitter_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'Pending Review' CHECK (status IN ('Pending Review', 'Under Review', 'Approved', 'Rejected', 'Revisions Requested')),
  submission_date TIMESTAMP DEFAULT NOW(),
  review_deadline TIMESTAMP,
  reviewer_id UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Relevant users can view submissions" ON submissions
  FOR SELECT USING (
    submitter_id = auth.uid() OR
    reviewer_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- 5. HCP CONTACTS TABLE (Healthcare Professional CRM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hcp_contacts (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  name TEXT NOT NULL,
  qualification TEXT,
  specialism TEXT,
  organisation TEXT,
  location TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE hcp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing team can view HCPs" ON hcp_contacts
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'liaison_officer', 'campaign_management', 'admin')
  );

CREATE POLICY "Marketing team can insert HCPs" ON hcp_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'liaison_officer', 'campaign_management', 'admin')
  );

-- ============================================================================
-- 6. INTERACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  hcp_id UUID REFERENCES hcp_contacts(id),
  campaign_id TEXT REFERENCES campaigns(id),
  initiated_by UUID REFERENCES profiles(id),
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('Call', 'Email', 'Visit', 'Meeting', 'Other')),
  product_mentioned TEXT,
  notes TEXT,
  outcome TEXT,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  interaction_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing and compliance can view interactions" ON interactions
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'compliance_reviewer', 'campaign_management', 'admin')
  );

CREATE POLICY "Users can create their own interactions" ON interactions
  FOR INSERT WITH CHECK (initiated_by = auth.uid());

-- ============================================================================
-- 7. VISITS TABLE (Liaison Officer)
-- ============================================================================
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  hcp_id UUID REFERENCES hcp_contacts(id),
  liaison_officer_id UUID REFERENCES profiles(id),
  visit_date TIMESTAMP NOT NULL,
  visit_type TEXT NOT NULL CHECK (visit_type IN ('Product Introduction', 'Inventory Review', 'Training', 'Follow-up', 'Other')),
  outcome TEXT CHECK (outcome IN ('Follow-up Required', 'Closed', 'Pending', 'Escalated')),
  notes TEXT,
  samples_distributed BOOLEAN DEFAULT FALSE,
  materials_left TEXT[],
  hcp_feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and admin all visits" ON visits
  FOR SELECT USING (
    liaison_officer_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Users can create their own visits" ON visits
  FOR INSERT WITH CHECK (liaison_officer_id = auth.uid());

-- ============================================================================
-- 8. TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Completed', 'Cancelled')),
  priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  due_date DATE,
  related_campaign_id TEXT REFERENCES campaigns(id),
  completion_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tasks, admins see all" ON tasks
  FOR SELECT USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Users can create tasks" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    (assigned_to IS NULL OR assigned_to = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  );

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

-- ============================================================================
-- 9. ACTIVITY LOGS TABLE (Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  status TEXT DEFAULT 'Success' CHECK (status IN ('Success', 'Failed', 'Modified')),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_resource ON activity_logs(resource_type, resource_id);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compliance and admins can view activity logs" ON activity_logs
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('compliance_reviewer', 'admin')
  );

CREATE POLICY "Users can view their own activity" ON activity_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert activity logs" ON activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================================
-- 10. COMPLIANCE FLAGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_flags (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  material_id TEXT REFERENCES materials(id),
  interaction_id UUID REFERENCES interactions(id),
  flagged_by UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Under Review', 'Resolved', 'False Alarm')),
  reviewer_id UUID REFERENCES profiles(id),
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

ALTER TABLE compliance_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compliance team can view flags" ON compliance_flags
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('compliance_reviewer', 'admin')
  );

-- ============================================================================
-- 11. SYSTEM SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage settings" ON system_settings
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_campaign ON materials(campaign_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_reviewer ON submissions(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_hcp_specialism ON hcp_contacts(specialism);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_interactions_date ON interactions(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_campaign ON interactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_liaison ON visits(liaison_officer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

-- ============================================================================
-- DEFAULT SYSTEM SETTINGS
-- ============================================================================
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('max_file_size_mb', '50', 'Maximum material file size in MB'),
  ('material_approval_days', '7', 'Days to complete material approval'),
  ('notification_enabled', 'true', 'System notifications active'),
  ('data_retention_days', '90', 'Days to retain activity logs'),
  ('audit_logging_enabled', 'true', 'Log all user actions')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- AUDIT LOGGING FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_details JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, resource_type, resource_id, details, timestamp)
  VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_details, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Compatibility overload for triggers that pass UUID resource ids (e.g., profiles.id).
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_details JSONB
)
RETURNS void AS $$
BEGIN
  PERFORM log_activity(p_user_id, p_action, p_resource_type, p_resource_id::TEXT, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION log_activity(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_activity(UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;

-- ============================================================================
-- TRIGGERS FOR ACTIVITY LOGGING
-- ============================================================================

-- Log material status changes
CREATE OR REPLACE FUNCTION trigger_log_material_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_activity(
      NEW.reviewed_by,
      'Material Status Changed: ' || OLD.status || ' → ' || NEW.status,
      'materials',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_material_status_log
  AFTER UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_material_change();

-- Log submission status changes
CREATE OR REPLACE FUNCTION trigger_log_submission_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_activity(
      NEW.reviewer_id,
      'Submission Status Changed: ' || OLD.status || ' → ' || NEW.status,
      'submissions',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_submission_status_log
  AFTER UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_submission_change();

-- Log role changes
CREATE OR REPLACE FUNCTION trigger_log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM log_activity(
      NEW.id,
      'User Role Changed: ' || COALESCE(OLD.role, 'null') || ' → ' || NEW.role,
      'profiles',
      NEW.id,
      jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_role_change_log
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_role_change();

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- Next steps:
-- 1. Create a storage bucket named 'materials' for file uploads
-- 2. Create test user accounts using Supabase Auth dashboard
-- 3. Manually insert profiles for each test user
-- 4. Run integration tests to verify RLS policies
-- ============================================================================
