import type {
  ReportDeliverySnapshot,
} from "./delivery-snapshot-types";
import {
  MAX_SNAPSHOT_AGE_DAYS_FOR_SHARE,
  type ReportShareEligibility,
  type ReportShareEligibilityReason,
} from "./share-token-types";

/**
 * Phase 1B Sprint 4D-B — pure snapshot share-eligibility evaluator.
 *
 * Canon (docs/22 §Eligibility for Sharing):
 *   - Only `client_pdf_candidate` snapshots may back a share token.
 *   - Voided snapshots can NEVER be shared.
 *   - `draft_watermark = true` snapshots can NEVER be shared (they are
 *     explicitly the Needs Review / Draft variant).
 *   - Claim-guard must have passed at generation time.
 *   - The canonical Group-B omission entry must be present in the
 *     snapshot's `omittedExhibits` — its absence indicates a
 *     pre-canon snapshot we should not surface to clients.
 *   - The snapshot must be no older than 14 days from `generated_at`.
 *
 * Returns ALL applicable reasons (not first-fail), so the UI can show
 * a complete blocker chip set. Empty `reasons` ⇔ `eligible = true`.
 *
 * Pure module — no React, no DB, no I/O. Time injection via `now` for
 * testability.
 */

export function evaluateReportShareEligibility(
  snapshot: ReportDeliverySnapshot,
  options?: { now?: Date; maxAgeDays?: number },
): ReportShareEligibility {
  const now = options?.now ?? new Date();
  const maxAgeDays =
    options?.maxAgeDays ?? MAX_SNAPSHOT_AGE_DAYS_FOR_SHARE;
  const reasons: ReportShareEligibilityReason[] = [];

  if (snapshot.status === "voided") {
    reasons.push({
      code: "snapshot_voided",
      operatorFacingNote:
        "Snapshot is voided. Voided snapshots can never back a client share link.",
    });
  }
  // NOTE: `status === 'candidate'` is the operational status for
  // Sprint 4C/4D snapshots — the `generated` status is reserved for a
  // future sprint when real PDF binaries are produced. Eligibility
  // therefore disqualifies `voided` only; the `client_pdf_candidate`
  // delivery surface + draft-watermark + claim-guard + Group-B checks
  // below carry the rest of the safety load.

  if (snapshot.deliverySurface !== "client_pdf_candidate") {
    reasons.push({
      code: "snapshot_not_client_pdf_candidate",
      operatorFacingNote:
        "Snapshot's delivery surface is not `client_pdf_candidate`. Internal candidates are not shareable.",
    });
  }

  if (snapshot.draftWatermark) {
    reasons.push({
      code: "draft_watermark_set",
      operatorFacingNote:
        "Snapshot is the draft / Needs Review variant. Approve the report and regenerate before sharing.",
    });
  }

  if (!snapshot.claimGuardResult.passed) {
    reasons.push({
      code: "claim_guard_failed",
      operatorFacingNote:
        "Claim-guard scan failed at generation time. Resolve the flagged section copy and regenerate before sharing.",
    });
  }

  const hasGroupBOmission = snapshot.omittedExhibits.some(
    (entry) => entry.slot === "group_b_block",
  );
  if (!hasGroupBOmission) {
    reasons.push({
      code: "group_b_block_violation",
      operatorFacingNote:
        "Snapshot is missing the canonical Group-B omission entry. Regenerate the candidate before sharing.",
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
