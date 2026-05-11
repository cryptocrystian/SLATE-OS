/**
 * Thin internal mapping from `ReportExhibitSlot` → report-section
 * grouping for the Sprint 1 internal report preview, per
 * `docs/17_PHASE_1B_REPORT_EXHIBIT_WIRING_CANON.md` § Report Section
 * Slot Vocabulary.
 *
 * This module is intentionally static: just a constant table.
 *
 *   - No DB / Supabase imports.
 *   - No React imports.
 *   - No `report_sections` mutation logic.
 *   - No Group-B slots (Benchmark / Waterfall / ROI Bridge are gated
 *     by `docs/14` / `docs/15` and stay preview-only).
 *
 * The future Sprint 2 sprint owns how a section row persists a slot
 * reference. Until then, the report-page renderer reads from this
 * table directly to decide which exhibit lives where.
 */

import type { ReportExhibitSlot } from "@/lib/charts/adapters/types";
import type { ReportSectionType } from "@/lib/reports/types";

/**
 * Report-section grouping. Matches the 12-section advisory report
 * vocabulary at the level of "which slot belongs in which section
 * family" — not the persisted section row id.
 */
export type ReportSectionKey =
  | "executive_summary"
  | "diagnostic"
  | "findings"
  | "roadmap";

export interface ReportSlotDefinition {
  slot: ReportExhibitSlot;
  sectionKey: ReportSectionKey;
  /** Short header displayed above the exhibit in the internal report preview. */
  title: string;
  /** One-line operator-facing description of what the slot shows. */
  description: string;
}

/**
 * Authoritative Group-A slot table. Order = render order in the
 * internal report preview. Adding a slot row is a canon amendment
 * (`docs/17` § Report Section Slot Vocabulary); not a silent edit.
 *
 * Group B (Benchmark Comparison Bars, AI-Savings Waterfall, ROI Bridge)
 * is intentionally absent. Wiring those slots requires the
 * corresponding canon to reach its next data gate (`docs/14` for
 * benchmark, `docs/15` for financial).
 */
export const GROUP_A_REPORT_SLOTS: readonly ReportSlotDefinition[] = [
  {
    slot: "executive_summary_portfolio",
    sectionKey: "executive_summary",
    title: "Executive Summary · 2×2",
    description:
      "Single-page visual summary of the engagement's opportunity portfolio (impact × complexity, bubble = business impact, ring = recommended).",
  },
  {
    slot: "findings_risk_priority",
    sectionKey: "findings",
    title: "Risk-Adjusted Priority Quadrant",
    description:
      "Analytical 2×2 grouping opportunities by impact × complexity with risk-band coloring; 50/50 midlines (analytical convention).",
  },
  {
    slot: "diagnostic_capability_maturity",
    sectionKey: "diagnostic",
    title: "Capability Maturity Heatmap",
    description:
      "Capability × dimension maturity grid (0–39 risk · 40–59 warning · 60–79 info · 80–100 success). Requires capability/dimension tagging on findings.",
  },
  {
    slot: "diagnostic_stakeholder_coverage",
    sectionKey: "diagnostic",
    title: "Stakeholder Coverage Matrix",
    description:
      "Role × topic intake-coverage grid with the 4-tone evidence-strength scale. Requires topic tagging on intake responses.",
  },
  {
    slot: "roadmap_90_day_sequence",
    sectionKey: "roadmap",
    title: "Roadmap Gantt with Dependencies",
    description:
      "30/60/90-day timeline with right-angle dependency arrows and a brand-primary Today marker.",
  },
] as const;

export type GroupAReportSlot = (typeof GROUP_A_REPORT_SLOTS)[number]["slot"];

/**
 * Set of all Group-A slot identifiers. Used by `isGroupAReportSlot`
 * and by Sprint 2 to validate persisted `report_sections.exhibit_slot`
 * values at the application boundary (in addition to the SQL CHECK
 * constraint added by migration `0012_report_section_exhibit_slot.sql`).
 */
const GROUP_A_REPORT_SLOT_SET: ReadonlySet<string> = new Set(
  GROUP_A_REPORT_SLOTS.map((s) => s.slot),
);

/**
 * Group-B slot identifiers — explicitly enumerated so callers can
 * surface a clear "gated" message if they encounter one. Mirrors the
 * three Group-B exhibits in `docs/17`. **Never authorize wiring of
 * these values until `docs/14` / `docs/15` advance their data gates.**
 */
export const GROUP_B_REPORT_SLOT_IDS = [
  "benchmark_comparison_bars",
  "ai_savings_waterfall",
  "roi_bridge",
] as const;

/**
 * Type predicate. Returns true ONLY for the five Group-A slot values.
 * Group B values, unknown strings, null, undefined, numbers, etc. all
 * return false. This is the canonical application-side guard at every
 * DB → TS boundary (mappers, action handlers, render-time gate).
 *
 * The SQL CHECK constraint (`report_sections_exhibit_slot_check`)
 * already enforces the allowlist at write-time; this predicate is
 * defense-in-depth for read paths so a future schema drift cannot
 * leak a Group-B value through to the renderer.
 */
export function isGroupAReportSlot(
  value: unknown,
): value is ReportExhibitSlot {
  return typeof value === "string" && GROUP_A_REPORT_SLOT_SET.has(value);
}

/**
 * Lenient cast: returns the value when it is a valid Group-A slot,
 * otherwise `null`. Useful at DB-read boundaries where a stray
 * non-allowlisted value should be coerced to "no slot" rather than
 * leaking through.
 */
export function assertGroupAReportSlot(
  value: unknown,
): ReportExhibitSlot | null {
  return isGroupAReportSlot(value) ? value : null;
}

/**
 * Canonical section_type → default Group-A slot map. Matches the
 * backfill in `supabase/migrations/0012_report_section_exhibit_slot.sql`
 * and the docs/17 § Group A row table byte-for-byte.
 *
 * Used by `initializeReportForEngagement` to seed `exhibit_slot` when
 * creating new sections. The five mapped sections receive their slot;
 * the other seven canonical sections receive null (no exhibit).
 */
export const DEFAULT_SLOT_BY_SECTION_TYPE: Partial<
  Record<ReportSectionType, ReportExhibitSlot>
> = {
  "executive-summary": "executive_summary_portfolio",
  "priority-recommendations": "findings_risk_priority",
  "readiness-assessment": "diagnostic_capability_maturity",
  "stakeholder-synthesis": "diagnostic_stakeholder_coverage",
  roadmap: "roadmap_90_day_sequence",
};

export function defaultSlotForSectionType(
  sectionType: ReportSectionType,
): ReportExhibitSlot | null {
  return DEFAULT_SLOT_BY_SECTION_TYPE[sectionType] ?? null;
}

/**
 * Lookup the static `ReportSlotDefinition` (title, description,
 * section_key) for a Group-A slot id. Returns `null` for unknown /
 * Group-B values so the renderer can fall back to a safe state.
 */
export function reportSlotDefinitionFor(
  slot: ReportExhibitSlot,
): ReportSlotDefinition | null {
  return GROUP_A_REPORT_SLOTS.find((s) => s.slot === slot) ?? null;
}
