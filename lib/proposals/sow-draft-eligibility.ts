import type {
  ProposalCommercialGuardResult,
  ProposalDeliverySnapshot,
  ProposalOmittedContent,
  ProposalPricingReviewState,
} from "./delivery-snapshot-types";

/**
 * Phase 1B SOW Draft Sprint P6-B — pure SOW Draft eligibility evaluator.
 *
 * Canon (`docs/26` § SOW Eligibility Rules) — 15 conditions stacked on
 * top of the proposal-side rules. This evaluator runs after the source
 * Proposal Candidate snapshot has been loaded; it does NOT load the
 * proposal itself or any DB rows. The caller (Sprint P6-B's
 * `generateSowDraftCandidateAction`) is responsible for:
 *
 *   1. Loading the source Proposal Candidate snapshot via
 *      `getProposalDeliverySnapshotById`.
 *   2. Running `runSowDraftCommercialGuard` to produce the SOW
 *      `commercialGuardResult`.
 *   3. Passing both into this evaluator.
 *
 * Returns ALL applicable reasons (not first-fail), mirroring the
 * proposal-side evaluator pattern. Warning-severity reasons
 * (e.g. `pricing_pending`, `implementation_credit_pending_approval`)
 * do not block eligibility — they are operator-facing notes the UI
 * surfaces alongside the eligible verdict.
 *
 * Pure module — no React, no DB, no I/O. Time injection via `now` for
 * testability.
 */

export type SowDraftEligibilityReasonCode =
  | "engagement_not_persisted"
  | "source_snapshot_missing"
  | "source_snapshot_voided"
  | "source_surface_not_proposal_candidate"
  | "source_not_approved"
  | "source_guard_failed"
  | "no_included_options"
  | "selected_option_missing"
  | "group_b_content_blocked"
  | "sow_guard_failed"
  | "pricing_pending"
  | "implementation_credit_pending_approval"
  | "public_sow_not_authorized"
  | "reviewer_notes_excluded"
  | "unsupported_surface";

export type SowDraftEligibilityReasonSeverity = "error" | "warning";

export interface SowDraftEligibilityReason {
  code: SowDraftEligibilityReasonCode;
  severity: SowDraftEligibilityReasonSeverity;
  message: string;
  /** Optional option-id or other narrow target string for the operator UI. */
  target?: string;
}

export interface SowDraftEligibilityResult {
  eligible: boolean;
  reasons: SowDraftEligibilityReason[];
  includedOptionIds: string[];
  omittedOptionIds: string[];
  /**
   * Per-option omission entries the caller will splat into the SOW
   * snapshot's `omitted_content` jsonb alongside the canonical
   * Group-B entry.
   */
  omittedContent: ProposalOmittedContent[];
  pricingReviewState: ProposalPricingReviewState;
  draftWatermark: boolean;
  /**
   * Canon-derived notice text the caller will store under the SOW
   * snapshot's `source_context_snapshot.sowDraft` jsonb. The exact
   * strings come from `docs/26` § Required Markings / Disclaimers and
   * must NOT be edited by the action layer — operators can edit them
   * post-generation through a future SOW editor surface.
   */
  sowDraftNotice: {
    pricingNotice: string;
    legalBoundaryNotice: string;
  };
}

export interface SowDraftEligibilityInput {
  /**
   * Whether the caller has confirmed the engagement is a persisted
   * UUID engagement. The action layer enforces this upstream; the
   * evaluator records a reason when this is false.
   */
  isPersistedEngagement: boolean;
  /**
   * Source Proposal Candidate snapshot loaded by the caller. Null
   * indicates the snapshot lookup failed at the action layer.
   */
  sourceProposalSnapshot: ProposalDeliverySnapshot | null;
  /**
   * Operator-selected option ids. Empty array means "fall through to
   * recommended options"; the action layer resolves the actual
   * included set.
   */
  selectedOptionIds?: string[];
  /**
   * Resolved included-option set the action layer derived from
   * `selectedOptionIds` (or recommended fallback). The evaluator
   * checks every entry in this list against the source snapshot's
   * `optionSnapshot` to ensure no operator-supplied id is missing.
   */
  resolvedIncludedOptionIds: string[];
  /**
   * Result of the SOW commercial guard scan against the candidate
   * SOW Draft fields + selected options. When absent, the evaluator
   * treats the guard as "not yet run" and surfaces a
   * `sow_guard_failed` reason (defensive default — production paths
   * always run the guard before the evaluator).
   */
  commercialGuardResult?: ProposalCommercialGuardResult;
}

const PRICING_NOTICE_PLACEHOLDER =
  "Pricing is pending manual review and is intentionally omitted from this draft.";
const PRICING_NOTICE_APPROVED =
  "Estimated · subject to final approval. Not a binding quote.";
const LEGAL_BOUNDARY_NOTICE =
  "Legal terms (governing law, indemnification, liability, warranty, termination) are intentionally omitted from this draft. They will be provided separately during the execution review process.";

function buildOptionOmission(
  optionId: string,
  reason: ProposalOmittedContent["reason"],
  issueCode: string,
  note: string,
): ProposalOmittedContent {
  return {
    scope: optionId,
    reason,
    issueCode,
    operatorFacingNote: note,
  };
}

export function evaluateSowDraftEligibility(
  input: SowDraftEligibilityInput,
): SowDraftEligibilityResult {
  const reasons: SowDraftEligibilityReason[] = [];
  const omittedContent: ProposalOmittedContent[] = [];
  const pricingReviewState =
    input.sourceProposalSnapshot?.pricingReviewState ?? "placeholder";
  const sowDraftNotice = {
    pricingNotice:
      pricingReviewState === "placeholder"
        ? PRICING_NOTICE_PLACEHOLDER
        : PRICING_NOTICE_APPROVED,
    legalBoundaryNotice: LEGAL_BOUNDARY_NOTICE,
  };

  if (!input.isPersistedEngagement) {
    reasons.push({
      code: "engagement_not_persisted",
      severity: "error",
      message:
        "SOW Draft snapshots only exist for persisted UUID engagements. Mock or legacy slug engagements never reach the SOW pipeline.",
    });
  }

  if (!input.sourceProposalSnapshot) {
    reasons.push({
      code: "source_snapshot_missing",
      severity: "error",
      message:
        "Source Proposal Candidate snapshot is missing. Generate or select an approved Proposal Candidate before generating a SOW Draft.",
    });
    // Without a source snapshot there is nothing else to evaluate.
    return {
      eligible: false,
      reasons,
      includedOptionIds: [],
      omittedOptionIds: [],
      omittedContent,
      pricingReviewState,
      draftWatermark: true,
      sowDraftNotice,
    };
  }

  const src = input.sourceProposalSnapshot;

  if (src.status === "voided") {
    reasons.push({
      code: "source_snapshot_voided",
      severity: "error",
      message:
        "Source Proposal Candidate snapshot is voided. SOW Draft cannot derive from a voided snapshot.",
    });
  }

  if (src.deliverySurface !== "client_proposal_candidate") {
    reasons.push({
      code: "source_surface_not_proposal_candidate",
      severity: "error",
      message:
        "Source snapshot's delivery surface is not `client_proposal_candidate`. SOW Draft can only derive from a Proposal Candidate snapshot.",
      target: src.deliverySurface,
    });
  }

  if (src.approvalState !== "approved") {
    reasons.push({
      code: "source_not_approved",
      severity: "error",
      message:
        "Source Proposal Candidate is not in `approval_state='approved'`. Approve the candidate first (Approve candidate button on the Past Proposal Candidates panel) before generating a SOW Draft.",
    });
  }

  if (!src.commercialGuardResult.passed) {
    reasons.push({
      code: "source_guard_failed",
      severity: "error",
      message:
        "Source Proposal Candidate's commercial guard scan failed at generation time. Resolve the offending option fields and regenerate the Proposal Candidate before generating a SOW Draft.",
    });
  }

  // Selected options must be a subset of the source snapshot's options
  // and must reference options that were `includedInArtifact=true` in
  // the source snapshot (the SOW cannot include options the source
  // Proposal Candidate excluded).
  const sourceOptionIds = new Set(
    src.optionSnapshot.map((o) => o.optionId),
  );
  const sourceIncludedOptionIds = new Set(
    src.optionSnapshot
      .filter((o) => o.includedInArtifact)
      .map((o) => o.optionId),
  );

  if (sourceIncludedOptionIds.size === 0) {
    reasons.push({
      code: "no_included_options",
      severity: "error",
      message:
        "Source Proposal Candidate has zero included options. Regenerate the Proposal Candidate with at least one selected option before generating a SOW Draft.",
    });
  }

  const includedOptionIds: string[] = [];
  for (const id of input.resolvedIncludedOptionIds) {
    if (!sourceOptionIds.has(id)) {
      reasons.push({
        code: "selected_option_missing",
        severity: "error",
        message:
          "An operator-selected option id is not present in the source Proposal Candidate snapshot. Re-select from the source snapshot's included options.",
        target: id,
      });
      continue;
    }
    if (!sourceIncludedOptionIds.has(id)) {
      reasons.push({
        code: "selected_option_missing",
        severity: "error",
        message:
          "An operator-selected option was excluded from the source Proposal Candidate's client-bound surface. The SOW Draft cannot include options the source snapshot omitted.",
        target: id,
      });
      continue;
    }
    includedOptionIds.push(id);
  }

  if (
    includedOptionIds.length === 0 &&
    input.resolvedIncludedOptionIds.length > 0 &&
    sourceIncludedOptionIds.size > 0
  ) {
    // Every operator-selected id was rejected by the validation above.
    // Surface a generic no-included-options error so the operator can
    // see the empty resolved set even if every individual selection
    // already has a target-tagged error.
    reasons.push({
      code: "no_included_options",
      severity: "error",
      message:
        "After validating the operator selection against the source snapshot, the included-options set is empty. Re-select from the source snapshot's included options.",
    });
  }

  // Per-option omission entries for the audit trail — every source
  // option NOT in the included set is captured.
  const includedSet = new Set(includedOptionIds);
  const omittedOptionIds: string[] = [];
  for (const option of src.optionSnapshot) {
    if (includedSet.has(option.optionId)) continue;
    omittedOptionIds.push(option.optionId);
    omittedContent.push(
      buildOptionOmission(
        option.optionId,
        "option_not_selected",
        "sow_option_not_selected",
        `Option \`${option.title}\` was not selected for this SOW Draft. Generate a new SOW Draft with this option in \`selectedOptionIds[]\` to include it.`,
      ),
    );
  }

  // Group-B canonical omission must be present in the source snapshot's
  // omittedContent — its absence indicates a pre-canon snapshot that
  // should not back a SOW Draft.
  const hasGroupBOmission = src.omittedContent.some(
    (entry) => entry.scope === "group_b_block",
  );
  if (!hasGroupBOmission) {
    reasons.push({
      code: "group_b_content_blocked",
      severity: "error",
      message:
        "Source Proposal Candidate is missing the canonical Group-B omission entry. Regenerate the Proposal Candidate (which prepends the entry by default) before generating a SOW Draft.",
    });
  }

  // SOW commercial guard verdict.
  if (!input.commercialGuardResult) {
    reasons.push({
      code: "sow_guard_failed",
      severity: "error",
      message:
        "The SOW commercial guard has not been run for this draft. The action layer must run `runSowDraftCommercialGuard(...)` before invoking the eligibility evaluator.",
    });
  } else if (!input.commercialGuardResult.passed) {
    reasons.push({
      code: "sow_guard_failed",
      severity: "error",
      message: `SOW commercial guard rejected ${input.commercialGuardResult.violations.length} violation(s). Edit the offending SOW Draft fields and regenerate.`,
    });
  }

  // Pricing / terms policy (canon § Pricing / Terms Policy).
  // `placeholder` is a non-blocking warning — the SOW Draft renderer
  // will surface the canon-mandated pricing-pending notice. Only when
  // `pricing_review_state` advances does pricing actually surface; the
  // warning is informational so the operator knows pricing is hidden.
  if (pricingReviewState === "placeholder") {
    reasons.push({
      code: "pricing_pending",
      severity: "warning",
      message:
        "Pricing is hidden in this SOW Draft because the source Proposal Candidate's pricing_review_state is `placeholder`. The mandatory pricing-pending notice will render in its place. Advance pricing via a future commercial-approval workflow to surface pricing.",
    });
  }

  // Implementation credit is hidden until a commercial-approval
  // workflow exists. The proposal-side evaluator surfaces this warning
  // too; the SOW evaluator mirrors it for symmetry.
  if (
    src.sourceContextSnapshot.implementationCredit.creditEligible &&
    pricingReviewState === "placeholder"
  ) {
    reasons.push({
      code: "implementation_credit_pending_approval",
      severity: "warning",
      message:
        "Implementation credit is captured in the snapshot but hidden from the SOW Draft surface until a commercial-approval workflow advances `pricingReviewState`. This is the canon default — no action required unless an approval path exists.",
    });
  }

  // Reviewer notes are excluded by canon. This evaluator does not
  // enforce that directly (the snapshot mapper does — the proposal
  // snapshot has no reviewer-notes field in its public jsonb shape),
  // but the warning is informational so operator review sees the
  // boundary in plain text.
  reasons.push({
    code: "reviewer_notes_excluded",
    severity: "warning",
    message:
      "Per canon, reviewer / operator notes are excluded from the SOW Draft surface by default. The SOW Draft renders only operator-curated content captured at generation time.",
  });

  // Public SOW share route is NOT part of Sprint P6. This warning is
  // operator-informational so the operator knows the generated SOW
  // Draft is internal-only for now.
  reasons.push({
    code: "public_sow_not_authorized",
    severity: "warning",
    message:
      "Public SOW share route is not authorized in Sprint P6. This SOW Draft is operator-internal only. Sprint P7-A decides whether a public `/s/[token]` route ships.",
  });

  // Eligibility is the absence of any `error`-severity reason. Warning
  // reasons do not block.
  const hasBlockingError = reasons.some((r) => r.severity === "error");

  return {
    eligible: !hasBlockingError,
    reasons,
    includedOptionIds,
    omittedOptionIds,
    omittedContent,
    pricingReviewState,
    // Always start with the draft watermark — operator approval
    // (future SOW-side approval action, optional in Sprint P6-C)
    // flips it to false.
    draftWatermark: true,
    sowDraftNotice,
  };
}
