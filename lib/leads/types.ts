import type { OpportunityArea } from "@/lib/scorecard/types";

export type LeadStatus =
  | "new"
  | "needs-review"
  | "high-fit"
  | "diagnostic-requested"
  | "nurture"
  | "disqualified"
  | "converted";

export type LeadSource =
  | "public-scorecard"
  | "referral"
  | "outbound"
  | "event"
  | "partner";

export type PracticeArea = "AI Systems" | "Custom Development" | "Venture Studio";

export type FitCategoryId =
  | "prime"
  | "good"
  | "nurture"
  | "disqualify";

export interface FitCategory {
  id: FitCategoryId;
  label: string;
  short: string;
  threshold: number;
  description: string;
}

export interface FitDimension {
  id:
    | "business-value"
    | "budget"
    | "pain-intensity"
    | "technical-readiness"
    | "buyer-readiness"
    | "expansion";
  label: string;
  value: number; // 0–100
  note: string;
}

export interface QualificationSignal {
  id: string;
  label: string;
  detail: string;
  direction: "positive" | "watch" | "negative";
}

export interface ProspectScores {
  ai: number;
  friction: number;
  systems: number;
}

export interface Lead {
  id: string;
  companyName: string;
  industry: string;
  employeeRange: string;
  revenueRange?: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  source: LeadSource;
  practiceArea: PracticeArea;
  status: LeadStatus;
  createdAt: string;
  lastActivityAt: string;
  scorecardCompletedAt: string;
  prospectScores: ProspectScores;
  internalFitScore: number;
  fitDimensions: FitDimension[];
  qualificationSignals: QualificationSignal[];
  recommendedAction: {
    headline: string;
    detail: string;
    cta: string;
  };
  opportunityAreas: OpportunityArea[];
  riskNotes: string[];
  notes: string[];
}
