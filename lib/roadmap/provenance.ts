import type {
  OpportunityProvenanceSummary,
} from "@/lib/opportunities/provenance";
import type { RoadmapPhase } from "./types";
import type { RoadmapStatus } from "./mappers";

/**
 * Sprint S7 — Roadmap provenance summary + S8 report-readiness signal.
 *
 * Canon: `docs/48_ROADMAP_AI_DRAFTING.md` § 3, § 5, § 7.
 *
 * Pure functions. No DB, no I/O. Safe to call from server pages,
 * server actions, client components, or unit tests.
 *
 * # Provenance preservation contract
 *
 * Each roadmap item is derived from one or more selected opportunities
 * (via `roadmap_items.opportunity_id`). The S6 helper
 * `summarizeOpportunityProvenance` already projects each opportunity's
 * source-finding `needsValidation` verdict. S7 carries that verdict
 * forward at the roadmap-item level:
 *
 *   - If the linked opportunity carries `needsValidation = true`, the
 *     roadmap item inherits a needs-validation flag — the operator
 *     should corroborate the underlying evidence before promoting the
 *     item to `ready` (the report-input state).
 *   - When a roadmap item has no linked opportunity (operator-authored
 *     directly), provenance is `unknown` — surfaced as a "no source
 *     opportunity" advisory so the operator can attach one.
 *
 * This is provenance preservation, not evidence-strength rewriting.
 * The roadmap item's own readiness still depends on operator review;
 * the provenance flag is an advisory the operator UI surfaces.
 */

export interface RoadmapItemProvenanceSummary {
  /** True when the roadmap item has a linked opportunity_id. */
  hasSourceOpportunity: boolean;
  /** True when the linked opportunity carries `needsValidation`. */
  needsValidation: boolean;
  /** Short operator-facing reason for the verdict. Null when clean. */
  needsValidationReason: string | null;
  /** True when the linked opportunity was deferred/rejected (which
   *  would indicate stale roadmap state). */
  sourceOpportunityInactive: boolean;
}

export function summarizeRoadmapItemProvenance(
  linkedOpportunityId: string | null | undefined,
  opportunityProvenanceById: ReadonlyMap<string, OpportunityProvenanceSummary>,
  opportunityStatusById: ReadonlyMap<string, string | null | undefined>,
): RoadmapItemProvenanceSummary {
  if (!linkedOpportunityId) {
    return {
      hasSourceOpportunity: false,
      needsValidation: true,
      needsValidationReason:
        "Roadmap item has no linked source opportunity. Link one before promoting to report-input state.",
      sourceOpportunityInactive: false,
    };
  }
  const opProv = opportunityProvenanceById.get(linkedOpportunityId);
  const opStatus = opportunityStatusById.get(linkedOpportunityId) ?? null;
  const opInactive =
    opStatus === "rejected" || opStatus === "deferred";

  if (opInactive) {
    return {
      hasSourceOpportunity: true,
      needsValidation: true,
      needsValidationReason: `Linked opportunity is currently ${opStatus}; the roadmap item carries stale provenance. Re-link to a selected opportunity or defer the roadmap item.`,
      sourceOpportunityInactive: true,
    };
  }
  if (!opProv) {
    return {
      hasSourceOpportunity: true,
      needsValidation: true,
      needsValidationReason:
        "Linked opportunity could not be matched to a provenance summary. Refresh the opportunities page and re-evaluate.",
      sourceOpportunityInactive: false,
    };
  }
  if (opProv.needsValidation) {
    return {
      hasSourceOpportunity: true,
      needsValidation: true,
      needsValidationReason:
        opProv.needsValidationReason ??
        "Linked opportunity inherits a needs-validation flag from its source findings.",
      sourceOpportunityInactive: false,
    };
  }
  return {
    hasSourceOpportunity: true,
    needsValidation: false,
    needsValidationReason: null,
    sourceOpportunityInactive: false,
  };
}

// ---------------------------------------------------------------------------
// Sanitized activity-metadata projection
// ---------------------------------------------------------------------------

export interface RoadmapItemProvenanceMetadata {
  hasSourceOpportunity: boolean;
  needsValidation: boolean;
  sourceOpportunityInactive: boolean;
}

export function provenanceForActivityMetadata(
  summary: RoadmapItemProvenanceSummary,
): RoadmapItemProvenanceMetadata {
  return {
    hasSourceOpportunity: summary.hasSourceOpportunity,
    needsValidation: summary.needsValidation,
    sourceOpportunityInactive: summary.sourceOpportunityInactive,
  };
}

// ---------------------------------------------------------------------------
// S8 report-readiness signal (read-only, does NOT block S8)
// ---------------------------------------------------------------------------

export interface ReportReadinessSignal {
  /** Roadmap items with status === 'ready' (operator-approved for the
   *  report-input lane). */
  approved: number;
  /** Roadmap items with status === 'deferred'. */
  deferred: number;
  /** Roadmap items with status === 'rejected'. */
  rejected: number;
  /** Roadmap items with status === 'planned' or anything pre-approval. */
  draft: number;
  /** Sum of all roadmap items seen. */
  total: number;
  /** Approved roadmap items whose provenance summary inherits
   *  `needsValidation`. */
  approvedNeedsValidation: number;
  /** Phase coverage among approved items. */
  approvedPhaseCoverage: {
    first30: number;
    days3160: number;
    days6190: number;
  };
  /** True when approved items include ≥1 `quick-win` priority. */
  hasApprovedQuickWin: boolean;
  /** True when approved items include ≥1 `strategic-build` priority. */
  hasApprovedStrategicBuild: boolean;
  /** Recommended minimum approved items before drafting S8 report
   *  sections. Threshold default 3; overridable. */
  minApprovedForS8: number;
  /** True when `approved >= minApprovedForS8`. */
  readyForS8: boolean;
  /** Operator-readable advisories (non-blocking). */
  warnings: string[];
}

export interface ReportRoadmapItemLike {
  status: RoadmapStatus | null | undefined;
  phase: RoadmapPhase | null | undefined;
  priority: string | null | undefined;
  provenance?: RoadmapItemProvenanceSummary | null;
}

/**
 * Pure projection of an engagement's roadmap into the S8 readiness
 * signal. The threshold and warnings are operator-facing; nothing in
 * this helper blocks S8 (S8 is not yet implemented; this surfaces how
 * close the engagement is to a report-drafting state).
 *
 * Boundary:
 *   - Rejected, deferred, planned, blocked, completed items NEVER
 *     count toward `approved`. Only `ready` items feed the S8
 *     input set.
 *   - The needs-validation count is reported but does NOT subtract
 *     from `approved`; the operator may legitimately promote a
 *     needs-validation roadmap item to `ready` with intent to scope
 *     it inside the report sections.
 */
export function buildReportReadinessSignal(
  items: ReadonlyArray<ReportRoadmapItemLike>,
  options: { minApprovedForS8?: number } = {},
): ReportReadinessSignal {
  const minApprovedForS8 = options.minApprovedForS8 ?? 3;
  let approved = 0;
  let deferred = 0;
  let rejected = 0;
  let draft = 0;
  let approvedNeedsValidation = 0;
  let hasApprovedQuickWin = false;
  let hasApprovedStrategicBuild = false;
  const approvedPhaseCoverage = { first30: 0, days3160: 0, days6190: 0 };

  for (const i of items) {
    switch (i.status) {
      case "ready":
        approved += 1;
        if (i.provenance?.needsValidation) approvedNeedsValidation += 1;
        if (i.priority === "quick-win") hasApprovedQuickWin = true;
        if (i.priority === "strategic-build") hasApprovedStrategicBuild = true;
        switch (i.phase) {
          case "first-30":
            approvedPhaseCoverage.first30 += 1;
            break;
          case "days-31-60":
            approvedPhaseCoverage.days3160 += 1;
            break;
          case "days-61-90":
            approvedPhaseCoverage.days6190 += 1;
            break;
          default:
            break;
        }
        break;
      case "deferred":
        deferred += 1;
        break;
      case "rejected":
        rejected += 1;
        break;
      case "planned":
      case "blocked":
      case "completed":
      default:
        draft += 1;
        break;
    }
  }

  const warnings: string[] = [];
  if (approved === 0 && (draft > 0 || deferred > 0 || rejected > 0)) {
    warnings.push(
      "No roadmap items approved yet. Mark at least one item ready before drafting S8 report sections.",
    );
  } else if (approved === 0) {
    warnings.push(
      "No roadmap items yet. Generate a draft roadmap from selected opportunities, then approve before drafting S8.",
    );
  }
  if (approved > 0 && approvedNeedsValidation === approved) {
    warnings.push(
      "Every approved roadmap item inherits a needs-validation flag from its source opportunity / findings. Corroborate evidence before drafting report sections.",
    );
  } else if (approved > 0 && approvedNeedsValidation > 0) {
    warnings.push(
      `${approvedNeedsValidation} of ${approved} approved roadmap item${
        approved === 1 ? "" : "s"
      } inherit a needs-validation flag. Plan scoping work into the report sections.`,
    );
  }
  if (approved > 0 && !hasApprovedQuickWin) {
    warnings.push(
      "No approved quick-win items. Report sections that highlight near-term momentum will read thin without one.",
    );
  }
  if (approved > 0 && !hasApprovedStrategicBuild) {
    warnings.push(
      "No approved strategic-build items. Report sections that articulate longer-horizon investment will read thin without one.",
    );
  }
  if (approved > 0 && approvedPhaseCoverage.first30 === 0) {
    warnings.push(
      "No approved first-30 items. Reports without a 30-day execution path tend to under-sell momentum.",
    );
  }
  if (approved > 0 && approved < minApprovedForS8) {
    warnings.push(
      `Only ${approved} approved roadmap item${
        approved === 1 ? "" : "s"
      } so far. Sprint S8 report-section drafting typically wants at least ${minApprovedForS8}.`,
    );
  }

  return {
    approved,
    deferred,
    rejected,
    draft,
    total: approved + deferred + rejected + draft,
    approvedNeedsValidation,
    approvedPhaseCoverage,
    hasApprovedQuickWin,
    hasApprovedStrategicBuild,
    minApprovedForS8,
    readyForS8: approved >= minApprovedForS8,
    warnings,
  };
}
