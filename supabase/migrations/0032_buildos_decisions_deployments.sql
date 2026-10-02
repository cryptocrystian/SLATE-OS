-- SLATE — BuildOS B1 · Decisions, deployments
--
-- Per docs/80 §4, §9 and docs/81 §9.
-- Layer: BUILDOS MODULE.
--
-- Decisions are created by the engine (an escalated run) and ruled ONLY via
-- build_rule_decision (0033). A ruling never dispatches work (B8): it makes
-- the item claimable, the scheduler does the rest. Deployments are recorded
-- in B1 (table only); the governance gate call arrives in B4.
--
-- Rollback path (manual, pre-production only):
--   drop table if exists public.build_deployments, public.build_decisions cascade;
--   drop function if exists public.build_decisions_guard();
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.build_decisions (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null,
  project_id            uuid not null,
  work_item_id          uuid not null,
  run_id                uuid references public.build_runs(id) on delete restrict,
  class                 text not null check (class in ('technical', 'product', 'owner')),
  title                 text not null check (char_length(btrim(title)) between 1 and 200),
  brief                 text not null check (char_length(brief) between 1 and 20000),
  options               jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  recommended_option    text,
  status                text not null default 'open' check (status in ('open', 'ruled', 'withdrawn')),
  ruling_option         text,
  ruling_note           text check (ruling_note is null or char_length(ruling_note) <= 4000),
  item_action           text check (item_action is null or item_action in ('ready', 'cancelled', 'superseded')),
  resulting_canon_ref   text check (resulting_canon_ref is null or char_length(resulting_canon_ref) <= 200),
  ruled_by              uuid references public.profiles(id) on delete set null,
  ruled_at              timestamptz,
  created_at            timestamptz not null default now(),
  foreign key (work_item_id, project_id) references public.build_work_items (id, project_id) on delete restrict,
  foreign key (project_id, workspace_id) references public.build_projects (id, workspace_id) on delete restrict,
  constraint build_decisions_ruled check (
    (status = 'ruled') = (ruled_at is not null and ruling_option is not null and item_action is not null)
  ),
  constraint build_decisions_recommended check (
    recommended_option is null
    or jsonb_path_exists(options, '$[*] ? (@.key == $k)', jsonb_build_object('k', recommended_option))
  )
);

create index if not exists build_decisions_open_idx
  on public.build_decisions (workspace_id, status, created_at desc);
create index if not exists build_decisions_item_idx on public.build_decisions (work_item_id);

-- Content is immutable; only the single open → ruled|withdrawn transition is allowed.
create or replace function public.build_decisions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'open' then
    raise exception 'build_decision_closed' using errcode = 'P0001';
  end if;
  if (to_jsonb(new) - 'status' - 'ruling_option' - 'ruling_note' - 'item_action'
        - 'resulting_canon_ref' - 'ruled_by' - 'ruled_at')
     <> (to_jsonb(old) - 'status' - 'ruling_option' - 'ruling_note' - 'item_action'
        - 'resulting_canon_ref' - 'ruled_by' - 'ruled_at') then
    raise exception 'build_decision_immutable' using errcode = 'P0001';
  end if;
  if new.status = 'ruled' and not jsonb_path_exists(
       new.options, '$[*] ? (@.key == $k)', jsonb_build_object('k', new.ruling_option)) then
    raise exception 'build_decision_unknown_option: %', new.ruling_option using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists build_decisions_guard on public.build_decisions;
create trigger build_decisions_guard
  before update on public.build_decisions
  for each row execute function public.build_decisions_guard();

create table if not exists public.build_deployments (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null,
  project_id               uuid not null,
  environment              text not null check (environment in ('development', 'staging', 'production', 'client_hosted')),
  ref                      text not null check (ref ~ '^[0-9a-f]{7,64}$'),
  status                   text not null default 'planned'
                             check (status in ('planned', 'approved', 'deployed', 'failed', 'rolled_back')),
  governance_gate_result   jsonb,
  approved_by              uuid references public.profiles(id) on delete set null,
  approved_at              timestamptz,
  deployed_at              timestamptz,
  note                     text check (note is null or char_length(note) <= 4000),
  created_by               uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  foreign key (project_id, workspace_id) references public.build_projects (id, workspace_id) on delete restrict,
  constraint build_deployments_approved check (status = 'planned' or (approved_by is not null and approved_at is not null))
);

create index if not exists build_deployments_project_idx on public.build_deployments (project_id, created_at desc);

drop trigger if exists build_deployments_set_updated_at on public.build_deployments;
create trigger build_deployments_set_updated_at
  before update on public.build_deployments
  for each row execute function public.set_updated_at();

revoke all on function public.build_decisions_guard() from public, anon, authenticated;

alter table public.build_decisions enable row level security;
alter table public.build_deployments enable row level security;

revoke all on table public.build_decisions, public.build_deployments from anon;
-- Decisions: read-only to operators; created by the engine, ruled via RPC.
revoke all on table public.build_decisions from authenticated;
grant select on table public.build_decisions to authenticated;
revoke delete, truncate on table public.build_deployments from authenticated;
grant select, insert, update on table public.build_deployments to authenticated;
grant all on table public.build_decisions, public.build_deployments to service_role;

drop policy if exists build_decisions_read on public.build_decisions;
create policy build_decisions_read on public.build_decisions
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists build_deployments_read on public.build_deployments;
create policy build_deployments_read on public.build_deployments
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists build_deployments_create on public.build_deployments;
create policy build_deployments_create on public.build_deployments
  for insert to authenticated
  with check (public.build_is_operator(workspace_id) and created_by = (select auth.uid()));
drop policy if exists build_deployments_update on public.build_deployments;
create policy build_deployments_update on public.build_deployments
  for update to authenticated
  using (public.build_is_operator(workspace_id)) with check (public.build_is_operator(workspace_id));
