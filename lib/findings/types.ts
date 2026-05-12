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
  /**
   * Last persisted update timestamp (ISO 8601 UTC). Surfaced from
   * `findings.updated_at` for freshness derivation in chart adapters.
   * Mock fixtures omit this field.
   */
  updatedAt?: string | null;
  /**
   * Last reviewer-touched timestamp (ISO 8601 UTC). Surfaced from
   * `findings.last_reviewed_at`. Distinct from `updatedAt` — captures
   * specifically when the review state was last changed (approve,
   * needs-review, report-ready). Mock fixtures omit this field.
   */
  lastReviewedAt?: string | null;
}
