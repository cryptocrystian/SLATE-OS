-- SLATE — Phase 1B Report Exhibit Wiring Sprint 2
-- Persist a Group-A `ReportExhibitSlot` reference on each report section.
--
-- Why a column and not a JSONB body block:
--   - report_sections does not yet carry a constrained rich-text body;
--     the existing columns (`summary`, `draft_preview`, `evidence_notes`,
--     `reviewer_note`) are scalar.
--   - A nullable `exhibit_slot text` column is reversible (rollback =
--     drop the column), explicit, queryable, and validatable at the SQL
--     boundary.
--   - Per docs/17 § Report Wiring Sequence Sprint 2, this is option (a)
--     of the three options the canon enumerated. The constrained block
--     model is deferred until a future sprint needs richer body content.
--
-- Boundary:
--   - Only Group-A slot values are accepted by the CHECK constraint.
--     Group B (Benchmark Comparison Bars, AI-Savings Waterfall, ROI
--     Bridge) is REJECTED at the SQL boundary per docs/14 / docs/15.
--   - Null is allowed — sections that do not reference an exhibit
--     simply leave the column null.
--   - No RLS change; the existing `report_sections_operator_full`
--     policy already gates writes by workspace.
--
-- Rollback path (manual):
--   alter table public.report_sections
--     drop constraint if exists report_sections_exhibit_slot_check;
--   alter table public.report_sections
--     drop column if exists exhibit_slot;
--
-- Idempotent: safe to re-run.

-- -----------------------------------------------------------------------------
-- Column
-- -----------------------------------------------------------------------------

alter table public.report_sections
  add column if not exists exhibit_slot text;

-- -----------------------------------------------------------------------------
-- CHECK constraint — Group A allowlist
-- -----------------------------------------------------------------------------
-- Adding via DO block so the migration stays re-runnable; ADD CONSTRAINT
-- IF NOT EXISTS is not supported by Postgres for CHECK constraints in
-- all supported versions.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'report_sections_exhibit_slot_check'
      and conrelid = 'public.report_sections'::regclass
  ) then
    alter table public.report_sections
      add constraint report_sections_exhibit_slot_check
      check (
        exhibit_slot is null
        or exhibit_slot in (
          'executive_summary_portfolio',
          'findings_risk_priority',
          'diagnostic_capability_maturity',
          'diagnostic_stakeholder_coverage',
          'roadmap_90_day_sequence'
        )
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Index — slot lookup
-- -----------------------------------------------------------------------------
-- Engagement-scoped slot lookups are the dominant access pattern (the
-- report page filters by engagement_id then groups by exhibit_slot).
-- Partial index keeps the index small — only rows with a slot are
-- indexed.

create index if not exists report_sections_exhibit_slot_idx
  on public.report_sections (engagement_id, exhibit_slot)
  where exhibit_slot is not null;

-- -----------------------------------------------------------------------------
-- Backfill — assign default Group-A slots by canonical section_type
-- -----------------------------------------------------------------------------
-- Only update rows where exhibit_slot is currently NULL. Existing rows
-- with a slot already set (e.g. from a later application-level seed)
-- are preserved. This backfill is idempotent: a re-run will no-op once
-- the slots are present.
--
-- Mapping (per docs/17 § Group A row table):
--   executive_summary       → executive_summary_portfolio
--   priority_recommendations → findings_risk_priority
--   readiness_assessment    → diagnostic_capability_maturity
--   stakeholder_synthesis   → diagnostic_stakeholder_coverage
--   roadmap                 → roadmap_90_day_sequence

update public.report_sections
   set exhibit_slot = 'executive_summary_portfolio'
 where section_type = 'executive_summary'
   and exhibit_slot is null;

update public.report_sections
   set exhibit_slot = 'findings_risk_priority'
 where section_type = 'priority_recommendations'
   and exhibit_slot is null;

update public.report_sections
   set exhibit_slot = 'diagnostic_capability_maturity'
 where section_type = 'readiness_assessment'
   and exhibit_slot is null;

update public.report_sections
   set exhibit_slot = 'diagnostic_stakeholder_coverage'
 where section_type = 'stakeholder_synthesis'
   and exhibit_slot is null;

update public.report_sections
   set exhibit_slot = 'roadmap_90_day_sequence'
 where section_type = 'roadmap'
   and exhibit_slot is null;
