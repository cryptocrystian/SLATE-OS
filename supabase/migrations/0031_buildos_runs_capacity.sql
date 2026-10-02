-- SLATE — BuildOS B1 · Workers, runs, run events, provider capacity, cost, alarms
--
-- Per docs/80 §4–§7 and docs/81 §5, §7, §10, §11, §12.
-- Layer: BUILDOS MODULE.
--
-- Runs, events, slot leases, ledger and alarms are written ONLY by the
-- security-definer engine RPCs (0033) on behalf of workers. Operators read.
-- Secrets are never stored: provider accounts name a secret_ref only.
--
-- Rollback path (manual, pre-production only):
--   drop table if exists public.build_alarms, public.build_cost_ledger, public.build_capacity_leases,
--     public.build_provider_accounts, public.build_run_events, public.build_runs, public.build_workers cascade;
--   drop function if exists public.build_runs_guard(), public.build_append_only_guard();
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- build_workers
-- -----------------------------------------------------------------------------

create table if not exists public.build_workers (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete restrict,
  name            text not null check (name ~ '^[a-z0-9][a-z0-9._-]{1,62}$'),
  substrate       text not null check (char_length(substrate) between 1 and 60),
  capabilities    text[] not null default '{}',
  status          text not null default 'active' check (status in ('active', 'disabled')),
  last_seen_at    timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, name)
);

drop trigger if exists build_workers_set_updated_at on public.build_workers;
create trigger build_workers_set_updated_at
  before update on public.build_workers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- build_runs
-- -----------------------------------------------------------------------------

create table if not exists public.build_runs (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null,
  project_id             uuid not null,
  work_item_id           uuid not null,
  run_key                text not null,
  attempt_no             int not null check (attempt_no >= 1),
  lane                   text not null default 'feature' check (lane ~ '^[a-z][a-z0-9-]{1,39}$'),
  mode                   text not null default 'build' check (mode in ('build', 'remediate', 'resume')),
  worker_id              uuid not null references public.build_workers(id) on delete restrict,
  status                 text not null default 'running' check (status in ('running', 'finished')),
  phase                  text check (phase is null or phase ~ '^[a-z][a-z0-9_-]{0,39}$'),
  -- pins (R9 / docs/81 §5)
  stack_profile          text not null,
  canon_profile          text not null,
  base_sha               text check (base_sha is null or base_sha ~ '^[0-9a-f]{7,64}$'),
  canon_ref_pin          text check (canon_ref_pin is null or char_length(canon_ref_pin) <= 200),
  lane_version           text check (lane_version is null or char_length(lane_version) <= 80),
  roster_hash            text check (roster_hash is null or char_length(roster_hash) <= 128),
  -- lease
  lease_expires_at       timestamptz not null,
  heartbeat_at           timestamptz,
  cancel_requested_at    timestamptz,
  cancel_requested_by    uuid references public.profiles(id) on delete set null,
  -- outcome
  verdict                text check (verdict is null or verdict in ('accepted', 'rejected', 'escalated', 'held', 'aborted')),
  failure_class          text check (failure_class is null or failure_class in
                           ('rejected', 'merge_conflict', 'escalated', 'provider_unavailable', 'no_verdict',
                            'worker_lost', 'budget_exceeded', 'precondition', 'operator_abort')),
  summary                text check (summary is null or char_length(summary) <= 4000),
  resumable_from_phase   text check (resumable_from_phase is null or resumable_from_phase ~ '^[a-z][a-z0-9_-]{0,39}$'),
  branch                 text check (branch is null or char_length(branch) <= 200),
  pr_url                 text check (pr_url is null or pr_url ~ '^https://'),
  merge_sha              text check (merge_sha is null or merge_sha ~ '^[0-9a-f]{7,64}$'),
  started_at             timestamptz not null default now(),
  finished_at            timestamptz,
  unique (workspace_id, run_key),
  unique (work_item_id, attempt_no),
  foreign key (work_item_id, project_id) references public.build_work_items (id, project_id) on delete restrict,
  foreign key (project_id, workspace_id) references public.build_projects (id, workspace_id) on delete restrict,
  constraint build_runs_finished check (
    (status = 'running' and verdict is null and failure_class is null and finished_at is null)
    or (status = 'finished' and verdict is not null and finished_at is not null)
  ),
  constraint build_runs_failure_iff_not_accepted check (
    status = 'running' or ((verdict = 'accepted') = (failure_class is null))
  ),
  constraint build_runs_verdict_class check (
    verdict is null
    or (verdict = 'accepted')
    or (verdict = 'rejected'  and failure_class in ('rejected', 'merge_conflict'))
    or (verdict = 'escalated' and failure_class = 'escalated')
    or (verdict = 'held'      and failure_class in ('provider_unavailable', 'no_verdict', 'worker_lost',
                                                     'budget_exceeded', 'precondition'))
    or (verdict = 'aborted'   and failure_class = 'operator_abort')
  ),
  constraint build_runs_accepted_pinned check (
    verdict is distinct from 'accepted' or (base_sha is not null and lane_version is not null)
  )
);

create index if not exists build_runs_running_idx
  on public.build_runs (project_id) where status = 'running';
create index if not exists build_runs_item_idx
  on public.build_runs (work_item_id, attempt_no desc);
create index if not exists build_runs_project_recent_idx
  on public.build_runs (project_id, started_at desc);
create index if not exists build_runs_lease_idx
  on public.build_runs (lease_expires_at) where status = 'running';

-- A finished run is immutable apart from merge_sha / pr_url back-fill
-- (docs/81 §5). Identity + pins are immutable once set.
create or replace function public.build_runs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.project_id is distinct from old.project_id
     or new.work_item_id is distinct from old.work_item_id
     or new.run_key is distinct from old.run_key
     or new.attempt_no is distinct from old.attempt_no
     or new.worker_id is distinct from old.worker_id
     or new.stack_profile is distinct from old.stack_profile
     or new.canon_profile is distinct from old.canon_profile
     or new.started_at is distinct from old.started_at
     or (old.base_sha is not null and new.base_sha is distinct from old.base_sha)
     or (old.lane_version is not null and new.lane_version is distinct from old.lane_version)
     or (old.canon_ref_pin is not null and new.canon_ref_pin is distinct from old.canon_ref_pin)
     or (old.roster_hash is not null and new.roster_hash is distinct from old.roster_hash) then
    raise exception 'build_run_immutable_field' using errcode = 'P0001';
  end if;
  if old.status = 'finished' then
    if (to_jsonb(new) - 'merge_sha' - 'pr_url') <> (to_jsonb(old) - 'merge_sha' - 'pr_url')
       or (old.merge_sha is not null and new.merge_sha is distinct from old.merge_sha)
       or (old.pr_url is not null and new.pr_url is distinct from old.pr_url) then
      raise exception 'build_run_finished_immutable' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists build_runs_guard on public.build_runs;
create trigger build_runs_guard
  before update on public.build_runs
  for each row execute function public.build_runs_guard();

-- Generic append-only guard for event / ledger tables.
create or replace function public.build_append_only_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'build_append_only: %', tg_table_name using errcode = 'P0001';
end;
$$;

-- -----------------------------------------------------------------------------
-- build_run_events (append-only)
-- -----------------------------------------------------------------------------

create table if not exists public.build_run_events (
  id                   bigint generated always as identity primary key,
  run_id               uuid not null references public.build_runs(id) on delete restrict,
  workspace_id         uuid not null,
  project_id           uuid not null,
  ts                   timestamptz not null default now(),
  kind                 text not null check (kind in ('phase_start', 'phase_end', 'gate', 'agent_call', 'log')),
  phase                text check (phase is null or char_length(phase) <= 40),
  role                 text check (role is null or char_length(role) <= 40),
  model                text check (model is null or char_length(model) <= 120),
  family               text check (family is null or family in ('anthropic', 'openai', 'google', 'xai', 'other')),
  passed               boolean,
  detail               jsonb not null default '{}'::jsonb,
  transcript_file_id   uuid references public.stored_files(id) on delete restrict
);

create index if not exists build_run_events_run_idx on public.build_run_events (run_id, id);

drop trigger if exists build_run_events_append_only on public.build_run_events;
create trigger build_run_events_append_only
  before update or delete on public.build_run_events
  for each row execute function public.build_append_only_guard();

-- -----------------------------------------------------------------------------
-- build_provider_accounts (no secrets — secret_ref names a key in the worker
-- secret manager)
-- -----------------------------------------------------------------------------

create table if not exists public.build_provider_accounts (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete restrict,
  label              text not null check (char_length(btrim(label)) between 1 and 80),
  family             text not null check (family in ('anthropic', 'openai', 'google', 'xai', 'other')),
  provider           text not null check (provider ~ '^[a-z][a-z0-9-]{1,39}$'),
  billing_class      text not null check (billing_class in ('subscription', 'metered', 'metered_subscription')),
  secret_ref         text not null check (secret_ref ~ '^[A-Za-z0-9_./:-]{1,120}$'),
  max_concurrency    int not null default 2 check (max_concurrency between 1 and 64),
  status             text not null default 'active' check (status in ('active', 'disabled')),
  health             text not null default 'unknown' check (health in ('healthy', 'degraded', 'down', 'unknown')),
  health_checked_at  timestamptz,
  health_detail      text check (health_detail is null or char_length(health_detail) <= 1000),
  cooldown_until     timestamptz,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (workspace_id, label)
);

drop trigger if exists build_provider_accounts_set_updated_at on public.build_provider_accounts;
create trigger build_provider_accounts_set_updated_at
  before update on public.build_provider_accounts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- build_capacity_leases (per-call slots; expire so a crash cannot pin capacity)
-- -----------------------------------------------------------------------------

create table if not exists public.build_capacity_leases (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null,
  account_id     uuid not null references public.build_provider_accounts(id) on delete restrict,
  run_id         uuid not null references public.build_runs(id) on delete restrict,
  role           text not null check (char_length(role) between 1 and 40),
  acquired_at    timestamptz not null default now(),
  expires_at     timestamptz not null,
  released_at    timestamptz
);

create index if not exists build_capacity_leases_live_idx
  on public.build_capacity_leases (account_id) where released_at is null;

-- -----------------------------------------------------------------------------
-- build_cost_ledger (append-only; one row per agent call)
-- -----------------------------------------------------------------------------

create table if not exists public.build_cost_ledger (
  id                bigint generated always as identity primary key,
  workspace_id      uuid not null,
  project_id        uuid not null,
  run_id            uuid not null references public.build_runs(id) on delete restrict,
  account_id        uuid not null references public.build_provider_accounts(id) on delete restrict,
  role              text not null,
  model             text not null check (char_length(model) between 1 and 120),
  tokens_in         bigint not null default 0 check (tokens_in >= 0),
  tokens_out        bigint not null default 0 check (tokens_out >= 0),
  list_cost_usd     numeric(12, 6) not null default 0 check (list_cost_usd >= 0),
  billed_cost_usd   numeric(12, 6) not null default 0 check (billed_cost_usd >= 0),
  outcome           text not null check (outcome in ('ok', 'provider_unavailable', 'error')),
  created_at        timestamptz not null default now()
);

create index if not exists build_cost_ledger_project_day_idx
  on public.build_cost_ledger (project_id, created_at);

drop trigger if exists build_cost_ledger_append_only on public.build_cost_ledger;
create trigger build_cost_ledger_append_only
  before update or delete on public.build_cost_ledger
  for each row execute function public.build_append_only_guard();

-- -----------------------------------------------------------------------------
-- build_alarms (docs/81 §10)
-- -----------------------------------------------------------------------------

create table if not exists public.build_alarms (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete restrict,
  project_id    uuid references public.build_projects(id) on delete restrict,
  kind          text not null check (kind in ('stall', 'starvation', 'thrash', 'dead_man', 'capacity', 'merge')),
  subject       text not null default '' check (char_length(subject) <= 200),
  detail        text check (detail is null or char_length(detail) <= 4000),
  raised_at     timestamptz not null default now(),
  cleared_at    timestamptz,
  cleared_by    uuid references public.profiles(id) on delete set null
);

create unique index if not exists build_alarms_open_uniq
  on public.build_alarms (workspace_id, kind, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), subject)
  where cleared_at is null;

revoke all on function public.build_runs_guard() from public, anon, authenticated;
revoke all on function public.build_append_only_guard() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privileges + RLS (docs/81 §11): members read; operators manage workers and
-- provider accounts; engine-only tables have no authenticated write grants.
-- -----------------------------------------------------------------------------

alter table public.build_workers enable row level security;
alter table public.build_runs enable row level security;
alter table public.build_run_events enable row level security;
alter table public.build_provider_accounts enable row level security;
alter table public.build_capacity_leases enable row level security;
alter table public.build_cost_ledger enable row level security;
alter table public.build_alarms enable row level security;

revoke all on table public.build_workers, public.build_runs, public.build_run_events,
  public.build_provider_accounts, public.build_capacity_leases, public.build_cost_ledger,
  public.build_alarms from anon;
revoke all on table public.build_runs, public.build_run_events, public.build_capacity_leases,
  public.build_cost_ledger, public.build_alarms from authenticated;
revoke delete, truncate on table public.build_workers, public.build_provider_accounts from authenticated;
grant select on table public.build_runs, public.build_run_events, public.build_capacity_leases,
  public.build_cost_ledger, public.build_alarms to authenticated;
grant select, insert, update on table public.build_workers, public.build_provider_accounts to authenticated;
grant all on table public.build_workers, public.build_runs, public.build_run_events,
  public.build_provider_accounts, public.build_capacity_leases, public.build_cost_ledger,
  public.build_alarms to service_role;

do $$
declare
  t text;
begin
  foreach t in array array['build_workers', 'build_runs', 'build_run_events', 'build_provider_accounts',
                           'build_capacity_leases', 'build_cost_ledger', 'build_alarms'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      t || '_read', t);
  end loop;
end $$;

drop policy if exists build_workers_create on public.build_workers;
create policy build_workers_create on public.build_workers
  for insert to authenticated
  with check (public.build_is_operator(workspace_id) and created_by = (select auth.uid()));
drop policy if exists build_workers_update on public.build_workers;
create policy build_workers_update on public.build_workers
  for update to authenticated
  using (public.build_is_operator(workspace_id)) with check (public.build_is_operator(workspace_id));

-- Provider accounts govern spend: workspace OWNER only.
drop policy if exists build_provider_accounts_create on public.build_provider_accounts;
create policy build_provider_accounts_create on public.build_provider_accounts
  for insert to authenticated
  with check (public.has_workspace_role(workspace_id, array['owner']) and created_by = (select auth.uid()));
drop policy if exists build_provider_accounts_update on public.build_provider_accounts;
create policy build_provider_accounts_update on public.build_provider_accounts
  for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner']))
  with check (public.has_workspace_role(workspace_id, array['owner']));
