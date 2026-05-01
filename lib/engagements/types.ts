export type EngagementStage =
  | "setup"
  | "intake"
  | "synthesis"
  | "scoring"
  | "report"
  | "proposal";

export type EngagementStatus =
  | "setup"
  | "active"
  | "needs-review"
  | "blocked"
  | "ready-for-report"
  | "proposal-draft"
  | "completed"
  | "paused";

export type EngagementType =
  | "AI Opportunity Sprint"
  | "Workflow Automation Assessment"
  | "Systems Readiness Review";

export type PanelTone =
  | "info"
  | "warning"
  | "success"
  | "neutral"
  | "risk"
  | "brand";

export interface PanelStatusBadge {
  tone: PanelTone;
  label: string;
}

export interface IntakeStatus {
  status: PanelStatusBadge;
  stakeholdersInvited: number;
  stakeholdersResponded: number;
  rolesCovered: string[];
  rolesMissing: string[];
  lastResponseAt?: string;
  nextAction: string;
}

export interface DocumentStatus {
  status: PanelStatusBadge;
  requested: number;
  received: number;
  reviewed: number;
  reviewState: string;
  nextAction: string;
}

export interface FindingsStatus {
  status: PanelStatusBadge;
  candidate: number;
  approved: number;
  rejected: number;
  reviewState: string;
  nextAction: string;
}

export interface OpportunityScoringStatus {
  status: PanelStatusBadge;
  identified: number;
  quickWins: number;
  strategicBuilds: number;
  defer: number;
  scoringState: string;
  nextAction: string;
}

export interface ReportStatus {
  status: PanelStatusBadge;
  sectionsTotal: number;
  sectionsDrafted: number;
  sectionsApproved: number;
  state: string;
  nextAction: string;
}

export interface ProposalStatus {
  status: PanelStatusBadge;
  options: number;
  recommendedOption: string | null;
  state: string;
  nextAction: string;
}

export interface ScorecardSnapshot {
  ai: number;
  friction: number;
  systems: number;
  classification: string;
}

export interface Engagement {
  id: string;
  name: string;
  accountName: string;
  companyName: string;
  industry: string;
  practiceArea: "AI Systems" | "Custom Development" | "Venture Studio";
  linkedLeadId?: string;
  engagementType: EngagementType;
  status: EngagementStatus;
  currentStage: EngagementStage;
  owner: string;
  createdAt: string;
  targetDate: string;
  lastActivityAt: string;
  nextMilestone: string;
  recommendedAction: {
    headline: string;
    detail: string;
    cta: string;
  };
  scorecardSummary?: ScorecardSnapshot;
  intake: IntakeStatus;
  documents: DocumentStatus;
  findings: FindingsStatus;
  opportunities: OpportunityScoringStatus;
  report: ReportStatus;
  proposal: ProposalStatus;
  riskNotes: string[];
  dependencies: string[];
  notes: string[];
}
