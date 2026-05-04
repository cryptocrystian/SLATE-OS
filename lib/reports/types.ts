export type ReportSectionType =
  | "executive-summary"
  | "business-context"
  | "systems-snapshot"
  | "readiness-assessment"
  | "workflow-friction"
  | "stakeholder-synthesis"
  | "opportunity-portfolio"
  | "priority-recommendations"
  | "governance-risk"
  | "roadmap"
  | "recommended-next-step"
  | "appendix";

export type ReportSectionStatus =
  | "not-started"
  | "drafted"
  | "needs-review"
  | "approved"
  | "final";

export type ReportStatus =
  | "draft"
  | "needs-review"
  | "approved"
  | "final";

export type ReportConfidence = "high" | "medium" | "low" | "needs-evidence";

export interface ReportSection {
  id: string;
  reportId: string;
  title: string;
  sectionType: ReportSectionType;
  status: ReportSectionStatus;
  summary: string;
  draftPreview: string;
  linkedFindingIds: string[];
  linkedOpportunityIds: string[];
  linkedRoadmapItemIds: string[];
  evidenceNotes: string;
  reviewerNote?: string;
  aiDrafted: boolean;
  confidence: ReportConfidence;
}

export interface Report {
  id: string;
  engagementId: string;
  title: string;
  status: ReportStatus;
  generatedAt: string;
  lastEditedAt: string;
  sections: ReportSection[];
  recommendedNextStep: string;
  consultantNotes: string[];
  exportStatus: "locked" | "preview-only" | "ready-for-export-placeholder";
}
