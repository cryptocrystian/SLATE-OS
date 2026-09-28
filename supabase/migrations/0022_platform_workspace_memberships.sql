-- SLATE — Platform G0 · Workspace memberships + authorization primitives
--
-- Per docs/72_GOVERNANCEOS_INTEGRATION_PLAN.md §3.2 and
-- docs/74_PLATFORM_AUTH_EXPOSURE_AUDIT.md.
--
-- Layer: SLATE PLATFORM (domain-agnostic). No module semantics here.
--
-- Why:
--   RLS through 0021 authorises any `authenticated` session against the
--   singleton workspace (`(select id from public.workspaces limit 1)`), and
--   the operator allowlist lives only in env vars, invisible to Postgres.
--   Any session minted directly against Supabase Auth therefore passed RLS.
--   This migration introduces a DB-visible membership table and helper
--   predicates. New tables use them from day one; 0023 swaps the existing
--   policies over.
--
-- What this migration does NOT do:
--   - It does not change any existing policy (that is 0023, applied
--     separately).
--   - It seeds no rows. Memberships are granted by an explicit, reviewed
--     step (`scripts/platform/grant-workspace-membership.cjs`), never
--     "every existing profile" — a profile minted through the pre-fix
--     sign-up exposure must not inherit access.
--   - `handle_new_auth_user()` is unchanged: a new auth user gets a profile,
--     never a membership.
--
-- Roles are PLATFORM roles only (owner | operator | viewer). Module roles
-- (e.g. GovernanceOS program roles) belong to their modules.
--
-- Rollback path (manual, only before 0023 is applied):
--   drop function if exists public.has_workspace_role(uuid, text[]);
--   drop function if exists public.is_workspace_member(uuid);
--   drop function if exists public.has_any_workspace_membership();
--   drop function if exists public.shares_workspace_with(uuid);
--   drop table if exists public.workspace_memberships;
--
-- Idempotent: safe to re-run.

-- -----------------------------------------------------------------------------
-- workspace_memberships
-- -----------------------------------------------------------------------------

create table if not exists public.workspace_memberships (
  workspace_id  uuid not null references public.workspaces(id) on delete restrict,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  role          text not null check (role in ('owner', 'operator', 'viewer')),
  status        text not null default 'active' check (status in ('active', 'suspended')),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, profile_id)
);

create index if not exists workspace_memberships_profile_idx
  on public.workspace_memberships (profile_id)
  where status = 'active';

drop trigger if exists workspace_memberships_set_updated_at on public.workspace_memberships;
create trigger workspace_memberships_set_updated_at
  before update on public.workspace_memberships
  for each row execute function public.set_updated_at();

alter table public.workspace_memberships enable row level security;

-- Explicit privileges. Older Supabase projects (production) default-grant
-- everything to anon/authenticated; newer ones grant nothing. State the
-- intent so both behave identically. RLS below is still the row filter.
revoke all on table public.workspace_memberships from anon;
grant select, insert, update, delete on table public.workspace_memberships to authenticated;
grant all on table public.workspace_memberships to service_role;

-- -----------------------------------------------------------------------------
-- Helper predicates
--
-- security definer so they can read workspace_memberships regardless of the
-- caller's RLS; empty search_path + fully-qualified names so they cannot be
-- hijacked. They take NO user argument: identity always comes from
-- auth.uid(), so a caller cannot ask about someone else.
-- -----------------------------------------------------------------------------

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships m
    where m.workspace_id = ws
      and m.profile_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.has_workspace_role(ws uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships m
    where m.workspace_id = ws
      and m.profile_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (roles)
  );
$$;

-- For pre-tenant tables with no workspace_id (scorecard inbound): the caller
-- must be an active member of *some* workspace.
create or replace function public.has_any_workspace_membership()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships m
    where m.profile_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- Profile visibility: self, or someone sharing an active workspace.
create or replace function public.shares_workspace_with(other_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships mine
    join public.workspace_memberships theirs
      on theirs.workspace_id = mine.workspace_id
    where mine.profile_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.profile_id = other_profile
      and theirs.status = 'active'
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.has_workspace_role(uuid, text[]) from public, anon;
revoke all on function public.has_any_workspace_membership() from public, anon;
revoke all on function public.shares_workspace_with(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.has_any_workspace_membership() to authenticated, service_role;
grant execute on function public.shares_workspace_with(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS on workspace_memberships
--   read:  your own rows, or rows in a workspace you belong to
--   write: workspace owners only (service role bypasses RLS for provisioning)
-- -----------------------------------------------------------------------------

drop policy if exists workspace_memberships_member_read on public.workspace_memberships;
create policy workspace_memberships_member_read on public.workspace_memberships
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_workspace_member(workspace_id)
  );

drop policy if exists workspace_memberships_owner_insert on public.workspace_memberships;
create policy workspace_memberships_owner_insert on public.workspace_memberships
  for insert
  to authenticated
  with check (public.has_workspace_role(workspace_id, array['owner']));

drop policy if exists workspace_memberships_owner_update on public.workspace_memberships;
create policy workspace_memberships_owner_update on public.workspace_memberships
  for update
  to authenticated
  using (public.has_workspace_role(workspace_id, array['owner']))
  with check (public.has_workspace_role(workspace_id, array['owner']));

drop policy if exists workspace_memberships_owner_delete on public.workspace_memberships;
create policy workspace_memberships_owner_delete on public.workspace_memberships
  for delete
  to authenticated
  using (public.has_workspace_role(workspace_id, array['owner']));
