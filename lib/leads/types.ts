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

/**
 * Trust posture for a lead, derived from the scorecard's anti-abuse +
 * email-quality pipeline at submission time. `unverified` is the
 * default — operators can later promote a lead to `verified` once
 * email-click verification ships, or `flagged` / `rejected` for
 * suspicious submissions.
 */
export type LeadTrustStatus =
  | "verified"
  | "unverified"
  | "flagged"
  | "rejected";

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
  trustStatus: LeadTrustStatus;
  trustReasons: string[];
}
