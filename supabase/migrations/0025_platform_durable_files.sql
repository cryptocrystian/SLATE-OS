-- SLATE — Platform G0 · Durable file store
--
-- Per docs/72_GOVERNANCEOS_INTEGRATION_PLAN.md §3.4 and
-- docs/75_PLATFORM_LIFECYCLE_DURABILITY_AUDIT.md.
-- Layer: SLATE PLATFORM (domain-agnostic).
--
-- Why: engagement files live on input_assets (ON DELETE CASCADE from
-- engagements) in the `engagement-documents` bucket. Anything a module must
-- keep beyond an engagement's life (e.g. GovernanceOS evidence) needs a
-- store with no engagement ownership. Files are COPIED here, never moved,
-- so ConsultOS behaviour is unchanged.
--
-- Integrity: sha256 is computed server-side at write time
-- (lib/platform/files.ts) and is NOT NULL — the row states exactly which
-- bytes were relied on.
--
-- Access: same posture as `engagement-documents` — private bucket, no
-- storage.objects policies, service-role only. Metadata rows are readable by
-- workspace members; writes go through the trusted server helper (service
-- role), so there is no authenticated insert/update/delete policy. Rows are
-- never deleted by the application (retention is a later decision).
--
-- Rollback path (manual):
--   drop table if exists public.stored_files;
--   delete from storage.buckets where id = 'slate-durable-files';  -- only if empty
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.stored_files (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspaces(id) on delete restrict,
  owner_module             text not null check (owner_module in ('consultos', 'buildos', 'ventureos', 'governanceos', 'platform')),
  bucket                   text not null default 'slate-durable-files',
  path                     text not null,
  sha256                   text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes               bigint not null check (size_bytes >= 0),
  mime_type                text not null,
  original_filename        text,
  -- Where the bytes came from, if copied from another store (lineage only,
  -- no FK: the source may later be deleted).
  source_kind              text check (source_kind in ('upload', 'input_asset_copy', 'generated')),
  source_ref               uuid,
  uploaded_by_profile_id   uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  unique (bucket, path)
);

create index if not exists stored_files_workspace_module_idx
  on public.stored_files (workspace_id, owner_module, created_at desc);
create index if not exists stored_files_sha256_idx
  on public.stored_files (workspace_id, sha256);

alter table public.stored_files enable row level security;

-- Explicit privileges (see 0022 note): members read metadata; only the
-- trusted server path (service role) writes.
revoke all on table public.stored_files from anon;
revoke insert, update, delete, truncate on table public.stored_files from authenticated;
grant select on table public.stored_files to authenticated;
grant all on table public.stored_files to service_role;

drop policy if exists stored_files_member_read on public.stored_files;
create policy stored_files_member_read on public.stored_files
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'slate-durable-files',
  'slate-durable-files',
  false,
  26214400,                                   -- 25 MiB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/json',
    'text/plain',
    'text/csv',
    'text/markdown',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies: service-role only, exactly like
-- `engagement-documents` (0010).
