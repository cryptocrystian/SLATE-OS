-- SLATE — BuildOS B1 · Projects, work items, dependencies
--
-- Per docs/80_BUILDOS_INTEGRATION_PLAN.md §4 and
-- docs/81_BUILDOS_DOMAIN_CONVENTIONS.md §2–§4.
-- Layer: BUILDOS MODULE. Uses platform primitives (0022 membership helpers,
-- 0024 retention holds); never modifies ConsultOS or GovernanceOS tables.
--
-- Canon: BuildOS (SLATE) is the system of record for build state (D1). No
-- build row is deleted by application code: projects close, items are
-- cancelled/superseded. A ConsultOS-originated project holds its engagement.
--
-- Rollback path (manual, pre-production only):
--   drop table if exists public.build_work_item_deps, public.build_work_items, public.build_projects cascade;
--   drop function if exists public.build_projects_guard(), public.build_projects_hold(),
--     public.build_work_items_guard(), public.build_work_item_deps_guard(), public.build_is_operator(uuid);
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Operator check (docs/81 §11): workspace owner/operator. Viewers read only.
-- -----------------------------------------------------------------------------

create or replace function public.build_is_operator(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_workspace_role(ws, array['owner', 'operator']);
$$;
revoke all on function public.build_is_operator(uuid) from public, anon;
grant execute on function public.build_is_operator(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- build_projects
-- -----------------------------------------------------------------------------

create table if not exists public.build_projects (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspaces(id) on delete restrict,
  project_key              text not null check (project_key ~ '^[a-z][a-z0-9-]{1,39}$'),
  name                     text not null check (char_length(btrim(name)) between 1 and 160),
  description              text check (description is null or char_length(description) <= 4000),
  origin_kind              text not null check (origin_kind in ('consultos_engagement', 'ventureos_venture', 'internal')),
  origin_engagement_id     uuid references public.engagements(id) on delete set null,
  origin_engagement_ref    uuid,
  origin_name_snapshot     text,
  origin_ref               text check (origin_ref is null or char_length(origin_ref) between 1 and 200),
  isolation_class          text not null default 'internal' check (isolation_class in ('internal', 'client')),
  repo_url                 text not null check (repo_url ~ '^(https://|git@)[^\s]+$'),
  default_branch           text not null default 'main' check (default_branch ~ '^[A-Za-z0-9._/-]{1,120}$'),
  stack_profile            text not null check (stack_profile ~ '^[a-z][a-z0-9-]{1,39}$'),
  canon_profile            text not null check (canon_profile ~ '^[a-z][a-z0-9.-]{1,39}$'),
  status                   text not null default 'intake'
                             check (status in ('intake', 'ready', 'active', 'paused', 'closed')),
  readiness_checked_at     timestamptz,
  readiness_note           text check (readiness_note is null or char_length(readiness_note) <= 4000),
  -- scheduling settings (docs/81 §3)
  wip_limit                int not null default 2 check (wip_limit between 1 and 8),
  priority_weight          int not null default 5 check (priority_weight between 1 and 10),
  max_attempts             int not null default 3 check (max_attempts between 1 and 10),
  daily_budget_usd         numeric(12, 2) check (daily_budget_usd is null or daily_budget_usd >= 0),
  builder_family           text not null default 'anthropic'
                             check (builder_family in ('anthropic', 'openai', 'google', 'xai', 'other')),
  judge_families           text[] not null default array['openai', 'google', 'xai'],
  sched_pass               numeric not null default 0,
  activated_at             timestamptz,
  closed_at                timestamptz,
  created_by               uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, project_key),
  constraint build_projects_origin check (
    (origin_kind = 'consultos_engagement' and origin_engagement_ref is not null and origin_ref is null
       and isolation_class = 'client')
    or (origin_kind = 'ventureos_venture' and origin_ref is not null
       and origin_engagement_id is null and origin_engagement_ref is null)
    or (origin_kind = 'internal' and origin_ref is null
       and origin_engagement_id is null and origin_engagement_ref is null)
  ),
  -- I3: the judge never shares the builder's family.
  constraint build_projects_judges check (
    cardinality(judge_families) >= 1
    and not (builder_family = any (judge_families))
    and judge_families <@ array['anthropic', 'openai', 'google', 'xai', 'other']
  ),
  constraint build_projects_closed_stamp check ((status = 'closed') = (closed_at is not null)),
  constraint build_projects_ready_needs_readiness check (status = 'intake' or status = 'closed' or readiness_checked_at is not null)
);

create index if not exists build_projects_workspace_idx
  on public.build_projects (workspace_id, status);
create index if not exists build_projects_engagement_idx
  on public.build_projects (origin_engagement_ref) where origin_engagement_ref is not null;

drop trigger if exists build_projects_set_updated_at on public.build_projects;
create trigger build_projects_set_updated_at
  before update on public.build_projects
  for each row execute function public.set_updated_at();

create or replace function public.build_projects_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  eng record;
begin
  -- The engagement FK `on delete set null` must never be blocked (lineage stays in *_ref).
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'origin_engagement_id' - 'updated_at')
       = (to_jsonb(old) - 'origin_engagement_id' - 'updated_at') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.origin_kind = 'consultos_engagement' then
      select e.id, e.name, e.workspace_id into eng from public.engagements e where e.id = new.origin_engagement_id;
      if not found or eng.workspace_id <> new.workspace_id then
        raise exception 'build_cross_workspace_reference: engagement' using errcode = 'P0001';
      end if;
      new.origin_engagement_ref := new.origin_engagement_id;
      new.origin_name_snapshot := eng.name;
    end if;
    if new.status not in ('intake') then
      raise exception 'build_project_must_start_in_intake' using errcode = 'P0001';
    end if;
    new.activated_at := null;
    new.closed_at := null;
    return new;
  end if;

  -- UPDATE
  if new.workspace_id is distinct from old.workspace_id
     or new.project_key is distinct from old.project_key
     or new.origin_kind is distinct from old.origin_kind
     or new.origin_engagement_ref is distinct from old.origin_engagement_ref
     or new.origin_ref is distinct from old.origin_ref
     or (new.origin_engagement_id is not null and new.origin_engagement_id is distinct from old.origin_engagement_id)
     or new.origin_name_snapshot is distinct from old.origin_name_snapshot then
    raise exception 'build_project_immutable_field' using errcode = 'P0001';
  end if;
  if old.status = 'closed' then
    raise exception 'build_project_closed' using errcode = 'P0001';
  end if;
  -- Fair-share state is engine-owned (docs/81 §6.2); activation resets it below.
  if current_user in ('authenticated', 'anon') and new.sched_pass is distinct from old.sched_pass then
    raise exception 'build_project_engine_field' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status then
    if not (
         (old.status = 'intake' and new.status in ('ready', 'closed'))
      or (old.status = 'ready'  and new.status in ('active', 'closed'))
      or (old.status = 'active' and new.status in ('paused', 'closed'))
      or (old.status = 'paused' and new.status in ('active', 'closed'))
    ) then
      raise exception 'build_project_invalid_transition: % -> %', old.status, new.status using errcode = 'P0001';
    end if;
    if new.status = 'active' then
      new.activated_at := coalesce(old.activated_at, now());
      -- docs/81 §6.2: no burst — start at the current minimum pass of active projects.
      new.sched_pass := coalesce(
        (select min(p.sched_pass) from public.build_projects p
          where p.workspace_id = new.workspace_id and p.status = 'active' and p.id <> new.id),
        old.sched_pass);
    end if;
    if new.status = 'closed' then
      new.closed_at := now();
    end if;
  end if;
  -- Profiles are immutable while a run is in flight (docs/81 §3). build_runs
  -- arrives in 0031; guard dynamically so this function compiles first.
  if (new.stack_profile is distinct from old.stack_profile or new.canon_profile is distinct from old.canon_profile)
     and to_regclass('public.build_runs') is not null then
    if exists (select 1 from public.build_runs r where r.project_id = new.id and r.status = 'running') then
      raise exception 'build_project_profile_locked_while_running' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists build_projects_guard on public.build_projects;
create trigger build_projects_guard
  before insert or update on public.build_projects
  for each row execute function public.build_projects_guard();

-- ConsultOS origin ⇒ platform retention hold on the engagement; released on close.
create or replace function public.build_projects_hold()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.origin_kind <> 'consultos_engagement' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    insert into public.retention_holds
      (workspace_id, entity_type, entity_id, held_by_module, holder_ref, reason, created_by)
    values
      (new.workspace_id, 'engagement', new.origin_engagement_ref, 'buildos',
       new.id::text, 'Origin of a BuildOS project', new.created_by)
    on conflict (entity_type, entity_id, held_by_module, holder_ref) where released_at is null
    do nothing;
  elsif tg_op = 'UPDATE' and old.status <> 'closed' and new.status = 'closed' then
    update public.retention_holds h
       set released_at = now(),
           released_by = (select auth.uid()),
           release_reason = 'BuildOS project closed'
     where h.entity_type = 'engagement'
       and h.entity_id = new.origin_engagement_ref
       and h.held_by_module = 'buildos'
       and h.holder_ref = new.id::text
       and h.released_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists build_projects_hold on public.build_projects;
create trigger build_projects_hold
  after insert or update of status on public.build_projects
  for each row execute function public.build_projects_hold();

-- -----------------------------------------------------------------------------
-- build_work_items
-- -----------------------------------------------------------------------------

create table if not exists public.build_work_items (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null,
  workspace_id            uuid not null,
  item_key                text not null check (item_key ~ '^[a-z0-9][a-z0-9.-]{0,79}$'),
  kind                    text not null check (kind in ('foundation', 'journey', 'remediation', 'chore')),
  canon_ref               text check (canon_ref is null or char_length(canon_ref) between 1 and 80),
  title                   text not null check (char_length(btrim(title)) between 1 and 200),
  brief                   text check (brief is null or char_length(brief) <= 20000),
  bindings                text[] not null default '{}',
  status                  text not null default 'draft'
                            check (status in ('draft', 'ready', 'in_progress', 'held', 'escalated',
                                              'accepted', 'superseded', 'cancelled')),
  ready_since             timestamptz,
  attempts                int not null default 0 check (attempts >= 0),
  -- attempts counted against max_attempts start here; a ruling resets it (docs/81 §5.1)
  attempt_budget_base     int not null default 0 check (attempt_budget_base >= 0 and attempt_budget_base <= attempts),
  hold_until              timestamptz,
  hold_reason             text check (hold_reason is null or hold_reason in
                            ('provider_unavailable', 'no_verdict', 'worker_lost', 'budget_exceeded',
                             'precondition', 'operator_abort', 'thrash')),
  last_failure_class      text,
  consecutive_failures    int not null default 0 check (consecutive_failures >= 0),
  remediates_item_id      uuid references public.build_work_items(id) on delete restrict,
  accepted_at             timestamptz,
  created_by              uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (id, workspace_id),
  unique (id, project_id),
  unique (project_id, item_key),
  foreign key (project_id, workspace_id)
    references public.build_projects (id, workspace_id) on delete restrict,
  constraint build_work_items_hold check (status = 'held' or (hold_until is null and hold_reason is null)),
  constraint build_work_items_held_reason check (status <> 'held' or hold_reason is not null),
  constraint build_work_items_accepted_stamp check ((status = 'accepted') = (accepted_at is not null)),
  constraint build_work_items_remediation check ((kind = 'remediation') = (remediates_item_id is not null))
);

create index if not exists build_work_items_claimable_idx
  on public.build_work_items (project_id, status, hold_until);
create index if not exists build_work_items_workspace_idx
  on public.build_work_items (workspace_id, status);

drop trigger if exists build_work_items_set_updated_at on public.build_work_items;
create trigger build_work_items_set_updated_at
  before update on public.build_work_items
  for each row execute function public.set_updated_at();

-- Engine-only transitions (anything into/out of in_progress, held→ready by
-- schedule, escalated→ruled) are allowed only when the statement runs as a
-- privileged role — i.e. inside the security-definer BuildOS RPCs (0033) or
-- service_role. A direct operator UPDATE runs as `authenticated` and gets the
-- operator transition table. Role-based, so it cannot be spoofed by a GUC.
create or replace function public.build_work_items_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  engine boolean := current_user not in ('authenticated', 'anon');
  proj record;
begin
  if tg_op = 'INSERT' then
    select p.status into proj from public.build_projects p where p.id = new.project_id;
    if proj.status = 'closed' then
      raise exception 'build_project_closed' using errcode = 'P0001';
    end if;
    if new.status not in ('draft', 'ready') then
      raise exception 'build_work_item_must_start_draft_or_ready' using errcode = 'P0001';
    end if;
    if new.remediates_item_id is not null and not exists (
      select 1 from public.build_work_items w where w.id = new.remediates_item_id and w.project_id = new.project_id
    ) then
      raise exception 'build_cross_project_reference: remediates' using errcode = 'P0001';
    end if;
    new.attempts := 0;
    new.attempt_budget_base := 0;
    new.consecutive_failures := 0;
    new.last_failure_class := null;
    new.accepted_at := null;
    new.ready_since := case when new.status = 'ready' then now() end;
    return new;
  end if;

  if new.project_id is distinct from old.project_id
     or new.workspace_id is distinct from old.workspace_id
     or new.item_key is distinct from old.item_key
     or new.kind is distinct from old.kind
     or new.remediates_item_id is distinct from old.remediates_item_id then
    raise exception 'build_work_item_immutable_field' using errcode = 'P0001';
  end if;
  if old.status in ('accepted', 'superseded', 'cancelled') then
    raise exception 'build_work_item_terminal' using errcode = 'P0001';
  end if;
  if not engine and (
       new.attempts is distinct from old.attempts
    or new.attempt_budget_base is distinct from old.attempt_budget_base
    or new.consecutive_failures is distinct from old.consecutive_failures
    or new.last_failure_class is distinct from old.last_failure_class) then
    raise exception 'build_work_item_engine_field' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status then
    if engine then
      if not (
           (old.status in ('ready', 'held') and new.status = 'in_progress')
        or (old.status = 'in_progress' and new.status in ('accepted', 'ready', 'held', 'escalated'))
        or (old.status = 'escalated' and new.status in ('ready', 'cancelled', 'superseded'))
        or (old.status = 'held' and new.status = 'ready')
      ) then
        raise exception 'build_work_item_invalid_transition: % -> %', old.status, new.status using errcode = 'P0001';
      end if;
    else
      -- Operator transitions (docs/81 §4): release, draft↔ready, cancel/supersede.
      if not (
           (old.status = 'draft' and new.status in ('ready', 'cancelled', 'superseded'))
        or (old.status = 'ready' and new.status in ('draft', 'cancelled', 'superseded'))
        or (old.status = 'held' and new.status in ('ready', 'cancelled', 'superseded'))
      ) then
        raise exception 'build_work_item_invalid_transition: % -> %', old.status, new.status using errcode = 'P0001';
      end if;
    end if;
    if new.status = 'ready' then
      new.ready_since := now();
    end if;
    if new.status <> 'held' then
      new.hold_until := null;
      new.hold_reason := null;
    end if;
    if new.status = 'accepted' then
      new.accepted_at := now();
    end if;
    -- An operator release clears the thrash counter.
    if not engine and old.status = 'held' and new.status = 'ready' then
      new.consecutive_failures := 0;
      new.last_failure_class := null;
    end if;
  elsif not engine and (new.hold_until is distinct from old.hold_until or new.hold_reason is distinct from old.hold_reason) then
    raise exception 'build_work_item_engine_field' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists build_work_items_guard on public.build_work_items;
create trigger build_work_items_guard
  before insert or update on public.build_work_items
  for each row execute function public.build_work_items_guard();

-- -----------------------------------------------------------------------------
-- build_work_item_deps (same project only, acyclic)
-- -----------------------------------------------------------------------------

create table if not exists public.build_work_item_deps (
  work_item_id     uuid not null,
  depends_on_id    uuid not null,
  project_id       uuid not null,
  workspace_id     uuid not null,
  created_at       timestamptz not null default now(),
  primary key (work_item_id, depends_on_id),
  foreign key (work_item_id, project_id) references public.build_work_items (id, project_id) on delete restrict,
  foreign key (depends_on_id, project_id) references public.build_work_items (id, project_id) on delete restrict,
  foreign key (project_id, workspace_id) references public.build_projects (id, workspace_id) on delete restrict,
  check (work_item_id <> depends_on_id)
);

create index if not exists build_work_item_deps_on_idx on public.build_work_item_deps (depends_on_id);

create or replace function public.build_work_item_deps_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Reject cycles: the new edge closes a cycle iff work_item_id is reachable from depends_on_id.
  if exists (
    with recursive reach(id) as (
      select d.depends_on_id from public.build_work_item_deps d where d.work_item_id = new.depends_on_id
      union
      select d.depends_on_id from public.build_work_item_deps d join reach r on d.work_item_id = r.id
    )
    select 1 from reach where id = new.work_item_id
  ) then
    raise exception 'build_dependency_cycle' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists build_work_item_deps_guard on public.build_work_item_deps;
create trigger build_work_item_deps_guard
  before insert on public.build_work_item_deps
  for each row execute function public.build_work_item_deps_guard();

revoke all on function public.build_projects_guard() from public, anon, authenticated;
revoke all on function public.build_projects_hold() from public, anon, authenticated;
revoke all on function public.build_work_items_guard() from public, anon, authenticated;
revoke all on function public.build_work_item_deps_guard() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privileges + RLS (docs/81 §11)
-- -----------------------------------------------------------------------------

alter table public.build_projects enable row level security;
alter table public.build_work_items enable row level security;
alter table public.build_work_item_deps enable row level security;

revoke all on table public.build_projects, public.build_work_items, public.build_work_item_deps from anon;
revoke delete, truncate on table public.build_projects, public.build_work_items from authenticated;
grant select, insert, update on table public.build_projects, public.build_work_items to authenticated;
grant select, insert, delete on table public.build_work_item_deps to authenticated;
grant all on table public.build_projects, public.build_work_items, public.build_work_item_deps to service_role;

drop policy if exists build_projects_read on public.build_projects;
create policy build_projects_read on public.build_projects
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists build_projects_create on public.build_projects;
create policy build_projects_create on public.build_projects
  for insert to authenticated
  with check (public.build_is_operator(workspace_id) and created_by = (select auth.uid()));
drop policy if exists build_projects_update on public.build_projects;
create policy build_projects_update on public.build_projects
  for update to authenticated
  using (public.build_is_operator(workspace_id)) with check (public.build_is_operator(workspace_id));

drop policy if exists build_work_items_read on public.build_work_items;
create policy build_work_items_read on public.build_work_items
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists build_work_items_create on public.build_work_items;
create policy build_work_items_create on public.build_work_items
  for insert to authenticated
  with check (public.build_is_operator(workspace_id) and created_by = (select auth.uid()));
drop policy if exists build_work_items_update on public.build_work_items;
create policy build_work_items_update on public.build_work_items
  for update to authenticated
  using (public.build_is_operator(workspace_id)) with check (public.build_is_operator(workspace_id));

drop policy if exists build_work_item_deps_read on public.build_work_item_deps;
create policy build_work_item_deps_read on public.build_work_item_deps
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists build_work_item_deps_write on public.build_work_item_deps;
create policy build_work_item_deps_write on public.build_work_item_deps
  for insert to authenticated with check (public.build_is_operator(workspace_id));
drop policy if exists build_work_item_deps_delete on public.build_work_item_deps;
create policy build_work_item_deps_delete on public.build_work_item_deps
  for delete to authenticated using (public.build_is_operator(workspace_id));
