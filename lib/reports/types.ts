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
  /**
   * Optional persisted reference to a Group-A chart-exhibit slot
   * (`lib/charts/adapters/types.ts#ReportExhibitSlot`). Sprint 2 +
   * migration `0012_report_section_exhibit_slot.sql`. Null when the
   * section does not reference an exhibit. Only Group-A values are
   * accepted at the SQL CHECK boundary; Group-B values are rejected.
   *
   * Typed as a narrowed string union rather than importing the
   * `ReportExhibitSlot` union directly to keep this module free of
   * `lib/charts/*` imports — `lib/reports/slot-map.ts` owns the
   * canonical predicate (`isGroupAReportSlot`).
   */
  exhibitSlot?:
    | "executive_summary_portfolio"
    | "findings_risk_priority"
    | "diagnostic_capability_maturity"
    | "diagnostic_stakeholder_coverage"
    | "roadmap_90_day_sequence"
    | null;
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
