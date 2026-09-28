-- SLATE — GovernanceOS G1 · Governance policies with immutable, superseding versions
--
-- Per docs/72 §4.1 and docs/76 §2. Layer: GOVERNANCEOS MODULE.
--
-- governance_policies           = identity (stable policy_key, domain, owner)
-- governance_policy_versions    = content; editable ONLY while `draft`.
--   draft → active → superseded | retired. At most one active version per
--   policy. Activation is a single server-side function that atomically
--   supersedes the prior active version. Non-draft versions can never be
--   edited or deleted: a material policy change is always a new version.
--
-- Activation modes (docs/76 §2): G1 accepts only `advisory`. `gated`
-- unlocks with decision records (G3); `enforced` only with a registered
-- enforcement adapter (G4+). A later migration relaxes the check below —
-- nothing here claims enforcement that does not exist.
--
-- Rollback path (manual, pre-production only):
--   drop table if exists public.governance_policy_versions, public.governance_policies cascade;
--   drop function if exists public.governance_activate_policy_version(uuid, text);
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.governance_policies (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null,
  governance_program_id  uuid not null,
  policy_key             text not null check (policy_key ~ '^[a-z0-9][a-z0-9_.-]{1,79}$'),
  name                   text not null check (char_length(btrim(name)) between 1 and 200),
  policy_domain          text not null check (policy_domain in
                           ('autonomy', 'deployment', 'data', 'model', 'tool_access', 'human_oversight', 'change', 'other')),
  owner_profile_id       uuid references public.profiles(id) on delete set null,
  created_by             uuid references public.profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, governance_program_id),
  unique (governance_program_id, policy_key),
  foreign key (governance_program_id, workspace_id)
    references public.governance_programs (id, workspace_id) on delete restrict
);

drop trigger if exists governance_policies_set_updated_at on public.governance_policies;
create trigger governance_policies_set_updated_at
  before update on public.governance_policies
  for each row execute function public.set_updated_at();

create table if not exists public.governance_policy_versions (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null,
  governance_program_id  uuid not null,
  governance_policy_id   uuid not null,
  version                integer not null check (version >= 1),
  status                 text not null default 'draft'
                           check (status in ('draft', 'active', 'superseded', 'retired')),
  activation_mode        text not null default 'advisory'
                           -- G1: advisory only (docs/76 §2 activation ladder).
                           check (activation_mode in ('advisory')),
  statement              text not null check (char_length(btrim(statement)) between 1 and 8000),
  rationale              text check (rationale is null or char_length(rationale) <= 4000),
  scope                  jsonb not null default '{}'::jsonb check (jsonb_typeof(scope) = 'object'),
  supersedes_version_id  uuid references public.governance_policy_versions(id) on delete restrict,
  created_by             uuid references public.profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  activated_by           uuid references public.profiles(id) on delete set null,
  activated_at           timestamptz,
  superseded_at          timestamptz,
  retired_by             uuid references public.profiles(id) on delete set null,
  retired_at             timestamptz,
  unique (governance_policy_id, version),
  foreign key (governance_policy_id, governance_program_id)
    references public.governance_policies (id, governance_program_id) on delete restrict,
  foreign key (governance_program_id, workspace_id)
    references public.governance_programs (id, workspace_id) on delete restrict,
  constraint governance_policy_versions_active_stamp check (
    status = 'draft' or activated_at is not null
    or status = 'retired'  -- a draft can be retired (abandoned) without ever activating
  )
);

create unique index if not exists governance_policy_versions_one_active
  on public.governance_policy_versions (governance_policy_id) where status = 'active';
create unique index if not exists governance_policy_versions_one_draft
  on public.governance_policy_versions (governance_policy_id) where status = 'draft';
create index if not exists governance_policy_versions_program_idx
  on public.governance_policy_versions (governance_program_id, status);

-- -----------------------------------------------------------------------------
-- Immutability guard
-- -----------------------------------------------------------------------------

create or replace function public.governance_policy_versions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  content_changed boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'governance_policy_version_immutable' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'governance_policy_version_must_start_draft' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.governance_programs p
                where p.id = new.governance_program_id and p.status = 'archived') then
      raise exception 'governance_program_archived' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- UPDATE
  content_changed :=
       new.statement is distinct from old.statement
    or new.rationale is distinct from old.rationale
    or new.scope is distinct from old.scope
    or new.activation_mode is distinct from old.activation_mode;

  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.governance_program_id is distinct from old.governance_program_id
     or new.governance_policy_id is distinct from old.governance_policy_id
     or new.version is distinct from old.version
     or new.supersedes_version_id is distinct from old.supersedes_version_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'governance_policy_version_immutable' using errcode = 'P0001';
  end if;

  if old.status <> 'draft' and content_changed then
    raise exception 'governance_policy_version_immutable' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status and not (
       (old.status = 'draft'  and new.status in ('active', 'retired'))
    or (old.status = 'active' and new.status in ('superseded', 'retired'))
  ) then
    raise exception 'governance_policy_version_invalid_transition: % -> %', old.status, new.status
      using errcode = 'P0001';
  end if;

  -- Activation must go through governance_activate_policy_version().
  if new.status = 'active' and old.status = 'draft'
     and coalesce(current_setting('slate.governance_activation', true), '') <> new.id::text then
    raise exception 'governance_policy_activation_requires_rpc' using errcode = 'P0001';
  end if;

  if new.status = 'superseded' and new.superseded_at is null then new.superseded_at := now(); end if;
  if new.status = 'retired' and new.retired_at is null then
    new.retired_at := now();
    new.retired_by := (select auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.governance_policy_versions_guard() from public, anon, authenticated;

drop trigger if exists governance_policy_versions_guard on public.governance_policy_versions;
create trigger governance_policy_versions_guard
  before insert or update or delete on public.governance_policy_versions
  for each row execute function public.governance_policy_versions_guard();

-- -----------------------------------------------------------------------------
-- Activation (atomic supersede). Invoker rights: RLS + role check apply.
-- -----------------------------------------------------------------------------

create or replace function public.governance_activate_policy_version(version_id uuid, reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v record;
begin
  select * into v from public.governance_policy_versions where id = version_id for update;
  if not found then
    raise exception 'governance_policy_version_not_found' using errcode = 'P0001';
  end if;
  if not public.governance_has_program_role(v.governance_program_id, array['program_admin', 'governance_manager']) then
    raise exception 'governance_forbidden' using errcode = '42501';
  end if;
  if v.status = 'active' then
    return; -- idempotent retry
  end if;
  if v.status <> 'draft' then
    raise exception 'governance_policy_version_invalid_transition: % -> active', v.status using errcode = 'P0001';
  end if;
  if reason is null or char_length(btrim(reason)) = 0 then
    raise exception 'governance_reason_required' using errcode = 'P0001';
  end if;

  -- serialize activations per policy
  perform 1 from public.governance_policies where id = v.governance_policy_id for update;

  update public.governance_policy_versions
     set status = 'superseded'
   where governance_policy_id = v.governance_policy_id and status = 'active';

  perform set_config('slate.governance_activation', v.id::text, true);
  update public.governance_policy_versions
     set status = 'active', activated_by = (select auth.uid()), activated_at = now()
   where id = v.id;
  perform set_config('slate.governance_activation', '', true);
end;
$$;
revoke all on function public.governance_activate_policy_version(uuid, text) from public, anon;
grant execute on function public.governance_activate_policy_version(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Privileges + RLS
-- -----------------------------------------------------------------------------

alter table public.governance_policies enable row level security;
alter table public.governance_policy_versions enable row level security;

revoke all on table public.governance_policies from anon;
revoke all on table public.governance_policy_versions from anon;
revoke delete, truncate on table public.governance_policies from authenticated;
revoke truncate on table public.governance_policy_versions from authenticated;
grant select, insert, update on table public.governance_policies to authenticated;
grant select, insert, update, delete on table public.governance_policy_versions to authenticated;
grant all on table public.governance_policies, public.governance_policy_versions to service_role;

drop policy if exists governance_policies_read on public.governance_policies;
create policy governance_policies_read on public.governance_policies
  for select to authenticated
  using (public.governance_program_role(governance_program_id) is not null);

drop policy if exists governance_policies_write on public.governance_policies;
create policy governance_policies_write on public.governance_policies
  for insert to authenticated
  with check (public.governance_has_program_role(governance_program_id, array['program_admin', 'governance_manager']));

drop policy if exists governance_policies_update on public.governance_policies;
create policy governance_policies_update on public.governance_policies
  for update to authenticated
  using (public.governance_has_program_role(governance_program_id, array['program_admin', 'governance_manager']))
  with check (public.governance_has_program_role(governance_program_id, array['program_admin', 'governance_manager']));

drop policy if exists governance_policy_versions_read on public.governance_policy_versions;
create policy governance_policy_versions_read on public.governance_policy_versions
  for select to authenticated
  using (public.governance_program_role(governance_program_id) is not null);

drop policy if exists governance_policy_versions_write on public.governance_policy_versions;
create policy governance_policy_versions_write on public.governance_policy_versions
  for all to authenticated
  using (public.governance_has_program_role(governance_program_id, array['program_admin', 'governance_manager']))
  with check (public.governance_has_program_role(governance_program_id, array['program_admin', 'governance_manager']));
