import type { ProposalOptionType, ProposalStatus } from "./types";

export const OPTION_TYPE_LABEL: Record<ProposalOptionType, string> = {
  "quick-win-build": "Quick-Win Build",
  "ai-workflow-system": "AI Workflow System",
  "managed-ai-partner": "Managed AI Partner",
};

export const OPTION_TYPE_TONE: Record<
  ProposalOptionType,
  "success" | "brand" | "ai"
> = {
  "quick-win-build": "success",
  "ai-workflow-system": "brand",
  "managed-ai-partner": "ai",
};

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Draft",
  "needs-review": "Needs Review",
  approved: "Approved",
  "sent-placeholder": "Sent · placeholder",
  "accepted-placeholder": "Accepted · placeholder",
};

export const PROPOSAL_STATUS_TONE: Record<
  ProposalStatus,
  "info" | "warning" | "success" | "brand"
> = {
  draft: "info",
  "needs-review": "warning",
  approved: "success",
  "sent-placeholder": "brand",
  "accepted-placeholder": "success",
};
