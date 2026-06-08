import type { ProposalCommercialGuardResult } from "./delivery-snapshot-types";
import type { Proposal, ProposalOption } from "./types";

/**
 * Sprint S9 — S10 Internal SOW Draft readiness signal.
 *
 * Pure functions. No DB, no I/O. Safe to call from server pages,
 * server actions, client components, or unit tests.
 *
 * Canon: `docs/51_PROPOSAL_AI_DRAFTING.md` § 7 (S10 readiness).
 *
 * # Contract
 *
 * The S9 → S10 handoff requires that the operator has:
 *   1. An initialized proposal.
 *   2. At least one proposal option.
 *   3. A recommended option selected (either pre-seeded by initialize
 *      or operator-selected via `markProposalOptionRecommended`).
 *   4. An operator-approved proposal candidate snapshot — i.e. the
 *      proposal's `status='approved'` AND a successful snapshot exists
 *      whose commercial guard passed.
 *
 * Provenance coverage on the recommended option is an advisory signal —
 * the operator can proceed without it but the hint warns when the
 * recommended option has no opportunity or roadmap links.
 *
 * The signal is **advisory** — never a hard gate at the action layer.
 * `docs/39` § 5 keeps S10 SOW Draft logic in its own sprint; the
 * existing `sow-draft-eligibility.ts` evaluator is the hard gate.
 * This helper exists so the proposal page can render an operator-facing
 * hint that summarizes whether the S10 entry conditions are met.
 *
 * # Boundary
 *
 * This helper deliberately exposes no client-side mutation, no `/p`
 * mint, no Send to Client, no SOW generation. S10 owns the SOW flow.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProposalSowReadinessOptions {
  /**
   * The proposal as loaded from `getProposalForEngagementPersisted`.
   * Null when no proposal row exists yet.
   */
  proposal: Proposal | null;
  /**
   * The proposal options. Convenience — could be derived from
   * `proposal.options` but accepted separately so tests can vary them
   * without rebuilding a full proposal shape.
   */
  options: readonly ProposalOption[];
  /**
   * Whether the most-recent proposal candidate snapshot is in
   * `approval_state = 'approved'`. The S10 hard gate also checks the
   * snapshot's surface (`client_proposal_candidate`) and that it isn't
   * voided; this advisory readiness signal accepts the caller's
   * pre-computed boolean.
   */
  hasApprovedSnapshot: boolean;
  /**
   * Whether the most-recent proposal candidate snapshot's commercial
   * guard passed. Null when no snapshot exists; true/false otherwise.
   */
  commercialGuardPassed: boolean | null;
  /**
   * Optional report-side context for completeness checks. When true
   * the hint reports that the 5 required report sections for proposal
   * drafting are still approved (i.e. the S8 → S9 chain is intact).
   * The S10 evaluator itself does not gate on this — but a regression
   * here is worth surfacing as an advisory.
   */
  hasRequiredReportSectionsApproved?: boolean;
}

export interface ProposalSowReadinessSignal {
  /** Whether a proposal row exists. */
  hasProposal: boolean;
  /** Number of options on the proposal. */
  optionCount: number;
  /** Whether at least one option is marked recommended. */
  hasRecommendedOption: boolean;
  /** Option type of the recommended option (canonical slug), or null. */
  recommendedOptionType: string | null;
  /** Provenance coverage on the recommended option. */
  recommendedOpportunityLinkCount: number;
  recommendedRoadmapLinkCount: number;
  /** True when the recommended option has at least one upstream link. */
  recommendedHasProvenance: boolean;
  /** Whether the proposal-level `status === 'approved'`. */
  proposalApproved: boolean;
  /** Whether the most-recent snapshot is `approval_state='approved'`. */
  hasApprovedSnapshot: boolean;
  /** Whether the most-recent snapshot's commercial guard passed. */
  commercialGuardPassed: boolean | null;
  /** Optional upstream S8 chain check. */
  hasRequiredReportSectionsApproved: boolean | null;
  /** Operator-facing advisory strings, ordered by severity. */
  advisories: string[];
  /**
   * Convenience boolean — `hasProposal && optionCount > 0 &&
   * hasRecommendedOption && proposalApproved && hasApprovedSnapshot
   * && commercialGuardPassed === true`.
   */
  readyForS10: boolean;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildSowReadinessSignal(
  args: ProposalSowReadinessOptions,
): ProposalSowReadinessSignal {
  const {
    proposal,
    options,
    hasApprovedSnapshot,
    commercialGuardPassed,
    hasRequiredReportSectionsApproved,
  } = args;

  const hasProposal = Boolean(proposal);
  const optionCount = options.length;

  const recommendedOption = options.find((o) => o.recommended) ?? null;
  const hasRecommendedOption = Boolean(recommendedOption);
  const recommendedOptionType = recommendedOption?.type ?? null;
  const recommendedOpportunityLinkCount =
    recommendedOption?.includedOpportunityIds.length ?? 0;
  const recommendedRoadmapLinkCount =
    recommendedOption?.linkedRoadmapItemIds.length ?? 0;
  const recommendedHasProvenance =
    recommendedOpportunityLinkCount + recommendedRoadmapLinkCount > 0;

  const proposalApproved = proposal?.status === "approved";

  const advisories = buildAdvisories({
    hasProposal,
    optionCount,
    hasRecommendedOption,
    recommendedHasProvenance,
    proposalApproved,
    hasApprovedSnapshot,
    commercialGuardPassed,
    hasRequiredReportSectionsApproved,
  });

  const readyForS10 =
    hasProposal &&
    optionCount > 0 &&
    hasRecommendedOption &&
    proposalApproved &&
    hasApprovedSnapshot &&
    commercialGuardPassed === true;

  return {
    hasProposal,
    optionCount,
    hasRecommendedOption,
    recommendedOptionType,
    recommendedOpportunityLinkCount,
    recommendedRoadmapLinkCount,
    recommendedHasProvenance,
    proposalApproved,
    hasApprovedSnapshot,
    commercialGuardPassed,
    hasRequiredReportSectionsApproved:
      typeof hasRequiredReportSectionsApproved === "boolean"
        ? hasRequiredReportSectionsApproved
        : null,
    advisories,
    readyForS10,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAdvisories(args: {
  hasProposal: boolean;
  optionCount: number;
  hasRecommendedOption: boolean;
  recommendedHasProvenance: boolean;
  proposalApproved: boolean;
  hasApprovedSnapshot: boolean;
  commercialGuardPassed: boolean | null;
  hasRequiredReportSectionsApproved?: boolean;
}): string[] {
  const out: string[] = [];

  if (!args.hasProposal) {
    out.push(
      "No proposal row exists yet. Initialize the proposal before any S10 readiness check applies.",
    );
    return out; // No further advisories make sense.
  }

  if (args.optionCount === 0) {
    out.push("Proposal has zero options. Seed at least one option.");
    return out;
  }

  if (!args.hasRecommendedOption) {
    out.push(
      "No option is marked recommended. Use the proposal-option action bar to mark one option as the recommended path before proceeding to S10.",
    );
  }

  if (args.hasRecommendedOption && !args.recommendedHasProvenance) {
    out.push(
      "Recommended option has no upstream opportunity or roadmap links. Run AI drafting or manually link source artifacts so the SOW Draft inherits provenance.",
    );
  }

  if (!args.proposalApproved) {
    out.push(
      "Proposal is not yet approved. Use the proposal status control to mark it approved after operator review.",
    );
  }

  if (!args.hasApprovedSnapshot) {
    out.push(
      "No operator-approved proposal candidate snapshot. Generate a candidate from the proposal page panel and approve it before S10.",
    );
  }

  if (args.commercialGuardPassed === false) {
    out.push(
      "The most-recent proposal candidate's commercial guard rejected one or more fields. Edit the offending option content and regenerate the candidate.",
    );
  } else if (args.commercialGuardPassed === null && args.hasApprovedSnapshot) {
    out.push(
      "The proposal candidate exists but the commercial guard result is unknown. Regenerate the candidate to refresh the guard verdict.",
    );
  }

  if (args.hasRequiredReportSectionsApproved === false) {
    out.push(
      "One or more required report sections are no longer approved. The S8 → S9 chain is degraded; revisit report-section approval before proceeding to S10.",
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Sprint S9 — convenience helper to fold a commercial-guard result into
// the readiness signal shape's `commercialGuardPassed` boolean. The
// existing snapshot pipeline stores guard verdicts inside the
// `proposal_delivery_snapshots.commercial_guard_result` jsonb; callers
// fetch the snapshot, then pipe the jsonb-deserialized object through
// this helper to keep readiness-signal callers free of any
// snapshot-shape coupling.
// ---------------------------------------------------------------------------

export function isCommercialGuardPassed(
  result: ProposalCommercialGuardResult | null | undefined,
): boolean | null {
  if (!result) return null;
  return result.passed === true;
}
