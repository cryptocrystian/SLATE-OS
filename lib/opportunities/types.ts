export type OpportunityCategory =
  | "Sales / Revenue Operations"
  | "Client Intake / Onboarding"
  | "Proposal / Document Generation"
  | "Customer Support / Triage"
  | "Internal Knowledge / Retrieval"
  | "Reporting / Analytics"
  | "Back-office Automation"
  | "Systems Integration"
  | "Governance / Risk Controls";

export type OpportunityPriority =
  | "quick-win"
  | "strategic-build"
  | "low-priority"
  | "defer"
  | "avoid";

export type OpportunityQuadrant =
  | "quick-win"
  | "strategic-build"
  | "low-priority"
  | "defer-avoid";

export type EvidenceStrength = "strong" | "adequate" | "thin";

export type OpportunityStatus =
  | "draft"
  | "scored"
  | "selected"
  | "deferred"
  | "rejected";

export interface Opportunity {
  id: string;
  engagementId: string;
  title: string;
  category: OpportunityCategory;
  description: string;
  priority: OpportunityPriority;
  /** Computed (or hand-set) matrix position. */
  quadrant: OpportunityQuadrant;
  /** All scores are 0–100, directional only. */
  businessImpactScore: number;
  complexityScore: number;
  riskScore: number;
  timeToValueScore: number;
  adoptionLikelihoodScore: number;
  strategicValueScore: number;
  evidenceStrength: EvidenceStrength;
  relatedFindingIds: string[];
  sourceSummary: string;
  recommendedAction: string;
  implementationShape: string;
  dependencies: string[];
  risks: string[];
  successSignals: string[];
  /** Lifecycle status for persisted opportunities. Mock fixtures may
   *  omit this. */
  status?: OpportunityStatus;
}
