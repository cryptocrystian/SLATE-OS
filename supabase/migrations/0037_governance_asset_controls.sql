-- SLATE — GovernanceOS launch path · GOV 02 proportionality + GOV 06 go-live record
--
-- Per docs/73 v0.2 (Saipien AI Governance Operating Standard) and the
-- 2026-10-26 Architect decision ("launch path, then G2–G4").
-- Layer: GOVERNANCEOS MODULE.
--
-- GOV 02 — controls scale with three readings taken per system:
--   data_sensitivity (existing), autonomy_level (existing), client_impact (new).
--   control_tier is DERIVED by the database from the three readings — never
--   set by a person or a model — so "controls scale per system" is computed,
--   not asserted. Any missing reading ⇒ 'unclassified'.
--
-- GOV 06 — before anything goes live, the record must hold: owner, autonomy
--   level, oversight mode, data sensitivity, tools and permissions, a stop
--   mechanism, and a named approver. The lifecycle guard now REFUSES the move
--   to `active` until every one is recorded, so the control is enforced, not
--   just described.
--
-- Rollback path (manual): drop the added columns; re-run 0027's
-- governed_assets_guard().
--
-- Idempotent: safe to re-run.

alter table public.governed_assets
  add column if not exists client_impact text
    check (client_impact is null or client_impact in ('none', 'indirect', 'direct', 'critical')),
  add column if not exists tools_and_permissions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tools_and_permissions) = 'array'),
  add column if not exists stop_mechanism text
    check (stop_mechanism is null or char_length(stop_mechanism) <= 2000),
  add column if not exists approver_name text
    check (approver_name is null or char_length(approver_name) <= 160),
  add column if not exists approver_contact_id uuid
    references public.contacts(id) on delete set null;

-- Derived control tier (GOV 02). Scale per reading: 0 low … 3 high.
--   data_sensitivity: public 0 · internal 1 · confidential 2 · restricted 3 · regulated 3
--   autonomy_level:   none 0 · assistive 0 · supervised 1 · conditional 2 · autonomous 3
--   client_impact:    none 0 · indirect 1 · direct 2 · critical 3
-- tier = the HIGHEST reading: ≤1 standard · 2 elevated · 3 high.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'governed_assets' and column_name = 'control_tier'
  ) then
    alter table public.governed_assets
      add column control_tier text generated always as (
        case
          when data_sensitivity is null or autonomy_level is null or client_impact is null then 'unclassified'
          when greatest(
                 case data_sensitivity when 'public' then 0 when 'internal' then 1 when 'confidential' then 2 else 3 end,
                 case autonomy_level when 'none' then 0 when 'assistive' then 0 when 'supervised' then 1 when 'conditional' then 2 else 3 end,
                 case client_impact when 'none' then 0 when 'indirect' then 1 when 'direct' then 2 else 3 end
               ) >= 3 then 'high'
          when greatest(
                 case data_sensitivity when 'public' then 0 when 'internal' then 1 when 'confidential' then 2 else 3 end,
                 case autonomy_level when 'none' then 0 when 'assistive' then 0 when 'supervised' then 1 when 'conditional' then 2 else 3 end,
                 case client_impact when 'none' then 0 when 'indirect' then 1 when 'direct' then 2 else 3 end
               ) = 2 then 'elevated'
          else 'standard'
        end
      ) stored;
  end if;
end;
$$;

create index if not exists governed_assets_control_tier_idx
  on public.governed_assets (governance_program_id, control_tier);

-- Guard: 0027 rules + contact-FK exemption for the new approver contact +
-- the GOV 06 go-live gate.
create or replace function public.governed_assets_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  missing text[] := array[]::text[];
begin
  -- An FK `on delete set null` from a contact deletion elsewhere in SLATE
  -- must never be blocked by GovernanceOS (name snapshots keep the record).
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'business_owner_contact_id' - 'technical_owner_contact_id' - 'approver_contact_id' - 'updated_at')
       = (to_jsonb(old) - 'business_owner_contact_id' - 'technical_owner_contact_id' - 'approver_contact_id' - 'updated_at') then
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
  else
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
  end if;

  -- GOV 06: entering `active` (on insert or by transition) needs the full record.
  if new.lifecycle_status = 'active'
     and (tg_op = 'INSERT' or old.lifecycle_status is distinct from 'active') then
    if new.operator_owner_profile_id is null and nullif(btrim(coalesce(new.business_owner_name, '')), '') is null then
      missing := array_append(missing, 'owner');
    end if;
    if new.autonomy_level is null then missing := array_append(missing, 'autonomy_level'); end if;
    if new.human_oversight_mode is null then missing := array_append(missing, 'human_oversight_mode'); end if;
    if new.data_sensitivity is null then missing := array_append(missing, 'data_sensitivity'); end if;
    if new.client_impact is null then missing := array_append(missing, 'client_impact'); end if;
    if jsonb_array_length(new.tools_and_permissions) = 0 then missing := array_append(missing, 'tools_and_permissions'); end if;
    if nullif(btrim(coalesce(new.stop_mechanism, '')), '') is null then missing := array_append(missing, 'stop_mechanism'); end if;
    if nullif(btrim(coalesce(new.approver_name, '')), '') is null then missing := array_append(missing, 'approver_name'); end if;
    if array_length(missing, 1) > 0 then
      raise exception 'gov06_incomplete: %', array_to_string(missing, ', ')
        using errcode = 'P0001',
              hint = 'GOV 06: record owner, autonomy, oversight, data sensitivity, client impact, tools and permissions, stop mechanism and a named approver before go-live.';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.governed_assets_guard() from public, anon, authenticated;
