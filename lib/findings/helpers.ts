import type {
  FindingCategory,
  FindingConfidence,
  FindingReviewStatus,
  SourceRefType,
} from "./types";

export const REVIEW_STATUS_LABEL: Record<FindingReviewStatus, string> = {
  draft: "Draft",
  "needs-review": "Needs Review",
  approved: "Approved",
  edited: "Edited",
  rejected: "Rejected",
  "report-ready": "Report Ready",
};

export const REVIEW_STATUS_TONE: Record<
  FindingReviewStatus,
  "info" | "warning" | "success" | "neutral" | "risk" | "brand"
> = {
  draft: "neutral",
  "needs-review": "warning",
  approved: "success",
  edited: "info",
  rejected: "risk",
  "report-ready": "brand",
};

export const CONFIDENCE_LABEL: Record<FindingConfidence, string> = {
  high: "High Confidence",
  medium: "Medium Confidence",
  low: "Low Confidence",
  "needs-evidence": "Needs Evidence",
};

export const CONFIDENCE_TONE: Record<
  FindingConfidence,
  "success" | "info" | "warning" | "risk"
> = {
  high: "success",
  medium: "info",
  low: "warning",
  "needs-evidence": "risk",
};

export const CATEGORY_TONE: Record<
  FindingCategory,
  "info" | "warning" | "neutral" | "brand" | "ai" | "success"
> = {
  "Workflow Friction": "warning",
  "Systems Gap": "warning",
  "Data Readiness": "info",
  "Adoption Risk": "warning",
  "Governance / Risk": "warning",
  "Revenue Opportunity": "success",
  "Back-office Efficiency": "info",
  "Customer Experience": "ai",
};

export const SOURCE_TYPE_LABEL: Record<SourceRefType, string> = {
  "stakeholder-response": "Stakeholder response",
  "uploaded-document": "Uploaded document",
  "scorecard-answer": "Scorecard answer",
  "consultant-note": "Consultant note",
};

export type FindingFilterId = "all" | FindingReviewStatus;

export const FINDING_FILTERS: Array<{ id: FindingFilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs-review", label: "Needs Review" },
  { id: "approved", label: "Approved" },
  { id: "report-ready", label: "Report Ready" },
  { id: "rejected", label: "Rejected" },
  { id: "draft", label: "Draft" },
];

export const FINDING_CATEGORIES: FindingCategory[] = [
  "Workflow Friction",
  "Systems Gap",
  "Data Readiness",
  "Adoption Risk",
  "Governance / Risk",
  "Revenue Opportunity",
  "Back-office Efficiency",
  "Customer Experience",
];
