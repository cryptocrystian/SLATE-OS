import type { SourceRef, SourceRefType } from "./types";

/**
 * Sprint S5 — Findings provenance summary.
 *
 * Canon: `docs/44_FINDINGS_APPROVAL_POLISH.md`.
 *
 * Pure function. No DB, no I/O. Takes the source-refs persisted on a
 * finding (created by S4 synthesis or operator-attached) and returns
 * lane counts + the "needs validation" verdict the UI surfaces on
 * each finding card.
 *
 * Source-ref type → canonical lane mapping (per `docs/39` § 4):
 *   - `stakeholder-response`     → ambiguous between primary and tertiary;
 *                                  resolved via the source's recorded
 *                                  `source_type` field on the underlying
 *                                  stakeholder_response row when the
 *                                  evidence aggregator persisted it. The
 *                                  ref's `sourceLabel` and `excerpt` give
 *                                  hints, but for provenance summary at
 *                                  the finding-card layer we treat any
 *                                  `stakeholder-response` ref as
 *                                  contributing to a generic "stakeholder
 *                                  evidence" bucket. The lane it came
 *                                  from is preserved separately in the
 *                                  evidence bundle metadata at synthesis
 *                                  time; the helper here projects what
 *                                  the operator UI needs without
 *                                  re-fetching the response row.
 *   - `uploaded-document`        → tertiary lane (offline_operator).
 *   - `scorecard-answer`         → engagement-context, not a primary lane.
 *   - `consultant-note`          → operator-typed; tertiary lane.
 *
 * Needs-validation rules:
 *   - No source refs at all → needs validation (assumption-flagged).
 *   - All refs strength = `thin` or `missing` → needs validation.
 *   - All refs are scorecard/consultant-note (no stakeholder claims)
 *     → needs validation.
 *   - Otherwise the finding has at least one solid stakeholder-tied
 *     ref and does not need validation.
 */

export interface FindingProvenanceSummary {
  /** Total ref count (excluding null/empty). */
  totalRefs: number;
  /** Refs whose `type === 'stakeholder-response'`. */
  stakeholderResponseRefs: number;
  /** Refs whose `type === 'uploaded-document'`. */
  uploadedDocumentRefs: number;
  /** Refs whose `type === 'scorecard-answer'`. */
  scorecardAnswerRefs: number;
  /** Refs whose `type === 'consultant-note'`. */
  consultantNoteRefs: number;
  /** Number of refs with strength = 'strong'. */
  strongRefs: number;
  /** Number of refs with strength = 'adequate'. */
  adequateRefs: number;
  /** Number of refs with strength = 'thin'. */
  thinRefs: number;
  /** Dominant strength across all refs. */
  dominantStrength: "strong" | "adequate" | "thin" | "missing";
  /** True when synthesis weight was weak or absent. */
  needsValidation: boolean;
  /** Short operator-facing reason for the needs-validation verdict.
   *  Null when the finding does not need validation. */
  needsValidationReason: string | null;
}

export function summarizeFindingProvenance(
  refs: SourceRef[] | null | undefined,
  /** Optional flag from the finding row. When true the finding was
   *  marked `assumption_flag=true` at synthesis time — that is a
   *  stronger needs-validation signal than ref counts alone. */
  assumptionFlag?: boolean,
): FindingProvenanceSummary {
  const list = Array.isArray(refs) ? refs : [];
  const byType: Record<SourceRefType, number> = {
    "stakeholder-response": 0,
    "uploaded-document": 0,
    "scorecard-answer": 0,
    "consultant-note": 0,
  };
  let strong = 0;
  let adequate = 0;
  let thin = 0;
  for (const ref of list) {
    if (!ref) continue;
    byType[ref.type] += 1;
    if (ref.strength === "strong") strong += 1;
    else if (ref.strength === "adequate") adequate += 1;
    else thin += 1;
  }
  const total = list.length;

  let dominantStrength: FindingProvenanceSummary["dominantStrength"];
  if (total === 0) dominantStrength = "missing";
  else if (strong >= Math.max(adequate, thin)) dominantStrength = "strong";
  else if (adequate >= thin) dominantStrength = "adequate";
  else dominantStrength = "thin";

  let needsValidation = false;
  let needsValidationReason: string | null = null;
  if (assumptionFlag) {
    needsValidation = true;
    needsValidationReason =
      "Synthesis marked this finding assumption-flagged — evidence was thin or absent at draft time.";
  } else if (total === 0) {
    needsValidation = true;
    needsValidationReason = "No source refs attached. Operator should add evidence before approval.";
  } else if (strong === 0 && adequate === 0) {
    needsValidation = true;
    needsValidationReason =
      "All source refs are rated thin or missing. Corroborate with stakeholder evidence before approval.";
  } else if (
    byType["stakeholder-response"] === 0 &&
    byType["uploaded-document"] === 0
  ) {
    needsValidation = true;
    needsValidationReason =
      "Only engagement-level context (scorecard or consultant notes) supports this finding. Stakeholder claim needed before approval.";
  }

  return {
    totalRefs: total,
    stakeholderResponseRefs: byType["stakeholder-response"],
    uploadedDocumentRefs: byType["uploaded-document"],
    scorecardAnswerRefs: byType["scorecard-answer"],
    consultantNoteRefs: byType["consultant-note"],
    strongRefs: strong,
    adequateRefs: adequate,
    thinRefs: thin,
    dominantStrength,
    needsValidation,
    needsValidationReason,
  };
}

// ---------------------------------------------------------------------------
// Opportunities readiness signal
// ---------------------------------------------------------------------------

export interface OpportunitiesReadinessSignal {
  /** Count of findings with review_status === 'approved' or 'report-ready'. */
  approved: number;
  /** Count of findings with review_status === 'rejected'. */
  rejected: number;
  /** Count of findings with review_status === 'needs-review' or 'edited' or 'draft'. */
  draft: number;
  /** Total findings the operator might still act on. */
  total: number;
  /** Approved findings whose provenance summary returns needs-validation. */
  approvedNeedsValidation: number;
  /** Minimum approved findings the canonical Sprint S6 opportunities
   *  drafting will want. Operator-facing threshold; not enforced here. */
  minApprovedForS6: number;
  /** True when `approved >= minApprovedForS6`. */
  readyForS6: boolean;
  /** Operator-readable advisories (non-blocking). */
  warnings: string[];
}

export interface ApprovedFindingProvenanceLike {
  reviewStatus: string;
  provenance?: FindingProvenanceSummary | null;
}

/**
 * Pure projection of an engagement's findings into the S6 readiness
 * signal. The threshold and warnings are operator-facing; nothing in
 * this helper blocks S6 (S6 is not yet built, and S5 explicitly does
 * not implement opportunities drafting).
 */
export function buildOpportunitiesReadinessSignal(
  findings: ApprovedFindingProvenanceLike[],
  options: { minApprovedForS6?: number } = {},
): OpportunitiesReadinessSignal {
  const minApprovedForS6 = options.minApprovedForS6 ?? 5;
  let approved = 0;
  let rejected = 0;
  let draft = 0;
  let approvedNeedsValidation = 0;
  for (const f of findings) {
    switch (f.reviewStatus) {
      case "approved":
      case "report-ready":
        approved += 1;
        if (f.provenance?.needsValidation) approvedNeedsValidation += 1;
        break;
      case "rejected":
        rejected += 1;
        break;
      case "draft":
      case "needs-review":
      case "edited":
      default:
        draft += 1;
        break;
    }
  }
  const warnings: string[] = [];
  if (approved === 0 && draft > 0) {
    warnings.push(
      "No findings approved yet. Approve at least one finding before considering S6 opportunities drafting.",
    );
  }
  if (approved > 0 && approvedNeedsValidation === approved) {
    warnings.push(
      "Every approved finding currently carries a needs-validation flag. Corroborate with stakeholder evidence before drafting opportunities, or the resulting opportunities will inherit weak provenance.",
    );
  } else if (approved > 0 && approvedNeedsValidation > 0) {
    warnings.push(
      `${approvedNeedsValidation} of ${approved} approved finding${approved === 1 ? "" : "s"} carry a needs-validation flag. Review evidence before treating them as scoped opportunities.`,
    );
  }
  if (approved > 0 && approved < minApprovedForS6) {
    warnings.push(
      `Only ${approved} approved finding${approved === 1 ? "" : "s"} so far. Sprint S6 opportunities drafting typically wants at least ${minApprovedForS6}.`,
    );
  }

  return {
    approved,
    rejected,
    draft,
    total: approved + rejected + draft,
    approvedNeedsValidation,
    minApprovedForS6,
    readyForS6: approved >= minApprovedForS6,
    warnings,
  };
}
