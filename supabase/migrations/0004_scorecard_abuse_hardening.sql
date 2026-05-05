-- SLATE — Persistence/Auth Step 4.5
-- Lightweight anti-abuse + email-quality metadata for the public
-- scorecard. Adds quality / verification / abuse columns to
-- scorecard_submissions plus a small trust-status pair on leads so
-- operators can recognize low-trust rows in the inbox without
-- redesigning the lead surface.
-- Idempotent: safe to re-run.

-- -----------------------------------------------------------------------------
-- scorecard_submissions: email + abuse metadata
-- -----------------------------------------------------------------------------

alter table public.scorecard_submissions
  add column if not exists email_normalized text;
alter table public.scorecard_submissions
  add column if not exists email_domain text;
alter table public.scorecard_submissions
  add column if not exists email_quality text default 'unknown';
alter table public.scorecard_submissions
  add column if not exists email_verified boolean not null default false;
alter table public.scorecard_submissions
  add column if not exists anti_abuse_status text default 'accepted';
alter table public.scorecard_submissions
  add column if not exists anti_abuse_reasons text[] not null default '{}';
alter table public.scorecard_submissions
  add column if not exists submission_duration_ms integer;
alter table public.scorecard_submissions
  add column if not exists honeypot_value text;
alter table public.scorecard_submissions
  add column if not exists client_fingerprint_hash text;

-- Permitted values are enforced in application code; the columns stay
-- text-typed (rather than enum) so the blocklist / quality vocabulary
-- can evolve without a migration.

create index if not exists scorecard_submissions_email_normalized_recent_idx
  on public.scorecard_submissions (email_normalized, submitted_at desc)
  where email_normalized is not null;
create index if not exists scorecard_submissions_email_domain_recent_idx
  on public.scorecard_submissions (email_domain, submitted_at desc)
  where email_domain is not null;
create index if not exists scorecard_submissions_anti_abuse_status_idx
  on public.scorecard_submissions (anti_abuse_status, submitted_at desc);

-- -----------------------------------------------------------------------------
-- leads: trust status surfaced in the operator inbox
-- -----------------------------------------------------------------------------

alter table public.leads
  add column if not exists trust_status text not null default 'unverified';
alter table public.leads
  add column if not exists trust_reasons text[] not null default '{}';

create index if not exists leads_trust_status_idx
  on public.leads (workspace_id, trust_status, last_activity_at desc);

-- RLS posture is unchanged: scorecard_submissions and leads are
-- operator-only via the existing 0002 policies, no anon read/write.
