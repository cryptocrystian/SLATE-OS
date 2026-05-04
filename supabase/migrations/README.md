# SLATE Supabase migrations

Plain `.sql` files, numbered in order. Anything required for the current
persistence sprint lives here; future sprints append new files.

## Step 0 / 1 contents

- `0001_auth_workspaces_profiles.sql` — workspaces (singleton), profiles
  (1:1 with `auth.users`), `updated_at` trigger helper, RLS, and a
  profile-on-signup trigger. Required for `/login`, `/auth/callback`, and
  the `/app/*` operator guard.

Domain tables (leads, engagements, scorecard, intake, findings,
opportunities, roadmap, reports, proposals, notes, activity_events)
intentionally do **not** appear in this migration. They land in Step 2+ as
each route's UI flips from mock data to real persistence.

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

No further migrations are required to exercise Step 1's `/login` flow.
