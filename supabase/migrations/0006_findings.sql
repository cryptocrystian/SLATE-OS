-- SLATE — Persistence/Auth Step 6
-- Findings persistence: operator-authored findings tied to an engagement,
-- plus typed source references that link each finding back to the
-- evidence (stakeholder responses, input assets, scorecard answers,
-- consultant notes).
--
-- Boundary:
--   - Operators have full CRUD via the authenticated server client.
--   - No anon policies. The public /intake/[token] route never reads
--     findings; findings are always operator-only.
--   - category / review_status / confidence stay text-typed so the
--     vocabulary can evolve without another migration.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- findings
-- -----------------------------------------------------------------------------

create table if not exists public.findings (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  engagement_id       uuid not null references public.engagements(id) on delete cascade,
  category            text not null default 'workflow_friction',
  statement           text not null,
  summary             text,
  evidence_summary    text,
  confidence          text not null default 'needs_evidence',
  review_status       text not null default 'needs_review',
  suggested_impact    text,
  assumption_flag     boolean not null default false,
  assumption_note     text,
  reviewer_note       text,
  ai_drafted          boolean not null default false,
  position            integer not null default 0,
  reviewed_by         uuid references public.profiles(id) on delete set null,
  last_reviewed_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists findings_engagement_idx
  on public.findings (engagement_id, position, created_at desc);

create index if not exists findings_workspace_status_idx
  on public.findings (workspace_id, review_status);

create index if not exists findings_engagement_status_idx
  on public.findings (engagement_id, review_status);

drop trigger if exists findings_set_updated_at on public.findings;
create trigger findings_set_updated_at
  before update on public.findings
  for each row execute function public.set_updated_at();

alter table public.findings enable row level security;

drop policy if exists findings_operator_full on public.findings;
create policy findings_operator_full on public.findings
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- finding_source_refs
-- -----------------------------------------------------------------------------

create table if not exists public.finding_source_refs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete restrict,
  engagement_id   uuid not null references public.engagements(id) on delete cascade,
  finding_id      uuid not null references public.findings(id) on delete cascade,
  source_type     text not null,
  source_id       uuid,
  source_label    text,
  source_role     text,
  excerpt         text,
  strength        text not null default 'adequate',
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists finding_source_refs_finding_idx
  on public.finding_source_refs (finding_id, created_at);

create index if not exists finding_source_refs_engagement_idx
  on public.finding_source_refs (engagement_id);

create index if not exists finding_source_refs_source_lookup_idx
  on public.finding_source_refs (source_type, source_id)
  where source_id is not null;

alter table public.finding_source_refs enable row level security;

drop policy if exists finding_source_refs_operator_full on public.finding_source_refs;
create policy finding_source_refs_operator_full on public.finding_source_refs
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));
