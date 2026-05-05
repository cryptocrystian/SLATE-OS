import type {
  ImplementationCredit,
  Proposal,
  ProposalConfidence,
  ProposalOption,
  ProposalOptionType,
  ProposalStatus,
} from "./types";

/**
 * DB ↔ TypeScript shape mappers for persisted proposals + options.
 *
 * Option type / status / confidence fields stay text-typed in the DB so
 * canonical labels can evolve without a migration.
 */

// ---------------------------------------------------------------------------
// DB row shapes
// ---------------------------------------------------------------------------

export interface DbProposalRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  title: string;
  status: string | null;
  recommended_option_id: string | null;
  next_step: string | null;
  assumptions: string[] | null;
  dependencies: string[] | null;
  credit_eligible: boolean | null;
  credit_amount_placeholder: string | null;
  credit_window: string | null;
  credit_notes: string | null;
  export_status: string | null;
  reviewed_by: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbProposalOptionRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  proposal_id: string;
  option_type: string;
  title: string;
  recommended: boolean | null;
  best_fit_scenario: string | null;
  scope_summary: string | null;
  timeline: string | null;
  deliverables: string[] | null;
  assumptions: string[] | null;
  dependencies: string[] | null;
  risks: string[] | null;
  pricing_placeholder: string | null;
  confidence: string | null;
  position: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbProposalOptionLinkRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  proposal_option_id: string;
  opportunity_id?: string | null;
  roadmap_item_id?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Enum translation
// ---------------------------------------------------------------------------

const OPTION_TYPE_FROM_DB: Record<string, ProposalOptionType> = {
  quick_win_build: "quick-win-build",
  ai_workflow_system: "ai-workflow-system",
  managed_ai_partner: "managed-ai-partner",
};

const OPTION_TYPE_TO_DB: Record<ProposalOptionType, string> = {
  "quick-win-build": "quick_win_build",
  "ai-workflow-system": "ai_workflow_system",
  "managed-ai-partner": "managed_ai_partner",
};

const STATUS_FROM_DB: Record<string, ProposalStatus> = {
  draft: "draft",
  needs_review: "needs-review",
  approved: "approved",
  sent_placeholder: "sent-placeholder",
  accepted_placeholder: "accepted-placeholder",
};

const STATUS_TO_DB: Record<ProposalStatus, string> = {
  draft: "draft",
  "needs-review": "needs_review",
  approved: "approved",
  "sent-placeholder": "sent_placeholder",
  "accepted-placeholder": "accepted_placeholder",
};

const CONFIDENCE_VALUES: ProposalConfidence[] = ["high", "medium", "low"];

const EXPORT_STATUS_VALUES: Proposal["exportStatus"][] = [
  "locked",
  "preview-only",
  "ready-for-export-placeholder",
];

const EXPORT_STATUS_FROM_DB: Record<string, Proposal["exportStatus"]> = {
  locked: "locked",
  preview_only: "preview-only",
  preview: "preview-only",
  ready_for_export_placeholder: "ready-for-export-placeholder",
};

export function dbOptionTypeFor(t: ProposalOptionType): string {
  return OPTION_TYPE_TO_DB[t] ?? "quick_win_build";
}

export function dbProposalStatusFor(s: ProposalStatus): string {
  return STATUS_TO_DB[s] ?? "draft";
}

export function tsOptionTypeFor(
  v: string | null | undefined,
): ProposalOptionType {
  if (!v) return "quick-win-build";
  return OPTION_TYPE_FROM_DB[v] ?? "quick-win-build";
}

export function tsProposalStatusFor(
  v: string | null | undefined,
): ProposalStatus {
  if (!v) return "draft";
  return STATUS_FROM_DB[v] ?? "draft";
}

export function tsConfidenceFor(
  v: string | null | undefined,
): ProposalConfidence {
  if (!v) return "medium";
  return (CONFIDENCE_VALUES as string[]).includes(v)
    ? (v as ProposalConfidence)
    : "medium";
}

export function tsExportStatusFor(
  v: string | null | undefined,
): Proposal["exportStatus"] {
  if (!v) return "locked";
  if ((EXPORT_STATUS_VALUES as string[]).includes(v)) {
    return v as Proposal["exportStatus"];
  }
  return EXPORT_STATUS_FROM_DB[v] ?? "locked";
}

// ---------------------------------------------------------------------------
// Public mappers
// ---------------------------------------------------------------------------

export function mapProposalOptionRow(
  row: DbProposalOptionRow,
  opportunityLinks: DbProposalOptionLinkRow[],
  roadmapLinks: DbProposalOptionLinkRow[],
): ProposalOption {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    title: row.title,
    type: tsOptionTypeFor(row.option_type),
    recommended: Boolean(row.recommended),
    bestFitScenario: row.best_fit_scenario ?? "",
    scopeSummary: row.scope_summary ?? "",
    includedOpportunityIds: opportunityLinks
      .filter((l) => l.proposal_option_id === row.id && l.opportunity_id)
      .map((l) => l.opportunity_id as string),
    linkedRoadmapItemIds: roadmapLinks
      .filter((l) => l.proposal_option_id === row.id && l.roadmap_item_id)
      .map((l) => l.roadmap_item_id as string),
    timeline: row.timeline ?? "",
    deliverables: row.deliverables ?? [],
    assumptions: row.assumptions ?? [],
    dependencies: row.dependencies ?? [],
    risks: row.risks ?? [],
    pricingPlaceholder: row.pricing_placeholder ?? "",
    confidence: tsConfidenceFor(row.confidence),
  };
}

export function mapProposalRow(
  row: DbProposalRow,
  options: ProposalOption[],
): Proposal {
  const credit: ImplementationCredit = {
    creditEligible: Boolean(row.credit_eligible ?? true),
    creditAmountPlaceholder:
      row.credit_amount_placeholder ?? "Up to 25% of AI Opportunity Sprint fee",
    creditWindow:
      row.credit_window ??
      "Applied if implementation starts within 60 days of report finalization",
    creditNotes:
      row.credit_notes ??
      "If the client proceeds into implementation within the agreed window, a portion of the AI Opportunity Sprint fee may be credited toward the implementation SOW. This is represented here as a commercial lever, not an automatic discount.",
  };
  return {
    id: row.id,
    engagementId: row.engagement_id,
    title: row.title,
    status: tsProposalStatusFor(row.status),
    recommendedOptionId: row.recommended_option_id ?? null,
    options,
    implementationCredit: credit,
    assumptions: row.assumptions ?? [],
    dependencies: row.dependencies ?? [],
    nextStep: row.next_step ?? "",
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
