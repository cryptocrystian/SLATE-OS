-- SLATE — Phase 1B Report Exhibit Wiring Sprint 4C-B
-- Operator-only report PDF candidate metadata snapshots.
--
-- Per docs/20_PHASE_1B_REPORT_PDF_CANDIDATE_CANON.md:
--   - Snapshots are point-in-time delivery artifacts derived from a report.
--   - A report can have many snapshots over its lifetime; operators
--     regenerate after edits, void earlier candidates, supersede with
--     a higher-readiness one.
--   - First implementation stores metadata only — no PDF binary,
--     no storage bucket. `artifact_*` columns are reserved for a
--     future server-rendered Option B sprint and remain nullable.
--   - Group-B exhibits never appear in a snapshot's exhibit_snapshot
--     payload; the canonical `group_b_block` omission entry in
--     `omitted_exhibits` is the machine-readable confirmation.
--   - No raw AI prompt body, model response, stakeholder PII, file
--     names, or signed-URL paths are persisted on any column.
--
-- Boundary:
--   - Workspace-scoped via the existing `(select id from public.workspaces limit 1)`
--     RLS pattern shared by ai_synthesis_runs and activity_events.
--   - No anon access. No public read. Service-role inserts are
--     authorized via RLS bypass on the service client only; the
--     operator-facing action uses the cookie-bound auth client.
--
-- Rollback path (manual):
--   drop table if exists public.report_delivery_snapshots cascade;
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- report_delivery_snapshots
-- -----------------------------------------------------------------------------

create table if not exists public.report_delivery_snapshots (
  id                            uuid primary key default gen_random_uuid(),
  workspace_id                  uuid not null references public.workspaces(id) on delete cascade,
  engagement_id                 uuid not null references public.engagements(id) on delete cascade,
  report_id                     uuid not null references public.reports(id) on delete cascade,

  status                        text not null default 'candidate'
    check (status in ('candidate','generated','voided')),
  delivery_surface              text not null default 'client_pdf_candidate'
    check (delivery_surface in ('internal_candidate','client_pdf_candidate')),
  report_status_at_generation   text not null,

  generated_by                  uuid references auth.users(id) on delete set null,
  generated_by_label            text,
  generated_at                  timestamptz not null default now(),

  section_snapshot              jsonb not null default '[]'::jsonb,
  exhibit_snapshot              jsonb not null default '[]'::jsonb,
  source_summary_snapshot       jsonb not null default '{}'::jsonb,
  claim_guard_result            jsonb not null default '{}'::jsonb,
  omitted_exhibits              jsonb not null default '[]'::jsonb,

  draft_watermark               boolean not null default false,

  artifact_path                 text,
  artifact_mime_type            text,
  artifact_size_bytes           integer,
  artifact_sha256               text,

  app_version                   text,
  commit_sha                    text,

  voided_at                     timestamptz,
  voided_by                     uuid references auth.users(id) on delete set null,
  void_reason                   text,

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists report_delivery_snapshots_workspace_idx
  on public.report_delivery_snapshots (workspace_id);

create index if not exists report_delivery_snapshots_engagement_idx
  on public.report_delivery_snapshots (engagement_id);

create index if not exists report_delivery_snapshots_report_idx
  on public.report_delivery_snapshots (report_id);

create index if not exists report_delivery_snapshots_generated_at_idx
  on public.report_delivery_snapshots (generated_at desc);

-- -----------------------------------------------------------------------------
-- Trigger — keep updated_at fresh
-- -----------------------------------------------------------------------------
-- Self-contained pgsql function so the migration doesn't depend on an
-- external set_updated_at helper. Idempotent via `create or replace`
-- and `drop trigger if exists`.

create or replace function public.report_delivery_snapshots_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists report_delivery_snapshots_set_updated_at_trg
  on public.report_delivery_snapshots;

create trigger report_delivery_snapshots_set_updated_at_trg
  before update on public.report_delivery_snapshots
  for each row
  execute function public.report_delivery_snapshots_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — operator-full only
-- -----------------------------------------------------------------------------

alter table public.report_delivery_snapshots enable row level security;

drop policy if exists report_delivery_snapshots_operator_full
  on public.report_delivery_snapshots;

create policy report_delivery_snapshots_operator_full
  on public.report_delivery_snapshots
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));
