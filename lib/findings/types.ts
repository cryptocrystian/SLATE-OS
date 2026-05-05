export type FindingCategory =
  | "Workflow Friction"
  | "Systems Gap"
  | "Data Readiness"
  | "Adoption Risk"
  | "Governance / Risk"
  | "Revenue Opportunity"
  | "Back-office Efficiency"
  | "Customer Experience";

export type FindingReviewStatus =
  | "draft"
  | "needs-review"
  | "approved"
  | "edited"
  | "rejected"
  | "report-ready";

export type FindingConfidence = "high" | "medium" | "low" | "needs-evidence";

export type SourceRefType =
  | "stakeholder-response"
  | "uploaded-document"
  | "scorecard-answer"
  | "consultant-note";

export interface SourceRef {
  id: string;
  type: SourceRefType;
  source: string;
  role?: string;
  excerpt: string;
  strength: "strong" | "adequate" | "thin";
}

export interface Finding {
  id: string;
  engagementId: string;
  category: FindingCategory;
  statement: string;
  summary: string;
  evidenceSummary: string;
  confidence: FindingConfidence;
  reviewStatus: FindingReviewStatus;
  suggestedImpact: string;
  sourceRefs: SourceRef[];
  assumptionFlag?: string;
  reviewerNote?: string;
  aiDrafted?: boolean;
}
