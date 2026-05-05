-- SLATE — Persistence/Auth Step 5
-- Stakeholder intake persistence: a stakeholder intake session per
-- invitee, the response rows they submit on a token-gated public route,
-- and lightweight input-asset metadata referenced from the operator
-- intake workspace.
--
-- Boundary:
--   - Operators have full CRUD via the authenticated server client.
--   - No anon policies. The public /intake/[token] route reads/writes
--     through a server-only service-role client that scopes by sha256
--     token hash; raw tokens are never stored.
--   - status / response_quality / asset_type / source / status fields
--     stay text-typed so the vocabulary can evolve without a migration.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- stakeholder_intake_sessions
-- -----------------------------------------------------------------------------

create table if not exists public.stakeholder_intake_sessions (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  engagement_id       uuid not null references public.engagements(id) on delete cascade,
  contact_id          uuid references public.contacts(id) on delete set null,
  stakeholder_name    text,
  stakeholder_email   citext,
  stakeholder_title   text,
  role                text not null default 'other',
  department          text,
  status              text not null default 'not_started',
  response_quality    text not null default 'missing',
  token_hash          text not null,
  token_expires_at    timestamptz,
  sent_at             timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  last_activity_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists stakeholder_intake_sessions_token_hash_uniq
  on public.stakeholder_intake_sessions (token_hash);

create index if not exists stakeholder_intake_sessions_engagement_idx
  on public.stakeholder_intake_sessions (engagement_id, last_activity_at desc nulls last);

create index if not exists stakeholder_intake_sessions_workspace_idx
  on public.stakeholder_intake_sessions (workspace_id);

create index if not exists stakeholder_intake_sessions_status_idx
  on public.stakeholder_intake_sessions (engagement_id, status);

drop trigger if exists stakeholder_intake_sessions_set_updated_at
  on public.stakeholder_intake_sessions;
create trigger stakeholder_intake_sessions_set_updated_at
  before update on public.stakeholder_intake_sessions
  for each row execute function public.set_updated_at();

alter table public.stakeholder_intake_sessions enable row level security;

drop policy if exists stakeholder_intake_sessions_operator_full
  on public.stakeholder_intake_sessions;
create policy stakeholder_intake_sessions_operator_full
  on public.stakeholder_intake_sessions
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- stakeholder_responses
-- -----------------------------------------------------------------------------

create table if not exists public.stakeholder_responses (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete restrict,
  engagement_id   uuid not null references public.engagements(id) on delete cascade,
  session_id      uuid not null references public.stakeholder_intake_sessions(id)
                    on delete cascade,
  question_id     text not null,
  question_label  text,
  answer_text     text,
  answer_json     jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists stakeholder_responses_session_idx
  on public.stakeholder_responses (session_id);

create unique index if not exists stakeholder_responses_session_question_uniq
  on public.stakeholder_responses (session_id, question_id);

create index if not exists stakeholder_responses_engagement_idx
  on public.stakeholder_responses (engagement_id);

drop trigger if exists stakeholder_responses_set_updated_at
  on public.stakeholder_responses;
create trigger stakeholder_responses_set_updated_at
  before update on public.stakeholder_responses
  for each row execute function public.set_updated_at();

alter table public.stakeholder_responses enable row level security;

drop policy if exists stakeholder_responses_operator_full
  on public.stakeholder_responses;
create policy stakeholder_responses_operator_full
  on public.stakeholder_responses
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- input_assets (document / supporting input METADATA only — no binary storage)
-- -----------------------------------------------------------------------------

create table if not exists public.input_assets (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete restrict,
  engagement_id     uuid not null references public.engagements(id) on delete cascade,
  session_id        uuid references public.stakeholder_intake_sessions(id)
                      on delete set null,
  title             text not null,
  asset_type        text,
  source            text,
  status            text not null default 'requested',
  evidence_quality  text not null default 'unverified',
  linked_role       text,
  summary           text,
  metadata          jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists input_assets_engagement_idx
  on public.input_assets (engagement_id, created_at desc);

create index if not exists input_assets_session_idx
  on public.input_assets (session_id);

drop trigger if exists input_assets_set_updated_at on public.input_assets;
create trigger input_assets_set_updated_at
  before update on public.input_assets
  for each row execute function public.set_updated_at();

alter table public.input_assets enable row level security;

drop policy if exists input_assets_operator_full on public.input_assets;
create policy input_assets_operator_full on public.input_assets
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));
