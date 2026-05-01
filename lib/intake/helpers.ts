import type {
  ResponseQuality,
  RoleCoverage,
  StakeholderRole,
  StakeholderStatus,
} from "./types";

export const ROLE_LABEL: Record<StakeholderRole, string> = {
  executive: "Executive · Owner",
  operations: "Operations Leader",
  sales: "Sales Leader",
  marketing: "Marketing Leader",
  finance: "Finance · Admin",
  it: "IT · Technical Contact",
  frontline: "Frontline User",
  "customer-success": "Customer Success",
  other: "Other",
};

export const STATUS_LABEL: Record<StakeholderStatus, string> = {
  invited: "Invited",
  "in-progress": "In Progress",
  completed: "Completed",
  "needs-follow-up": "Needs Follow-up",
  "not-started": "Not Started",
};

export const STATUS_TONE: Record<
  StakeholderStatus,
  "info" | "warning" | "success" | "neutral" | "risk"
> = {
  invited: "info",
  "in-progress": "info",
  completed: "success",
  "needs-follow-up": "warning",
  "not-started": "neutral",
};

export const QUALITY_LABEL: Record<ResponseQuality, string> = {
  strong: "Strong",
  adequate: "Adequate",
  thin: "Thin",
  missing: "Missing",
};

export const QUALITY_TONE: Record<
  ResponseQuality,
  "success" | "info" | "warning" | "risk"
> = {
  strong: "success",
  adequate: "info",
  thin: "warning",
  missing: "risk",
};

export const COVERAGE_LABEL: Record<RoleCoverage, string> = {
  covered: "Covered",
  partial: "Partial",
  missing: "Missing",
};

export const COVERAGE_TONE: Record<
  RoleCoverage,
  "success" | "warning" | "risk"
> = {
  covered: "success",
  partial: "warning",
  missing: "risk",
};

export type IntakeFilterId = "all" | StakeholderStatus;

export const INTAKE_FILTERS: Array<{ id: IntakeFilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "in-progress", label: "In Progress" },
  { id: "needs-follow-up", label: "Needs Follow-up" },
  { id: "not-started", label: "Not Started" },
];
