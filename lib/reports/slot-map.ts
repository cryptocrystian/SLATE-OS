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
