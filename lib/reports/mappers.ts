import { assertGroupAReportSlot } from "./slot-map";
import type {
  Report,
  ReportConfidence,
  ReportSection,
  ReportSectionStatus,
  ReportSectionType,
  ReportStatus,
} from "./types";

/**
 * DB ↔ TypeScript shape mappers for persisted reports.
 *
 * The TS shapes use hyphenated unions; the DB stores underscored
 * snake_case. Section type vocabulary is also kept text-typed in the
 * DB so canonical labels can evolve without a migration.
 */

// ---------------------------------------------------------------------------
// DB row shapes
// ---------------------------------------------------------------------------

export interface DbReportRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  title: string;
  status: string | null;
  generated_at: string | null;
  last_edited_at: string | null;
  recommended_next_step: string | null;
  consultant_notes: string[] | null;
  export_status: string | null;
  reviewed_by: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbReportSectionRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  report_id: string;
  section_type: string;
  title: string;
  status: string | null;
  summary: string | null;
  draft_preview: string | null;
  evidence_notes: string | null;
  reviewer_note: string | null;
  ai_drafted: boolean | null;
  confidence: string | null;
  position: number | null;
  reviewed_by: string | null;
  last_reviewed_at: string | null;
  /** Sprint 2 + migration 0012 — nullable Group-A exhibit slot reference. */
  exhibit_slot: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbReportSectionLinkRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  report_section_id: string;
  /** Either finding_id, opportunity_id, or roadmap_item_id depending on table. */
  finding_id?: string | null;
  opportunity_id?: string | null;
  roadmap_item_id?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Enum translation
// ---------------------------------------------------------------------------

const SECTION_TYPE_FROM_DB: Record<string, ReportSectionType> = {
  executive_summary: "executive-summary",
  business_context: "business-context",
  systems_snapshot: "systems-snapshot",
  readiness_assessment: "readiness-assessment",
  workflow_friction: "workflow-friction",
  stakeholder_synthesis: "stakeholder-synthesis",
  opportunity_portfolio: "opportunity-portfolio",
  priority_recommendations: "priority-recommendations",
  governance_risk: "governance-risk",
  roadmap: "roadmap",
  recommended_next_step: "recommended-next-step",
  appendix: "appendix",
};

const SECTION_TYPE_TO_DB: Record<ReportSectionType, string> = {
  "executive-summary": "executive_summary",
  "business-context": "business_context",
  "systems-snapshot": "systems_snapshot",
  "readiness-assessment": "readiness_assessment",
  "workflow-friction": "workflow_friction",
  "stakeholder-synthesis": "stakeholder_synthesis",
  "opportunity-portfolio": "opportunity_portfolio",
  "priority-recommendations": "priority_recommendations",
  "governance-risk": "governance_risk",
  roadmap: "roadmap",
  "recommended-next-step": "recommended_next_step",
  appendix: "appendix",
};

const SECTION_STATUS_FROM_DB: Record<string, ReportSectionStatus> = {
  not_started: "not-started",
  drafted: "drafted",
  needs_review: "needs-review",
  approved: "approved",
  final: "final",
};

const SECTION_STATUS_TO_DB: Record<ReportSectionStatus, string> = {
  "not-started": "not_started",
  drafted: "drafted",
  "needs-review": "needs_review",
  approved: "approved",
  final: "final",
};

const REPORT_STATUS_FROM_DB: Record<string, ReportStatus> = {
  draft: "draft",
  needs_review: "needs-review",
  approved: "approved",
  final: "final",
};

const REPORT_STATUS_TO_DB: Record<ReportStatus, string> = {
  draft: "draft",
  "needs-review": "needs_review",
  approved: "approved",
  final: "final",
};

const CONFIDENCE_FROM_DB: Record<string, ReportConfidence> = {
  high: "high",
  medium: "medium",
  low: "low",
  needs_evidence: "needs-evidence",
};

const CONFIDENCE_TO_DB: Record<ReportConfidence, string> = {
  high: "high",
  medium: "medium",
  low: "low",
  "needs-evidence": "needs_evidence",
};

const EXPORT_STATUS_VALUES: Report["exportStatus"][] = [
  "locked",
  "preview-only",
  "ready-for-export-placeholder",
];

const EXPORT_STATUS_FROM_DB: Record<string, Report["exportStatus"]> = {
  locked: "locked",
  preview_only: "preview-only",
  preview: "preview-only",
  ready_for_export_placeholder: "ready-for-export-placeholder",
};

export function dbSectionTypeFor(t: ReportSectionType): string {
  return SECTION_TYPE_TO_DB[t] ?? "executive_summary";
}

export function dbSectionStatusFor(s: ReportSectionStatus): string {
  return SECTION_STATUS_TO_DB[s] ?? "not_started";
}

export function dbReportStatusFor(s: ReportStatus): string {
  return REPORT_STATUS_TO_DB[s] ?? "draft";
}

export function dbConfidenceFor(c: ReportConfidence): string {
  return CONFIDENCE_TO_DB[c] ?? "needs_evidence";
}

export function tsSectionTypeFor(
  v: string | null | undefined,
): ReportSectionType {
  if (!v) return "executive-summary";
  return SECTION_TYPE_FROM_DB[v] ?? "executive-summary";
}

export function tsSectionStatusFor(
  v: string | null | undefined,
): ReportSectionStatus {
  if (!v) return "not-started";
  return SECTION_STATUS_FROM_DB[v] ?? "not-started";
}

export function tsReportStatusFor(
  v: string | null | undefined,
): ReportStatus {
  if (!v) return "draft";
  return REPORT_STATUS_FROM_DB[v] ?? "draft";
}

export function tsConfidenceFor(
  v: string | null | undefined,
): ReportConfidence {
  if (!v) return "needs-evidence";
  return CONFIDENCE_FROM_DB[v] ?? "needs-evidence";
}

export function tsExportStatusFor(
  v: string | null | undefined,
): Report["exportStatus"] {
  if (!v) return "locked";
  if ((EXPORT_STATUS_VALUES as string[]).includes(v)) {
    return v as Report["exportStatus"];
  }
  return EXPORT_STATUS_FROM_DB[v] ?? "locked";
}

// ---------------------------------------------------------------------------
// Public mappers
// ---------------------------------------------------------------------------

export function mapReportSectionRow(
  row: DbReportSectionRow,
  findingLinks: DbReportSectionLinkRow[],
  opportunityLinks: DbReportSectionLinkRow[],
  roadmapLinks: DbReportSectionLinkRow[],
): ReportSection {
  return {
    id: row.id,
    reportId: row.report_id,
    title: row.title,
    sectionType: tsSectionTypeFor(row.section_type),
    status: tsSectionStatusFor(row.status),
    summary: row.summary ?? "",
    draftPreview: row.draft_preview ?? "",
    linkedFindingIds: findingLinks
      .filter((l) => l.report_section_id === row.id && l.finding_id)
      .map((l) => l.finding_id as string),
    linkedOpportunityIds: opportunityLinks
      .filter((l) => l.report_section_id === row.id && l.opportunity_id)
      .map((l) => l.opportunity_id as string),
    linkedRoadmapItemIds: roadmapLinks
      .filter((l) => l.report_section_id === row.id && l.roadmap_item_id)
      .map((l) => l.roadmap_item_id as string),
    evidenceNotes: row.evidence_notes ?? "",
    reviewerNote: row.reviewer_note ?? undefined,
    aiDrafted: Boolean(row.ai_drafted),
    confidence: tsConfidenceFor(row.confidence),
    // Defense-in-depth: the SQL CHECK constraint already prevents
    // Group-B values, but a future schema drift or manual DB edit
    // must not leak through the renderer. `assertGroupAReportSlot`
    // coerces anything outside the Group-A allowlist to null.
    exhibitSlot: assertGroupAReportSlot(row.exhibit_slot),
  };
}

export function mapReportRow(
  row: DbReportRow,
  sections: ReportSection[],
): Report {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    title: row.title,
    status: tsReportStatusFor(row.status),
    generatedAt: row.generated_at ?? row.created_at,
    lastEditedAt: row.last_edited_at ?? row.updated_at,
    sections,
    recommendedNextStep: row.recommended_next_step ?? "",
    consultantNotes: row.consultant_notes ?? [],
    exportStatus: tsExportStatusFor(row.export_status),
  };
}

// ---------------------------------------------------------------------------
// UUID guard
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}
