-- SLATE — Persistence/Auth Step 7
-- Opportunities + 30/60/90 roadmap persistence. Operator-scored
-- opportunities tied to approved findings via opportunity_finding_links,
-- plus manually-sequenced roadmap items linked to opportunities.
--
-- Boundary:
--   - Operators have full CRUD via the authenticated server client.
--   - No anon policies. Public /intake/[token] and /scorecard/* routes
--     never read opportunities or roadmap.
--   - category / priority / quadrant / evidence_strength / status /
--     phase fields stay text-typed so vocabulary can evolve without
--     another migration.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- opportunities
-- -----------------------------------------------------------------------------

create table if not exists public.opportunities (
  id                          uuid primary key default gen_random_uuid(),
  workspace_id                uuid not null references public.workspaces(id) on delete restrict,
  engagement_id               uuid not null references public.engagements(id) on delete cascade,
  title                       text not null,
  category                    text not null default 'Back-office Automation',
  description                 text,
  priority                    text not null default 'low_priority',
  quadrant                    text not null default 'low_priority',
  business_impact_score       integer not null default 50,
  complexity_score            integer not null default 50,
  risk_score                  integer not null default 50,
  time_to_value_score         integer not null default 50,
  adoption_likelihood_score   integer not null default 50,
  strategic_value_score       integer not null default 50,
  evidence_strength           text not null default 'adequate',
  source_summary              text,
  recommended_action          text,
  implementation_shape        text,
  dependencies                text[] not null default '{}',
  risks                       text[] not null default '{}',
  success_signals             text[] not null default '{}',
  status                      text not null default 'draft',
  position                    integer not null default 0,
  reviewed_by                 uuid references public.profiles(id) on delete set null,
  last_reviewed_at            timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists opportunities_engagement_idx
  on public.opportunities (engagement_id, position, created_at desc);

create index if not exists opportunities_workspace_quadrant_idx
  on public.opportunities (workspace_id, quadrant);

create index if not exists opportunities_engagement_status_idx
  on public.opportunities (engagement_id, status);

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

alter table public.opportunities enable row level security;

drop policy if exists opportunities_operator_full on public.opportunities;
create policy opportunities_operator_full on public.opportunities
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- opportunity_finding_links (join table)
-- -----------------------------------------------------------------------------

create table if not exists public.opportunity_finding_links (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete restrict,
  engagement_id   uuid not null references public.engagements(id) on delete cascade,
  opportunity_id  uuid not null references public.opportunities(id) on delete cascade,
  finding_id      uuid not null references public.findings(id) on delete cascade,
  strength        text not null default 'adequate',
  created_at      timestamptz not null default now()
);

create unique index if not exists opportunity_finding_links_pair_uniq
  on public.opportunity_finding_links (opportunity_id, finding_id);

create index if not exists opportunity_finding_links_finding_idx
  on public.opportunity_finding_links (finding_id);

create index if not exists opportunity_finding_links_engagement_idx
  on public.opportunity_finding_links (engagement_id);

alter table public.opportunity_finding_links enable row level security;

drop policy if exists opportunity_finding_links_operator_full
  on public.opportunity_finding_links;
create policy opportunity_finding_links_operator_full
  on public.opportunity_finding_links
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- roadmap_items
-- -----------------------------------------------------------------------------

create table if not exists public.roadmap_items (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  engagement_id       uuid not null references public.engagements(id) on delete cascade,
  opportunity_id      uuid references public.opportunities(id) on delete set null,
  phase               text not null default 'first_30',
  title               text not null,
  objective           text,
  priority            text not null default 'low_priority',
  key_actions         text[] not null default '{}',
  dependencies        text[] not null default '{}',
  success_criteria    text[] not null default '{}',
  risks               text[] not null default '{}',
  owner_placeholder   text,
  readiness_note      text,
  position            integer not null default 0,
  status              text not null default 'planned',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists roadmap_items_engagement_idx
  on public.roadmap_items (engagement_id, phase, position, created_at);

create index if not exists roadmap_items_opportunity_idx
  on public.roadmap_items (opportunity_id);

create index if not exists roadmap_items_engagement_status_idx
  on public.roadmap_items (engagement_id, status);

drop trigger if exists roadmap_items_set_updated_at on public.roadmap_items;
create trigger roadmap_items_set_updated_at
  before update on public.roadmap_items
  for each row execute function public.set_updated_at();

alter table public.roadmap_items enable row level security;

drop policy if exists roadmap_items_operator_full on public.roadmap_items;
create policy roadmap_items_operator_full on public.roadmap_items
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));
