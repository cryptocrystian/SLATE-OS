-- SLATE — AI Synthesis Step 1
-- Operator-triggered AI synthesis runs. Records each invocation of the
-- LLM-backed synthesis pipeline (currently only `findings_draft`) with
-- safe summary metadata only — no prompt bodies, no raw model
-- responses, no stakeholder content, no file names.
--
-- Boundary:
--   - Operators (authenticated) can select/insert/update workspace
--     synthesis runs. No anon access. Public scorecard / intake routes
--     never read synthesis runs.
--   - run_type / status remain text-typed so vocabulary can evolve
--     without another migration.
--   - input_summary / output_summary jsonb columns are intended for
--     small counts and feature flags only. Application code is
--     responsible for never persisting prompts, raw responses, file
--     names, or stakeholder excerpts here.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- ai_synthesis_runs
-- -----------------------------------------------------------------------------

create table if not exists public.ai_synthesis_runs (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces(id) on delete restrict,
  engagement_id         uuid not null references public.engagements(id) on delete cascade,
  run_type              text not null,
  status                text not null default 'started',
  provider              text,
  model                 text,
  input_summary         jsonb not null default '{}'::jsonb,
  output_summary        jsonb not null default '{}'::jsonb,
  error_code            text,
  error_message         text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_by_user_id    uuid references auth.users(id) on delete set null,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists ai_synthesis_runs_engagement_started_idx
  on public.ai_synthesis_runs (engagement_id, started_at desc);

create index if not exists ai_synthesis_runs_workspace_started_idx
  on public.ai_synthesis_runs (workspace_id, started_at desc);

create index if not exists ai_synthesis_runs_status_idx
  on public.ai_synthesis_runs (status, started_at desc);

alter table public.ai_synthesis_runs enable row level security;

drop policy if exists ai_synthesis_runs_operator_full on public.ai_synthesis_runs;
create policy ai_synthesis_runs_operator_full on public.ai_synthesis_runs
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));
