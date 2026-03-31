# Final Readiness Checklist

This checklist captures the remaining execution steps after code completion and local validation.

## 1) Local Validation Status

- Frontend tests: PASS
- Frontend production build: PASS
- Workspace diagnostics: clean

## 2) Required SQL Hotfix Execution (Supabase SQL Editor)

Run these scripts in order:

1. `fix-campaign-update-rls.sql`
2. `fix-material-versions-and-task-assignment-rls.sql`

If your environment also needs prior RLS/table patches, execute any earlier pending fix scripts before UAT.

## 3) Post-SQL Verification Queries

```sql
-- A) Confirm material_versions table exists
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'material_versions';

-- B) Confirm key policies exist
select policyname, tablename, cmd
from pg_policies
where schemaname = 'public'
  and (
    (tablename = 'campaigns' and policyname = 'Campaign management can update campaigns')
    or
    (tablename = 'material_versions' and policyname in (
      'Operational roles can view material versions',
      'Operational roles can insert material versions'
    ))
    or
    (tablename = 'tasks' and policyname = 'Operational roles can create tasks')
  )
order by tablename, policyname;
```

## 4) UAT Scenarios (Role-Based)

1. Campaign Management or Admin: launch a campaign with exception flow and provide required reason.
2. Confirm override action writes an audit entry in activity logs.
3. Replace a material file and verify a new history entry appears from material_versions.
4. Campaign Management: assign a task to another user (cross-role assignment) and confirm success.
5. Verify No Role user lands on no-access/waiting experience.

## 5) Audit Trail Checks

```sql
-- Replace filters with your latest actor/campaign/material IDs as needed.
select id, action, entity_type, entity_id, details, created_at
from activity_logs
order by created_at desc
limit 100;

select material_id, version_number, file_url, uploaded_by, change_reason, created_at
from material_versions
order by created_at desc
limit 100;
```

## 6) Go/No-Go Criteria

Release is ready when all are true:

- SQL hotfix scripts completed successfully in target environment.
- UAT scenarios above pass for expected roles.
- Audit trail entries are visible for launch overrides and material versioning.
- Local test and build remain green after any final tweaks.
