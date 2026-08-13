import type {
  ReportConfidence,
  ReportSectionStatus,
  ReportSectionType,
  ReportStatus,
} from "./types";

// Consolidated advisory-report arc (was 12 sections; trimmed to 7 narrative
// + appendix to remove the cross-section repetition and padding a 12-section
// scaffold produced). Dropped types (systems-snapshot, readiness-assessment,
// governance-risk, recommended-next-step) fold their job into a neighbor via
// the per-section charters in `lib/ai/report-section-synthesis.ts`:
//   - systems-snapshot + readiness-assessment → workflow-friction
//     (now "Current State & Operating Friction")
//   - governance-risk + recommended-next-step → priority-recommendations
// The full `ReportSectionType` union is intentionally retained for backward
// compatibility with reports scaffolded before this change.
export const SECTION_ORDER: ReportSectionType[] = [
  "executive-summary",
  "business-context",
  "workflow-friction",
  "stakeholder-synthesis",
  "opportunity-portfolio",
  "priority-recommendations",
  "roadmap",
  "appendix",
];

export const SECTION_LABEL: Record<ReportSectionType, string> = {
  "executive-summary": "Executive Summary",
  "business-context": "Business Context",
  "systems-snapshot": "Current-State Systems Snapshot",
  "readiness-assessment": "AI Readiness Assessment",
  "workflow-friction": "Current State & Operating Friction",
  "stakeholder-synthesis": "Stakeholder Discovery Synthesis",
  "opportunity-portfolio": "AI Opportunity Portfolio",
  "priority-recommendations": "Priority Recommendations",
  "governance-risk": "Risk and Governance Notes",
  roadmap: "30/60/90-Day Roadmap",
  "recommended-next-step": "Recommended Next Step",
  appendix: "Appendix",
};

export const SECTION_STATUS_LABEL: Record<ReportSectionStatus, string> = {
  "not-started": "Not Started",
  drafted: "Drafted",
  "needs-review": "Needs Review",
  approved: "Approved",
  final: "Final",
};

export const SECTION_STATUS_TONE: Record<
  ReportSectionStatus,
  "info" | "warning" | "success" | "neutral" | "brand"
> = {
  "not-started": "neutral",
  drafted: "info",
  "needs-review": "warning",
  approved: "success",
  final: "brand",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Draft",
  "needs-review": "Needs Review",
  approved: "Approved",
  final: "Final",
};

export const REPORT_STATUS_TONE: Record<
  ReportStatus,
  "info" | "warning" | "success" | "brand"
> = {
  draft: "info",
  "needs-review": "warning",
  approved: "success",
  final: "brand",
};

export const CONFIDENCE_LABEL: Record<ReportConfidence, string> = {
  high: "High Confidence",
  medium: "Medium Confidence",
  low: "Low Confidence",
  "needs-evidence": "Needs Evidence",
};

export const CONFIDENCE_TONE: Record<
  ReportConfidence,
  "success" | "info" | "warning" | "risk"
> = {
  high: "success",
  medium: "info",
  low: "warning",
  "needs-evidence": "risk",
};

export type ReportFilterId = "all" | ReportSectionStatus;

export const REPORT_FILTERS: Array<{ id: ReportFilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs-review", label: "Needs Review" },
  { id: "approved", label: "Approved" },
  { id: "drafted", label: "Drafted" },
  { id: "final", label: "Final" },
  { id: "not-started", label: "Not Started" },
];
