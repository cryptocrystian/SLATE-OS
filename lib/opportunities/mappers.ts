import type {
  EvidenceStrength,
  Opportunity,
  OpportunityCategory,
  OpportunityPriority,
  OpportunityQuadrant,
} from "./types";

/**
 * DB ↔ TypeScript mappers for persisted opportunities.
 *
 * The TS shapes predate persistence and use hyphenated unions /
 * mixed-case category labels. The DB stores underscored snake_case
 * (priority / quadrant / status) and free text for category so
 * vocabulary can evolve without a migration.
 */

// ---------------------------------------------------------------------------
// DB row shapes
// ---------------------------------------------------------------------------

export interface DbOpportunityRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  title: string;
  category: string | null;
  description: string | null;
  priority: string | null;
  quadrant: string | null;
  business_impact_score: number | null;
  complexity_score: number | null;
  risk_score: number | null;
  time_to_value_score: number | null;
  adoption_likelihood_score: number | null;
  strategic_value_score: number | null;
  evidence_strength: string | null;
  source_summary: string | null;
  recommended_action: string | null;
  implementation_shape: string | null;
  dependencies: string[] | null;
  risks: string[] | null;
  success_signals: string[] | null;
  status: string | null;
  position: number | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOpportunityFindingLinkRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  opportunity_id: string;
  finding_id: string;
  strength: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Enum translation
// ---------------------------------------------------------------------------

const PRIORITY_FROM_DB: Record<string, OpportunityPriority> = {
  quick_win: "quick-win",
  strategic_build: "strategic-build",
  low_priority: "low-priority",
  defer: "defer",
  avoid: "avoid",
};

const PRIORITY_TO_DB: Record<OpportunityPriority, string> = {
  "quick-win": "quick_win",
  "strategic-build": "strategic_build",
  "low-priority": "low_priority",
  defer: "defer",
  avoid: "avoid",
};

const QUADRANT_FROM_DB: Record<string, OpportunityQuadrant> = {
  quick_win: "quick-win",
  strategic_build: "strategic-build",
  low_priority: "low-priority",
  defer_avoid: "defer-avoid",
  // Some operators may pick `defer` or `avoid` directly; collapse into
  // the visual `defer-avoid` quadrant.
  defer: "defer-avoid",
  avoid: "defer-avoid",
};

const QUADRANT_TO_DB: Record<OpportunityQuadrant, string> = {
  "quick-win": "quick_win",
  "strategic-build": "strategic_build",
  "low-priority": "low_priority",
  "defer-avoid": "defer_avoid",
};

const CATEGORIES: OpportunityCategory[] = [
  "Sales / Revenue Operations",
  "Client Intake / Onboarding",
  "Proposal / Document Generation",
  "Customer Support / Triage",
  "Internal Knowledge / Retrieval",
  "Reporting / Analytics",
  "Back-office Automation",
  "Systems Integration",
  "Governance / Risk Controls",
];

const EVIDENCE: EvidenceStrength[] = ["strong", "adequate", "thin"];

export type OpportunityStatus =
  | "draft"
  | "scored"
  | "selected"
  | "deferred"
  | "rejected";

export const OPPORTUNITY_STATUSES: OpportunityStatus[] = [
  "draft",
  "scored",
  "selected",
  "deferred",
  "rejected",
];

export function dbPriorityFor(priority: OpportunityPriority): string {
  return PRIORITY_TO_DB[priority] ?? "low_priority";
}

export function dbQuadrantFor(quadrant: OpportunityQuadrant): string {
  return QUADRANT_TO_DB[quadrant] ?? "low_priority";
}

export function tsPriorityFor(value: string | null | undefined): OpportunityPriority {
  if (!value) return "low-priority";
  return PRIORITY_FROM_DB[value] ?? "low-priority";
}

export function tsQuadrantFor(value: string | null | undefined): OpportunityQuadrant {
  if (!value) return "low-priority";
  return QUADRANT_FROM_DB[value] ?? "low-priority";
}

export function tsCategoryFor(value: string | null | undefined): OpportunityCategory {
  if (!value) return "Back-office Automation";
  return (CATEGORIES as string[]).includes(value)
    ? (value as OpportunityCategory)
    : "Back-office Automation";
}

export function tsEvidenceFor(value: string | null | undefined): EvidenceStrength {
  if (!value) return "adequate";
  return (EVIDENCE as string[]).includes(value)
    ? (value as EvidenceStrength)
    : "adequate";
}

export function tsStatusFor(value: string | null | undefined): OpportunityStatus {
  if (!value) return "draft";
  return (OPPORTUNITY_STATUSES as string[]).includes(value)
    ? (value as OpportunityStatus)
    : "draft";
}

// ---------------------------------------------------------------------------
// Public mapper
// ---------------------------------------------------------------------------

export function mapOpportunityRow(
  row: DbOpportunityRow,
  links: DbOpportunityFindingLinkRow[],
): Opportunity {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    title: row.title,
    category: tsCategoryFor(row.category),
    description: row.description ?? "",
    priority: tsPriorityFor(row.priority),
    quadrant: tsQuadrantFor(row.quadrant),
    businessImpactScore: clampScore(row.business_impact_score),
    complexityScore: clampScore(row.complexity_score),
    riskScore: clampScore(row.risk_score),
    timeToValueScore: clampScore(row.time_to_value_score),
    adoptionLikelihoodScore: clampScore(row.adoption_likelihood_score),
    strategicValueScore: clampScore(row.strategic_value_score),
    evidenceStrength: tsEvidenceFor(row.evidence_strength),
    relatedFindingIds: links
      .filter((l) => l.opportunity_id === row.id)
      .map((l) => l.finding_id),
    sourceSummary: row.source_summary ?? "",
    recommendedAction: row.recommended_action ?? "",
    implementationShape: row.implementation_shape ?? "",
    dependencies: row.dependencies ?? [],
    risks: row.risks ?? [],
    successSignals: row.success_signals ?? [],
    status: tsStatusFor(row.status),
    updatedAt: row.updated_at ?? null,
    reviewerNote:
      typeof row.reviewer_notes === "string" && row.reviewer_notes.length > 0
        ? row.reviewer_notes
        : null,
  };
}

function clampScore(v: number | null | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ---------------------------------------------------------------------------
// UUID guard
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}
