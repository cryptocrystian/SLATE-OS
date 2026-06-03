-- SLATE — Sprint S3-B (Attio Read Context Implementation)
-- Canon: docs/42_ATTIO_CRM_SYSTEM_OF_RECORD_CANON.md § 11
--
-- Adds the single column required for deterministic CRM context lookup:
--   public.accounts.attio_company_id text null
--
-- Scope discipline (per docs/42 § 11 + § 16.5):
--   - Additive only. No NOT NULL, no CHECK, no RLS policy change.
--   - Workspace scope inherits from the parent `accounts` row's existing
--     RLS posture. No new policy is required.
--   - Idempotent: safe to re-run via the `if not exists` pattern.
--
-- Intentionally NOT shipping in S3-B (deferred per docs/42 § 11):
--   - `stakeholder_intake_sessions.attio_person_id`
--   - `engagements.attio_deal_id`
--   These remain optional cross-links that a future sprint can add when
--   per-stakeholder or per-deal enrichment becomes operationally useful.
--
-- Attio ID format: Attio record IDs are UUIDs at the API layer but the
-- column is `text` so the SLATE side does not depend on UUID-shape
-- assumptions. A future provider with different ID shapes can reuse the
-- column unchanged.

alter table public.accounts
  add column if not exists attio_company_id text;

-- Index for deterministic lookup of `accounts` rows by Attio company ID.
-- Partial index because most rows will be null until the operator links
-- them.
create index if not exists accounts_attio_company_id_idx
  on public.accounts (attio_company_id)
  where attio_company_id is not null;
