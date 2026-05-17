import type {
  DbProposalDeliverySnapshotRow,
  ProposalApprovalState,
  ProposalCommercialGuardResult,
  ProposalDeliverySnapshot,
  ProposalDeliverySnapshotStatus,
  ProposalDeliverySurface,
  ProposalOmittedContent,
  ProposalOptionSnapshot,
  ProposalPricingReviewState,
  ProposalSourceContextSnapshot,
} from "./delivery-snapshot-types";
import type { ProposalOptionType } from "./types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P2 — DB row → TS shape mappers
 * for proposal delivery snapshots. The jsonb columns are validated
 * defensively: malformed payloads (manual SQL edits, future schema
 * drift) coerce to safe empty shapes rather than crashing the
 * renderer.
 *
 * Pure module — no React, no DB, no I/O.
 */

const VALID_STATUSES: ReadonlyArray<ProposalDeliverySnapshotStatus> = [
  "candidate",
  "generated",
  "voided",
];

const VALID_SURFACES: ReadonlyArray<ProposalDeliverySurface> = [
  "internal_candidate",
  "client_proposal_candidate",
  "sow_draft_candidate",
];

const VALID_APPROVAL_STATES: ReadonlyArray<ProposalApprovalState> = [
  "unreviewed",
  "approved",
  "revoked",
];

const VALID_PRICING_STATES: ReadonlyArray<ProposalPricingReviewState> = [
  "placeholder",
  "manually_approved",
  "workflow_approved",
];

const VALID_OPTION_TYPES: ReadonlyArray<ProposalOptionType> = [
  "quick-win-build",
  "ai-workflow-system",
  "managed-ai-partner",
];

function asStatus(v: string): ProposalDeliverySnapshotStatus {
  return (VALID_STATUSES as ReadonlyArray<string>).includes(v)
    ? (v as ProposalDeliverySnapshotStatus)
    : "candidate";
}

function asSurface(v: string): ProposalDeliverySurface {
  return (VALID_SURFACES as ReadonlyArray<string>).includes(v)
    ? (v as ProposalDeliverySurface)
    : "client_proposal_candidate";
}

function asApprovalState(v: string): ProposalApprovalState {
  return (VALID_APPROVAL_STATES as ReadonlyArray<string>).includes(v)
    ? (v as ProposalApprovalState)
    : "unreviewed";
}

function asPricingReviewState(v: string): ProposalPricingReviewState {
  return (VALID_PRICING_STATES as ReadonlyArray<string>).includes(v)
    ? (v as ProposalPricingReviewState)
    : "placeholder";
}

function asOptionType(v: unknown): ProposalOptionType {
  return typeof v === "string" &&
    (VALID_OPTION_TYPES as ReadonlyArray<string>).includes(v)
    ? (v as ProposalOptionType)
    : "quick-win-build";
}

function asArray<T>(v: unknown, isItem: (x: unknown) => x is T): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const x of v) {
    if (isItem(x)) out.push(x);
  }
  return out;
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asBoolean(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  return asArray(v, (x): x is string => typeof x === "string");
}

function isOptionSnapshot(x: unknown): x is ProposalOptionSnapshot {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.optionId === "string" && typeof o.title === "string";
}

function isOmittedContent(x: unknown): x is ProposalOmittedContent {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.scope === "string" && typeof o.reason === "string";
}

function mapOptionSnapshot(x: ProposalOptionSnapshot): ProposalOptionSnapshot {
  // The jsonb survived the type guard, but we still normalise nested
  // arrays + enums via the existing helpers so renderer code can
  // depend on shape stability.
  const raw = x as unknown as Record<string, unknown>;
  return {
    optionId: asString(raw.optionId),
    position: asNumber(raw.position, 0),
    optionType: asOptionType(raw.optionType),
    title: asString(raw.title),
    bestFitScenario: asString(raw.bestFitScenario),
    scopeSummary: asString(raw.scopeSummary),
    timeline: asString(raw.timeline),
    deliverables: asStringArray(raw.deliverables),
    assumptions: asStringArray(raw.assumptions),
    dependencies: asStringArray(raw.dependencies),
    risks: asStringArray(raw.risks),
    pricingPlaceholder: asString(raw.pricingPlaceholder),
    recommended: asBoolean(raw.recommended, false),
    includedInArtifact: asBoolean(raw.includedInArtifact, true),
  };
}

function mapSourceContextSnapshot(
  v: unknown,
): ProposalSourceContextSnapshot {
  const o = asObject(v);
  const credit = asObject(o.implementationCredit);
  return {
    implementationCredit: {
      creditEligible: asBoolean(credit.creditEligible, true),
      creditAmountPlaceholder: asString(credit.creditAmountPlaceholder),
      creditWindow: asString(credit.creditWindow),
      creditNotes: asString(credit.creditNotes),
    },
    reportSnapshotId:
      typeof o.reportSnapshotId === "string" ? o.reportSnapshotId : null,
    linkedOpportunityIds: asStringArray(o.linkedOpportunityIds),
    linkedRoadmapItemIds: asStringArray(o.linkedRoadmapItemIds),
  };
}

function mapCommercialGuardResult(
  v: unknown,
): ProposalCommercialGuardResult {
  const o = asObject(v);
  return {
    scannedFields: asStringArray(o.scannedFields),
    scannedFieldCount: asNumber(o.scannedFieldCount, 0),
    patternsApplied: asArray(
      o.patternsApplied,
      (x): x is ProposalCommercialGuardResult["patternsApplied"][number] =>
        x === "financial" ||
        x === "commercial-finality" ||
        x === "roadmap-commitment" ||
        x === "proposal-finality" ||
        x === "sow-draft-finality",
    ),
    patternCount: asNumber(o.patternCount, 0),
    violations: asArray(
      o.violations,
      (x): x is ProposalCommercialGuardResult["violations"][number] => {
        if (!x || typeof x !== "object") return false;
        const v = x as Record<string, unknown>;
        return (
          typeof v.field === "string" &&
          typeof v.code === "string" &&
          (v.patternFamily === "financial" ||
            v.patternFamily === "commercial-finality" ||
            v.patternFamily === "roadmap-commitment" ||
            v.patternFamily === "proposal-finality" ||
            v.patternFamily === "sow-draft-finality")
        );
      },
    ),
    passed: asBoolean(o.passed, true),
    scanDurationMs: asNumber(o.scanDurationMs, 0),
    version: asString(o.version, "commercial-guard.v1"),
  };
}

export function mapProposalDeliverySnapshotRow(
  row: DbProposalDeliverySnapshotRow,
): ProposalDeliverySnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    engagementId: row.engagement_id,
    proposalId: row.proposal_id,
    status: asStatus(row.status),
    deliverySurface: asSurface(row.delivery_surface),
    proposalStatusAtGeneration: row.proposal_status_at_generation,
    generatedByUserId: row.generated_by,
    generatedByLabel: row.generated_by_label,
    generatedAt: row.generated_at,
    optionSnapshot: asArray(row.option_snapshot, isOptionSnapshot).map(
      mapOptionSnapshot,
    ),
    sourceContextSnapshot: mapSourceContextSnapshot(
      row.source_context_snapshot,
    ),
    commercialGuardResult: mapCommercialGuardResult(row.commercial_guard_result),
    omittedContent: asArray(row.omitted_content, isOmittedContent),
    draftWatermark: row.draft_watermark,
    approvalState: asApprovalState(row.approval_state),
    pricingReviewState: asPricingReviewState(row.pricing_review_state),
    selectedOptionIds: Array.isArray(row.selected_option_ids)
      ? row.selected_option_ids.filter((s): s is string => typeof s === "string")
      : [],
    artifactPath: row.artifact_path,
    artifactMimeType: row.artifact_mime_type,
    artifactSizeBytes: row.artifact_size_bytes,
    appVersion: row.app_version,
    commitSha: row.commit_sha,
    voidedAt: row.voided_at,
    voidedByUserId: row.voided_by,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
