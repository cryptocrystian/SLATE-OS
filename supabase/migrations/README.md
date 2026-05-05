# SLATE Supabase migrations

Plain `.sql` files, numbered in order. Anything required for the current
persistence sprint lives here; future sprints append new files.

## Migrations

- `0001_auth_workspaces_profiles.sql` — workspaces (singleton), profiles
  (1:1 with `auth.users`), `updated_at` trigger helper, RLS, and a
  profile-on-signup trigger. Required for `/login`, `/auth/callback`, and
  the `/app/*` operator guard.
- `0002_scorecard_leads.sql` — public-scorecard persistence: `accounts`,
  `contacts` (citext email), `leads` (with internal `fit_score`),
  `lead_fit_dimensions`, `lead_qualification_signals`,
  `scorecard_submissions` (with `internal_fit_score` + deferred `lead_id`
  FK), `scorecard_answers`. Adds enums (`practice_area`, `lead_source`,
  `lead_status`, `fit_dimension_id`, `qualification_signal_direction`,
  `scorecard_classification`). RLS enabled with operator-full policies
  workspace-scoped via `profiles.id = auth.uid()`. **No anon insert
  policies** — the public `/api/scorecard/submit` endpoint writes via the
  service-role client.

Remaining domain tables (engagements, intake, findings, opportunities,
roadmap, reports, proposals, notes, activity_events) intentionally do
**not** appear yet. They land in Step 3+ as each route's UI flips from
mock data to real persistence.

## Applying a migration

Two equivalent options. Pick whichever your environment supports — there is
no Supabase CLI requirement for Step 0/1.

### Option A — Supabase Dashboard SQL Editor (no tooling required)

1. Open the project in the Supabase Dashboard.
2. **SQL Editor → New query.**
3. Paste the contents of the migration `.sql` file.
4. Run.

The script is idempotent (`if not exists`, `drop policy if exists`,
`on conflict do nothing`), so re-running it is safe if you need to retry.

### Option B — Supabase CLI

If you already have the Supabase CLI configured against this project:

```bash
supabase db push
```

The CLI will pick up `supabase/migrations/*.sql` in numeric order.

### Option C — Mgmt API helper (dev-only)

`scripts/dev/apply-migration.cjs` posts a single migration file to the
Management API SQL endpoint using `SUPABASE_ACCESS_TOKEN` and
`SUPABASE_PROJECT_REF` from `.env.local`. Used during Step 2 verification
to apply both `0001_…` and `0002_…` to the live project.

```bash
node scripts/dev/apply-migration.cjs 0002_scorecard_leads.sql
```

The helper never logs the SQL body, never logs the PAT, and redacts known
credential patterns from any error response. Dev-only; not imported by
the app runtime.

## After applying 0001

In the Supabase Dashboard:

1. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (or your deployed origin)
   - Redirect URLs: include `http://localhost:3000/auth/callback`
2. **Authentication → Providers → Email**
   - Magic link: enabled.
   - You may want "Confirm email" off for trusted-operator invites; final
     posture is your call.
3. **Authentication → Users**
   - Invite each Saipien Labs operator (email + magic link). The
     `on_auth_user_created` trigger creates their `profiles` row
     automatically. Operators can later update their own
     `display_name` / `title` / `avatar_initials`.

For operator auth, keep Supabase signups restricted where possible
(Authentication → Settings → "Allow new users to sign up" → off, if your
plan exposes the toggle). SLATE also enforces a server-side operator
allowlist in `signInWithMagicLink` via `SLATE_OPERATOR_EMAIL_ALLOWLIST`
and `SLATE_OPERATOR_DOMAIN_ALLOWLIST`; both layers should remain in
place before Step 2 begins.

No further migrations are required to exercise Step 1's `/login` flow.
