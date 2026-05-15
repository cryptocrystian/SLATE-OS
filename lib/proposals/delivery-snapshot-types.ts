/**
 * Phase 1B Proposal/SOW Delivery Sprint P2 — proposal delivery snapshot
 * TypeScript shapes.
 *
 * Mirrors `public.proposal_delivery_snapshots` from migration
 * `0015_proposal_delivery_snapshots.sql`. Snapshots are point-in-time
 * commercial-discussion artifacts; the first implementation (this
 * sprint) stores metadata only and never produces a PDF binary.
 *
 * Pure module — no React, no DB, no I/O.
 */

import type { ProposalOptionType } from "./types";

export type ProposalDeliverySnapshotStatus =
  | "candidate"
  | "generated"
  | "voided";

export type ProposalDeliverySurface =
  | "internal_candidate"
  | "client_proposal_candidate"
  | "sow_draft_candidate";

export type ProposalApprovalState = "unreviewed" | "approved" | "revoked";

export type ProposalPricingReviewState =
  | "placeholder"
  | "manually_approved"
  | "workflow_approved";

/**
 * Per-option snapshot. Captures the option's commercial content at
 * generation time. Reviewer notes are intentionally excluded by
 * default (canon §Commercial Claim Guard, item 3).
 *
 * The snapshot carries `optionId` for operator-side audit. The
 * public-route renderer (Sprint P5) must not surface `optionId` in
 * the client artifact.
 */
export interface ProposalOptionSnapshot {
  optionId: string;
  position: number;
  optionType: ProposalOptionType;
  title: string;
  bestFitScenario: string;
  scopeSummary: string;
  timeline: string;
  deliverables: string[];
  assumptions: string[];
  dependencies: string[];
  risks: string[];
  pricingPlaceholder: string;
  recommended: boolean;
  /**
   * Whether this option was included in the snapshot's client-bound
   * surface. Mirrors the report-side `section.includedInArtifact`
   * flag. Omitted options are still captured for the audit trail
   * but are flagged so the renderer can skip them.
   */
  includedInArtifact: boolean;
}

/**
 * Source-context digest. Captures the proposal-level commercial-lever
 * copy + friendly back-references to related artifacts. Internal IDs
 * are captured here for operator audit; the public render MUST
 * translate them to friendly client-visible context only.
 */
export interface ProposalSourceContextSnapshot {
  /**
   * Proposal-level commercial lever copy at generation time.
   * Implementation credit is hidden from the client artifact unless
   * `pricingReviewState !== 'placeholder'` AND a future commercial
   * approval workflow gates surface it (canon §Pricing / Terms
   * Policy).
   */
  implementationCredit: {
    creditEligible: boolean;
    creditAmountPlaceholder: string;
    creditWindow: string;
    creditNotes: string;
  };
  /**
   * Cross-artifact references. Operator-audit-only. The public render
   * MUST NOT include these IDs in the client artifact (canon
   * §Relationship to Report Link MVP — "by friendly context, not
   * internal IDs").
   */
  reportSnapshotId: string | null;
  linkedOpportunityIds: string[];
  linkedRoadmapItemIds: string[];
}

/**
 * Result of the export-time commercial-guard scan. The shape extends
 * the report-side `ReportDeliveryClaimGuardResult` with a new
 * `proposal-finality` family for the 18 commercial / SOW patterns
 * added by `docs/24` §Commercial Claim Guard.
 */
export interface ProposalCommercialGuardResult {
  scannedFields: string[];
  scannedFieldCount: number;
  patternsApplied: ReadonlyArray<
    | "financial"
    | "commercial-finality"
    | "roadmap-commitment"
    | "proposal-finality"
  >;
  patternCount: number;
  violations: ReadonlyArray<{
    field: string;
    code: string;
    patternFamily:
      | "financial"
      | "commercial-finality"
      | "roadmap-commitment"
      | "proposal-finality";
  }>;
  passed: boolean;
  scanDurationMs: number;
  version: string;
}

/**
 * Omitted-content entry. The canonical Group-B confirmation entry is
 * always present; per-option omissions (e.g. options the operator
 * excluded, or options that failed eligibility) land alongside it.
 */
export type ProposalOmittedContentReason =
  | "group_b_canon_gate"
  | "option_not_selected"
  | "option_blank_commercial_terms"
  | "option_commercial_guard_violation"
  | "option_reviewer_note_only"
  | "option_pricing_pending_approval";

export interface ProposalOmittedContent {
  /**
   * Either a `proposal_option` id OR the literal string `"group_b_block"`
   * for the canonical Group-B omission entry.
   */
  scope: string;
  reason: ProposalOmittedContentReason;
  issueCode: string;
  operatorFacingNote: string;
}

export interface ProposalDeliverySnapshot {
  id: string;
  workspaceId: string;
  engagementId: string;
  proposalId: string;

  status: ProposalDeliverySnapshotStatus;
  deliverySurface: ProposalDeliverySurface;
  proposalStatusAtGeneration: string;

  generatedByUserId: string | null;
  generatedByLabel: string | null;
  generatedAt: string;

  optionSnapshot: ProposalOptionSnapshot[];
  sourceContextSnapshot: ProposalSourceContextSnapshot;
  commercialGuardResult: ProposalCommercialGuardResult;
  omittedContent: ProposalOmittedContent[];

  draftWatermark: boolean;
  approvalState: ProposalApprovalState;
  pricingReviewState: ProposalPricingReviewState;

  selectedOptionIds: string[];

  artifactPath: string | null;
  artifactMimeType: string | null;
  artifactSizeBytes: number | null;

  appVersion: string | null;
  commitSha: string | null;

  voidedAt: string | null;
  voidedByUserId: string | null;
  voidReason: string | null;

  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// DB row shape — exact column names from migration 0015
// ---------------------------------------------------------------------------

export interface DbProposalDeliverySnapshotRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  proposal_id: string;
  status: string;
  delivery_surface: string;
  proposal_status_at_generation: string;
  generated_by: string | null;
  generated_by_label: string | null;
  generated_at: string;
  option_snapshot: unknown;
  source_context_snapshot: unknown;
  commercial_guard_result: unknown;
  omitted_content: unknown;
  draft_watermark: boolean;
  approval_state: string;
  pricing_review_state: string;
  selected_option_ids: string[] | null;
  artifact_path: string | null;
  artifact_mime_type: string | null;
  artifact_size_bytes: number | null;
  app_version: string | null;
  commit_sha: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Group-B canonical omission entry — always present in omittedContent
// ---------------------------------------------------------------------------

export const PROPOSAL_GROUP_B_OMISSION_ENTRY: ProposalOmittedContent = {
  scope: "group_b_block",
  reason: "group_b_canon_gate",
  issueCode: "group_b_canon_gate",
  operatorFacingNote:
    "Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge are intentionally omitted from every proposal artifact. They remain preview-only until docs/14 / docs/15 advance their data gates.",
};
