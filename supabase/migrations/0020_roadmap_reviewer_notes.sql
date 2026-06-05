-- SLATE — Sprint S7 (Roadmap AI Drafting + Sequencing)
-- Canon: docs/48_ROADMAP_AI_DRAFTING.md § 2
--
-- Adds the single column required for roadmap-item rejection-reason
-- capture, matching the S5 findings.reviewer_note + S6
-- opportunities.reviewer_notes pattern:
--   public.roadmap_items.reviewer_notes text null
--
-- Scope discipline (per docs/48 § 2 + docs/39 § 11):
--   - Additive only. Nullable. No NOT NULL, no CHECK, no default.
--   - No RLS policy change. Workspace scope inherits from the parent
--     roadmap_items row's existing policy
--     (roadmap_items_operator_full, authenticated-only).
--   - Idempotent: safe to re-run via the `if not exists` pattern.
--
-- Why a column instead of activity-event metadata only:
--   The operator UI surfaces rejection reasons on the roadmap item
--   card itself (mirroring the S5/S6 pattern). Storing in
--   `reviewer_notes` keeps the rejection rationale workspace-scoped via
--   the existing RLS policy and avoids reaching back into the activity
--   ledger to render card metadata.
--
-- Boundary:
--   - No PII. Operator-typed rejection text only. Server-side validated
--     to 10-500 chars (or empty); never carries raw opportunity text,
--     raw finding text, raw stakeholder text, tokens, or external IDs.
--   - No Send to Client surface, no public route, no Group-B field.

alter table public.roadmap_items
  add column if not exists reviewer_notes text;
