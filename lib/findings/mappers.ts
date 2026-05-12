import type {
  Finding,
  FindingCategory,
  FindingConfidence,
  FindingReviewStatus,
  SourceRef,
  SourceRefType,
} from "./types";

/**
 * DB ↔ TypeScript shape mappers for persisted findings.
 *
 * The TS `Finding` shape predates persistence and uses hyphenated /
 * mixed-case unions; the DB stores underscored snake_case. This module
 * is the single point of translation so the existing finding components
 * keep their props unchanged.
 */

// ---------------------------------------------------------------------------
// DB row shapes
// ---------------------------------------------------------------------------

export interface DbFindingRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  category: string | null;
  statement: string;
  summary: string | null;
  evidence_summary: string | null;
  confidence: string | null;
  review_status: string | null;
  suggested_impact: string | null;
  assumption_flag: boolean | null;
  assumption_note: string | null;
  reviewer_note: string | null;
  ai_drafted: boolean | null;
  position: number | null;
  reviewed_by: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbFindingSourceRefRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  finding_id: string;
  source_type: string;
  source_id: string | null;
  source_label: string | null;
  source_role: string | null;
  excerpt: string | null;
  strength: string | null;
  metadata: unknown;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Enum translation
// ---------------------------------------------------------------------------

const CATEGORY_FROM_DB: Record<string, FindingCategory> = {
  workflow_friction: "Workflow Friction",
  systems_gap: "Systems Gap",
  data_readiness: "Data Readiness",
  adoption_risk: "Adoption Risk",
  governance_risk: "Governance / Risk",
  revenue_opportunity: "Revenue Opportunity",
  back_office_efficiency: "Back-office Efficiency",
  customer_experience: "Customer Experience",
};

const CATEGORY_TO_DB: Record<FindingCategory, string> = {
  "Workflow Friction": "workflow_friction",
  "Systems Gap": "systems_gap",
  "Data Readiness": "data_readiness",
  "Adoption Risk": "adoption_risk",
  "Governance / Risk": "governance_risk",
  "Revenue Opportunity": "revenue_opportunity",
  "Back-office Efficiency": "back_office_efficiency",
  "Customer Experience": "customer_experience",
};

const REVIEW_STATUS_FROM_DB: Record<string, FindingReviewStatus> = {
  draft: "draft",
  needs_review: "needs-review",
  approved: "approved",
  edited: "edited",
  rejected: "rejected",
  report_ready: "report-ready",
};

const REVIEW_STATUS_TO_DB: Record<FindingReviewStatus, string> = {
  draft: "draft",
  "needs-review": "needs_review",
  approved: "approved",
  edited: "edited",
  rejected: "rejected",
  "report-ready": "report_ready",
};

const CONFIDENCE_FROM_DB: Record<string, FindingConfidence> = {
  high: "high",
  medium: "medium",
  low: "low",
  needs_evidence: "needs-evidence",
};

const CONFIDENCE_TO_DB: Record<FindingConfidence, string> = {
  high: "high",
  medium: "medium",
  low: "low",
  "needs-evidence": "needs_evidence",
};

const SOURCE_TYPE_FROM_DB: Record<string, SourceRefType> = {
  stakeholder_response: "stakeholder-response",
  input_asset: "uploaded-document",
  scorecard_answer: "scorecard-answer",
  consultant_note: "consultant-note",
};

const SOURCE_TYPE_TO_DB: Record<SourceRefType, string> = {
  "stakeholder-response": "stakeholder_response",
  "uploaded-document": "input_asset",
  "scorecard-answer": "scorecard_answer",
  "consultant-note": "consultant_note",
};

const STRENGTH_VALUES: SourceRef["strength"][] = ["strong", "adequate", "thin"];

export function dbCategoryFor(category: FindingCategory): string {
  return CATEGORY_TO_DB[category] ?? "workflow_friction";
}

export function dbReviewStatusFor(status: FindingReviewStatus): string {
  return REVIEW_STATUS_TO_DB[status] ?? "needs_review";
}

export function dbConfidenceFor(confidence: FindingConfidence): string {
  return CONFIDENCE_TO_DB[confidence] ?? "needs_evidence";
}

export function dbSourceTypeFor(type: SourceRefType): string {
  return SOURCE_TYPE_TO_DB[type] ?? "consultant_note";
}

function tsCategoryFor(category: string | null | undefined): FindingCategory {
  if (!category) return "Workflow Friction";
  return CATEGORY_FROM_DB[category] ?? "Workflow Friction";
}

function tsReviewStatusFor(
  status: string | null | undefined,
): FindingReviewStatus {
  if (!status) return "needs-review";
  return REVIEW_STATUS_FROM_DB[status] ?? "needs-review";
}

function tsConfidenceFor(
  confidence: string | null | undefined,
): FindingConfidence {
  if (!confidence) return "needs-evidence";
  return CONFIDENCE_FROM_DB[confidence] ?? "needs-evidence";
}

function tsSourceTypeFor(type: string | null | undefined): SourceRefType {
  if (!type) return "consultant-note";
  return SOURCE_TYPE_FROM_DB[type] ?? "consultant-note";
}

function tsStrengthFor(
  strength: string | null | undefined,
): SourceRef["strength"] {
  if (!strength) return "adequate";
  return (STRENGTH_VALUES as string[]).includes(strength)
    ? (strength as SourceRef["strength"])
    : "adequate";
}

// ---------------------------------------------------------------------------
// Public mappers
// ---------------------------------------------------------------------------

export function mapFindingRow(
  row: DbFindingRow,
  refs: DbFindingSourceRefRow[],
): Finding {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    category: tsCategoryFor(row.category),
    statement: row.statement,
    summary: row.summary ?? "",
    evidenceSummary: row.evidence_summary ?? "",
    confidence: tsConfidenceFor(row.confidence),
    reviewStatus: tsReviewStatusFor(row.review_status),
    suggestedImpact: row.suggested_impact ?? "",
    sourceRefs: refs.map(mapSourceRefRow),
    assumptionFlag:
      row.assumption_flag && row.assumption_note?.trim()
        ? row.assumption_note
        : undefined,
    reviewerNote: row.reviewer_note ?? undefined,
    aiDrafted: Boolean(row.ai_drafted),
    updatedAt: row.updated_at ?? null,
    lastReviewedAt: row.last_reviewed_at ?? null,
  };
}

export function mapSourceRefRow(row: DbFindingSourceRefRow): SourceRef {
  return {
    id: row.id,
    type: tsSourceTypeFor(row.source_type),
    source: row.source_label?.trim() || "Source",
    role: row.source_role?.trim() || undefined,
    excerpt: row.excerpt ?? "",
    strength: tsStrengthFor(row.strength),
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
