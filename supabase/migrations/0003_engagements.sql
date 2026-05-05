-- SLATE — Persistence/Auth Step 4
-- Engagement creation + engagement detail persistence.
-- Adds the engagements table plus the enums it needs. Status panels
-- (intake / documents / findings / opportunities / report / proposal)
-- are stored as jsonb on the engagement row for now — they will become
-- derived views once the underlying domain tables land in Steps 5–8.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.engagement_type as enum
    ('ai_opportunity_sprint',
     'workflow_automation_assessment',
     'systems_readiness_review');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.engagement_status as enum
    ('setup', 'active', 'needs_review', 'blocked',
     'ready_for_report', 'proposal_draft', 'completed', 'paused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.engagement_stage as enum
    ('setup', 'intake', 'synthesis', 'scoring', 'report', 'proposal');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- engagements
-- -----------------------------------------------------------------------------

create table if not exists public.engagements (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  account_id          uuid not null references public.accounts(id) on delete restrict,
  contact_id          uuid references public.contacts(id) on delete set null,
  linked_lead_id      uuid references public.leads(id) on delete set null,
  name                text not null,
  engagement_type     public.engagement_type not null default 'ai_opportunity_sprint',
  status              public.engagement_status not null default 'setup',
  current_stage       public.engagement_stage not null default 'setup',
  owner_profile_id    uuid references public.profiles(id) on delete set null,
  target_date         date,
  last_activity_at    timestamptz not null default now(),
  next_milestone      text,
  recommended_action  jsonb,
  stage_progress      jsonb,
  intake_status       jsonb,
  document_status     jsonb,
  findings_status     jsonb,
  opportunity_status  jsonb,
  report_status       jsonb,
  proposal_status     jsonb,
  risk_notes          jsonb,
  dependencies        jsonb,
  notes               jsonb,
  source_snapshot     jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists engagements_set_updated_at on public.engagements;
create trigger engagements_set_updated_at
  before update on public.engagements
  for each row execute function public.set_updated_at();

create index if not exists engagements_workspace_activity_idx
  on public.engagements (workspace_id, last_activity_at desc);
create index if not exists engagements_account_idx
  on public.engagements (account_id);
create index if not exists engagements_contact_idx
  on public.engagements (contact_id);
create index if not exists engagements_linked_lead_idx
  on public.engagements (linked_lead_id);
create index if not exists engagements_stage_idx
  on public.engagements (current_stage);
create index if not exists engagements_status_idx
  on public.engagements (status);

-- One live engagement per source lead (re-clicking "Start AI Opportunity
-- Sprint" should always reopen the existing workspace, not create a
-- duplicate). NULL linked_lead_id rows (manually-created engagements) are
-- excluded from the constraint.
create unique index if not exists engagements_one_per_lead_uniq
  on public.engagements (linked_lead_id)
  where linked_lead_id is not null;

alter table public.engagements enable row level security;

drop policy if exists engagements_operator_full on public.engagements;
create policy engagements_operator_full on public.engagements
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));
