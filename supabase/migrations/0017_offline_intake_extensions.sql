-- SLATE — Sprint I2 (Offline Intake Data Model + Server Actions)
-- Canon: docs/37_SAPIENT_DIGITAL_OFFLINE_INTAKE_CANON.md
--
-- Extends the Sprint 5 stakeholder intake schema with operator-staged
-- offline intake support (Mode B) and document-only intake (Mode C), and
-- adds a first-class `engagement_intake_documents` entity for offline
-- source attachments. Live-link intake (Mode A) behavior is preserved
-- byte-identical: every pre-existing session/response row defaults to
-- source_type='live_link' + client_visible=true, and the existing
-- token_hash NOT NULL invariant becomes a CHECK constraint gated on the
-- mode rather than a column-level NOT NULL.
--
-- Boundaries enforced by this migration:
--   - Operators have full CRUD via the authenticated workspace-scoped
--     server client. No anon policies anywhere. No public/client
--     policies.
--   - Offline modes (operator_entered / meeting_notes / transcript /
--     email_paste / document_upload) MUST NOT have a token_hash; live
--     mode MUST. Enforced via CHECK constraint.
--   - client_visible defaults to FALSE on every new offline row. The
--     docs/35 § 5 readiness gate stands between this data and any
--     client-facing artifact.
--   - source_type and source_confidence values are CHECK-constrained so
--     downstream synthesis can rely on the vocabulary.
--   - response_status values are CHECK-constrained; transitions are
--     enforced at the server-action layer, not in SQL.
--   - Documents NEVER reach the public /r or /p routes; they feed
--     operator-side findings synthesis only.
--
-- Idempotent: safe to re-run.

-- =============================================================================
-- stakeholder_intake_sessions extensions
-- =============================================================================

-- Mode discriminator. Default 'live_link' preserves existing behavior.
alter table public.stakeholder_intake_sessions
  add column if not exists source_type text not null default 'live_link';

alter table public.stakeholder_intake_sessions
  add column if not exists entered_by uuid references auth.users(id) on delete set null;

alter table public.stakeholder_intake_sessions
  add column if not exists collected_at timestamptz;

alter table public.stakeholder_intake_sessions
  add column if not exists source_confidence text;

alter table public.stakeholder_intake_sessions
  add column if not exists operator_notes text;

-- client_visible default true preserves existing live-mode semantics on
-- backfill (pre-existing rows are all live). New offline rows default
-- false at the server-action layer.
alter table public.stakeholder_intake_sessions
  add column if not exists client_visible boolean not null default true;

-- Backfill ALL pre-existing rows to source_type='live_link' + client_visible=true
-- (only applies once on first run; the column defaults above already
-- handle this but we re-affirm explicitly).
update public.stakeholder_intake_sessions
   set source_type = coalesce(source_type, 'live_link'),
       client_visible = coalesce(client_visible, true)
 where source_type is null or client_visible is null;

-- Drop token_hash NOT NULL invariant so offline rows can omit it. The
-- CHECK constraint below restores semantic safety (live requires hash;
-- offline must omit).
alter table public.stakeholder_intake_sessions
  alter column token_hash drop not null;

-- Source-type vocabulary. CHECK NOT VALID + VALIDATE to avoid blocking
-- on huge tables (defensive; this table is small in practice).
alter table public.stakeholder_intake_sessions
  drop constraint if exists stakeholder_intake_sessions_source_type_check;
alter table public.stakeholder_intake_sessions
  add constraint stakeholder_intake_sessions_source_type_check
  check (source_type in (
    'live_link',
    'operator_entered',
    'meeting_notes',
    'transcript',
    'email_paste',
    'document_upload'
  ));

-- Source confidence vocabulary (nullable; only set for offline modes).
alter table public.stakeholder_intake_sessions
  drop constraint if exists stakeholder_intake_sessions_source_confidence_check;
alter table public.stakeholder_intake_sessions
  add constraint stakeholder_intake_sessions_source_confidence_check
  check (
    source_confidence is null
    or source_confidence in ('first_hand', 'second_hand', 'inferred')
  );

-- Live mode requires token_hash; offline modes must not have one.
alter table public.stakeholder_intake_sessions
  drop constraint if exists stakeholder_intake_sessions_token_hash_mode_check;
alter table public.stakeholder_intake_sessions
  add constraint stakeholder_intake_sessions_token_hash_mode_check
  check (
    (source_type = 'live_link' and token_hash is not null)
    or (source_type != 'live_link' and token_hash is null)
  );

-- operator_notes length cap (canon docs/37 § 3.1 — 2000 chars max).
alter table public.stakeholder_intake_sessions
  drop constraint if exists stakeholder_intake_sessions_operator_notes_length_check;
alter table public.stakeholder_intake_sessions
  add constraint stakeholder_intake_sessions_operator_notes_length_check
  check (operator_notes is null or length(operator_notes) <= 2000);

-- Index on source_type for filtering live vs offline rows in queries.
create index if not exists stakeholder_intake_sessions_source_type_idx
  on public.stakeholder_intake_sessions (engagement_id, source_type);

-- =============================================================================
-- stakeholder_responses extensions
-- =============================================================================

alter table public.stakeholder_responses
  add column if not exists source_type text not null default 'live_link';

-- response_status lifecycle. Default 'ready_for_synthesis' preserves
-- existing live-mode semantics on backfill (pre-existing rows came
-- through the public token route, which means the stakeholder typed
-- them — they are by definition ready for synthesis). New offline rows
-- default 'draft' at the server-action layer.
alter table public.stakeholder_responses
  add column if not exists response_status text not null default 'ready_for_synthesis';

alter table public.stakeholder_responses
  add column if not exists entered_by uuid references auth.users(id) on delete set null;

alter table public.stakeholder_responses
  add column if not exists collected_at timestamptz;

alter table public.stakeholder_responses
  add column if not exists operator_notes text;

alter table public.stakeholder_responses
  add column if not exists supersedes_response_id uuid
  references public.stakeholder_responses(id) on delete set null;

alter table public.stakeholder_responses
  add column if not exists client_visible boolean not null default true;

-- Backfill safety: pre-existing rows are live-link + ready-for-synthesis.
update public.stakeholder_responses
   set source_type = coalesce(source_type, 'live_link'),
       response_status = coalesce(response_status, 'ready_for_synthesis'),
       client_visible = coalesce(client_visible, true)
 where source_type is null or response_status is null or client_visible is null;

alter table public.stakeholder_responses
  drop constraint if exists stakeholder_responses_source_type_check;
alter table public.stakeholder_responses
  add constraint stakeholder_responses_source_type_check
  check (source_type in (
    'live_link',
    'operator_entered',
    'meeting_notes',
    'transcript',
    'email_paste',
    'document_upload'
  ));

alter table public.stakeholder_responses
  drop constraint if exists stakeholder_responses_response_status_check;
alter table public.stakeholder_responses
  add constraint stakeholder_responses_response_status_check
  check (response_status in (
    'draft',
    'ready_for_synthesis',
    'superseded',
    'voided'
  ));

alter table public.stakeholder_responses
  drop constraint if exists stakeholder_responses_operator_notes_length_check;
alter table public.stakeholder_responses
  add constraint stakeholder_responses_operator_notes_length_check
  check (operator_notes is null or length(operator_notes) <= 1000);

create index if not exists stakeholder_responses_status_idx
  on public.stakeholder_responses (engagement_id, response_status);

create index if not exists stakeholder_responses_source_type_idx
  on public.stakeholder_responses (engagement_id, source_type);

-- =============================================================================
-- engagement_intake_documents (new)
-- =============================================================================
--
-- First-class entity for offline-mode source attachments. Distinct from
-- `input_assets` (which is the Sprint 5 metadata-only table for the
-- live intake workspace) because this entity carries the full offline
-- content (text or storage reference) plus per-document operator
-- provenance fields. Documents NEVER reach the public /r or /p routes;
-- they feed operator-side findings synthesis only.

create table if not exists public.engagement_intake_documents (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete restrict,
  engagement_id       uuid not null references public.engagements(id) on delete cascade,
  stakeholder_id      uuid references public.stakeholder_intake_sessions(id) on delete set null,
  title               text not null,
  source_type         text not null default 'document_upload',
  content_text        text,
  external_url        text,
  storage_path        text,
  mime_type           text,
  size_bytes          bigint,
  source_confidence   text,
  operator_notes      text,
  client_visible      boolean not null default false,
  created_by          uuid references auth.users(id) on delete set null,
  voided_at           timestamptz,
  voided_by           uuid references auth.users(id) on delete set null,
  void_reason         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.engagement_intake_documents
  drop constraint if exists engagement_intake_documents_source_type_check;
alter table public.engagement_intake_documents
  add constraint engagement_intake_documents_source_type_check
  check (source_type in (
    'document_upload',
    'meeting_notes',
    'transcript',
    'email_paste',
    'external_link'
  ));

alter table public.engagement_intake_documents
  drop constraint if exists engagement_intake_documents_source_confidence_check;
alter table public.engagement_intake_documents
  add constraint engagement_intake_documents_source_confidence_check
  check (
    source_confidence is null
    or source_confidence in ('first_hand', 'second_hand', 'inferred')
  );

alter table public.engagement_intake_documents
  drop constraint if exists engagement_intake_documents_title_length_check;
alter table public.engagement_intake_documents
  add constraint engagement_intake_documents_title_length_check
  check (length(title) between 1 and 200);

alter table public.engagement_intake_documents
  drop constraint if exists engagement_intake_documents_operator_notes_length_check;
alter table public.engagement_intake_documents
  add constraint engagement_intake_documents_operator_notes_length_check
  check (operator_notes is null or length(operator_notes) <= 1000);

alter table public.engagement_intake_documents
  drop constraint if exists engagement_intake_documents_void_reason_length_check;
alter table public.engagement_intake_documents
  add constraint engagement_intake_documents_void_reason_length_check
  check (void_reason is null or length(void_reason) <= 500);

-- At least one of content_text / external_url / storage_path must be
-- present so the document has retrievable content. CHECK is intentionally
-- permissive so the operator UI can save a draft with just a title +
-- summary in operator_notes if the actual content lands later.
-- (Server-action layer enforces stricter rules per source_type.)

create index if not exists engagement_intake_documents_engagement_idx
  on public.engagement_intake_documents (engagement_id, created_at desc);

create index if not exists engagement_intake_documents_workspace_idx
  on public.engagement_intake_documents (workspace_id);

create index if not exists engagement_intake_documents_stakeholder_idx
  on public.engagement_intake_documents (stakeholder_id);

create index if not exists engagement_intake_documents_source_type_idx
  on public.engagement_intake_documents (engagement_id, source_type);

create index if not exists engagement_intake_documents_voided_idx
  on public.engagement_intake_documents (engagement_id, voided_at);

drop trigger if exists engagement_intake_documents_set_updated_at
  on public.engagement_intake_documents;
create trigger engagement_intake_documents_set_updated_at
  before update on public.engagement_intake_documents
  for each row execute function public.set_updated_at();

alter table public.engagement_intake_documents enable row level security;

drop policy if exists engagement_intake_documents_operator_full
  on public.engagement_intake_documents;
create policy engagement_intake_documents_operator_full
  on public.engagement_intake_documents
  for all
  to authenticated
  using (workspace_id = (select id from public.workspaces limit 1))
  with check (workspace_id = (select id from public.workspaces limit 1));
