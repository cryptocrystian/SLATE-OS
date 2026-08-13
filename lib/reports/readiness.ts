import type { ReportSection, ReportSectionType } from "./types";

/**
 * Sprint S8 — Proposal-readiness signal.
 *
 * Pure functions. No DB, no I/O. Safe to call from server pages,
 * server actions, client components, or unit tests.
 *
 * Canon: `docs/49_REPORT_SECTION_AI_DRAFTING.md` § 7 (S9 readiness).
 *
 * # Contract
 *
 * The S8 → S9 handoff requires that the operator has approved a
 * minimum viable subset of the 12-section report taxonomy AND that the
 * sections feeding the proposal carry source provenance. We do not
 * gate on per-section AI drafting — operators may write a section by
 * hand and still have it count toward S9 readiness. What matters is
 * the operator-approved state and the provenance link.
 *
 * The signal is **advisory** — never a hard gate at the action layer.
 * `docs/39` § 5 keeps proposal AI drafting in S9; the gate lives there,
 * not here. This helper exists so the report page can render an
 * operator-facing hint that tells the operator at a glance whether they
 * have enough to proceed.
 *
 * # Required-section taxonomy
 *
 * Per `docs/49` § 7, the proposal AI prompt for S9 needs these
 * five sections approved (or final) before it can run with high
 * confidence:
 *
 *   - executive-summary       — sets the framing for the proposal cover
 *   - opportunity-portfolio   — the operator-blessed opportunity list
 *   - priority-recommendations — what the proposal is actually selling
 *   - roadmap                 — the 30/60/90 sequence proposal options reference
 *   - recommended-next-step   — the explicit hand-off to the proposal
 *
 * Operators may approve other sections without affecting S9 readiness.
 * Those five are the minimum viable subset.
 *
 * # `minApprovedForS9`
 *
 * Default `5` matches the count of required sections. Configurable so
 * tests can probe edge cases.
 *
 * # Boundary
 *
 * This helper deliberately exposes no client-side mutation, no /r or
 * /p mint, no Send to Client, and no SOW affordance. The S9 sprint
 * itself owns the proposal AI flow. S10 (Internal SOW Draft) is the
 * next downstream consumer; this helper does not mention it.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Required sections for proposal drafting. `recommended-next-step` was
// folded into `priority-recommendations` in the section consolidation (see
// SECTION_ORDER in ./helpers.ts), so the immediate-next-action requirement
// is now carried by that section rather than a standalone one.
export const PROPOSAL_REQUIRED_SECTIONS: ReadonlyArray<ReportSectionType> = [
  "executive-summary",
  "opportunity-portfolio",
  "priority-recommendations",
  "roadmap",
];

export interface ProposalReadinessSignal {
  /** Total report sections in the persisted taxonomy. */
  total: number;
  /** Counts by lifecycle status. */
  notStarted: number;
  drafted: number;
  needsReview: number;
  approved: number;
  final: number;
  /** `approved + final` — the operator-blessed surface for S9. */
  operatorBlessed: number;
  /** True when `operatorBlessed >= minApprovedForS9`. */
  hasMinimumApproved: boolean;
  /** Per-required-section approved-or-final booleans (canonical labels). */
  requiredApproval: Record<ReportSectionType, boolean>;
  /** True when every section in `PROPOSAL_REQUIRED_SECTIONS` is approved/final. */
  hasAllRequiredApproved: boolean;
  /** Approved + final sections that have at least one upstream link row. */
  approvedSectionsWithProvenance: number;
  /** Approved + final sections with no upstream link rows. */
  approvedSectionsMissingProvenance: number;
  /** Operator-facing advisory strings, ordered by severity. */
  advisories: string[];
  /** Convenience boolean — `hasMinimumApproved && hasAllRequiredApproved`. */
  readyForS9: boolean;
}

export interface ProposalReadinessOptions {
  minApprovedForS9?: number;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildProposalReadinessSignal(
  sections: readonly ReportSection[],
  options?: ProposalReadinessOptions,
): ProposalReadinessSignal {
  const minApprovedForS9 = options?.minApprovedForS9 ?? 5;

  let notStarted = 0;
  let drafted = 0;
  let needsReview = 0;
  let approved = 0;
  let final = 0;

  for (const section of sections) {
    switch (section.status) {
      case "not-started":
        notStarted += 1;
        break;
      case "drafted":
        drafted += 1;
        break;
      case "needs-review":
        needsReview += 1;
        break;
      case "approved":
        approved += 1;
        break;
      case "final":
        final += 1;
        break;
      default:
        notStarted += 1;
    }
  }

  const operatorBlessed = approved + final;
  const hasMinimumApproved = operatorBlessed >= minApprovedForS9;

  const requiredApproval = buildRequiredApprovalMap(sections);
  const hasAllRequiredApproved = PROPOSAL_REQUIRED_SECTIONS.every(
    (k) => requiredApproval[k],
  );

  let approvedSectionsWithProvenance = 0;
  let approvedSectionsMissingProvenance = 0;
  for (const section of sections) {
    if (section.status !== "approved" && section.status !== "final") continue;
    const linkCount =
      section.linkedFindingIds.length +
      section.linkedOpportunityIds.length +
      section.linkedRoadmapItemIds.length;
    if (linkCount > 0) {
      approvedSectionsWithProvenance += 1;
    } else {
      approvedSectionsMissingProvenance += 1;
    }
  }

  const advisories = buildAdvisories({
    minApprovedForS9,
    operatorBlessed,
    hasMinimumApproved,
    hasAllRequiredApproved,
    requiredApproval,
    approvedSectionsMissingProvenance,
    needsReview,
    drafted,
    notStarted,
  });

  return {
    total: sections.length,
    notStarted,
    drafted,
    needsReview,
    approved,
    final,
    operatorBlessed,
    hasMinimumApproved,
    requiredApproval,
    hasAllRequiredApproved,
    approvedSectionsWithProvenance,
    approvedSectionsMissingProvenance,
    advisories,
    readyForS9: hasMinimumApproved && hasAllRequiredApproved,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequiredApprovalMap(
  sections: readonly ReportSection[],
): Record<ReportSectionType, boolean> {
  const result: Record<ReportSectionType, boolean> = {
    "executive-summary": false,
    "business-context": false,
    "systems-snapshot": false,
    "readiness-assessment": false,
    "workflow-friction": false,
    "stakeholder-synthesis": false,
    "opportunity-portfolio": false,
    "priority-recommendations": false,
    "governance-risk": false,
    roadmap: false,
    "recommended-next-step": false,
    appendix: false,
  };
  for (const section of sections) {
    if (section.status === "approved" || section.status === "final") {
      result[section.sectionType] = true;
    }
  }
  return result;
}

function buildAdvisories(args: {
  minApprovedForS9: number;
  operatorBlessed: number;
  hasMinimumApproved: boolean;
  hasAllRequiredApproved: boolean;
  requiredApproval: Record<ReportSectionType, boolean>;
  approvedSectionsMissingProvenance: number;
  needsReview: number;
  drafted: number;
  notStarted: number;
}): string[] {
  const out: string[] = [];

  if (!args.hasMinimumApproved) {
    const need = args.minApprovedForS9 - args.operatorBlessed;
    out.push(
      `Approve ${need} more section${need === 1 ? "" : "s"} to reach the ${args.minApprovedForS9}-approved threshold for proposal drafting.`,
    );
  }

  if (!args.hasAllRequiredApproved) {
    const missing = PROPOSAL_REQUIRED_SECTIONS.filter(
      (k) => !args.requiredApproval[k],
    );
    if (missing.length > 0) {
      out.push(
        `Required for proposal: approve ${missing
          .map((k) => SECTION_LABEL_FALLBACK[k])
          .join(", ")}.`,
      );
    }
  }

  if (args.approvedSectionsMissingProvenance > 0) {
    out.push(
      `${args.approvedSectionsMissingProvenance} approved section${
        args.approvedSectionsMissingProvenance === 1 ? "" : "s"
      } lack${args.approvedSectionsMissingProvenance === 1 ? "s" : ""} source provenance links. Link findings, opportunities, or roadmap items before proceeding to proposal drafting.`,
    );
  }

  if (args.needsReview > 0) {
    out.push(
      `${args.needsReview} section${args.needsReview === 1 ? "" : "s"} awaiting operator review.`,
    );
  }

  if (args.drafted > 0 && args.needsReview === 0) {
    out.push(
      `${args.drafted} drafted section${args.drafted === 1 ? "" : "s"} ready to promote to needs-review or approved.`,
    );
  }

  return out;
}

/**
 * Local fallback labels — duplicated rather than imported from
 * `lib/reports/helpers.ts` because that module also exports the canonical
 * `SECTION_ORDER` array, which we don't need here. Keeping this helper
 * dependency-free makes it cheap to import from server components, client
 * components, and unit tests alike.
 */
const SECTION_LABEL_FALLBACK: Record<ReportSectionType, string> = {
  "executive-summary": "Executive Summary",
  "business-context": "Business Context",
  "systems-snapshot": "Current-State Systems Snapshot",
  "readiness-assessment": "AI Readiness Assessment",
  "workflow-friction": "Workflow Friction Analysis",
  "stakeholder-synthesis": "Stakeholder Discovery Synthesis",
  "opportunity-portfolio": "AI Opportunity Portfolio",
  "priority-recommendations": "Priority Recommendations",
  "governance-risk": "Risk and Governance Notes",
  roadmap: "30/60/90-Day Roadmap",
  "recommended-next-step": "Recommended Next Step",
  appendix: "Appendix",
};
