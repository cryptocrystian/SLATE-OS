-- SLATE — Phase 1B Proposal/SOW Delivery Sprint P2
-- Operator-only proposal delivery candidate snapshots.
--
-- Per docs/24_PHASE_1B_PROPOSAL_SOW_DELIVERY_CANON.md:
--   - Snapshots are point-in-time commercial-discussion artifacts derived
--     from a proposal. A proposal can have many snapshots over its
--     lifetime; operators regenerate after edits, void earlier
--     candidates, and may eventually approve one to back a SOW Draft
--     surface (Sprint P6).
--   - The same table backs three delivery surfaces via the
--     `delivery_surface` column: `internal_candidate`, the client-safe
--     `client_proposal_candidate`, and (future Sprint P6)
--     `sow_draft_candidate`. The renderer/guard switches on the
--     surface; the schema is shared.
--   - First implementation stores metadata only — no PDF binary,
--     no storage bucket. `artifact_*` columns are reserved for a future
--     binary-export canon and remain nullable.
--   - Group-B exhibits never appear in a snapshot's option_snapshot or
--     source_context_snapshot payload; the canonical Group-B-omission
--     entry lives inside `omitted_content` as the machine-readable
--     confirmation per `docs/24` § Proposal Eligibility Rules item 11.
--   - No raw AI prompt body, model response, stakeholder PII, file
--     names, reviewer notes, signed-URL paths, or internal report-snapshot
--     UUIDs intended for client surfaces are persisted on any column.
--     `source_context_snapshot` may capture report snapshot id by ID
--     for operator audit; the public-route render (Sprint P5) MUST
--     translate that ID to friendly client-visible context only.
--
-- Boundary:
--   - Workspace-scoped via the existing `(select id from public.workspaces limit 1)`
--     RLS pattern shared by ai_synthesis_runs / activity_events /
--     report_delivery_snapshots / report_share_tokens.
--   - No anon access. No public read. No public route exists yet —
--     the public `/p/[token]` surface lands in Sprint P5, gated by
--     a separate `proposal_share_tokens` table that does not exist yet.
--   - Service-role inserts will be authorized via RLS bypass on the
--     service client only when Sprint P5 introduces it; the Sprint P2
--     `generateProposalCandidateAction` uses the cookie-bound auth
--     client.
--
-- Rollback path (manual):
--   drop table if exists public.proposal_delivery_snapshots cascade;
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- proposal_delivery_snapshots
-- -----------------------------------------------------------------------------

create table if not exists public.proposal_delivery_snapshots (
  id                              uuid primary key default gen_random_uuid(),
  workspace_id                    uuid not null references public.workspaces(id) on delete cascade,
  engagement_id                   uuid not null references public.engagements(id) on delete cascade,
  proposal_id                     uuid not null references public.proposals(id) on delete cascade,

  status                          text not null default 'candidate'
    check (status in ('candidate','generated','voided')),
  delivery_surface                text not null default 'client_proposal_candidate'
    check (delivery_surface in ('internal_candidate','client_proposal_candidate','sow_draft_candidate')),
  proposal_status_at_generation   text not null,

  generated_by                    uuid references auth.users(id) on delete set null,
  generated_by_label              text,
  generated_at                    timestamptz not null default now(),

  option_snapshot                 jsonb not null default '[]'::jsonb,
  source_context_snapshot         jsonb not null default '{}'::jsonb,
  commercial_guard_result         jsonb not null default '{}'::jsonb,
  omitted_content                 jsonb not null default '[]'::jsonb,

  draft_watermark                 boolean not null default true,
  approval_state                  text not null default 'unreviewed'
    check (approval_state in ('unreviewed','approved','revoked')),
  pricing_review_state            text not null default 'placeholder'
    check (pricing_review_state in ('placeholder','manually_approved','workflow_approved')),

  selected_option_ids             uuid[] not null default '{}'::uuid[],

  artifact_path                   text,
  artifact_mime_type              text,
  artifact_size_bytes             integer,

  app_version                     text,
  commit_sha                      text,

  voided_at                       timestamptz,
  voided_by                       uuid references auth.users(id) on delete set null,
  void_reason                     text,

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists proposal_delivery_snapshots_workspace_idx
  on public.proposal_delivery_snapshots (workspace_id);

create index if not exists proposal_delivery_snapshots_engagement_idx
  on public.proposal_delivery_snapshots (engagement_id);

create index if not exists proposal_delivery_snapshots_proposal_idx
  on public.proposal_delivery_snapshots (proposal_id);

create index if not exists proposal_delivery_snapshots_generated_at_idx
  on public.proposal_delivery_snapshots (generated_at desc);

create index if not exists proposal_delivery_snapshots_status_idx
  on public.proposal_delivery_snapshots (status);

create index if not exists proposal_delivery_snapshots_approval_idx
  on public.proposal_delivery_snapshots (approval_state);

-- -----------------------------------------------------------------------------
-- Trigger — keep updated_at fresh
-- -----------------------------------------------------------------------------
-- Self-contained pgsql function so the migration doesn't depend on an
-- external set_updated_at helper. Idempotent via `create or replace`
-- and `drop trigger if exists`.

create or replace function public.proposal_delivery_snapshots_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists proposal_delivery_snapshots_set_updated_at_trg
  on public.proposal_delivery_snapshots;

create trigger proposal_delivery_snapshots_set_updated_at_trg
  before update on public.proposal_delivery_snapshots
  for each row
  execute function public.proposal_delivery_snapshots_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — operator-full only
-- -----------------------------------------------------------------------------

alter table public.proposal_delivery_snapshots enable row level security;

drop policy if exists proposal_delivery_snapshots_operator_full
  on public.proposal_delivery_snapshots;

create policy proposal_delivery_snapshots_operator_full
  on public.proposal_delivery_snapshots
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));
