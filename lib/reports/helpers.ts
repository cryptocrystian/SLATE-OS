import type {
  ReportConfidence,
  ReportSectionStatus,
  ReportSectionType,
  ReportStatus,
} from "./types";

export const SECTION_ORDER: ReportSectionType[] = [
  "executive-summary",
  "business-context",
  "systems-snapshot",
  "readiness-assessment",
  "workflow-friction",
  "stakeholder-synthesis",
  "opportunity-portfolio",
  "priority-recommendations",
  "governance-risk",
  "roadmap",
  "recommended-next-step",
  "appendix",
];

export const SECTION_LABEL: Record<ReportSectionType, string> = {
  "executive-summary": "Executive Summary",
  "business-context": "Business Context",
  "systems-snapshot": "Current-State Systems Snapshot",
  "readiness-assessment": "AI Readiness Assessment",
  "workflow-friction": "Workflow Friction Analysis",
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
