-- SLATE — Persistence/Auth Step 10
-- File / document binary storage. Adds storage columns to
-- `input_assets` and provisions a private `engagement-documents`
-- Supabase Storage bucket. The bucket is intentionally private; all
-- public stakeholder uploads route through the server-only token
-- gateway, and operator downloads use short-lived signed URLs minted
-- by the authenticated server. Browsers never receive service-role
-- credentials or list privileges.
--
-- Boundary:
--   - `input_assets` RLS posture stays operator-only (workspace
--     scoped). Public token uploads bypass RLS via the server-only
--     service-role client after validating a sha256 token hash.
--   - `storage.objects` policies are intentionally NOT broadened to
--     `anon` or `authenticated` for this bucket. All read/write goes
--     through server-side helpers, which act with service-role under
--     the existing token / auth boundary.
--   - status / asset_type / source / evidence_quality remain
--     text-typed so vocabulary can evolve without another migration.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- input_assets — add storage columns
-- -----------------------------------------------------------------------------

alter table public.input_assets
  add column if not exists storage_bucket text;

alter table public.input_assets
  add column if not exists storage_path text;

alter table public.input_assets
  add column if not exists original_filename text;

alter table public.input_assets
  add column if not exists mime_type text;

alter table public.input_assets
  add column if not exists size_bytes bigint;

alter table public.input_assets
  add column if not exists uploaded_by_profile_id uuid
    references public.profiles(id) on delete set null;

alter table public.input_assets
  add column if not exists uploaded_by_user_id uuid
    references auth.users(id) on delete set null;

alter table public.input_assets
  add column if not exists uploaded_by_session_id uuid
    references public.stakeholder_intake_sessions(id) on delete set null;

alter table public.input_assets
  add column if not exists uploaded_at timestamptz;

alter table public.input_assets
  add column if not exists download_count integer not null default 0;

alter table public.input_assets
  add column if not exists last_downloaded_at timestamptz;

alter table public.input_assets
  add column if not exists checksum_sha256 text;

create index if not exists input_assets_storage_path_idx
  on public.input_assets (storage_bucket, storage_path);

-- (engagement_id, created_at desc) and (session_id) already exist from
-- migration 0005 — re-asserting them here would be redundant.

-- -----------------------------------------------------------------------------
-- Storage bucket
-- -----------------------------------------------------------------------------

-- The bucket is private (public = false). MIME enforcement at the
-- bucket level catches the obvious misuse cases; the server route does
-- the same validation again so the client cannot rely on either layer
-- alone.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'engagement-documents',
  'engagement-documents',
  false,
  10485760,                                   -- 10 MiB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No `storage.objects` policies are created in this migration.
-- Stakeholder uploads, operator uploads, and operator downloads all
-- flow through server-side helpers in `lib/assets/*` that use the
-- service-role client after enforcing the token / auth boundary.
-- Adding `to authenticated` policies on `storage.objects` here would
-- broaden access beyond the gated server paths and leak the bucket
-- to every signed-in client.
