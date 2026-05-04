-- SLATE — Persistence/Auth Step 1
-- Minimum schema for operator login: a single workspace, profiles linked
-- 1:1 to auth.users, an updated_at trigger helper, and a profile-on-signup
-- trigger. Domain tables (leads, engagements, scorecard_*, etc.) land in
-- Step 2+. Idempotent: safe to re-run.

-- Required Postgres extensions on Supabase
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- workspaces (single Saipien Labs workspace for v1)
-- -----------------------------------------------------------------------------

create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Seed the singleton workspace once.
insert into public.workspaces (name)
select 'Saipien Labs'
where not exists (select 1 from public.workspaces);

alter table public.workspaces enable row level security;

drop policy if exists workspaces_operator_read on public.workspaces;
create policy workspaces_operator_read on public.workspaces
  for select
  to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- profiles (operator profile, joined to auth.users by id)
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  title           text,
  avatar_initials text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists profiles_operator_read on public.profiles;
create policy profiles_operator_read on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Self-insert for the rare case where the trigger below has not yet fired
-- (e.g. a profile created from an existing auth.user via UI).
drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- Auto-create a profile row when a new auth.user is created
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
