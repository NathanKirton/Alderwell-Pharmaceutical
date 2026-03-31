# Alderwell Pharmaceutical Portal

Role-based web platform for campaign delivery, compliance review, liaison activity, and audit logging.

## Overview

This repository contains:

- A React frontend app in `react-frontend/`
- Supabase database and RLS setup SQL scripts in the repository root
- Operational checklists and migration guides for setup and production readiness

The application routes authenticated users to a role-specific dashboard:

- `admin`
- `marketing_sales`
- `compliance_reviewer`
- `campaign_management`
- `liaison_officer`
- `no_role` (restricted access view)

## Tech Stack

- React 19 (Create React App)
- React Router 6
- Supabase (Auth, PostgreSQL, Storage, RLS)
- Render (static web deployment)

## Repository Structure

```text
.
|-- react-frontend/                # Main web app
|   |-- src/
|   |   |-- components/            # Dashboards, auth UI, shared layout
|   |   |-- contexts/              # Auth context and role bootstrap
|   |   |-- services/              # Supabase client + query helpers
|   |   `-- utils/
|-- database-setup.sql             # Baseline schema + policies
|-- fix-*.sql                      # Incremental RLS/data fixes
|-- rollback-*.sql                 # Rollback scripts
|-- DATABASE_SCHEMA.md             # Schema reference
|-- SUPABASE_SETUP_CHECKLIST.md    # Environment and DB setup flow
|-- MIGRATION_GUIDE.md             # Mock-data to live-query migration examples
|-- FINAL_READINESS_CHECKLIST.md   # Production go-live checks
`-- render.yaml                    # Render static deploy config
```

## Prerequisites

- Node.js 18+
- npm 9+
- A Supabase project with SQL Editor access

## Local Development

1. Install frontend dependencies:

```bash
cd react-frontend
npm install
```

2. Configure Supabase credentials.

Recommended approach:

- Use environment variables in `react-frontend/.env.local`:

```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Current `react-frontend/src/services/supabaseClient.js` uses hardcoded values. For production safety, migrate this file to read from environment variables.

3. Start the app:

```bash
npm start
```

4. Open `http://localhost:3000`.

## Frontend Scripts

Run from `react-frontend/`:

- `npm start` - start development server
- `npm test` - run tests
- `npm run build` - create production build in `react-frontend/build/`

## Supabase Setup

1. Execute `database-setup.sql` in Supabase SQL Editor.
2. Create storage buckets:
	- `materials` (private)
	- `avatars` (public)
3. Apply policies and setup steps from `SUPABASE_SETUP_CHECKLIST.md`.
4. Create users and profile rows for role-based access testing.

For full schema details, see `DATABASE_SCHEMA.md`.

## Important SQL Fix Scripts

The root folder includes focused SQL patches for RLS and behavior corrections (for example profiles visibility, activity logs, task assignment, materials update rules, and marketing dashboard permissions).

Recommended practice:

1. Apply only the script needed for your issue.
2. Test with representative role accounts.
3. Record applied scripts in your release notes.
4. Keep rollback scripts nearby for fast recovery.

## Authentication and Role Routing

- Auth state is managed in `react-frontend/src/contexts/AuthContext.jsx`.
- Role-based route protection is handled in `react-frontend/src/components/ProtectedRoute.jsx`.
- Dashboard path mapping is resolved by `react-frontend/src/utils/roleUtils.js`.

Default app behavior:

- Unauthenticated users are redirected to `/login`
- Authenticated users are redirected to the dashboard for their role
- Users without a valid role are sent to `/no-access`

## Deployment (Render)

Render configuration is defined in `render.yaml`:

- Service type: static site
- Root directory: `react-frontend`
- Build command: `npm ci && npm run build`
- Publish path: `build`
- SPA rewrite: `/* -> /index.html`

## Operational Documentation

- `SUPABASE_SETUP_CHECKLIST.md` - initial project setup and validation
- `MIGRATION_GUIDE.md` - examples for replacing mock data with live Supabase queries
- `FINAL_READINESS_CHECKLIST.md` - release readiness checks
- `DATABASE_SCHEMA.md` - table-level schema and policy reference

## Notes

- Keep Supabase service-role keys out of frontend code.
- Validate RLS behavior for each role before release.
- Prefer incremental SQL scripts over editing live baseline schema directly.
