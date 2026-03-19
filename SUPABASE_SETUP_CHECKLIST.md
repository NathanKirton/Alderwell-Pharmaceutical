# Alderwell Pharmaceuticals - Supabase Setup Checklist

## Phase 1: Initial Configuration

### Supabase Project Setup
- [ ] Create Supabase account at https://supabase.com
- [ ] Create a new project (PostgreSQL database)
- [ ] Note down your Supabase URL and anon key
- [ ] Update `react-frontend/src/services/supabaseClient.js` with your credentials

### Environment Variables
- [ ] Create `.env.local` in `react-frontend/` directory
```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
```

---

## Phase 2: Database Schema Setup

### Execute SQL Schema
1. Go to Supabase Dashboard → SQL Editor
2. Open `database-setup.sql` from the project root
3. Copy and paste the entire contents into the SQL Editor
4. Click "Run" to execute all tables, indexes, and functions

**Tables Created:**
- ✓ profiles
- ✓ campaigns
- ✓ materials
- ✓ submissions
- ✓ hcp_contacts
- ✓ interactions
- ✓ visits
- ✓ tasks
- ✓ activity_logs
- ✓ compliance_flags
- ✓ system_settings

### Verify Tables
```sql
-- Run in SQL Editor to verify all tables exist
SELECT * FROM information_schema.tables WHERE table_schema = 'public';
```

---

## Phase 3: Storage Configuration

### Create Materials Storage Bucket
1. Go to Supabase Dashboard → Storage
2. Click "Create new bucket"
3. Name: `materials` (exactly)
4. Make Public: **FALSE** (restrict via RLS policies)
5. Click "Create bucket"

### Create Avatars Storage Bucket
1. Click "Create new bucket"
2. Name: `avatars`
3. Make Public: **TRUE** (allows direct image access)
4. Click "Create bucket"

### Storage Policies
In Supabase SQL Editor, add these policies:

```sql
-- Materials bucket - Marketing can upload
CREATE POLICY "Materials bucket - Marketing can upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'materials' AND
    (SELECT role FROM profiles WHERE id = auth.uid()) 
      IN ('marketing_sales', 'campaign_management', 'admin')
  );

-- Materials bucket - Can download
CREATE POLICY "Materials bucket - Can download"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'materials');

-- Avatars - Everyone can access
CREATE POLICY "Avatars are publicly accessible"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');
```

---

## Phase 4: Authentication Setup

### Enable Auth Providers
1. Go to Supabase Dashboard → Authentication → Settings
2. Under "Auth Providers", enable:
   - [x] Email (required)
   - [ ] Google (optional - for easier login)
   - [ ] GitHub (optional - for team members)

### Email Configuration
1. Go to Authentication → Email Templates
2. Verify default templates are set (Confirmation, Password Reset, Magic Link)
3. Customize if needed with your branding

---

## Phase 5: Create Test Users

### Create Test Accounts via Supabase Dashboard
Go to **Authentication → Users → Add user**

Create these test accounts:

| Email | Password | Role |
|-------|----------|------|
| admin@alderwell.com | TestPass123! | admin |
| marketing@alderwell.com | TestPass123! | marketing_sales |
| compliance@alderwell.com | TestPass123! | compliance_reviewer |
| campaign@alderwell.com | TestPass123! | campaign_management |
| liaison@alderwell.com | TestPass123! | liaison_officer |
| norole@alderwell.com | TestPass123! | no_role |

### Manually Create Profile Records
In Supabase SQL Editor:

```sql
-- Replace UUIDs with actual user IDs from Auth users table
INSERT INTO profiles (id, email, full_name, role) VALUES
  ('user-id-1', 'admin@alderwell.com', 'Admin User', 'admin'),
  ('user-id-2', 'marketing@alderwell.com', 'Marketing Team', 'marketing_sales'),
  ('user-id-3', 'compliance@alderwell.com', 'Compliance Officer', 'compliance_reviewer'),
  ('user-id-4', 'campaign@alderwell.com', 'Campaign Manager', 'campaign_management'),
  ('user-id-5', 'liaison@alderwell.com', 'Liaison Officer', 'liaison_officer'),
  ('user-id-6', 'norole@alderwell.com', 'New User', 'no_role');
```

**To get real user IDs:**
1. Go to Authentication → Users
2. Click on a user to see their UUID
3. Replace in the INSERT statement

---

## Phase 6: Frontend Integration

### Install Helper Functions
- [ ] Verify `supabaseHelpers.js` exists in `react-frontend/src/services/`
- [ ] This file contains all query functions for your components

### Update Components to Use Helpers
Example usage in a React component:

```javascript
import { campaignQueries } from '../services/supabaseHelpers'

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState([])

  useEffect(() => {
    const loadCampaigns = async () => {
      const data = await campaignQueries.getAllCampaigns()
      setCampaigns(data)
    }
    loadCampaigns()
  }, [])

  return (
    // Your JSX here
  )
}
```

### Replace Mock Data with Live Queries
Update these files to use `supabaseHelpers.js`:
- [ ] `Admin.jsx` - Use `campaignQueries`, `auditQueries`, `profileQueries`
- [ ] `MarketingSales.jsx` - Use `hcpQueries`, `interactionQueries`, `taskQueries`
- [ ] `LiaisonOfficer.jsx` - Use `visitQueries`, `hcpQueries`
- [ ] `CampaignManagement.jsx` - Use `campaignQueries`, `materialQueries`
- [ ] `ComplianceReviewer.jsx` - Use `materialQueries`, `auditQueries`, `complianceQueries`

---

## Phase 7: Testing & Validation

### Test Authentication
- [ ] Sign up with new email
- [ ] Verify email (check your email or Supabase settings)
- [ ] Log in with credentials
- [ ] Log out successfully
- [ ] Password reset works

### Test Role-Based Access
For each role (admin, marketing, compliance, etc.):
- [ ] Log in as user
- [ ] Verify correct dashboard displays
- [ ] Verify can only see age-appropriate data
- [ ] Verify can't access other roles' data

### Test RLS Policies
```sql
-- Test as admin (should see all profiles)
SELECT * FROM profiles;

-- Test as specific user (should see only own profile)
SELECT * FROM profiles WHERE id = auth.uid();

-- Test unauthorized access (should fail)
SELECT * FROM activity_logs; -- Non-compliance user
```

### Test Campaign Workflow
1. [ ] Create campaign as marketing user
2. [ ] Submit material for approval
3. [ ] Review/approve as compliance user
4. [ ] Verify activity log entry created
5. [ ] Verify compliance flag triggered if suspicious

### Test Audit Logging
1. [ ] Log in as any user
2. [ ] Perform actions (create, update, delete)
3. [ ] Go to Admin → Activity Logs
4. [ ] Verify actions are tracked with timestamps and details

---

## Phase 8: Security Hardening

### Review RLS Policies
- [ ] All tables have RLS enabled
- [ ] Policies follow least-privilege principle
- [ ] Test that users can't access other users' data
- [ ] Admin policies correctly grant full access

### Secure Sensitive Data
- [ ] Never store passwords in profiles table
- [ ] Activity logs store only non-sensitive details
- [ ] File uploads scanned for malware (optional)
- [ ] Sensitive compliance data flagged appropriately

### API Key Protection
- [ ] Anon key has minimal permissions (frontend use only)
- [ ] Service role key stored securely (never expose in frontend)
- [ ] Both keys rotated regularly (quarterly minimum)

### Data Retention Policies
- [ ] Set up monthly cleanup for old activity logs
- [ ] Archive old campaigns after 1 year
- [ ] Delete rejected materials after 90 days

---

## Phase 9: Deployment Preparation

### Production Checklist
- [ ] Enable HTTPS on production Supabase project
- [ ] Update environment variables for production
- [ ] Set up database backups (Supabase automatic)
- [ ] Enable audit logs (Supabase Pro plan)
- [ ] Configure firewall rules (if applicable)

### Monitoring
- [ ] Set up alerts for failed login attempts
- [ ] Monitor database query performance
- [ ] Track RLS policy violations
- [ ] Monitor activity logs for suspicious behavior

### Backup Strategy
- [ ] Supabase automatic backups enabled
- [ ] Manual export weekly to external storage
- [ ] Test restore procedure monthly
- [ ] Document recovery procedures

---

## Phase 10: Post-Launch

### Monitor & Iterate
- [ ] Review activity logs daily for first week
- [ ] Slow queries and add indexes if needed
- [ ] Gather user feedback on permission conflicts
- [ ] Adjust RLS policies based on real usage

### User Onboarding
- [ ] Create admin guide for user management
- [ ] Document role-specific workflows
- [ ] Train compliance team on approval process
- [ ] Create troubleshooting FAQ

### Continuous Improvement
- [ ] Review audit logs monthly
- [ ] Update security policies quarterly
- [ ] Test disaster recovery plan annually
- [ ] Stay updated on Supabase security advisories

---

## Troubleshooting Guide

### Common Issues

#### "Auth error: Invalid JWT"
**Solution:** Check that anon key in `.env.local` matches Supabase project settings

#### "Permission denied on table"
**Solution:** Verify user's role in profiles table and that RLS policies are correctly defined

#### "Slow query performance"
**Solution:** Check indexes exist on filtered columns; use `EXPLAIN ANALYZE` in SQL Editor

#### "File upload fails"
**Solution:** Verify storage bucket exists, storage policies created, and file size < max_file_size_mb setting

#### "Can't see other users' data (as admin)"
**Solution:** Verify admin RLS policies are correctly checking role = 'admin'

---

## Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **JWT Debugging:** https://jwt.io
- **RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security
- **Storage Guide:** https://supabase.com/docs/guides/storage

---

## Next Steps

1. Complete Phase 1-8 in order
2. Run full test suite (authentication, CRUD, RLS, audit)
3. Brief team on database structure
4. Begin integrating frontend with live database
5. Deploy to staging for UAT
6. Address feedback and deploy to production
