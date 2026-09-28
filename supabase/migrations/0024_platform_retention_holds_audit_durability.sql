-- SLATE — Platform G0 · Retention holds + audit/provenance durability
--
-- Per docs/72_GOVERNANCEOS_INTEGRATION_PLAN.md §3.4 and
-- docs/75_PLATFORM_LIFECYCLE_DURABILITY_AUDIT.md.
-- Layer: SLATE PLATFORM (domain-agnostic).
--
-- Canon rule (Architect, 2026-09-25): no lifecycle event in one SLATE module
-- may silently destroy or invalidate another module's history.
--
-- 1. retention_holds — a generic "another module depends on this row" lock.
--    BEFORE DELETE triggers on engagements / accounts / contacts / leads
--    refuse the delete while an unreleased hold exists. The platform does
--    not know WHY a hold exists; the holding module does (held_by_module +
--    holder_ref).
-- 2. Audit/provenance decoupling — activity_events, notes and
--    ai_synthesis_runs stop cascading with engagements/leads. Their FKs
--    become ON DELETE SET NULL and a non-FK *_ref column preserves which
--    engagement/lead the row belonged to. Existing readers filter by a
--    specific live engagement_id, so orphaned rows never surface in
--    ConsultOS; they survive for audit.
-- 3. ai_synthesis_runs.engagement_id becomes nullable so non-engagement AI
--    work (internal / venture / governance) can record provenance, with a
--    generic subject_type/subject_id and a module column.
--
-- Rollback path (manual): restore the three FK definitions to
-- ON DELETE CASCADE, re-add NOT NULL to ai_synthesis_runs.engagement_id
-- (only if no null rows), drop the added columns, triggers and
-- public.retention_holds.
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Module vocabulary (machine values; canon names per docs/72 §1.2)
-- -----------------------------------------------------------------------------
--   consultos | buildos | ventureos | governanceos | platform

-- -----------------------------------------------------------------------------
-- 1. retention_holds
-- -----------------------------------------------------------------------------

create table if not exists public.retention_holds (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete restrict,
  entity_type      text not null check (entity_type in ('engagement', 'account', 'contact', 'lead')),
  entity_id        uuid not null,
  held_by_module   text not null check (held_by_module in ('consultos', 'buildos', 'ventureos', 'governanceos', 'platform')),
  holder_ref       text not null,          -- opaque to the platform (e.g. a program id)
  reason           text not null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  released_at      timestamptz,
  released_by      uuid references public.profiles(id) on delete set null,
  release_reason   text,
  -- release fields are all-or-nothing on the release side
  check (released_at is not null or (released_by is null and release_reason is null))
);

create unique index if not exists retention_holds_active_uniq
  on public.retention_holds (entity_type, entity_id, held_by_module, holder_ref)
  where released_at is null;

create index if not exists retention_holds_entity_active_idx
  on public.retention_holds (entity_type, entity_id)
  where released_at is null;

alter table public.retention_holds enable row level security;

-- Explicit privileges (see 0022 note). No DELETE for authenticated: hold
-- history is permanent.
revoke all on table public.retention_holds from anon;
revoke delete, truncate on table public.retention_holds from authenticated;
grant select, insert, update on table public.retention_holds to authenticated;
grant all on table public.retention_holds to service_role;

-- Members can see, place and release holds in their workspace. There is no
-- DELETE policy: hold history is permanent. Release = set released_at.
drop policy if exists retention_holds_member_read on public.retention_holds;
create policy retention_holds_member_read on public.retention_holds
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists retention_holds_member_insert on public.retention_holds;
create policy retention_holds_member_insert on public.retention_holds
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and released_at is null);

drop policy if exists retention_holds_member_release on public.retention_holds;
create policy retention_holds_member_release on public.retention_holds
  for update to authenticated
  using (public.is_workspace_member(workspace_id) and released_at is null)
  with check (public.is_workspace_member(workspace_id));

-- Only released_at / released_by / release_reason may change, and only once.
create or replace function public.retention_holds_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.released_at is not null then
    raise exception 'retention_hold_already_released' using errcode = 'P0001';
  end if;
  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.entity_type is distinct from old.entity_type
     or new.entity_id is distinct from old.entity_id
     or new.held_by_module is distinct from old.held_by_module
     or new.holder_ref is distinct from old.holder_ref
     or new.reason is distinct from old.reason
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'retention_hold_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists retention_holds_guard_update on public.retention_holds;
create trigger retention_holds_guard_update
  before update on public.retention_holds
  for each row execute function public.retention_holds_guard_update();

-- Delete guard. TG_ARGV[0] = entity_type. Fires for direct deletes and for
-- rows removed by a cascade, so a hold on an engagement also blocks deleting
-- anything that would cascade into it.
create or replace function public.platform_guard_retention_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hold record;
begin
  select h.held_by_module, h.reason
    into hold
    from public.retention_holds h
   where h.entity_type = tg_argv[0]
     and h.entity_id = old.id
     and h.released_at is null
   limit 1;

  if found then
    raise exception 'retention_hold_active: % % is held by % (%)',
      tg_argv[0], old.id, hold.held_by_module, hold.reason
      using errcode = 'P0001',
            hint = 'Release the hold from the holding module before deleting.';
  end if;
  return old;
end;
$$;

-- Trigger-only: never exposed as an RPC (Supabase advisor 0028/0029).
revoke all on function public.platform_guard_retention_hold() from public, anon, authenticated;
revoke all on function public.retention_holds_guard_update() from public, anon, authenticated;

drop trigger if exists engagements_retention_guard on public.engagements;
create trigger engagements_retention_guard
  before delete on public.engagements
  for each row execute function public.platform_guard_retention_hold('engagement');

drop trigger if exists accounts_retention_guard on public.accounts;
create trigger accounts_retention_guard
  before delete on public.accounts
  for each row execute function public.platform_guard_retention_hold('account');

drop trigger if exists contacts_retention_guard on public.contacts;
create trigger contacts_retention_guard
  before delete on public.contacts
  for each row execute function public.platform_guard_retention_hold('contact');

drop trigger if exists leads_retention_guard on public.leads;
create trigger leads_retention_guard
  before delete on public.leads
  for each row execute function public.platform_guard_retention_hold('lead');

-- -----------------------------------------------------------------------------
-- 2. activity_events — survive engagement/lead deletion
-- -----------------------------------------------------------------------------

alter table public.activity_events
  add column if not exists module text not null default 'consultos',
  add column if not exists engagement_ref uuid,
  add column if not exists lead_ref uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activity_events_module_check') then
    alter table public.activity_events
      add constraint activity_events_module_check
      check (module in ('consultos', 'buildos', 'ventureos', 'governanceos', 'platform'));
  end if;
end;
$$;

update public.activity_events
   set engagement_ref = coalesce(engagement_ref, engagement_id),
       lead_ref = coalesce(lead_ref, lead_id)
 where (engagement_ref is null and engagement_id is not null)
    or (lead_ref is null and lead_id is not null);

alter table public.activity_events drop constraint if exists activity_events_engagement_id_fkey;
alter table public.activity_events
  add constraint activity_events_engagement_id_fkey
  foreign key (engagement_id) references public.engagements(id) on delete set null;

alter table public.activity_events drop constraint if exists activity_events_lead_id_fkey;
alter table public.activity_events
  add constraint activity_events_lead_id_fkey
  foreign key (lead_id) references public.leads(id) on delete set null;

create index if not exists activity_events_engagement_ref_idx
  on public.activity_events (engagement_ref) where engagement_ref is not null;
create index if not exists activity_events_module_idx
  on public.activity_events (workspace_id, module, created_at desc);

-- -----------------------------------------------------------------------------
-- 3. notes — same treatment
-- -----------------------------------------------------------------------------

alter table public.notes
  add column if not exists engagement_ref uuid,
  add column if not exists lead_ref uuid;

update public.notes
   set engagement_ref = coalesce(engagement_ref, engagement_id),
       lead_ref = coalesce(lead_ref, lead_id)
 where (engagement_ref is null and engagement_id is not null)
    or (lead_ref is null and lead_id is not null);

alter table public.notes drop constraint if exists notes_engagement_id_fkey;
alter table public.notes
  add constraint notes_engagement_id_fkey
  foreign key (engagement_id) references public.engagements(id) on delete set null;

alter table public.notes drop constraint if exists notes_lead_id_fkey;
alter table public.notes
  add constraint notes_lead_id_fkey
  foreign key (lead_id) references public.leads(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 4. ai_synthesis_runs — engagement-optional provenance
-- -----------------------------------------------------------------------------

alter table public.ai_synthesis_runs
  add column if not exists module text not null default 'consultos',
  add column if not exists engagement_ref uuid,
  add column if not exists subject_type text,
  add column if not exists subject_id uuid;

update public.ai_synthesis_runs
   set engagement_ref = engagement_id
 where engagement_ref is null and engagement_id is not null;

alter table public.ai_synthesis_runs alter column engagement_id drop not null;

alter table public.ai_synthesis_runs drop constraint if exists ai_synthesis_runs_engagement_id_fkey;
alter table public.ai_synthesis_runs
  add constraint ai_synthesis_runs_engagement_id_fkey
  foreign key (engagement_id) references public.engagements(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_synthesis_runs_module_check') then
    alter table public.ai_synthesis_runs
      add constraint ai_synthesis_runs_module_check
      check (module in ('consultos', 'buildos', 'ventureos', 'governanceos', 'platform'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_synthesis_runs_subject_check') then
    -- Every run must say what it was about: an engagement, or a generic subject.
    alter table public.ai_synthesis_runs
      add constraint ai_synthesis_runs_subject_check
      check (engagement_ref is not null or (subject_type is not null and subject_id is not null));
  end if;
end;
$$;

create index if not exists ai_synthesis_runs_subject_idx
  on public.ai_synthesis_runs (subject_type, subject_id) where subject_id is not null;

-- -----------------------------------------------------------------------------
-- 5. *_ref auto-population on insert (callers keep writing engagement_id /
--    lead_id exactly as today; no ConsultOS code change required)
-- -----------------------------------------------------------------------------

create or replace function public.platform_fill_lineage_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.engagement_id is not null and new.engagement_ref is null then
    new.engagement_ref := new.engagement_id;
  end if;
  -- Nested (not AND-ed): plpgsql resolves record fields when the expression
  -- is prepared, and ai_synthesis_runs has no lead_id / lead_ref.
  if tg_table_name in ('activity_events', 'notes') then
    if new.lead_id is not null and new.lead_ref is null then
      new.lead_ref := new.lead_id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.platform_fill_lineage_refs() from public, anon, authenticated;

drop trigger if exists activity_events_fill_refs on public.activity_events;
create trigger activity_events_fill_refs
  before insert on public.activity_events
  for each row execute function public.platform_fill_lineage_refs();

drop trigger if exists notes_fill_refs on public.notes;
create trigger notes_fill_refs
  before insert or update of engagement_id, lead_id on public.notes
  for each row execute function public.platform_fill_lineage_refs();

drop trigger if exists ai_synthesis_runs_fill_refs on public.ai_synthesis_runs;
create trigger ai_synthesis_runs_fill_refs
  before insert on public.ai_synthesis_runs
  for each row execute function public.platform_fill_lineage_refs();
