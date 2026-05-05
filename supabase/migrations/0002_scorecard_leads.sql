-- SLATE — Persistence/Auth Step 2
-- Public scorecard submission persistence + lead creation.
-- Idempotent where practical. New tables: accounts, contacts, leads,
-- lead_fit_dimensions, lead_qualification_signals, scorecard_submissions,
-- scorecard_answers.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.practice_area as enum ('ai_systems', 'custom_dev', 'venture_studio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_source as enum
    ('public_scorecard', 'referral', 'outbound', 'event', 'partner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum
    ('new', 'needs_review', 'high_fit', 'diagnostic_requested',
     'nurture', 'disqualified', 'converted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fit_dimension_id as enum
    ('business_value', 'budget', 'pain_intensity',
     'technical_readiness', 'buyer_readiness', 'expansion');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.qualification_signal_direction as enum
    ('positive', 'watch', 'negative');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.scorecard_classification as enum
    ('not_ready', 'automation_ready', 'quick_win', 'audit_ready', 'strategic');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- accounts
-- -----------------------------------------------------------------------------

create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete restrict,
  name            text not null,
  industry        text,
  employee_range  text,
  revenue_range   text,
  practice_area   public.practice_area not null default 'ai_systems',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

create unique index if not exists accounts_workspace_lower_name_uniq
  on public.accounts (workspace_id, lower(name));
create index if not exists accounts_workspace_idx
  on public.accounts (workspace_id);

alter table public.accounts enable row level security;

drop policy if exists accounts_operator_full on public.accounts;
create policy accounts_operator_full on public.accounts
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- -----------------------------------------------------------------------------
-- contacts
-- -----------------------------------------------------------------------------

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  full_name   text,
  title       text,
  email       citext,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create unique index if not exists contacts_account_email_uniq
  on public.contacts (account_id, email)
  where email is not null;
create index if not exists contacts_account_idx
  on public.contacts (account_id);
create index if not exists contacts_email_idx
  on public.contacts (email);

alter table public.contacts enable row level security;

drop policy if exists contacts_operator_full on public.contacts;
create policy contacts_operator_full on public.contacts
  for all
  to authenticated
  using (
    exists (
      select 1 from public.accounts a
      where a.id = contacts.account_id
        and a.workspace_id = (select id from public.workspaces limit 1)
    )
  )
  with check (
    exists (
      select 1 from public.accounts a
      where a.id = contacts.account_id
        and a.workspace_id = (select id from public.workspaces limit 1)
    )
  );

-- -----------------------------------------------------------------------------
-- scorecard_submissions
-- (forward-declared so leads.submission_id can reference it; lead_id is
--  added later via alter table after leads exists)
-- -----------------------------------------------------------------------------

create table if not exists public.scorecard_submissions (
  id                            uuid primary key default gen_random_uuid(),
  submitted_at                  timestamptz not null default now(),
  submitted_email               citext,
  submitted_first_name          text,
  submitted_last_name           text,
  submitted_role                text,
  submitted_company             text,
  industry                      text,
  employee_range                text,
  prospect_ai_readiness         smallint,
  prospect_workflow_friction    smallint,
  prospect_systems_readiness    smallint,
  internal_fit_score            smallint,
  classification                public.scorecard_classification,
  lead_id                       uuid, -- FK constraint added below after leads exists
  client_meta                   jsonb
);

create index if not exists scorecard_submissions_submitted_at_idx
  on public.scorecard_submissions (submitted_at desc);
create index if not exists scorecard_submissions_email_idx
  on public.scorecard_submissions (submitted_email);

alter table public.scorecard_submissions enable row level security;

-- Operators can read all submissions in the workspace context.
drop policy if exists scorecard_submissions_operator_read on public.scorecard_submissions;
create policy scorecard_submissions_operator_read on public.scorecard_submissions
  for select
  to authenticated
  using (true);

-- Operators may also update/delete (service-role bypasses RLS but the
-- explicit policy keeps the boundary visible).
drop policy if exists scorecard_submissions_operator_write on public.scorecard_submissions;
create policy scorecard_submissions_operator_write on public.scorecard_submissions
  for all
  to authenticated
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- scorecard_answers
-- -----------------------------------------------------------------------------

create table if not exists public.scorecard_answers (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.scorecard_submissions(id) on delete cascade,
  question_id    text not null,
  value          jsonb not null
);

create index if not exists scorecard_answers_submission_idx
  on public.scorecard_answers (submission_id);
create unique index if not exists scorecard_answers_submission_question_uniq
  on public.scorecard_answers (submission_id, question_id);

alter table public.scorecard_answers enable row level security;

drop policy if exists scorecard_answers_operator_read on public.scorecard_answers;
create policy scorecard_answers_operator_read on public.scorecard_answers
  for select
  to authenticated
  using (true);

drop policy if exists scorecard_answers_operator_write on public.scorecard_answers;
create policy scorecard_answers_operator_write on public.scorecard_answers
  for all
  to authenticated
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------

create table if not exists public.leads (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  account_id          uuid not null references public.accounts(id) on delete restrict,
  contact_id          uuid references public.contacts(id) on delete set null,
  source              public.lead_source not null,
  practice_area       public.practice_area not null default 'ai_systems',
  status              public.lead_status not null default 'new',
  internal_fit_score  smallint,
  prospect_scores     jsonb,
  recommended_action  jsonb,
  submission_id       uuid references public.scorecard_submissions(id) on delete set null,
  last_activity_at    timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create index if not exists leads_workspace_status_idx
  on public.leads (workspace_id, status, last_activity_at desc);
create index if not exists leads_account_idx on public.leads (account_id);
create index if not exists leads_contact_idx on public.leads (contact_id);
create index if not exists leads_submission_idx on public.leads (submission_id);

alter table public.leads enable row level security;

drop policy if exists leads_operator_full on public.leads;
create policy leads_operator_full on public.leads
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));

-- Add the deferred FK from scorecard_submissions.lead_id → leads.id now
-- that leads exists. The reverse FK on leads.submission_id is already in
-- place.
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'scorecard_submissions'
      and constraint_name = 'scorecard_submissions_lead_id_fkey'
  ) then
    alter table public.scorecard_submissions
      add constraint scorecard_submissions_lead_id_fkey
      foreign key (lead_id) references public.leads(id) on delete set null;
  end if;
end $$;

create index if not exists scorecard_submissions_lead_idx
  on public.scorecard_submissions (lead_id);

-- -----------------------------------------------------------------------------
-- lead_fit_dimensions
-- -----------------------------------------------------------------------------

create table if not exists public.lead_fit_dimensions (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads(id) on delete cascade,
  dimension_id  public.fit_dimension_id not null,
  value         smallint not null,
  note          text
);

create unique index if not exists lead_fit_dimensions_lead_dim_uniq
  on public.lead_fit_dimensions (lead_id, dimension_id);

alter table public.lead_fit_dimensions enable row level security;

drop policy if exists lead_fit_dimensions_operator_full on public.lead_fit_dimensions;
create policy lead_fit_dimensions_operator_full on public.lead_fit_dimensions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_fit_dimensions.lead_id
        and l.workspace_id = (select id from public.workspaces limit 1)
    )
  )
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_fit_dimensions.lead_id
        and l.workspace_id = (select id from public.workspaces limit 1)
    )
  );

-- -----------------------------------------------------------------------------
-- lead_qualification_signals
-- -----------------------------------------------------------------------------

create table if not exists public.lead_qualification_signals (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  label      text not null,
  detail     text,
  direction  public.qualification_signal_direction not null,
  position   integer not null default 0
);

create index if not exists lead_qualification_signals_lead_idx
  on public.lead_qualification_signals (lead_id, position);

alter table public.lead_qualification_signals enable row level security;

drop policy if exists lead_qualification_signals_operator_full on public.lead_qualification_signals;
create policy lead_qualification_signals_operator_full on public.lead_qualification_signals
  for all
  to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_qualification_signals.lead_id
        and l.workspace_id = (select id from public.workspaces limit 1)
    )
  )
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_qualification_signals.lead_id
        and l.workspace_id = (select id from public.workspaces limit 1)
    )
  );
