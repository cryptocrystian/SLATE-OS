-- SLATE — GovernanceOS G1 · Governed asset registry + lifecycle history
--
-- Per docs/72 §4.1–4.5 and docs/76 §5–6. Layer: GOVERNANCEOS MODULE.
--
-- One typed registry for use cases, AI systems, models, agents, workflows
-- and vendor services. Assets may originate anywhere in SLATE (ConsultOS,
-- BuildOS, VentureOS, integration/runtime, internal, external) via generic
-- lineage (source_system / source_entity_type / source_entity_id) — never a
-- hard FK into another module, and never an authorization input.
--
-- Lifecycle (docs/76 §6): proposed → assessment → active → restricted →
-- retired. `approved` is RESERVED — unreachable until G3 decision records
-- exist; an already-running asset is honestly `active · not yet
-- governance-approved`. `retired` is terminal. No deletes. Every lifecycle
-- change is written to an append-only history table BY THE DATABASE, so no
-- code path can change status without leaving a record.
--
-- Rollback path (manual, pre-production only):
--   drop table if exists public.governed_asset_lifecycle_events, public.governed_assets cascade;
--   drop function if exists public.governance_transition_asset(uuid, text, text);
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.governed_assets (
  id                          uuid primary key default gen_random_uuid(),
  workspace_id                uuid not null,
  governance_program_id       uuid not null,
  asset_type                  text not null check (asset_type in
                                ('use_case', 'ai_system', 'model', 'agent', 'workflow', 'vendor_service')),
  name                        text not null check (char_length(btrim(name)) between 1 and 200),
  description                 text check (description is null or char_length(description) <= 4000),
  lifecycle_status            text not null default 'proposed' check (lifecycle_status in
                                ('proposed', 'assessment', 'active', 'restricted', 'retired')),
  -- governance dimensions (queryable columns, docs/72 §5.3 design rule)
  criticality                 text check (criticality is null or criticality in ('low', 'medium', 'high', 'critical')),
  data_sensitivity            text check (data_sensitivity is null or data_sensitivity in
                                ('public', 'internal', 'confidential', 'restricted', 'regulated')),
  autonomy_level              text check (autonomy_level is null or autonomy_level in
                                ('none', 'assistive', 'supervised', 'conditional', 'autonomous')),
  human_oversight_mode        text check (human_oversight_mode is null or human_oversight_mode in
                                ('human_in_the_loop', 'human_on_the_loop', 'human_out_of_the_loop')),
  deployment_environment      text check (deployment_environment is null or deployment_environment in
                                ('development', 'staging', 'production', 'client_hosted', 'other')),
  external_vendor             text,
  model_provider              text,
  model_identifier            text,
  intended_use                text check (intended_use is null or char_length(intended_use) <= 4000),
  prohibited_uses             jsonb not null default '[]'::jsonb check (jsonb_typeof(prohibited_uses) = 'array'),
  -- owners (profile for Saipien operators; name snapshots survive contact deletion)
  operator_owner_profile_id   uuid references public.profiles(id) on delete set null,
  business_owner_name         text,
  business_owner_contact_id   uuid references public.contacts(id) on delete set null,
  technical_owner_name        text,
  technical_owner_contact_id  uuid references public.contacts(id) on delete set null,
  -- cross-SLATE lineage (docs/76 §5)
  source_system               text check (source_system is null or source_system in
                                ('consultos', 'buildos', 'ventureos', 'integration', 'runtime', 'internal', 'external')),
  source_entity_type          text,
  source_entity_id            text,
  correlation_id              text,
  external_runtime_id         text,
  parent_governed_asset_id    uuid,
  metadata                    jsonb not null default '{}'::jsonb,
  created_by                  uuid references public.profiles(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  retired_at                  timestamptz,
  unique (id, governance_program_id),
  foreign key (governance_program_id, workspace_id)
    references public.governance_programs (id, workspace_id) on delete restrict,
  -- a parent must be in the same program
  foreign key (parent_governed_asset_id, governance_program_id)
    references public.governed_assets (id, governance_program_id) on delete restrict,
  constraint governed_assets_lineage_complete check (
    (source_system is null and source_entity_type is null and source_entity_id is null)
    or (source_system is not null and source_entity_type is not null and source_entity_id is not null)
  ),
  constraint governed_assets_not_own_parent check (parent_governed_asset_id is distinct from id),
  constraint governed_assets_retired_stamp check ((lifecycle_status = 'retired') = (retired_at is not null))
);

create unique index if not exists governed_assets_lineage_uniq
  on public.governed_assets (governance_program_id, source_system, source_entity_type, source_entity_id)
  where source_system is not null;
create index if not exists governed_assets_program_idx
  on public.governed_assets (workspace_id, governance_program_id, lifecycle_status, asset_type);
create index if not exists governed_assets_parent_idx
  on public.governed_assets (parent_governed_asset_id) where parent_governed_asset_id is not null;
create index if not exists governed_assets_source_idx
  on public.governed_assets (source_system, source_entity_type, source_entity_id) where source_system is not null;

drop trigger if exists governed_assets_set_updated_at on public.governed_assets;
create trigger governed_assets_set_updated_at
  before update on public.governed_assets
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Append-only lifecycle history
-- -----------------------------------------------------------------------------

create table if not exists public.governed_asset_lifecycle_events (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null,
  governance_program_id  uuid not null,
  governed_asset_id      uuid not null,
  from_status            text,
  to_status              text not null,
  reason                 text,
  changed_by             uuid references public.profiles(id) on delete set null,
  changed_at             timestamptz not null default now(),
  foreign key (governed_asset_id, governance_program_id)
    references public.governed_assets (id, governance_program_id) on delete restrict
);

create index if not exists governed_asset_lifecycle_events_asset_idx
  on public.governed_asset_lifecycle_events (governed_asset_id, changed_at desc);

-- -----------------------------------------------------------------------------
-- Guard: transitions, terminal retire, immutable identity, same-program parent
-- -----------------------------------------------------------------------------

create or replace function public.governed_assets_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An FK `on delete set null` from a contact deletion elsewhere in SLATE
  -- must never be blocked by GovernanceOS (name snapshots keep the record).
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'business_owner_contact_id' - 'technical_owner_contact_id' - 'updated_at')
       = (to_jsonb(old) - 'business_owner_contact_id' - 'technical_owner_contact_id' - 'updated_at') then
    return new;
  end if;

  if exists (
    select 1 from public.governance_programs p
     where p.id = new.governance_program_id and p.status = 'archived'
  ) then
    raise exception 'governance_program_archived' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    if new.lifecycle_status = 'retired' then
      raise exception 'governed_asset_invalid_initial_status' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.lifecycle_status = 'retired' then
    raise exception 'governed_asset_retired' using errcode = 'P0001';
  end if;
  if new.workspace_id is distinct from old.workspace_id
     or new.governance_program_id is distinct from old.governance_program_id
     or new.asset_type is distinct from old.asset_type
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'governed_asset_immutable_field' using errcode = 'P0001';
  end if;
  if new.lifecycle_status is distinct from old.lifecycle_status and not (
       (old.lifecycle_status = 'proposed'   and new.lifecycle_status in ('assessment', 'active', 'retired'))
    or (old.lifecycle_status = 'assessment' and new.lifecycle_status in ('proposed', 'active', 'retired'))
    or (old.lifecycle_status = 'active'     and new.lifecycle_status in ('assessment', 'restricted', 'retired'))
    or (old.lifecycle_status = 'restricted' and new.lifecycle_status in ('assessment', 'active', 'retired'))
  ) then
    raise exception 'governed_asset_invalid_transition: % -> %', old.lifecycle_status, new.lifecycle_status
      using errcode = 'P0001';
  end if;
  if new.lifecycle_status = 'retired' and new.retired_at is null then
    new.retired_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists governed_assets_guard on public.governed_assets;
create trigger governed_assets_guard
  before insert or update on public.governed_assets
  for each row execute function public.governed_assets_guard();

-- History writer. Definer: members cannot insert history rows directly.
create or replace function public.governed_assets_record_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.lifecycle_status is distinct from old.lifecycle_status then
    insert into public.governed_asset_lifecycle_events
      (workspace_id, governance_program_id, governed_asset_id, from_status, to_status, reason, changed_by)
    values
      (new.workspace_id, new.governance_program_id, new.id,
       case when tg_op = 'INSERT' then null else old.lifecycle_status end,
       new.lifecycle_status,
       nullif(current_setting('slate.governance_reason', true), ''),
       (select auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists governed_assets_record_lifecycle on public.governed_assets;
create trigger governed_assets_record_lifecycle
  after insert or update of lifecycle_status on public.governed_assets
  for each row execute function public.governed_assets_record_lifecycle();

revoke all on function public.governed_assets_guard() from public, anon, authenticated;
revoke all on function public.governed_assets_record_lifecycle() from public, anon, authenticated;

-- Transition with a recorded reason (the only way the app changes status).
create or replace function public.governance_transition_asset(asset uuid, to_status text, reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if reason is null or char_length(btrim(reason)) = 0 then
    raise exception 'governance_reason_required' using errcode = 'P0001';
  end if;
  perform set_config('slate.governance_reason', left(reason, 1000), true);
  update public.governed_assets set lifecycle_status = to_status where id = asset;
  if not found then
    raise exception 'governed_asset_not_found' using errcode = 'P0001';
  end if;
  perform set_config('slate.governance_reason', '', true);
end;
$$;
revoke all on function public.governance_transition_asset(uuid, text, text) from public, anon;
grant execute on function public.governance_transition_asset(uuid, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Privileges + RLS
-- -----------------------------------------------------------------------------

alter table public.governed_assets enable row level security;
alter table public.governed_asset_lifecycle_events enable row level security;

revoke all on table public.governed_assets from anon;
revoke all on table public.governed_asset_lifecycle_events from anon;
revoke delete, truncate on table public.governed_assets from authenticated;
revoke insert, update, delete, truncate on table public.governed_asset_lifecycle_events from authenticated;
grant select, insert, update on table public.governed_assets to authenticated;
grant select on table public.governed_asset_lifecycle_events to authenticated;
grant all on table public.governed_assets, public.governed_asset_lifecycle_events to service_role;

drop policy if exists governed_assets_read on public.governed_assets;
create policy governed_assets_read on public.governed_assets
  for select to authenticated
  using (public.governance_program_role(governance_program_id) is not null);

drop policy if exists governed_assets_register on public.governed_assets;
create policy governed_assets_register on public.governed_assets
  for insert to authenticated
  with check (public.governance_has_program_role(governance_program_id,
    array['program_admin', 'governance_manager', 'contributor']));

drop policy if exists governed_assets_update on public.governed_assets;
create policy governed_assets_update on public.governed_assets
  for update to authenticated
  using (public.governance_has_program_role(governance_program_id,
    array['program_admin', 'governance_manager', 'contributor']))
  with check (public.governance_has_program_role(governance_program_id,
    array['program_admin', 'governance_manager', 'contributor']));

drop policy if exists governed_asset_lifecycle_events_read on public.governed_asset_lifecycle_events;
create policy governed_asset_lifecycle_events_read on public.governed_asset_lifecycle_events
  for select to authenticated
  using (public.governance_program_role(governance_program_id) is not null);
