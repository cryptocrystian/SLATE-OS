import type { ProposalDeliverySnapshot } from "./delivery-snapshot-types";
import {
  MAX_SOW_SNAPSHOT_AGE_DAYS_FOR_SHARE,
  type SowShareEligibility,
  type SowShareEligibilityReason,
} from "./sow-share-types";

/**
 * Phase 1B SOW Share Route Sprint P7-B — pure SOW-Draft share
 * eligibility evaluator. Encodes `docs/28` § 5 criteria + `docs/65`.
 *
 * Differences from the proposal-side evaluator
 * (`evaluateProposalShareEligibility`):
 *   - The surface must be `sow_draft_candidate` (the proposal evaluator
 *     rejects that surface; this one requires it).
 *   - `draft_watermark` is NOT a blocker. A shared SOW stays a draft —
 *     approval gates shareability but keeps the DRAFT stripe as an
 *     e-signature-confusion mitigation (`docs/28` § 9). The proposal
 *     evaluator requires `draft_watermark=false`; the SOW one ignores it.
 *   - The source Proposal Candidate must ALSO be approved (`docs/28` § 5
 *     criterion 4). This evaluator is pure, so the caller resolves the
 *     source's approval state and passes it as `sourceProposalApproved`.
 *     It fails CLOSED: if the caller cannot confirm the source is
 *     approved, it must pass `false`.
 *
 * Returns ALL applicable reasons (not first-fail). Empty ⇔ eligible.
 * Pure module — no React, no DB, no I/O. Time injection via `now`.
 */

export function evaluateSowShareEligibility(
  snapshot: ProposalDeliverySnapshot,
  options: {
    /**
     * Whether the source Proposal Candidate snapshot is currently
     * approved and not voided (`docs/28` § 5 criterion 4). Fails closed:
     * callers that cannot confirm it MUST pass `false`.
     */
    sourceProposalApproved: boolean;
    now?: Date;
    maxAgeDays?: number;
  },
): SowShareEligibility {
  const now = options.now ?? new Date();
  const maxAgeDays = options.maxAgeDays ?? MAX_SOW_SNAPSHOT_AGE_DAYS_FOR_SHARE;
  const reasons: SowShareEligibilityReason[] = [];

  if (snapshot.deliverySurface !== "sow_draft_candidate") {
    reasons.push({
      code: "snapshot_not_sow_draft",
      operatorFacingNote:
        "Snapshot's delivery surface is not `sow_draft_candidate`. Only SOW Drafts back a SOW share link.",
    });
  }

  if (snapshot.status === "voided") {
    reasons.push({
      code: "snapshot_voided",
      operatorFacingNote:
        "SOW Draft is voided. Voided SOW Drafts can never back a share link.",
    });
  }

  if (snapshot.approvalState !== "approved") {
    reasons.push({
      code: "snapshot_not_approved",
      operatorFacingNote:
        "SOW Draft is not approved. Click Approve SOW Draft in the Past SOW Drafts panel before generating a share link.",
    });
  }

  // Note: draft_watermark is intentionally NOT checked. A shared SOW
  // keeps its DRAFT stripe (docs/28 § 9).

  if (!options.sourceProposalApproved) {
    reasons.push({
      code: "source_proposal_not_approved",
      operatorFacingNote:
        "The source Proposal Candidate is not approved (or was voided). Approve the source proposal, or regenerate the SOW Draft from an approved candidate, before sharing.",
    });
  }

  if (!snapshot.commercialGuardResult.passed) {
    reasons.push({
      code: "commercial_guard_failed",
      operatorFacingNote:
        "SOW commercial guard scan failed at generation time. Resolve the flagged content and regenerate before sharing.",
    });
  }

  const hasGroupBOmission = snapshot.omittedContent.some(
    (entry) => entry.scope === "group_b_block",
  );
  if (!hasGroupBOmission) {
    reasons.push({
      code: "group_b_block_violation",
      operatorFacingNote:
        "SOW Draft is missing the canonical Group-B omission entry. Regenerate the draft before sharing.",
    });
  }

  const includedOptionCount = snapshot.optionSnapshot.filter(
    (o) => o.includedInArtifact,
  ).length;
  if (includedOptionCount === 0) {
    reasons.push({
      code: "no_included_options",
      operatorFacingNote:
        "SOW Draft has zero included options. Regenerate from a proposal candidate with a selected option before sharing.",
    });
  }

  const generatedAtMs = new Date(snapshot.generatedAt).getTime();
  if (!Number.isNaN(generatedAtMs)) {
    const ageMs = now.getTime() - generatedAtMs;
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) {
      reasons.push({
        code: "snapshot_too_old",
        operatorFacingNote: `SOW Draft is older than ${maxAgeDays} days. Regenerate before sharing.`,
      });
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    evaluatedAt: now.toISOString(),
  };
}
