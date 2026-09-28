-- SLATE — GovernanceOS G1 · GovernanceOS columns on platform audit/provenance tables
--
-- Per docs/72 §4.1 (ledger row "governance_program_id columns … GovernanceOS
-- (on platform tables)") and docs/76 §7. Layer: GOVERNANCEOS MODULE.
--
-- The platform tables (activity_events, ai_synthesis_runs) stay
-- domain-agnostic: they never reference governance. GovernanceOS adds its
-- own nullable column + FK here, as a *user* of the platform.
--
-- A RESTRICTIVE policy narrows activity visibility for rows that belong to a
-- governance program: a workspace member who is not on a client program must
-- not read that program's activity titles. Rows without a
-- governance_program_id are unaffected.
--
-- Rollback path (manual, pre-production only):
--   drop policy if exists activity_events_governance_program_scope on public.activity_events;
--   drop policy if exists ai_synthesis_runs_governance_program_scope on public.ai_synthesis_runs;
--   alter table public.activity_events drop column if exists governance_program_id;
--   alter table public.ai_synthesis_runs drop column if exists governance_program_id;
--
-- Idempotent: safe to re-run.

alter table public.activity_events
  add column if not exists governance_program_id uuid
    references public.governance_programs(id) on delete restrict;

create index if not exists activity_events_governance_program_idx
  on public.activity_events (governance_program_id, created_at desc)
  where governance_program_id is not null;

alter table public.ai_synthesis_runs
  add column if not exists governance_program_id uuid
    references public.governance_programs(id) on delete restrict;

create index if not exists ai_synthesis_runs_governance_program_idx
  on public.ai_synthesis_runs (governance_program_id, created_at desc)
  where governance_program_id is not null;

-- Governance-scoped rows must be tagged with the governance module.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activity_events_governance_module_check') then
    alter table public.activity_events
      add constraint activity_events_governance_module_check
      check (governance_program_id is null or module = 'governanceos');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_synthesis_runs_governance_module_check') then
    alter table public.ai_synthesis_runs
      add constraint ai_synthesis_runs_governance_module_check
      check (governance_program_id is null or module = 'governanceos');
  end if;
  -- docs/76 §7: governance events never carry the cascading engagement FK.
  if not exists (select 1 from pg_constraint where conname = 'activity_events_governance_no_engagement_fk') then
    alter table public.activity_events
      add constraint activity_events_governance_no_engagement_fk
      check (governance_program_id is null or engagement_id is null);
  end if;
end;
$$;

drop policy if exists activity_events_governance_program_scope on public.activity_events;
create policy activity_events_governance_program_scope on public.activity_events
  as restrictive
  for all to authenticated
  using (governance_program_id is null or public.governance_program_role(governance_program_id) is not null)
  with check (governance_program_id is null or public.governance_program_role(governance_program_id) is not null);

drop policy if exists ai_synthesis_runs_governance_program_scope on public.ai_synthesis_runs;
create policy ai_synthesis_runs_governance_program_scope on public.ai_synthesis_runs
  as restrictive
  for all to authenticated
  using (governance_program_id is null or public.governance_program_role(governance_program_id) is not null)
  with check (governance_program_id is null or public.governance_program_role(governance_program_id) is not null);
