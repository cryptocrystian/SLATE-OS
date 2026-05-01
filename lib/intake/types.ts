export type StakeholderRole =
  | "executive"
  | "operations"
  | "sales"
  | "marketing"
  | "finance"
  | "it"
  | "frontline"
  | "customer-success"
  | "other";

export type StakeholderStatus =
  | "invited"
  | "in-progress"
  | "completed"
  | "needs-follow-up"
  | "not-started";

export type ResponseQuality = "strong" | "adequate" | "thin" | "missing";

export interface Stakeholder {
  id: string;
  name: string;
  title: string;
  role: StakeholderRole;
  department?: string;
  status: StakeholderStatus;
  completionPercent: number;
  responseQuality: ResponseQuality;
  lastActivity: string;
  summary: string;
  keySignals: string[];
  openQuestions: string[];
  riskFlags: string[];
}

export type RoleCoverage = "covered" | "partial" | "missing";

export interface RoleCoverageRow {
  role: StakeholderRole;
  required: boolean;
  status: RoleCoverage;
  stakeholderCount: number;
  coverageNote: string;
}

export type DocumentStatus =
  | "requested"
  | "received"
  | "reviewed"
  | "missing"
  | "outdated";

export interface SupportingInput {
  id: string;
  title: string;
  type:
    | "operations-doc"
    | "process-map"
    | "data-export"
    | "system-screenshot"
    | "policy-doc"
    | "report"
    | "other";
  source: string;
  status: DocumentStatus;
  evidenceQuality: "strong" | "adequate" | "thin" | "unverified";
  linkedStakeholder?: string;
  linkedRole?: StakeholderRole;
  summary: string;
}

export interface IntakeRecord {
  engagementId: string;
  stakeholders: Stakeholder[];
  roleCoverage: RoleCoverageRow[];
  supportingInputs: SupportingInput[];
  followUps: Array<{
    id: string;
    label: string;
    detail: string;
    target: string;
    severity: "high" | "medium" | "low";
  }>;
  intakeRiskNotes: string[];
}
