-- SLATE — Persistence/Auth Step 8
-- Reports + proposals persistence. Reports assemble persisted sections
-- with three join tables traceable to findings, opportunities, and
-- roadmap items. Proposals assemble persisted options (three canonical
-- types: quick_win_build, ai_workflow_system, managed_ai_partner) with
-- two join tables traceable to opportunities and roadmap items.
--
-- Boundary:
--   - Operators have full CRUD via the authenticated server client.
--   - No anon policies. Public /scorecard/* and /intake/[token] routes
--     never read reports or proposals.
--   - status / section_type / option_type / confidence / export_status
--     stay text-typed so vocabulary can evolve without another
--     migration.
--   - Implementation credit lives inline on `proposals` as a bounded
--     commercial lever — eligibility flag, amount placeholder, window,
--     and notes. No payments, no e-signature, no SOW execution.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- reports
-- -----------------------------------------------------------------------------

create table if not exists public.reports (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspaces(id) on delete restrict,
  engagement_id            uuid not null references public.engagements(id) on delete cascade,
  title                    text not null,
  status                   text not null default 'draft',
  generated_at             timestamptz,
  last_edited_at           timestamptz,
  recommended_next_step    text,
  consultant_notes         text[] not null default '{}',
  export_status            text not null default 'locked',
  reviewed_by              uuid references public.profiles(id) on delete set null,
  last_reviewed_at         timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index if not exists reports_engagement_uniq
  on public.reports (engagement_id);

create index if not exists reports_workspace_status_idx
  on public.reports (workspace_id, status);

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;

drop policy if exists reports_operator_full on public.reports;
create policy reports_operator_full on public.reports
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- report_sections
-- -----------------------------------------------------------------------------

create table if not exists public.report_sections (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete restrict,
  engagement_id     uuid not null references public.engagements(id) on delete cascade,
  report_id         uuid not null references public.reports(id) on delete cascade,
  section_type      text not null,
  title             text not null,
  status            text not null default 'not_started',
  summary           text,
  draft_preview     text,
  evidence_notes    text,
  reviewer_note     text,
  ai_drafted        boolean not null default false,
  confidence        text not null default 'needs_evidence',
  position          integer not null default 0,
  reviewed_by       uuid references public.profiles(id) on delete set null,
  last_reviewed_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists report_sections_report_type_uniq
  on public.report_sections (report_id, section_type);

create index if not exists report_sections_engagement_idx
  on public.report_sections (engagement_id, position, created_at);

create index if not exists report_sections_engagement_status_idx
  on public.report_sections (engagement_id, status);

drop trigger if exists report_sections_set_updated_at on public.report_sections;
create trigger report_sections_set_updated_at
  before update on public.report_sections
  for each row execute function public.set_updated_at();

alter table public.report_sections enable row level security;

drop policy if exists report_sections_operator_full on public.report_sections;
create policy report_sections_operator_full on public.report_sections
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- report_section_finding_links
-- -----------------------------------------------------------------------------

create table if not exists public.report_section_finding_links (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  engagement_id       uuid not null references public.engagements(id) on delete cascade,
  report_section_id   uuid not null references public.report_sections(id) on delete cascade,
  finding_id          uuid not null references public.findings(id) on delete cascade,
  created_at          timestamptz not null default now()
);

create unique index if not exists report_section_finding_links_pair_uniq
  on public.report_section_finding_links (report_section_id, finding_id);

create index if not exists report_section_finding_links_finding_idx
  on public.report_section_finding_links (finding_id);

create index if not exists report_section_finding_links_engagement_idx
  on public.report_section_finding_links (engagement_id);

alter table public.report_section_finding_links enable row level security;

drop policy if exists report_section_finding_links_operator_full
  on public.report_section_finding_links;
create policy report_section_finding_links_operator_full
  on public.report_section_finding_links
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- report_section_opportunity_links
-- -----------------------------------------------------------------------------

create table if not exists public.report_section_opportunity_links (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  engagement_id       uuid not null references public.engagements(id) on delete cascade,
  report_section_id   uuid not null references public.report_sections(id) on delete cascade,
  opportunity_id      uuid not null references public.opportunities(id) on delete cascade,
  created_at          timestamptz not null default now()
);

create unique index if not exists report_section_opportunity_links_pair_uniq
  on public.report_section_opportunity_links (report_section_id, opportunity_id);

create index if not exists report_section_opportunity_links_opp_idx
  on public.report_section_opportunity_links (opportunity_id);

create index if not exists report_section_opportunity_links_engagement_idx
  on public.report_section_opportunity_links (engagement_id);

alter table public.report_section_opportunity_links enable row level security;

drop policy if exists report_section_opportunity_links_operator_full
  on public.report_section_opportunity_links;
create policy report_section_opportunity_links_operator_full
  on public.report_section_opportunity_links
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- report_section_roadmap_links
-- -----------------------------------------------------------------------------

create table if not exists public.report_section_roadmap_links (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  engagement_id       uuid not null references public.engagements(id) on delete cascade,
  report_section_id   uuid not null references public.report_sections(id) on delete cascade,
  roadmap_item_id     uuid not null references public.roadmap_items(id) on delete cascade,
  created_at          timestamptz not null default now()
);

create unique index if not exists report_section_roadmap_links_pair_uniq
  on public.report_section_roadmap_links (report_section_id, roadmap_item_id);

create index if not exists report_section_roadmap_links_item_idx
  on public.report_section_roadmap_links (roadmap_item_id);

create index if not exists report_section_roadmap_links_engagement_idx
  on public.report_section_roadmap_links (engagement_id);

alter table public.report_section_roadmap_links enable row level security;

drop policy if exists report_section_roadmap_links_operator_full
  on public.report_section_roadmap_links;
create policy report_section_roadmap_links_operator_full
  on public.report_section_roadmap_links
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- proposals
-- -----------------------------------------------------------------------------

create table if not exists public.proposals (
  id                                 uuid primary key default gen_random_uuid(),
  workspace_id                       uuid not null references public.workspaces(id) on delete restrict,
  engagement_id                      uuid not null references public.engagements(id) on delete cascade,
  title                              text not null,
  status                             text not null default 'draft',
  recommended_option_id              uuid,
  next_step                          text,
  assumptions                        text[] not null default '{}',
  dependencies                       text[] not null default '{}',
  credit_eligible                    boolean not null default true,
  credit_amount_placeholder          text not null default 'Up to 25% of AI Opportunity Sprint fee',
  credit_window                      text not null default 'Applied if implementation starts within 60 days of report finalization',
  credit_notes                       text not null default 'If the client proceeds into implementation within the agreed window, a portion of the AI Opportunity Sprint fee may be credited toward the implementation SOW. This is represented here as a commercial lever, not an automatic discount.',
  export_status                      text not null default 'locked',
  reviewed_by                        uuid references public.profiles(id) on delete set null,
  last_reviewed_at                   timestamptz,
  created_at                         timestamptz not null default now(),
  updated_at                         timestamptz not null default now()
);

create unique index if not exists proposals_engagement_uniq
  on public.proposals (engagement_id);

create index if not exists proposals_workspace_status_idx
  on public.proposals (workspace_id, status);

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

alter table public.proposals enable row level security;

drop policy if exists proposals_operator_full on public.proposals;
create policy proposals_operator_full on public.proposals
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- proposal_options
-- -----------------------------------------------------------------------------

create table if not exists public.proposal_options (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspaces(id) on delete restrict,
  engagement_id            uuid not null references public.engagements(id) on delete cascade,
  proposal_id              uuid not null references public.proposals(id) on delete cascade,
  option_type              text not null,
  title                    text not null,
  recommended              boolean not null default false,
  best_fit_scenario        text,
  scope_summary            text,
  timeline                 text,
  deliverables             text[] not null default '{}',
  assumptions              text[] not null default '{}',
  dependencies             text[] not null default '{}',
  risks                    text[] not null default '{}',
  pricing_placeholder      text,
  confidence               text not null default 'medium',
  position                 integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index if not exists proposal_options_proposal_type_uniq
  on public.proposal_options (proposal_id, option_type);

create index if not exists proposal_options_engagement_idx
  on public.proposal_options (engagement_id, position, created_at);

drop trigger if exists proposal_options_set_updated_at on public.proposal_options;
create trigger proposal_options_set_updated_at
  before update on public.proposal_options
  for each row execute function public.set_updated_at();

alter table public.proposal_options enable row level security;

drop policy if exists proposal_options_operator_full on public.proposal_options;
create policy proposal_options_operator_full on public.proposal_options
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- Recommended-option FK is added after proposal_options exists so the
-- table dependency order works for fresh installs.
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'proposals'
      and constraint_name = 'proposals_recommended_option_id_fkey'
  ) then
    alter table public.proposals
      add constraint proposals_recommended_option_id_fkey
      foreign key (recommended_option_id)
      references public.proposal_options(id)
      on delete set null;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- proposal_option_opportunity_links
-- -----------------------------------------------------------------------------

create table if not exists public.proposal_option_opportunity_links (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces(id) on delete restrict,
  engagement_id         uuid not null references public.engagements(id) on delete cascade,
  proposal_option_id    uuid not null references public.proposal_options(id) on delete cascade,
  opportunity_id        uuid not null references public.opportunities(id) on delete cascade,
  created_at            timestamptz not null default now()
);

create unique index if not exists proposal_option_opportunity_links_pair_uniq
  on public.proposal_option_opportunity_links (proposal_option_id, opportunity_id);

create index if not exists proposal_option_opportunity_links_opp_idx
  on public.proposal_option_opportunity_links (opportunity_id);

create index if not exists proposal_option_opportunity_links_engagement_idx
  on public.proposal_option_opportunity_links (engagement_id);

alter table public.proposal_option_opportunity_links enable row level security;

drop policy if exists proposal_option_opportunity_links_operator_full
  on public.proposal_option_opportunity_links;
create policy proposal_option_opportunity_links_operator_full
  on public.proposal_option_opportunity_links
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- proposal_option_roadmap_links
-- -----------------------------------------------------------------------------

create table if not exists public.proposal_option_roadmap_links (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces(id) on delete restrict,
  engagement_id         uuid not null references public.engagements(id) on delete cascade,
  proposal_option_id    uuid not null references public.proposal_options(id) on delete cascade,
  roadmap_item_id       uuid not null references public.roadmap_items(id) on delete cascade,
  created_at            timestamptz not null default now()
);

create unique index if not exists proposal_option_roadmap_links_pair_uniq
  on public.proposal_option_roadmap_links (proposal_option_id, roadmap_item_id);

create index if not exists proposal_option_roadmap_links_item_idx
  on public.proposal_option_roadmap_links (roadmap_item_id);

create index if not exists proposal_option_roadmap_links_engagement_idx
  on public.proposal_option_roadmap_links (engagement_id);

alter table public.proposal_option_roadmap_links enable row level security;

drop policy if exists proposal_option_roadmap_links_operator_full
  on public.proposal_option_roadmap_links;
create policy proposal_option_roadmap_links_operator_full
  on public.proposal_option_roadmap_links
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));
