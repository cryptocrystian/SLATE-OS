import type { ProposalDeliverySnapshot } from "./delivery-snapshot-types";
import {
  MAX_PROPOSAL_SNAPSHOT_AGE_DAYS_FOR_SHARE,
  type ProposalShareEligibility,
  type ProposalShareEligibilityReason,
} from "./share-token-types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P4 — pure snapshot share
 * eligibility evaluator.
 *
 * Canon (`docs/24` § Prepare Client Review Unlock Policy + § Snapshot
 * Model Recommendation):
 *   - Only `client_proposal_candidate` snapshots may back a share
 *     token. `sow_draft_candidate` surface is rejected here — Sprint
 *     P7 will define a SOW-specific share evaluator if SOW Draft ever
 *     gets a separate share surface (separate decision per `docs/24`
 *     § Proposed Sprint Sequence).
 *   - Voided snapshots can NEVER be shared.
 *   - `draft_watermark = true` snapshots can NEVER be shared — the
 *     operator must approve the candidate first, which flips
 *     `approval_state='approved'` AND `draft_watermark=false`.
 *   - `approval_state = 'approved'` is the proposal-side gate
 *     (stricter than the report-side, which had no approval state).
 *     Until the operator clicks Approve candidate in the Past
 *     Proposal Candidates panel, the snapshot is not share-eligible.
 *   - Commercial guard must have passed at generation time.
 *   - The canonical Group-B omission entry must be present in the
 *     snapshot's `omittedContent` — its absence indicates a pre-canon
 *     snapshot we should not surface to clients.
 *   - The snapshot must be no older than 14 days from `generatedAt`.
 *   - At least one option must be included in the snapshot.
 *
 * Returns ALL applicable reasons (not first-fail), so the UI can show
 * a complete blocker chip set. Empty `reasons` ⇔ `eligible = true`.
 *
 * Pure module — no React, no DB, no I/O. Time injection via `now` for
 * testability.
 */

export function evaluateProposalShareEligibility(
  snapshot: ProposalDeliverySnapshot,
  options?: { now?: Date; maxAgeDays?: number },
): ProposalShareEligibility {
  const now = options?.now ?? new Date();
  const maxAgeDays =
    options?.maxAgeDays ?? MAX_PROPOSAL_SNAPSHOT_AGE_DAYS_FOR_SHARE;
  const reasons: ProposalShareEligibilityReason[] = [];

  // SOW Draft surface gate — Sprint P7 scope, separately authorised.
  if (snapshot.deliverySurface === "sow_draft_candidate") {
    reasons.push({
      code: "sow_surface_not_share_eligible",
      operatorFacingNote:
        "SOW Draft snapshots are not share-eligible in Sprint P4. A separate SOW share surface lands in Sprint P7 IF authorised.",
    });
  } else if (snapshot.deliverySurface !== "client_proposal_candidate") {
    reasons.push({
      code: "snapshot_not_client_proposal_candidate",
      operatorFacingNote:
        "Snapshot's delivery surface is not `client_proposal_candidate`. Only client-safe proposal candidates are share-eligible.",
    });
  }

  if (snapshot.status === "voided") {
    reasons.push({
      code: "snapshot_voided",
      operatorFacingNote:
        "Snapshot is voided. Voided proposal candidates can never back a client share link.",
    });
  }

  if (snapshot.approvalState !== "approved") {
    reasons.push({
      code: "snapshot_not_approved",
      operatorFacingNote:
        "Snapshot is not approved. Click Approve candidate in the Past Proposal Candidates panel before generating a share link.",
    });
  }

  if (snapshot.draftWatermark) {
    reasons.push({
      code: "draft_watermark_set",
      operatorFacingNote:
        "Snapshot still carries the Draft Candidate watermark. Approve the candidate to drop the watermark before sharing.",
    });
  }

  if (!snapshot.commercialGuardResult.passed) {
    reasons.push({
      code: "commercial_guard_failed",
      operatorFacingNote:
        "Commercial guard scan failed at generation time. Resolve the flagged option content and regenerate before sharing.",
    });
  }

  const hasGroupBOmission = snapshot.omittedContent.some(
    (entry) => entry.scope === "group_b_block",
  );
  if (!hasGroupBOmission) {
    reasons.push({
      code: "group_b_block_violation",
      operatorFacingNote:
        "Snapshot is missing the canonical Group-B omission entry. Regenerate the candidate before sharing.",
    });
  }

  const includedOptionCount = snapshot.optionSnapshot.filter(
    (o) => o.includedInArtifact,
  ).length;
  if (includedOptionCount === 0) {
    reasons.push({
      code: "no_included_options",
      operatorFacingNote:
        "Snapshot has zero included options. Regenerate the candidate with a recommended option (or an explicit selection) before sharing.",
    });
  }

  const generatedAtMs = new Date(snapshot.generatedAt).getTime();
  if (!Number.isNaN(generatedAtMs)) {
    const ageMs = now.getTime() - generatedAtMs;
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) {
      reasons.push({
        code: "snapshot_too_old",
        operatorFacingNote: `Snapshot is older than ${maxAgeDays} days. Regenerate the candidate before sharing.`,
      });
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    evaluatedAt: now.toISOString(),
  };
}
