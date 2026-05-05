-- SLATE — Persistence/Auth Step 9
-- Activity events + operator notes. Adds an auditable operational
-- trail across leads + the persisted engagement workflow plus a thin
-- internal notes surface for operators.
--
-- Boundary:
--   - Operators have full CRUD on notes via the authenticated server
--     client. They can select activity events; they should not insert /
--     update / delete events directly from the browser. Server actions
--     (and a service-role logger for public-server contexts) emit
--     events.
--   - No anon policies. Public scorecard / intake routes never read
--     notes or activity. The public stakeholder server route may emit
--     activity via the service-role client but does not surface the
--     resulting rows to the stakeholder.
--   - event_type / entity_type / visibility stay text-typed so the
--     vocabulary can evolve without another migration.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- activity_events
-- -----------------------------------------------------------------------------

create table if not exists public.activity_events (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  actor_profile_id    uuid references public.profiles(id) on delete set null,
  actor_user_id       uuid references auth.users(id) on delete set null,
  event_type          text not null,
  entity_type         text not null,
  entity_id           uuid,
  engagement_id       uuid references public.engagements(id) on delete cascade,
  lead_id             uuid references public.leads(id) on delete cascade,
  account_id          uuid references public.accounts(id) on delete set null,
  contact_id          uuid references public.contacts(id) on delete set null,
  title               text not null,
  summary             text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists activity_events_workspace_created_idx
  on public.activity_events (workspace_id, created_at desc);

create index if not exists activity_events_engagement_created_idx
  on public.activity_events (engagement_id, created_at desc);

create index if not exists activity_events_lead_created_idx
  on public.activity_events (lead_id, created_at desc);

create index if not exists activity_events_entity_idx
  on public.activity_events (entity_type, entity_id);

create index if not exists activity_events_event_type_idx
  on public.activity_events (event_type, created_at desc);

alter table public.activity_events enable row level security;

-- Operators can read all workspace activity. Insert is allowed via the
-- authenticated server client so server actions can log under the
-- operator's session; service-role inserts (used by public-server
-- contexts) bypass RLS by design and are scoped at the helper level.
drop policy if exists activity_events_operator_select on public.activity_events;
create policy activity_events_operator_select on public.activity_events
  for select
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1));

drop policy if exists activity_events_operator_insert on public.activity_events;
create policy activity_events_operator_insert on public.activity_events
  for insert
  to authenticated
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- notes
-- -----------------------------------------------------------------------------

create table if not exists public.notes (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  author_profile_id   uuid references public.profiles(id) on delete set null,
  author_user_id      uuid references auth.users(id) on delete set null,
  entity_type         text not null,
  entity_id           uuid not null,
  lead_id             uuid references public.leads(id) on delete cascade,
  engagement_id       uuid references public.engagements(id) on delete cascade,
  body                text not null,
  visibility          text not null default 'internal',
  pinned              boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index if not exists notes_workspace_created_idx
  on public.notes (workspace_id, created_at desc);

create index if not exists notes_engagement_created_idx
  on public.notes (engagement_id, created_at desc);

create index if not exists notes_lead_created_idx
  on public.notes (lead_id, created_at desc);

create index if not exists notes_entity_idx
  on public.notes (entity_type, entity_id);

create index if not exists notes_pinned_idx
  on public.notes (entity_type, entity_id, pinned)
  where deleted_at is null;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

drop policy if exists notes_operator_full on public.notes;
create policy notes_operator_full on public.notes
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));
