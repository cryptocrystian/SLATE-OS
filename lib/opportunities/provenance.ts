import type {
  FindingProvenanceSummary,
} from "@/lib/findings/provenance";
import type { EvidenceStrength, OpportunityStatus } from "./types";

/**
 * Sprint S6 — Opportunities provenance summary + S7 roadmap readiness
 * signal.
 *
 * Canon: `docs/45_OPPORTUNITIES_AI_DRAFTING.md` § 3, § 5, § 7.
 *
 * Pure functions. No DB, no I/O. Safe to call from server pages,
 * server actions, client components, or unit tests.
 *
 * # Provenance preservation contract
 *
 * Every opportunity is derived from one or more approved findings
 * (S4-synthesis or operator-authored). The S5 helper
 * `summarizeFindingProvenance` projects each finding's source-ref set
 * into a `needsValidation` verdict. S6 carries that verdict forward at
 * the opportunity level:
 *
 *   - If ANY source finding for an opportunity carries
 *     `needsValidation = true`, the opportunity inherits a
 *     needs-validation flag — operator should corroborate evidence
 *     before promoting it into the roadmap.
 *   - Source-finding count is preserved so the card can show
 *     "Backed by N findings" with the needs-validation overlay when
 *     applicable.
 *
 * This is provenance preservation, not evidence-strength rewriting.
 * The opportunity's own `evidenceStrength` axis (set by AI synthesis or
 * the operator) is independent — it summarises overall confidence in
 * the opportunity, not the provenance of its source findings.
 */

export interface OpportunityProvenanceSummary {
  /** Total findings linked via `opportunity_finding_links`. */
  totalSourceFindings: number;
  /** Source findings whose persisted refs produce a needs-validation
   *  verdict via `summarizeFindingProvenance`. */
  needsValidationSourceFindings: number;
  /** Source findings whose persisted refs are dominantly strong. */
  strongSourceFindings: number;
  /** Source findings whose dominant strength is adequate. */
  adequateSourceFindings: number;
  /** Source findings whose dominant strength is thin or missing. */
  thinSourceFindings: number;
  /** True when the opportunity inherits a needs-validation flag from
   *  any source finding OR when no source findings exist. */
  needsValidation: boolean;
  /** Short operator-facing reason for the verdict. Null when clean. */
  needsValidationReason: string | null;
}

/**
 * Compute the provenance summary for a single opportunity.
 *
 * @param relatedFindingIds The opportunity's
 *   `relatedFindingIds` array (from `opportunity_finding_links`).
 * @param findingProvenanceById Map of finding-id → S5 provenance
 *   summary. Findings not present in the map are treated as missing
 *   and contribute to the needs-validation count (defensive default).
 */
export function summarizeOpportunityProvenance(
  relatedFindingIds: ReadonlyArray<string>,
  findingProvenanceById: ReadonlyMap<string, FindingProvenanceSummary>,
): OpportunityProvenanceSummary {
  const ids = Array.isArray(relatedFindingIds) ? relatedFindingIds : [];
  let needsValidationSourceFindings = 0;
  let strong = 0;
  let adequate = 0;
  let thin = 0;
  let missingFromMap = 0;

  for (const id of ids) {
    const summary = findingProvenanceById.get(id);
    if (!summary) {
      missingFromMap += 1;
      thin += 1;
      needsValidationSourceFindings += 1;
      continue;
    }
    if (summary.needsValidation) needsValidationSourceFindings += 1;
    switch (summary.dominantStrength) {
      case "strong":
        strong += 1;
        break;
      case "adequate":
        adequate += 1;
        break;
      case "thin":
      case "missing":
      default:
        thin += 1;
        break;
    }
  }

  const total = ids.length;
  let needsValidation = false;
  let needsValidationReason: string | null = null;

  if (total === 0) {
    needsValidation = true;
    needsValidationReason =
      "Not linked to any source findings. Attach approved findings before promoting into the roadmap.";
  } else if (needsValidationSourceFindings === total) {
    needsValidation = true;
    needsValidationReason =
      "Every source finding carries a needs-validation flag. Corroborate with stakeholder evidence before promoting.";
  } else if (needsValidationSourceFindings > 0) {
    needsValidation = true;
    needsValidationReason = `${needsValidationSourceFindings} of ${total} source finding${
      total === 1 ? "" : "s"
    } carry a needs-validation flag. Review evidence before promoting.`;
  } else if (missingFromMap === total) {
    // All linked finding IDs were unknown to the provenance map.
    // Defensive — treat as needs-validation rather than silently green.
    needsValidation = true;
    needsValidationReason =
      "Linked findings were not loaded with provenance. Refresh the findings page and re-evaluate before promoting.";
  }

  return {
    totalSourceFindings: total,
    needsValidationSourceFindings,
    strongSourceFindings: strong,
    adequateSourceFindings: adequate,
    thinSourceFindings: thin,
    needsValidation,
    needsValidationReason,
  };
}

// ---------------------------------------------------------------------------
// Sanitized activity-metadata projection
// ---------------------------------------------------------------------------

export interface OpportunityProvenanceMetadata {
  totalSourceFindings: number;
  needsValidationSourceFindings: number;
  strongSourceFindings: number;
  adequateSourceFindings: number;
  thinSourceFindings: number;
  needsValidation: boolean;
}

/**
 * Project a provenance summary into the sanitized shape recorded on
 * activity-event metadata. Counts only — never the underlying source
 * finding IDs (the activity feed never re-renders source identity).
 */
export function provenanceForActivityMetadata(
  summary: OpportunityProvenanceSummary,
): OpportunityProvenanceMetadata {
  return {
    totalSourceFindings: summary.totalSourceFindings,
    needsValidationSourceFindings: summary.needsValidationSourceFindings,
    strongSourceFindings: summary.strongSourceFindings,
    adequateSourceFindings: summary.adequateSourceFindings,
    thinSourceFindings: summary.thinSourceFindings,
    needsValidation: summary.needsValidation,
  };
}

// ---------------------------------------------------------------------------
// Roadmap readiness signal (S7 hint — read-only, does NOT block S7)
// ---------------------------------------------------------------------------

export interface RoadmapReadinessSignal {
  /** Opportunities with status === 'selected' (operator-approved for
   *  roadmap drafting). */
  selected: number;
  /** Opportunities with status === 'deferred' (parked for a future
   *  engagement; not roadmap candidates). */
  deferred: number;
  /** Opportunities with status === 'rejected'. */
  rejected: number;
  /** Opportunities still in pre-approval (`draft` or `scored`). */
  draft: number;
  /** Sum of all opportunities seen. */
  total: number;
  /** Selected opportunities whose provenance summary inherits
   *  `needsValidation`. */
  selectedNeedsValidation: number;
  /** Selected opportunities flagged with evidence strength = 'thin'. */
  selectedThinEvidence: number;
  /** Selected opportunities placed in the `defer-avoid` quadrant —
   *  operator may want to re-triage. */
  selectedInDeferAvoid: number;
  /** Recommended minimum selected opportunities before drafting an S7
   *  roadmap. Threshold default 3; overridable. */
  minSelectedForS7: number;
  /** True when `selected >= minSelectedForS7`. */
  readyForS7: boolean;
  /** Operator-readable advisories (non-blocking). */
  warnings: string[];
}

export interface RoadmapOpportunityLike {
  status: OpportunityStatus | null | undefined;
  /** The opportunity's own evidence strength axis. */
  evidenceStrength: EvidenceStrength;
  /** The opportunity's quadrant. */
  quadrant: string;
  /** Provenance summary derived from source findings. */
  provenance?: OpportunityProvenanceSummary | null;
}

/**
 * Pure projection of an engagement's opportunities into the S7
 * readiness signal. The threshold and warnings are operator-facing;
 * nothing in this helper blocks S7 (S7 is not yet built; this signal
 * surfaces how close the engagement is to a drafting-ready state).
 *
 * Boundary:
 *   - Rejected and deferred opportunities NEVER feed the `selected`
 *     count. The signal is exclusively about operator-approved
 *     ("selected") opportunities.
 *   - The needs-validation count is reported but does NOT subtract
 *     from `selected`; operator may legitimately promote a
 *     needs-validation opportunity into the roadmap with intent to
 *     scope it during S7.
 */
export function buildRoadmapReadinessSignal(
  opportunities: ReadonlyArray<RoadmapOpportunityLike>,
  options: { minSelectedForS7?: number } = {},
): RoadmapReadinessSignal {
  const minSelectedForS7 = options.minSelectedForS7 ?? 3;
  let selected = 0;
  let deferred = 0;
  let rejected = 0;
  let draft = 0;
  let selectedNeedsValidation = 0;
  let selectedThinEvidence = 0;
  let selectedInDeferAvoid = 0;

  for (const o of opportunities) {
    switch (o.status) {
      case "selected":
        selected += 1;
        if (o.provenance?.needsValidation) selectedNeedsValidation += 1;
        if (o.evidenceStrength === "thin") selectedThinEvidence += 1;
        if (o.quadrant === "defer-avoid") selectedInDeferAvoid += 1;
        break;
      case "deferred":
        deferred += 1;
        break;
      case "rejected":
        rejected += 1;
        break;
      case "draft":
      case "scored":
      default:
        draft += 1;
        break;
    }
  }

  const warnings: string[] = [];
  if (selected === 0 && (draft > 0 || deferred > 0 || rejected > 0)) {
    warnings.push(
      "No opportunities selected yet. Mark at least one opportunity selected before drafting an S7 roadmap.",
    );
  } else if (selected === 0) {
    warnings.push(
      "No opportunities yet. Generate draft opportunities or author one manually, then select before drafting an S7 roadmap.",
    );
  }
  if (selected > 0 && selectedNeedsValidation === selected) {
    warnings.push(
      "Every selected opportunity inherits a needs-validation flag from its source findings. Corroborate evidence before drafting a roadmap or expect each roadmap item to inherit weak provenance.",
    );
  } else if (selected > 0 && selectedNeedsValidation > 0) {
    warnings.push(
      `${selectedNeedsValidation} of ${selected} selected opportunit${
        selected === 1 ? "y" : "ies"
      } inherit a needs-validation flag from source findings. Plan scoping work into the roadmap or shore up the evidence first.`,
    );
  }
  if (selected > 0 && selectedThinEvidence === selected) {
    warnings.push(
      "Every selected opportunity carries thin evidence-strength. Roadmap items drafted from these should be treated as exploratory scoping work.",
    );
  } else if (selected > 0 && selectedThinEvidence > 0) {
    warnings.push(
      `${selectedThinEvidence} of ${selected} selected opportunit${
        selected === 1 ? "y" : "ies"
      } carry thin evidence-strength. Consider an evidence pass before roadmap drafting.`,
    );
  }
  if (selected > 0 && selectedInDeferAvoid > 0) {
    warnings.push(
      `${selectedInDeferAvoid} selected opportunit${
        selectedInDeferAvoid === 1 ? "y is" : "ies are"
      } in the defer-or-avoid quadrant. Reconsider before drafting a roadmap around them.`,
    );
  }
  if (selected > 0 && selected < minSelectedForS7) {
    warnings.push(
      `Only ${selected} selected opportunit${
        selected === 1 ? "y" : "ies"
      } so far. Sprint S7 roadmap drafting typically wants at least ${minSelectedForS7}.`,
    );
  }

  return {
    selected,
    deferred,
    rejected,
    draft,
    total: selected + deferred + rejected + draft,
    selectedNeedsValidation,
    selectedThinEvidence,
    selectedInDeferAvoid,
    minSelectedForS7,
    readyForS7: selected >= minSelectedForS7,
    warnings,
  };
}
