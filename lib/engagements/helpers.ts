import type { EngagementStage, EngagementStatus } from "./types";

export const STAGES: EngagementStage[] = [
  "setup",
  "intake",
  "synthesis",
  "scoring",
  "report",
  "proposal",
];

export const STAGE_LABEL: Record<EngagementStage, string> = {
  setup: "Setup",
  intake: "Intake",
  synthesis: "Synthesis",
  scoring: "Scoring",
  report: "Report",
  proposal: "Proposal",
};

export const STAGE_DESCRIPTION: Record<EngagementStage, string> = {
  setup:
    "Engagement created, stakeholders identified, initial context aligned with the source scorecard.",
  intake:
    "Role-based stakeholder discovery and document collection in progress.",
  synthesis:
    "Responses and documents are being analyzed; candidate findings are drafted for human review.",
  scoring:
    "Approved findings are being prioritized into a quadrant of quick wins, strategic builds, and defers.",
  report:
    "AI Opportunity Sprint report is being assembled section by section with linked evidence.",
  proposal:
    "Tiered SOW options (Quick-Win Build, AI Workflow System, Managed AI Partner) are being prepared for the client.",
};

export const STATUS_LABEL: Record<EngagementStatus, string> = {
  setup: "Setup",
  active: "Active",
  "needs-review": "Needs Review",
  blocked: "Blocked",
  "ready-for-report": "Ready for Report",
  "proposal-draft": "Proposal Draft",
  completed: "Completed",
  paused: "Paused",
};

export const STATUS_TONE: Record<
  EngagementStatus,
  "info" | "warning" | "success" | "neutral" | "brand" | "risk"
> = {
  setup: "info",
  active: "info",
  "needs-review": "warning",
  blocked: "risk",
  "ready-for-report": "brand",
  "proposal-draft": "brand",
  completed: "success",
  paused: "neutral",
};

export type EngagementFilterId = "all" | EngagementStage | "completed";

export const ENGAGEMENT_FILTERS: Array<{
  id: EngagementFilterId;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "setup", label: "Setup" },
  { id: "intake", label: "Intake" },
  { id: "synthesis", label: "Synthesis" },
  { id: "scoring", label: "Scoring" },
  { id: "report", label: "Report" },
  { id: "proposal", label: "Proposal" },
  { id: "completed", label: "Completed" },
];

export function stageIndex(stage: EngagementStage) {
  return STAGES.indexOf(stage);
}
