export type ProposalStatus =
  | "draft"
  | "needs-review"
  | "approved"
  | "sent-placeholder"
  | "accepted-placeholder";

export type ProposalOptionType =
  | "quick-win-build"
  | "ai-workflow-system"
  | "managed-ai-partner";

export type ProposalConfidence = "high" | "medium" | "low";

export interface ProposalOption {
  id: string;
  proposalId: string;
  title: string;
  type: ProposalOptionType;
  recommended: boolean;
  bestFitScenario: string;
  scopeSummary: string;
  includedOpportunityIds: string[];
  linkedRoadmapItemIds: string[];
  timeline: string;
  deliverables: string[];
  assumptions: string[];
  dependencies: string[];
  risks: string[];
  pricingPlaceholder: string;
  confidence: ProposalConfidence;
}

export interface ImplementationCredit {
  creditEligible: boolean;
  creditAmountPlaceholder: string;
  creditWindow: string;
  creditNotes: string;
}

export interface Proposal {
  id: string;
  engagementId: string;
  title: string;
  status: ProposalStatus;
  recommendedOptionId: string | null;
  options: ProposalOption[];
  implementationCredit: ImplementationCredit;
  assumptions: string[];
  dependencies: string[];
  nextStep: string;
  exportStatus: "locked" | "preview-only" | "ready-for-export-placeholder";
}
