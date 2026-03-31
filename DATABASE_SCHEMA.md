# Alderwell Pharmaceuticals - Supabase Database Schema

## Overview
This document outlines the complete database structure for the Alderwell Pharmaceuticals role-based portal. The system handles 6 user roles with role-based access control (RBAC), campaign management, compliance oversight, and audit logging.

---

## Core Tables

### 1. **profiles** (Extended Supabase Auth)
Stores user profile data linked to Supabase built-in `auth.users`.

```sql
CREATE TABLE profiles (
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

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
```

---

### 2. **campaigns**
Master campaign records for all marketing and compliance campaigns.

```sql
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY DEFAULT 'CMP-' || LPAD(CAST(NEXTVAL('campaign_seq') AS TEXT), 3, '0'),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  description TEXT,
  status TEXT CHECK (status IN ('Planning', 'Active', 'On Hold', 'Archived')),
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12, 2),
  category TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE SEQUENCE campaign_seq START 1;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view campaigns"
  ON campaigns
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Campaign owners and admins can update"
  ON campaigns
  FOR UPDATE
  USING (
    auth.uid() = owner_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

---

### 3. **materials**
Stores marketing materials awaiting approval or in compliance review.

```sql
CREATE TABLE materials (
  id TEXT PRIMARY KEY DEFAULT 'MAT-' || LPAD(CAST(NEXTVAL('material_seq') AS TEXT), 4, '0'),
  campaign_id TEXT REFERENCES campaigns(id),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected')),
  submission_date TIMESTAMP DEFAULT NOW(),
  reviewed_by UUID REFERENCES profiles(id),
  review_notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE SEQUENCE material_seq START 1;

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing team can view submitted materials"
  ON materials
  FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'compliance_reviewer', 'admin') OR
    uploaded_by = auth.uid()
  );

CREATE POLICY "Compliance reviewers can update review status"
  ON materials
  FOR UPDATE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('compliance_reviewer', 'admin')
  );
```

---

### 4. **submissions** (Material Approval Workflow)
Tracks the approval workflow for materials and campaigns.

```sql
CREATE TABLE submissions (
  id TEXT PRIMARY KEY DEFAULT 'SUB-' || LPAD(CAST(NEXTVAL('submission_seq') AS TEXT), 3, '0'),
  material_id TEXT REFERENCES materials(id),
  campaign_id TEXT REFERENCES campaigns(id),
  submitter_id UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('Pending Review', 'Under Review', 'Approved', 'Rejected', 'Revisions Requested')),
  submission_date TIMESTAMP DEFAULT NOW(),
  review_deadline TIMESTAMP,
  reviewer_id UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE SEQUENCE submission_seq START 1;

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submitters and reviewers can view their submissions"
  ON submissions
  FOR SELECT
  USING (
    submitter_id = auth.uid() OR
    reviewer_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

---

### 5. **hcp_contacts** (Healthcare Professional Database)
CRM data for Marketing & Sales interactions.

```sql
CREATE TABLE hcp_contacts (
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

CREATE POLICY "Marketing team can view HCP contacts"
  ON hcp_contacts
  FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'liaison_officer', 'admin')
  );
```

---

### 6. **interactions**
Logs all HCP interactions, emails, calls, and visits.

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  hcp_id UUID REFERENCES hcp_contacts(id),
  campaign_id TEXT REFERENCES campaigns(id),
  initiated_by UUID REFERENCES profiles(id),
  interaction_type TEXT CHECK (interaction_type IN ('Call', 'Email', 'Visit', 'Meeting', 'Other')),
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

CREATE POLICY "Marketing and compliance can view interactions"
  ON interactions
  FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'compliance_reviewer', 'admin')
  );

CREATE POLICY "Users can create their own interactions"
  ON interactions
  FOR INSERT
  WITH CHECK (initiated_by = auth.uid());
```

---

### 7. **visits** (Liaison Officer Visits)
Tracks field visit logs for Liaison Officers.

```sql
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  hcp_id UUID REFERENCES hcp_contacts(id),
  liaison_officer_id UUID REFERENCES profiles(id),
  visit_date TIMESTAMP NOT NULL,
  visit_type TEXT CHECK (visit_type IN ('Product Introduction', 'Inventory Review', 'Training', 'Follow-up', 'Other')),
  outcome TEXT CHECK (outcome IN ('Follow-up Required', 'Closed', 'Pending', 'Escalated')),
  notes TEXT,
  samples_distributed BOOLEAN DEFAULT FALSE,
  materials_left TEXT[],
  hcp_feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Liaison officers can view their own visits"
  ON visits
  FOR SELECT
  USING (
    liaison_officer_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Liaison officers can create their own visits"
  ON visits
  FOR INSERT
  WITH CHECK (liaison_officer_id = auth.uid());
```

---

### 8. **tasks**
Task management across all roles.

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('Open', 'In Progress', 'Completed', 'Cancelled')),
  priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  due_date DATE,
  related_campaign_id TEXT REFERENCES campaigns(id),
  completion_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tasks"
  ON tasks
  FOR SELECT
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Admins can view all tasks"
  ON tasks
  FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
```

---

### 9. **activity_logs** (Audit Trail)
Comprehensive logging of all user actions for compliance and auditing.

```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  status TEXT CHECK (status IN ('Success', 'Failed', 'Modified')),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_timestamp ON activity_logs(timestamp);
CREATE INDEX idx_activity_resource ON activity_logs(resource_type, resource_id);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compliance and admins can view activity logs"
  ON activity_logs
  FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('compliance_reviewer', 'admin')
  );

CREATE POLICY "Users can view their own activity"
  ON activity_logs
  FOR SELECT
  USING (user_id = auth.uid());
```

---

### 10. **compliance_flags**
Flagged interactions or materials requiring review.

```sql
CREATE TABLE compliance_flags (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  material_id TEXT REFERENCES materials(id),
  interaction_id UUID REFERENCES interactions(id),
  flagged_by UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  status TEXT CHECK (status IN ('Open', 'Under Review', 'Resolved', 'False Alarm')),
  reviewer_id UUID REFERENCES profiles(id),
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

ALTER TABLE compliance_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compliance team and admins can view flags"
  ON compliance_flags
  FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('compliance_reviewer', 'admin')
  );
```

---

### 11. **system_settings**
Admin-configurable system settings.

```sql
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view and update settings"
  ON system_settings
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
```

---

## Role-Based Access Control (RBAC)

### Role Definitions

| Role | Permissions | Key Features |
|------|-------------|--------------|
| **admin** | Full system access | User management, system settings, compliance oversight, activity logs |
| **marketing_sales** | CRM, campaigns, HCP interactions, materials submission | Dashboard, CRM, interaction log, tasks, campaigns, materials |
| **compliance_reviewer** | Material approvals, audit logs, compliance flags | Material approval centre, audit logs, flagged interactions, reporting |
| **campaign_management** | Campaign creation, approval tracking, analytics | Campaign management, approvals workflow, reporting |
| **liaison_officer** | Visit logging, HCP interaction, sample tracking | Visit logging, schedule, materials, task management |
| **no_role** | Limited read-only access | Profile view only, awaiting role assignment |

---

## Key Functions for Audit & Compliance

### Log Activity Function (Trigger)
```sql
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, resource_type, resource_id, details, timestamp)
  VALUES (
    auth.uid(),
    TG_ARGV[0],
    TG_TABLE_NAME,
    NEW.id::TEXT,
    row_to_json(NEW),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to critical tables
CREATE TRIGGER log_material_approvals AFTER UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION log_activity('Material Updated');

CREATE TRIGGER log_submission_approvals AFTER UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION log_activity('Submission Status Changed');

CREATE TRIGGER log_role_changes AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION log_activity('Role Changed');
```

---

## Indexes for Performance

```sql
-- User & Role lookups
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Campaign queries
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_owner ON campaigns(owner_id);

-- Material approval workflow
CREATE INDEX idx_materials_status ON materials(status);
CREATE INDEX idx_materials_campaign ON materials(campaign_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_reviewer ON submissions(reviewer_id);

-- HCP & interaction lookup
CREATE INDEX idx_hcp_specialism ON hcp_contacts(specialism);
CREATE INDEX idx_interactions_type ON interactions(interaction_type);
CREATE INDEX idx_interactions_date ON interactions(interaction_date);
CREATE INDEX idx_interactions_campaign ON interactions(campaign_id);

-- Liaison officer visits
CREATE INDEX idx_visits_date ON visits(visit_date);
CREATE INDEX idx_visits_liaison ON visits(liaison_officer_id);

-- Task management
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_date);
```

---

## Setup Instructions

### 1. Create Tables in Supabase SQL Editor
Copy and paste each table creation script into the Supabase SQL Editor and execute.

### 2. Enable RLS Policy Checks
```sql
ALTER SCHEMA public OWNER TO postgres;
CREATE POLICY "Enable RLS" ON auth.users
  USING (TRUE);
```

### 3. Create Storage Bucket for Materials
```
Go to Supabase Dashboard → Storage → Create New Bucket
Bucket name: materials
Public: false (set access via policies)
```

### 4. Storage RLS Policies
```sql
CREATE POLICY "Materials bucket - Marketing can upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'materials' AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'campaign_management', 'admin')
  );

CREATE POLICY "Materials bucket - Can download approved"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'materials');
```

### 5. Create Default System Settings
```sql
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('max_file_size_mb', '50', 'Maximum material file size in MB'),
('material_approval_days', '7', 'Days to complete material approval'),
('notification_enabled', 'true', 'System notifications active'),
('data_retention_days', '90', 'Days to retain activity logs');
```

---

## Data Relationships Diagram

```
profiles (auth)
├── campaigns (owner_id)
├── materials (uploaded_by, reviewed_by)
├── submissions (submitter_id, reviewer_id)
├── hcp_contacts (created_by)
├── interactions (initiated_by)
├── visits (liaison_officer_id)
├── tasks (assigned_to, created_by)
└── activity_logs (user_id)

campaigns
├── materials
└── submissions

hcp_contacts
├── interactions
└── visits

materials
└── compliance_flags

interactions
└── compliance_flags
```

---

## Testing & Validation

### Test User Accounts
```
Admin: admin@alderwell.com | Role: admin
Marketing: marketing@alderwell.com | Role: marketing_sales
Compliance: compliance@alderwell.com | Role: compliance_reviewer
Campaign Mgr: campaign@alderwell.com | Role: campaign_management
Liaison: liaison@alderwell.com | Role: liaison_officer
NoRole: norole@alderwell.com | Role: no_role
```

### Security Checklist
- [ ] RLS policies enabled on all tables
- [ ] Activity logging triggers in place
- [ ] Storage buckets protected with policies
- [ ] Service role key secured (never expose in frontend)
- [ ] Anon key restricted to read/write policies
- [ ] Secrets stored in environment variables

---

## Performance Optimization Tips

1. **Pagination**: Always use `.range()` when querying lists
2. **Selective Columns**: Use `.select()` to limit columns returned
3. **Indexes**: Frequently filtered columns should be indexed
4. **Real-time Subscriptions**: Use for live updates on activity logs
5. **Caching**: Cache role permissions in memory with 5-min TTL

