-- SLATE — Sprint S6 (Opportunities AI Drafting + Quadrant Approval)
-- Canon: docs/45_OPPORTUNITIES_AI_DRAFTING.md § 2
--
-- Adds the single column required for opportunity rejection-reason
-- capture, matching the S5 findings.reviewer_note pattern:
--   public.opportunities.reviewer_notes text null
--
-- Scope discipline (per docs/45 § 2 + docs/39 § 11):
--   - Additive only. Nullable. No NOT NULL, no CHECK, no default.
--   - No RLS policy change. Workspace scope inherits from the parent
--     `opportunities` row's existing policy
--     (opportunities_operator_full, authenticated-only).
--   - Idempotent: safe to re-run via the `if not exists` pattern.
--
-- Why a column instead of activity-event metadata only:
--   The operator UI surfaces rejection reasons on the opportunity card
--   itself (mirroring the S5 finding pattern). Storing in
--   `reviewer_notes` keeps the rejection rationale workspace-scoped via
--   the existing RLS policy and avoids reaching back into the activity
--   ledger to render card metadata.
--
-- Boundary:
--   - No PII. Operator-typed rejection text only. Server-side validated
--     to 10-500 chars (or empty); never carries raw stakeholder text,
--     raw answer text, tokens, or external IDs.
--   - No Send to Client surface, no public route, no Group-B field.

alter table public.opportunities
  add column if not exists reviewer_notes text;
