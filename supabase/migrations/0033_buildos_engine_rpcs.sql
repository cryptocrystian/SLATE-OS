-- SLATE — BuildOS B1 · Engine RPCs: worker principal, claim/lease, capacity
-- slots, finish transitions, decision ruling, alarms
--
-- Per docs/80 §5–§7 and docs/81 §4–§7, §9–§11.
-- Layer: BUILDOS MODULE.
--
-- D5: workers authenticate as the NOLOGIN role `buildos_worker` (a per-host
-- login role IN ROLE buildos_worker is created out-of-band; its password lives
-- in the worker secret manager). That role can execute the worker RPCs below
-- and NOTHING else — no table privileges, never the service-role key.
--
-- Scheduling policy lives in build_claim_run (no long-lived scheduler process):
-- claimability → WIP → decomposition gate → capacity (builder + a judge family,
-- metered-only for client projects) → daily budget, ordered by stride
-- fair share (sched_pass). Per-project claims are serialized by FOR UPDATE on
-- the project row; items are taken with SKIP LOCKED.
--
-- Rollback path (manual, pre-production only): drop the functions below and
--   `drop role if exists buildos_worker;` (after revoking its grants).
--
-- Idempotent: safe to re-run.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'buildos_worker') then
    create role buildos_worker nologin;
  end if;
end $$;
grant usage on schema public to buildos_worker;

-- -----------------------------------------------------------------------------
-- Internal helpers (not granted to anyone)
-- -----------------------------------------------------------------------------

-- Validate an active worker and stamp last_seen_at.
create or replace function public.build__worker(p_worker uuid)
returns public.build_workers
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.build_workers;
begin
  update public.build_workers set last_seen_at = now()
   where id = p_worker and status = 'active'
  returning * into w;
  if not found then
    raise exception 'build_worker_unknown_or_disabled' using errcode = 'P0001';
  end if;
  return w;
end;
$$;

-- The caller's running run (ownership + liveness check).
create or replace function public.build__owned_run(p_worker uuid, p_run uuid)
returns public.build_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.build_runs;
begin
  perform public.build__worker(p_worker);
  select * into r from public.build_runs where id = p_run for update;
  if not found or r.worker_id <> p_worker then
    raise exception 'build_run_not_owned' using errcode = 'P0001';
  end if;
  if r.status <> 'running' then
    raise exception 'build_run_finished' using errcode = 'P0001';
  end if;
  return r;
end;
$$;

-- Is there an eligible account in `fam` with a free slot? (docs/81 §6.1-5, §7)
create or replace function public.build__family_has_capacity(p_ws uuid, p_family text, p_metered_only boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.build_provider_accounts a
     where a.workspace_id = p_ws
       and a.family = p_family
       and a.status = 'active'
       and a.health = 'healthy'
       and (a.cooldown_until is null or a.cooldown_until <= now())
       and (not p_metered_only or a.billing_class = 'metered')
       and a.max_concurrency > (
             select count(*) from public.build_capacity_leases l
              where l.account_id = a.id and l.released_at is null and l.expires_at > now())
  );
$$;

create or replace function public.build__raise_alarm(p_ws uuid, p_project uuid, p_kind text, p_subject text, p_detail text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.build_alarms (workspace_id, project_id, kind, subject, detail)
  values (p_ws, p_project, p_kind, coalesce(p_subject, ''), p_detail)
  on conflict (workspace_id, kind, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), subject)
    where cleared_at is null
  do nothing;
$$;

-- Core finish transition (docs/81 §5.1). Used by build_finish_run and the reaper.
create or replace function public.build__apply_finish(p_run uuid, p_verdict text, p_class text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     public.build_runs;
  item  public.build_work_items;
  proj  public.build_projects;
  d     jsonb;
  consecutive int;
  hold_for interval;
begin
  p_payload := coalesce(p_payload, '{}'::jsonb);
  update public.build_runs
     set status = 'finished',
         verdict = p_verdict,
         failure_class = p_class,
         finished_at = now(),
         summary = left(p_payload ->> 'summary', 4000),
         resumable_from_phase = p_payload ->> 'resumable_from_phase',
         branch = coalesce(p_payload ->> 'branch', branch),
         pr_url = coalesce(p_payload ->> 'pr_url', pr_url),
         merge_sha = coalesce(p_payload ->> 'merge_sha', merge_sha)
   where id = p_run and status = 'running'
  returning * into r;
  if not found then
    raise exception 'build_run_finished' using errcode = 'P0001';
  end if;

  -- A finished run holds no capacity.
  update public.build_capacity_leases set released_at = now()
   where run_id = r.id and released_at is null;

  select * into item from public.build_work_items where id = r.work_item_id for update;
  select * into proj from public.build_projects where id = r.project_id;

  if p_verdict = 'accepted' then
    update public.build_work_items
       set status = 'accepted', consecutive_failures = 0, last_failure_class = null
     where id = item.id;
    return;
  end if;

  consecutive := case when item.last_failure_class = p_class then item.consecutive_failures + 1 else 1 end;

  -- Thrash rule: 5 consecutive identical non-accepted outcomes park the item
  -- for an operator. Nothing loops unattended (factory 21eb357, 515fbe1).
  if p_class <> 'escalated' and consecutive >= 5 then
    update public.build_work_items
       set status = 'held', hold_until = null, hold_reason = 'thrash',
           consecutive_failures = consecutive, last_failure_class = p_class
     where id = item.id;
    perform public.build__raise_alarm(r.workspace_id, r.project_id, 'thrash', item.item_key,
      format('%s consecutive %s outcomes; held for operator release', consecutive, p_class));
    return;
  end if;

  if p_verdict = 'rejected' then
    if item.attempts - item.attempt_budget_base >= proj.max_attempts then
      update public.build_work_items
         set status = 'escalated', consecutive_failures = consecutive, last_failure_class = p_class
       where id = item.id;
      insert into public.build_decisions
        (workspace_id, project_id, work_item_id, run_id, class, title, brief, options, recommended_option)
      values
        (r.workspace_id, r.project_id, item.id, r.id, 'technical',
         left(format('%s did not converge after %s attempts', item.item_key, item.attempts - item.attempt_budget_base), 200),
         coalesce(nullif(p_payload ->> 'summary', ''), 'The lane exhausted its attempt budget without an accepted run.'),
         jsonb_build_array(
           jsonb_build_object('key', 'retry', 'label', 'Release for another attempt budget',
                              'consequence', 'The item returns to ready with a fresh attempt budget.'),
           jsonb_build_object('key', 'cancel', 'label', 'Cancel the work item',
                              'consequence', 'The item is cancelled; file a new item if the scope changes.')),
         'retry');
    else
      update public.build_work_items
         set status = 'ready', consecutive_failures = consecutive, last_failure_class = p_class
       where id = item.id;
    end if;
    return;
  end if;

  if p_verdict = 'escalated' then
    d := p_payload -> 'decision';
    if d is null or jsonb_typeof(d) <> 'object'
       or coalesce(d ->> 'class', '') not in ('technical', 'product', 'owner')
       or coalesce(btrim(d ->> 'title'), '') = '' or coalesce(d ->> 'brief', '') = ''
       or jsonb_typeof(d -> 'options') is distinct from 'array' or jsonb_array_length(d -> 'options') = 0 then
      raise exception 'build_decision_payload_required' using errcode = 'P0001';
    end if;
    update public.build_work_items
       set status = 'escalated', consecutive_failures = consecutive, last_failure_class = p_class
     where id = item.id;
    insert into public.build_decisions
      (workspace_id, project_id, work_item_id, run_id, class, title, brief, options, recommended_option)
    values
      (r.workspace_id, r.project_id, item.id, r.id, d ->> 'class', left(d ->> 'title', 200),
       left(d ->> 'brief', 20000), d -> 'options', d ->> 'recommended_option');
    return;
  end if;

  -- held / aborted
  hold_for := case p_class
    when 'provider_unavailable' then
      make_interval(secs => least(greatest(coalesce((p_payload ->> 'retry_after_s')::numeric, 0), 900), 21600))
    when 'no_verdict'  then interval '5 minutes'
    when 'worker_lost' then interval '1 minute'
    else null
  end;
  update public.build_work_items
     set status = 'held',
         hold_reason = p_class,
         hold_until = case
           when p_class = 'budget_exceeded'
             then (date_trunc('day', now() at time zone 'utc') + interval '1 day') at time zone 'utc'
           when hold_for is not null then now() + hold_for
           else null  -- precondition / operator_abort: operator release
         end,
         consecutive_failures = consecutive,
         last_failure_class = p_class
   where id = item.id;
end;
$$;

-- Reap runs whose worker lease expired: held / worker_lost (docs/81 §5).
create or replace function public.build__reap_expired(p_ws uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
  n int := 0;
begin
  for rid in
    select r.id from public.build_runs r
     where r.workspace_id = p_ws and r.status = 'running' and r.lease_expires_at < now()
     for update skip locked
  loop
    perform public.build__apply_finish(rid, 'held', 'worker_lost',
      jsonb_build_object('summary', 'Worker lease expired; run reclaimed.'));
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.build__worker(uuid) from public, anon, authenticated;
revoke all on function public.build__owned_run(uuid, uuid) from public, anon, authenticated;
revoke all on function public.build__family_has_capacity(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.build__raise_alarm(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.build__apply_finish(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.build__reap_expired(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Worker RPCs
-- -----------------------------------------------------------------------------

create or replace function public.build_claim_run(p_worker uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  w      public.build_workers;
  cand   record;
  proj   public.build_projects;
  item   public.build_work_items;
  prev   public.build_runs;
  run    public.build_runs;
  v_attempt int;
  spent  numeric;
begin
  w := public.build__worker(p_worker);
  perform public.build__reap_expired(w.workspace_id);

  for cand in
    select i.id as item_id, p.id as project_id
      from public.build_work_items i
      join public.build_projects p on p.id = i.project_id
     where p.workspace_id = w.workspace_id
       and p.status = 'active'
       and p.stack_profile = any (w.capabilities)
       and (i.status = 'ready' or (i.status = 'held' and i.hold_until is not null and i.hold_until <= now()))
       and not exists (
         select 1 from public.build_work_item_deps d
           join public.build_work_items di on di.id = d.depends_on_id
          where d.work_item_id = i.id and di.status <> 'accepted')
     order by p.sched_pass asc, p.priority_weight desc,
              coalesce(i.ready_since, i.updated_at) asc, i.created_at asc
  loop
    select * into proj from public.build_projects where id = cand.project_id for update;
    continue when proj.status <> 'active';

    -- WIP
    continue when (select count(*) from public.build_runs r
                    where r.project_id = proj.id and r.status = 'running') >= proj.wip_limit;

    select * into item from public.build_work_items where id = cand.item_id for update skip locked;
    continue when not found;
    continue when not (item.status = 'ready'
                       or (item.status = 'held' and item.hold_until is not null and item.hold_until <= now()));

    -- Decomposition gate: bindings disjoint from running items in the same project.
    continue when exists (
      select 1 from public.build_runs r
        join public.build_work_items ri on ri.id = r.work_item_id
       where r.project_id = proj.id and r.status = 'running'
         and ('*' = any (ri.bindings) or '*' = any (item.bindings) or ri.bindings && item.bindings));

    -- Capacity: the builder family AND some judge family (metered-only for client projects).
    continue when not public.build__family_has_capacity(proj.workspace_id, proj.builder_family,
                                                         proj.isolation_class = 'client');
    continue when not exists (
      select 1 from unnest(proj.judge_families) f
       where public.build__family_has_capacity(proj.workspace_id, f, proj.isolation_class = 'client'));

    -- Daily budget (UTC day).
    if proj.daily_budget_usd is not null then
      select coalesce(sum(l.billed_cost_usd), 0) into spent
        from public.build_cost_ledger l
       where l.project_id = proj.id
         and l.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
      continue when spent >= proj.daily_budget_usd;
    end if;

    -- Claim.
    select * into prev from public.build_runs
     where work_item_id = item.id and status = 'finished'
     order by attempt_no desc limit 1;

    v_attempt := item.attempts + 1;
    insert into public.build_runs
      (workspace_id, project_id, work_item_id, run_key, attempt_no, mode, worker_id,
       stack_profile, canon_profile, lease_expires_at, heartbeat_at)
    values
      (proj.workspace_id, proj.id, item.id,
       proj.project_key || '/' || item.item_key || '/' || v_attempt, v_attempt,
       case when prev.resumable_from_phase is not null then 'resume'
            when item.kind = 'remediation' then 'remediate'
            else 'build' end,
       w.id, proj.stack_profile, proj.canon_profile, now() + interval '300 seconds', now())
    returning * into run;

    update public.build_work_items set status = 'in_progress', attempts = v_attempt where id = item.id;
    update public.build_projects set sched_pass = sched_pass + (1.0 / priority_weight) where id = proj.id;

    return jsonb_build_object(
      'run_id', run.id,
      'run_key', run.run_key,
      'attempt_no', run.attempt_no,
      'mode', run.mode,
      'lease_expires_at', run.lease_expires_at,
      'resume_from_phase', prev.resumable_from_phase,
      'resume_branch', case when prev.resumable_from_phase is not null then prev.branch end,
      'project', jsonb_build_object(
        'id', proj.id, 'project_key', proj.project_key, 'repo_url', proj.repo_url,
        'default_branch', proj.default_branch, 'stack_profile', proj.stack_profile,
        'canon_profile', proj.canon_profile, 'isolation_class', proj.isolation_class,
        'builder_family', proj.builder_family, 'judge_families', to_jsonb(proj.judge_families)),
      'work_item', jsonb_build_object(
        'id', item.id, 'item_key', item.item_key, 'kind', item.kind, 'canon_ref', item.canon_ref,
        'title', item.title, 'brief', item.brief, 'bindings', to_jsonb(item.bindings),
        'remediates_item_id', item.remediates_item_id));
  end loop;
  return null;
end;
$$;

create or replace function public.build_heartbeat(p_worker uuid, p_run uuid, p_phase text, p_pins jsonb default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.build_runs;
begin
  r := public.build__owned_run(p_worker, p_run);
  update public.build_runs
     set phase = coalesce(p_phase, phase),
         heartbeat_at = now(),
         lease_expires_at = now() + interval '300 seconds',
         base_sha      = coalesce(base_sha, p_pins ->> 'base_sha'),
         canon_ref_pin = coalesce(canon_ref_pin, p_pins ->> 'canon_ref'),
         lane_version  = coalesce(lane_version, p_pins ->> 'lane_version'),
         roster_hash   = coalesce(roster_hash, p_pins ->> 'roster_hash'),
         branch        = coalesce(p_pins ->> 'branch', branch)
   where id = r.id;
  return case when r.cancel_requested_at is not null then 'cancel' else 'continue' end;
end;
$$;

create or replace function public.build_report_events(p_worker uuid, p_run uuid, p_events jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.build_runs;
  n int;
begin
  r := public.build__owned_run(p_worker, p_run);
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 500 then
    raise exception 'build_events_batch_invalid' using errcode = 'P0001';
  end if;
  insert into public.build_run_events
    (run_id, workspace_id, project_id, ts, kind, phase, role, model, family, passed, detail, transcript_file_id)
  select r.id, r.workspace_id, r.project_id,
         coalesce((e ->> 'ts')::timestamptz, now()), e ->> 'kind', e ->> 'phase', e ->> 'role',
         e ->> 'model', e ->> 'family', (e ->> 'passed')::boolean,
         coalesce(e -> 'detail', '{}'::jsonb), (e ->> 'transcript_file_id')::uuid
    from jsonb_array_elements(p_events) e;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Acquire a per-call capacity slot. I3 is enforced here too: a judging role
-- can never be served by the builder's family.
create or replace function public.build_acquire_slot(p_worker uuid, p_run uuid, p_family text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r    public.build_runs;
  proj public.build_projects;
  a    public.build_provider_accounts;
  lease_id uuid;
begin
  r := public.build__owned_run(p_worker, p_run);
  select * into proj from public.build_projects where id = r.project_id;
  if p_role in ('reviewer', 'test-author', 'product-manager') then
    if p_family = proj.builder_family or not (p_family = any (proj.judge_families)) then
      raise exception 'build_i3_violation: % may not be served by family %', p_role, p_family using errcode = 'P0001';
    end if;
  elsif p_family <> proj.builder_family then
    raise exception 'build_family_not_in_roster: %', p_family using errcode = 'P0001';
  end if;

  for a in
    select * from public.build_provider_accounts acc
     where acc.workspace_id = r.workspace_id and acc.family = p_family and acc.status = 'active'
       and acc.health = 'healthy' and (acc.cooldown_until is null or acc.cooldown_until <= now())
       and (proj.isolation_class <> 'client' or acc.billing_class = 'metered')
     order by (acc.billing_class = 'subscription') desc, acc.created_at
     for update
  loop
    if a.max_concurrency > (select count(*) from public.build_capacity_leases l
                             where l.account_id = a.id and l.released_at is null and l.expires_at > now()) then
      insert into public.build_capacity_leases (workspace_id, account_id, run_id, role, expires_at)
      values (r.workspace_id, a.id, r.id, p_role, now() + interval '30 minutes')
      returning id into lease_id;
      return jsonb_build_object('lease_id', lease_id, 'account_id', a.id, 'provider', a.provider,
                                'billing_class', a.billing_class, 'secret_ref', a.secret_ref);
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.build_release_slot(p_worker uuid, p_lease uuid, p_usage jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.build_capacity_leases;
  r public.build_runs;
  outcome text := coalesce(p_usage ->> 'outcome', 'ok');
begin
  perform public.build__worker(p_worker);
  select * into l from public.build_capacity_leases where id = p_lease for update;
  if not found then
    raise exception 'build_lease_unknown' using errcode = 'P0001';
  end if;
  select * into r from public.build_runs where id = l.run_id;
  if r.worker_id <> p_worker then
    raise exception 'build_run_not_owned' using errcode = 'P0001';
  end if;
  update public.build_capacity_leases set released_at = coalesce(released_at, now()) where id = l.id;
  if p_usage ? 'model' then
    insert into public.build_cost_ledger
      (workspace_id, project_id, run_id, account_id, role, model, tokens_in, tokens_out,
       list_cost_usd, billed_cost_usd, outcome)
    values
      (r.workspace_id, r.project_id, r.id, l.account_id, l.role, p_usage ->> 'model',
       coalesce((p_usage ->> 'tokens_in')::bigint, 0), coalesce((p_usage ->> 'tokens_out')::bigint, 0),
       coalesce((p_usage ->> 'list_cost_usd')::numeric, 0), coalesce((p_usage ->> 'billed_cost_usd')::numeric, 0),
       outcome);
  end if;
  -- A live provider failure marks the account down immediately (docs/81 §7).
  if outcome = 'provider_unavailable' then
    update public.build_provider_accounts
       set health = 'down',
           health_checked_at = now(),
           health_detail = left(coalesce(p_usage ->> 'detail', 'provider unavailable'), 1000),
           cooldown_until = now() + make_interval(secs => greatest(coalesce((p_usage ->> 'retry_after_s')::numeric, 0), 300))
     where id = l.account_id;
  end if;
end;
$$;

-- Canary / probe result for one account (docs/80 §6.3).
create or replace function public.build_report_account_health(
  p_worker uuid, p_account uuid, p_health text, p_detail text, p_cooldown_s numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.build_workers;
begin
  w := public.build__worker(p_worker);
  if p_health not in ('healthy', 'degraded', 'down') then
    raise exception 'build_health_invalid' using errcode = 'P0001';
  end if;
  update public.build_provider_accounts
     set health = p_health, health_checked_at = now(), health_detail = left(p_detail, 1000),
         cooldown_until = case when p_cooldown_s is not null and p_cooldown_s > 0
                               then now() + make_interval(secs => p_cooldown_s) end
   where id = p_account and workspace_id = w.workspace_id;
  if not found then
    raise exception 'build_account_unknown' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.build_finish_run(
  p_worker uuid, p_run uuid, p_verdict text, p_failure_class text, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.build_runs;
begin
  r := public.build__owned_run(p_worker, p_run);
  if p_verdict = 'aborted' and r.cancel_requested_at is null then
    raise exception 'build_abort_without_cancel_request' using errcode = 'P0001';
  end if;
  -- Pins may arrive with the finish payload (they are still immutable once set).
  update public.build_runs
     set base_sha     = coalesce(base_sha, p_payload ->> 'base_sha'),
         lane_version = coalesce(lane_version, p_payload ->> 'lane_version'),
         canon_ref_pin = coalesce(canon_ref_pin, p_payload ->> 'canon_ref'),
         roster_hash  = coalesce(roster_hash, p_payload ->> 'roster_hash')
   where id = r.id;
  perform public.build__apply_finish(r.id, p_verdict, p_failure_class, p_payload);
end;
$$;

create or replace function public.build_worker_raise_alarm(p_worker uuid, p_project uuid, p_kind text, p_subject text, p_detail text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.build_workers;
begin
  w := public.build__worker(p_worker);
  if p_kind not in ('merge', 'capacity') then
    raise exception 'build_alarm_kind_not_worker_raisable: %', p_kind using errcode = 'P0001';
  end if;
  if p_project is not null and not exists (
    select 1 from public.build_projects p where p.id = p_project and p.workspace_id = w.workspace_id) then
    raise exception 'build_cross_workspace_reference: project' using errcode = 'P0001';
  end if;
  perform public.build__raise_alarm(w.workspace_id, p_project, p_kind, p_subject, p_detail);
end;
$$;

-- -----------------------------------------------------------------------------
-- Operator RPCs (authenticated; authorization checked inside)
-- -----------------------------------------------------------------------------

create or replace function public.build_rule_decision(
  p_decision uuid, p_option text, p_note text, p_item_action text, p_canon_ref text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d    public.build_decisions;
  item public.build_work_items;
begin
  select * into d from public.build_decisions where id = p_decision for update;
  if not found or not public.build_is_operator(d.workspace_id) then
    raise exception 'build_not_authorized' using errcode = 'P0001';
  end if;
  if d.status <> 'open' then
    raise exception 'build_decision_closed' using errcode = 'P0001';
  end if;
  if p_item_action not in ('ready', 'cancelled', 'superseded') then
    raise exception 'build_item_action_invalid' using errcode = 'P0001';
  end if;
  update public.build_decisions
     set status = 'ruled', ruling_option = p_option, ruling_note = p_note, item_action = p_item_action,
         resulting_canon_ref = p_canon_ref, ruled_by = (select auth.uid()), ruled_at = now()
   where id = d.id;
  -- B8: the ruling makes the item claimable (or closes it); it never dispatches.
  select * into item from public.build_work_items where id = d.work_item_id for update;
  if item.status = 'escalated' then
    update public.build_work_items
       set status = p_item_action,
           attempt_budget_base = case when p_item_action = 'ready' then attempts else attempt_budget_base end,
           consecutive_failures = 0,
           last_failure_class = null
     where id = item.id;
  end if;
end;
$$;

create or replace function public.build_request_cancel(p_run uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.build_runs;
begin
  select * into r from public.build_runs where id = p_run for update;
  if not found or not public.build_is_operator(r.workspace_id) then
    raise exception 'build_not_authorized' using errcode = 'P0001';
  end if;
  if r.status <> 'running' then
    raise exception 'build_run_finished' using errcode = 'P0001';
  end if;
  update public.build_runs
     set cancel_requested_at = coalesce(cancel_requested_at, now()),
         cancel_requested_by = coalesce(cancel_requested_by, (select auth.uid()))
   where id = r.id;
end;
$$;

create or replace function public.build_clear_alarm(p_alarm uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.build_alarms;
begin
  select * into a from public.build_alarms where id = p_alarm for update;
  if not found or not public.build_is_operator(a.workspace_id) then
    raise exception 'build_not_authorized' using errcode = 'P0001';
  end if;
  update public.build_alarms set cleared_at = coalesce(cleared_at, now()), cleared_by = (select auth.uid())
   where id = a.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Alarm evaluation (docs/81 §10). Idempotent. Callable by the scheduler
-- (service_role / worker) or an operator for their workspace.
-- -----------------------------------------------------------------------------

create or replace function public.build_evaluate_alarms(p_ws uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Inside SECURITY DEFINER current_user is the owner, so authorize on the JWT:
  -- an end-user session (auth.uid() set) must be an operator of p_ws; callers
  -- without a user JWT can only be service_role or buildos_worker (the only
  -- other grantees), and evaluation merely raises/clears alarms.
  caller_ok boolean := (select auth.uid()) is null or public.build_is_operator(p_ws);
  rec record;
  raised int := 0;
  claimable boolean;
  cap_ok boolean;
begin
  if not caller_ok then
    raise exception 'build_not_authorized' using errcode = 'P0001';
  end if;

  perform public.build__reap_expired(p_ws);

  -- dead_man: workers active in the last 24h but silent for 10 min.
  for rec in select * from public.build_workers w where w.workspace_id = p_ws and w.status = 'active' loop
    if rec.last_seen_at is not null and rec.last_seen_at > now() - interval '24 hours'
       and rec.last_seen_at < now() - interval '10 minutes' then
      perform public.build__raise_alarm(p_ws, null, 'dead_man', rec.name,
        format('worker %s last seen %s', rec.name, rec.last_seen_at));
      raised := raised + 1;
    elsif rec.last_seen_at >= now() - interval '10 minutes' then
      update public.build_alarms set cleared_at = now()
       where workspace_id = p_ws and kind = 'dead_man' and subject = rec.name and cleared_at is null;
    end if;
  end loop;

  for rec in select * from public.build_projects p where p.workspace_id = p_ws and p.status = 'active' loop
    -- capacity, per needed family
    cap_ok := public.build__family_has_capacity(p_ws, rec.builder_family, rec.isolation_class = 'client')
              and exists (select 1 from unnest(rec.judge_families) f
                           where public.build__family_has_capacity(p_ws, f, rec.isolation_class = 'client'));
    if not public.build__family_has_capacity(p_ws, rec.builder_family, rec.isolation_class = 'client') then
      perform public.build__raise_alarm(p_ws, rec.id, 'capacity', 'builder:' || rec.builder_family,
        'No healthy account with a free slot in the builder family');
      raised := raised + 1;
    else
      update public.build_alarms set cleared_at = now()
       where project_id = rec.id and kind = 'capacity' and subject = 'builder:' || rec.builder_family and cleared_at is null;
    end if;
    if not exists (select 1 from unnest(rec.judge_families) f
                    where public.build__family_has_capacity(p_ws, f, rec.isolation_class = 'client')) then
      perform public.build__raise_alarm(p_ws, rec.id, 'capacity', 'judge',
        'No healthy account with a free slot in any judge family');
      raised := raised + 1;
    else
      update public.build_alarms set cleared_at = now()
       where project_id = rec.id and kind = 'capacity' and subject = 'judge' and cleared_at is null;
    end if;

    claimable := exists (
      select 1 from public.build_work_items i
       where i.project_id = rec.id
         and (i.status = 'ready' or (i.status = 'held' and i.hold_until is not null and i.hold_until <= now()))
         and not exists (select 1 from public.build_work_item_deps d
                           join public.build_work_items di on di.id = d.depends_on_id
                          where d.work_item_id = i.id and di.status <> 'accepted'));

    -- stall: claimable + capacity, nothing claimed for 30 min
    if claimable and cap_ok
       and coalesce((select max(r.started_at) from public.build_runs r where r.project_id = rec.id), rec.activated_at)
           < now() - interval '30 minutes'
       and not exists (select 1 from public.build_runs r where r.project_id = rec.id and r.status = 'running') then
      perform public.build__raise_alarm(p_ws, rec.id, 'stall', '', 'Claimable work and capacity, but nothing claimed for 30 minutes');
      raised := raised + 1;
    else
      update public.build_alarms set cleared_at = now()
       where project_id = rec.id and kind = 'stall' and cleared_at is null;
    end if;

    -- starvation: claimable, no accepted run in 24h
    if claimable and rec.activated_at < now() - interval '24 hours'
       and not exists (select 1 from public.build_runs r where r.project_id = rec.id and r.verdict = 'accepted'
                         and r.finished_at > now() - interval '24 hours') then
      perform public.build__raise_alarm(p_ws, rec.id, 'starvation', '', 'Claimable work but no accepted run in 24 hours');
      raised := raised + 1;
    else
      update public.build_alarms set cleared_at = now()
       where project_id = rec.id and kind = 'starvation' and cleared_at is null;
    end if;
  end loop;
  return raised;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: worker RPCs → buildos_worker (+ service_role); operator RPCs →
-- authenticated. Nothing to anon / public.
-- -----------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'build_claim_run(uuid)',
    'build_heartbeat(uuid, uuid, text, jsonb)',
    'build_report_events(uuid, uuid, jsonb)',
    'build_acquire_slot(uuid, uuid, text, text)',
    'build_release_slot(uuid, uuid, jsonb)',
    'build_report_account_health(uuid, uuid, text, text, numeric)',
    'build_finish_run(uuid, uuid, text, text, jsonb)',
    'build_worker_raise_alarm(uuid, uuid, text, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to buildos_worker, service_role', f);
  end loop;
  foreach f in array array[
    'build_rule_decision(uuid, text, text, text, text)',
    'build_request_cancel(uuid)',
    'build_clear_alarm(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  execute 'revoke all on function public.build_evaluate_alarms(uuid) from public, anon';
  execute 'grant execute on function public.build_evaluate_alarms(uuid) to authenticated, buildos_worker, service_role';
end $$;
