-- SLATE — GovernanceOS G1 · Governance programs, program roles, engagement links
--
-- Per docs/72_GOVERNANCEOS_INTEGRATION_PLAN.md §4 and
-- docs/76_GOVERNANCEOS_DOMAIN_CONVENTIONS.md §1, §8.
-- Layer: GOVERNANCEOS MODULE. Uses platform primitives (0022 membership
-- helpers, 0024 retention holds); never modifies ConsultOS tables.
--
-- Canon: durable governance state belongs to GovernanceOS. A program is
-- never deleted (archive only). Engagements LINK to programs; an active link
-- places a platform retention hold so the engagement cannot be deleted out
-- from under the program, and the link row keeps an engagement snapshot so
-- program history survives even after an unlink + delete.
--
-- Rollback path (manual, pre-production only):
--   drop table if exists public.governance_program_engagements, public.governance_program_members, public.governance_programs cascade;
--   drop function if exists public.governance_program_role(uuid), public.governance_has_program_role(uuid, text[]);
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- governance_programs
-- -----------------------------------------------------------------------------

create table if not exists public.governance_programs (
  id                            uuid primary key default gen_random_uuid(),
  workspace_id                  uuid not null references public.workspaces(id) on delete restrict,
  program_kind                  text not null check (program_kind in ('client', 'internal', 'venture')),
  account_id                    uuid references public.accounts(id) on delete restrict,
  venture_source_system         text check (venture_source_system is null or venture_source_system = 'ventureos'),
  venture_source_id             text,
  name                          text not null check (char_length(btrim(name)) between 1 and 160),
  description                   text check (description is null or char_length(description) <= 4000),
  status                        text not null default 'draft'
                                  check (status in ('draft', 'active', 'paused', 'archived')),
  owner_profile_id              uuid references public.profiles(id) on delete set null,
  executive_sponsor_name        text check (executive_sponsor_name is null or char_length(executive_sponsor_name) <= 160),
  executive_sponsor_contact_id  uuid references public.contacts(id) on delete set null,
  operating_model               text check (operating_model is null or char_length(operating_model) <= 2000),
  risk_appetite                 jsonb not null default '{}'::jsonb,
  risk_scale                    jsonb not null default '{}'::jsonb,
  framework_strategy            jsonb not null default '{}'::jsonb,
  default_review_cadence        text check (default_review_cadence is null
                                  or default_review_cadence in ('monthly', 'quarterly', 'semiannual', 'annual')),
  started_at                    timestamptz,
  next_program_review_at        timestamptz,
  archived_at                   timestamptz,
  created_by                    uuid references public.profiles(id) on delete set null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (id, workspace_id),
  -- docs/76 §1: ownership by kind. No fake CRM account for internal programs.
  constraint governance_programs_kind_owner check (
    (program_kind = 'client'   and account_id is not null and venture_source_id is null)
    or (program_kind = 'internal' and account_id is null and venture_source_id is null and venture_source_system is null)
    or (program_kind = 'venture'  and venture_source_id is not null and venture_source_system = 'ventureos')
  ),
  constraint governance_programs_archived_stamp check ((status = 'archived') = (archived_at is not null))
);

create index if not exists governance_programs_workspace_idx
  on public.governance_programs (workspace_id, status, program_kind);
create index if not exists governance_programs_account_idx
  on public.governance_programs (account_id) where account_id is not null;

drop trigger if exists governance_programs_set_updated_at on public.governance_programs;
create trigger governance_programs_set_updated_at
  before update on public.governance_programs
  for each row execute function public.set_updated_at();

-- Integrity: kind + workspace are fixed at creation; archived is terminal;
-- a client account must live in the program's workspace; status machine.
create or replace function public.governance_programs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An FK `on delete set null` from a contact deletion elsewhere in SLATE
  -- must never be blocked by GovernanceOS (the sponsor name snapshot stays).
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'executive_sponsor_contact_id' - 'updated_at')
       = (to_jsonb(old) - 'executive_sponsor_contact_id' - 'updated_at') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
       or new.program_kind is distinct from old.program_kind then
      raise exception 'governance_program_immutable_field' using errcode = 'P0001';
    end if;
    if old.status = 'archived' then
      raise exception 'governance_program_archived' using errcode = 'P0001';
    end if;
    if new.status is distinct from old.status and not (
         (old.status = 'draft'  and new.status in ('active', 'archived'))
      or (old.status = 'active' and new.status in ('paused', 'archived'))
      or (old.status = 'paused' and new.status in ('active', 'archived'))
    ) then
      raise exception 'governance_program_invalid_transition: % -> %', old.status, new.status
        using errcode = 'P0001';
    end if;
    if new.status = 'active' and old.status = 'draft' and new.started_at is null then
      new.started_at := now();
    end if;
    if new.status = 'archived' and new.archived_at is null then
      new.archived_at := now();
    end if;
  end if;
  if new.account_id is not null and not exists (
    select 1 from public.accounts a where a.id = new.account_id and a.workspace_id = new.workspace_id
  ) then
    raise exception 'governance_cross_workspace_reference: account' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists governance_programs_guard on public.governance_programs;
create trigger governance_programs_guard
  before insert or update on public.governance_programs
  for each row execute function public.governance_programs_guard();

-- -----------------------------------------------------------------------------
-- governance_program_members (module roles — docs/76 §8)
-- -----------------------------------------------------------------------------

create table if not exists public.governance_program_members (
  governance_program_id  uuid not null,
  workspace_id           uuid not null,
  profile_id             uuid not null references public.profiles(id) on delete cascade,
  role                   text not null check (role in
                           ('program_admin', 'governance_manager', 'reviewer', 'contributor', 'viewer')),
  created_by             uuid references public.profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  primary key (governance_program_id, profile_id),
  foreign key (governance_program_id, workspace_id)
    references public.governance_programs (id, workspace_id) on delete restrict
);

create index if not exists governance_program_members_profile_idx
  on public.governance_program_members (profile_id);

-- -----------------------------------------------------------------------------
-- Effective program role for the CALLER (auth.uid()).
--   explicit membership wins; otherwise internal programs grant workspace
--   owner/operator → program_admin, workspace viewer → viewer.
--   client/venture programs require explicit membership.
-- -----------------------------------------------------------------------------

create or replace function public.governance_program_role(program uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select m.role
       from public.governance_program_members m
       join public.governance_programs p on p.id = m.governance_program_id
      where m.governance_program_id = program
        and m.profile_id = (select auth.uid())
        and public.is_workspace_member(p.workspace_id)),
    (select case
              when public.has_workspace_role(p.workspace_id, array['owner', 'operator']) then 'program_admin'
              when public.is_workspace_member(p.workspace_id) then 'viewer'
            end
       from public.governance_programs p
      where p.id = program and p.program_kind = 'internal')
  );
$$;

create or replace function public.governance_has_program_role(program uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.governance_program_role(program) = any (roles), false);
$$;

revoke all on function public.governance_program_role(uuid) from public, anon;
revoke all on function public.governance_has_program_role(uuid, text[]) from public, anon;
grant execute on function public.governance_program_role(uuid) to authenticated, service_role;
grant execute on function public.governance_has_program_role(uuid, text[]) to authenticated, service_role;

-- Creator of a client/venture program becomes its program_admin. Runs as
-- definer: the creator cannot yet satisfy the members insert policy.
create or replace function public.governance_programs_add_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.program_kind <> 'internal' and (select auth.uid()) is not null then
    insert into public.governance_program_members (governance_program_id, workspace_id, profile_id, role, created_by)
    values (new.id, new.workspace_id, (select auth.uid()), 'program_admin', (select auth.uid()))
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.governance_programs_add_creator() from public, anon, authenticated;

drop trigger if exists governance_programs_add_creator on public.governance_programs;
create trigger governance_programs_add_creator
  after insert on public.governance_programs
  for each row execute function public.governance_programs_add_creator();

-- -----------------------------------------------------------------------------
-- governance_program_engagements (link, never owner)
-- -----------------------------------------------------------------------------

create table if not exists public.governance_program_engagements (
  id                        uuid primary key default gen_random_uuid(),
  governance_program_id     uuid not null,
  workspace_id              uuid not null,
  engagement_id             uuid references public.engagements(id) on delete set null,
  engagement_ref            uuid not null,
  engagement_name_snapshot  text not null,
  relationship_type         text not null default 'assessment'
                              check (relationship_type in ('baseline', 'assessment', 'remediation', 'advisory', 'other')),
  linked_by                 uuid references public.profiles(id) on delete set null,
  linked_at                 timestamptz not null default now(),
  unlinked_by               uuid references public.profiles(id) on delete set null,
  unlinked_at               timestamptz,
  unlink_reason             text,
  foreign key (governance_program_id, workspace_id)
    references public.governance_programs (id, workspace_id) on delete restrict,
  check (unlinked_at is not null or (unlinked_by is null and unlink_reason is null))
);

create unique index if not exists governance_program_engagements_active_uniq
  on public.governance_program_engagements (governance_program_id, engagement_ref)
  where unlinked_at is null;
create index if not exists governance_program_engagements_engagement_idx
  on public.governance_program_engagements (engagement_ref);

create or replace function public.governance_program_engagements_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  eng record;
begin
  if tg_op = 'INSERT' then
    select e.id, e.name, e.workspace_id into eng from public.engagements e where e.id = new.engagement_id;
    if not found or eng.workspace_id <> new.workspace_id then
      raise exception 'governance_cross_workspace_reference: engagement' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.governance_programs p where p.id = new.governance_program_id and p.status = 'archived') then
      raise exception 'governance_program_archived' using errcode = 'P0001';
    end if;
    new.engagement_ref := new.engagement_id;
    new.engagement_name_snapshot := eng.name;
    new.unlinked_at := null;
    new.unlinked_by := null;
    new.unlink_reason := null;
    return new;
  end if;

  -- UPDATE: only a single unlink is allowed (engagement_id may also be
  -- nulled by the FK when an unlinked engagement is later deleted).
  if old.unlinked_at is not null and new.unlinked_at is distinct from old.unlinked_at then
    raise exception 'governance_link_already_unlinked' using errcode = 'P0001';
  end if;
  if new.id is distinct from old.id
     or new.governance_program_id is distinct from old.governance_program_id
     or new.workspace_id is distinct from old.workspace_id
     or new.engagement_ref is distinct from old.engagement_ref
     or new.engagement_name_snapshot is distinct from old.engagement_name_snapshot
     or new.relationship_type is distinct from old.relationship_type
     or new.linked_by is distinct from old.linked_by
     or new.linked_at is distinct from old.linked_at
     or (new.engagement_id is not null and new.engagement_id is distinct from old.engagement_id) then
    raise exception 'governance_link_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists governance_program_engagements_guard on public.governance_program_engagements;
create trigger governance_program_engagements_guard
  before insert or update on public.governance_program_engagements
  for each row execute function public.governance_program_engagements_guard();

-- Active link ⇒ platform retention hold on the engagement (holder_ref = program id).
create or replace function public.governance_program_engagements_hold()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.retention_holds
      (workspace_id, entity_type, entity_id, held_by_module, holder_ref, reason, created_by)
    values
      (new.workspace_id, 'engagement', new.engagement_ref, 'governanceos',
       new.governance_program_id::text, 'Linked to a GovernanceOS program', new.linked_by)
    on conflict (entity_type, entity_id, held_by_module, holder_ref) where released_at is null
    do nothing;
  elsif tg_op = 'UPDATE' and old.unlinked_at is null and new.unlinked_at is not null then
    update public.retention_holds h
       set released_at = new.unlinked_at,
           released_by = new.unlinked_by,
           release_reason = coalesce(new.unlink_reason, 'Unlinked from GovernanceOS program')
     where h.entity_type = 'engagement'
       and h.entity_id = new.engagement_ref
       and h.held_by_module = 'governanceos'
       and h.holder_ref = new.governance_program_id::text
       and h.released_at is null;
  end if;
  return new;
end;
$$;
revoke all on function public.governance_program_engagements_hold() from public, anon, authenticated;
revoke all on function public.governance_program_engagements_guard() from public, anon, authenticated;
revoke all on function public.governance_programs_guard() from public, anon, authenticated;

drop trigger if exists governance_program_engagements_hold on public.governance_program_engagements;
create trigger governance_program_engagements_hold
  after insert or update of unlinked_at on public.governance_program_engagements
  for each row execute function public.governance_program_engagements_hold();

-- -----------------------------------------------------------------------------
-- Privileges + RLS
-- -----------------------------------------------------------------------------

alter table public.governance_programs enable row level security;
alter table public.governance_program_members enable row level security;
alter table public.governance_program_engagements enable row level security;

revoke all on table public.governance_programs from anon;
revoke all on table public.governance_program_members from anon;
revoke all on table public.governance_program_engagements from anon;
revoke delete, truncate on table public.governance_programs from authenticated;
revoke delete, truncate on table public.governance_program_engagements from authenticated;
grant select, insert, update on table public.governance_programs to authenticated;
grant select, insert, update, delete on table public.governance_program_members to authenticated;
grant select, insert, update on table public.governance_program_engagements to authenticated;
grant all on table public.governance_programs, public.governance_program_members,
  public.governance_program_engagements to service_role;

-- programs
drop policy if exists governance_programs_read on public.governance_programs;
create policy governance_programs_read on public.governance_programs
  for select to authenticated
  using (public.governance_program_role(id) is not null);

drop policy if exists governance_programs_create on public.governance_programs;
create policy governance_programs_create on public.governance_programs
  for insert to authenticated
  with check (
    public.has_workspace_role(workspace_id, array['owner', 'operator'])
    and created_by = (select auth.uid())
  );

drop policy if exists governance_programs_update on public.governance_programs;
create policy governance_programs_update on public.governance_programs
  for update to authenticated
  using (public.governance_has_program_role(id, array['program_admin', 'governance_manager']))
  with check (public.governance_has_program_role(id, array['program_admin', 'governance_manager']));

-- members
drop policy if exists governance_program_members_read on public.governance_program_members;
create policy governance_program_members_read on public.governance_program_members
  for select to authenticated
  using (public.governance_program_role(governance_program_id) is not null);

drop policy if exists governance_program_members_admin_write on public.governance_program_members;
create policy governance_program_members_admin_write on public.governance_program_members
  for all to authenticated
  using (public.governance_has_program_role(governance_program_id, array['program_admin']))
  with check (
    public.governance_has_program_role(governance_program_id, array['program_admin'])
    and public.is_workspace_member(workspace_id)
  );

-- engagement links (no delete: unlink is an update, history is kept)
drop policy if exists governance_program_engagements_read on public.governance_program_engagements;
create policy governance_program_engagements_read on public.governance_program_engagements
  for select to authenticated
  using (public.governance_program_role(governance_program_id) is not null);

drop policy if exists governance_program_engagements_link on public.governance_program_engagements;
create policy governance_program_engagements_link on public.governance_program_engagements
  for insert to authenticated
  with check (public.governance_has_program_role(governance_program_id, array['program_admin', 'governance_manager']));

drop policy if exists governance_program_engagements_unlink on public.governance_program_engagements;
create policy governance_program_engagements_unlink on public.governance_program_engagements
  for update to authenticated
  using (public.governance_has_program_role(governance_program_id, array['program_admin', 'governance_manager']))
  with check (public.governance_has_program_role(governance_program_id, array['program_admin', 'governance_manager']));
