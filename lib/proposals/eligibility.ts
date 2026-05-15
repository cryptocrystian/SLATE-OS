import type {
  ProposalCommercialGuardResult,
  ProposalDeliverySurface,
  ProposalOmittedContent,
  ProposalPricingReviewState,
} from "./delivery-snapshot-types";
import type { Proposal, ProposalOption } from "./types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P2 — pure proposal-delivery
 * eligibility evaluator.
 *
 * Canon (docs/24 § Proposal Eligibility Rules) — the 13 conditions
 * below; this Sprint P2 evaluator only authorizes the
 * `client_proposal_candidate` surface. SOW Draft (`sow_draft_candidate`)
 * eligibility is a Sprint P6 superset that stacks on top of these
 * rules and lives in a separate evaluator authored at that time.
 *
 * Returns ALL applicable reasons (not first-fail), so the operator UI
 * can render a complete blocker chip set the same way the report-side
 * eligibility evaluator does.
 *
 * Pure module — no React, no DB, no I/O. Time injection via `now` for
 * testability.
 */

export type ProposalDeliveryEligibilityReasonCode =
  | "engagement_not_persisted"
  | "proposal_missing"
  | "no_options_exist"
  | "no_selection"
  | "included_options_empty"
  | "option_blank_commercial_terms"
  | "commercial_guard_failed"
  | "reviewer_only_option"
  | "sow_surface_not_authorized_yet"
  | "implementation_credit_pending_approval"
  | "unsupported_surface";

export type ProposalDeliveryEligibilityReasonSeverity = "error" | "warning";

export interface ProposalDeliveryEligibilityReason {
  code: ProposalDeliveryEligibilityReasonCode;
  severity: ProposalDeliveryEligibilityReasonSeverity;
  message: string;
  /** Optional option-id or other narrow target string for the operator UI. */
  target?: string;
}

export interface ProposalDeliveryEligibilityResult {
  eligible: boolean;
  reasons: ProposalDeliveryEligibilityReason[];
  includedOptionIds: string[];
  omittedOptionIds: string[];
  /**
   * Per-option omission entries the caller will splat into
   * `omitted_content` jsonb alongside the canonical Group-B entry.
   */
  omittedContent: ProposalOmittedContent[];
  draftWatermark: boolean;
  pricingReviewState: ProposalPricingReviewState;
}

export interface ProposalDeliveryEligibilityInput {
  proposal: Proposal | null;
  options: ProposalOption[];
  /**
   * Operator-selected option ids. Empty array means "pick by
   * recommended-flag". Non-empty array means "include exactly these
   * options".
   */
  selectedOptionIds?: string[];
  /**
   * Result of the export-time commercial guard run against the
   * candidate-included options. When absent, the evaluator treats
   * the guard as "not yet run" and surfaces a `commercial_guard_failed`
   * reason (defensive default — production paths always run the guard
   * before the evaluator).
   */
  commercialGuardResult?: ProposalCommercialGuardResult;
  /**
   * Whether the caller has confirmed the engagement is a persisted
   * UUID engagement. The action layer enforces this upstream; the
   * evaluator records a reason when this is false.
   */
  isPersistedEngagement: boolean;
  /**
   * Sprint P2 default is `client_proposal_candidate`. Passing
   * `sow_draft_candidate` is intentionally rejected because Sprint P6
   * has not yet shipped the SOW-specific evaluator addendum.
   */
  surface?: ProposalDeliverySurface;
  /**
   * Future pricing-approval workflow output. When the operator
   * approves pricing via a manual path or an approved workflow, the
   * caller passes the resolved state in. Default is `placeholder`
   * (hidden in the client artifact).
   */
  pricingReviewState?: ProposalPricingReviewState;
}

const PLACEHOLDER_PATTERNS: ReadonlyArray<RegExp> = [
  /\bTBD\b/i,
  /\bTODO\b/i,
  /<\s*scope\s*>/i,
  /<\s*timeline\s*>/i,
  /<\s*placeholder\s*>/i,
];

function looksLikePlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(trimmed));
}

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

export function evaluateProposalDeliveryEligibility(
  input: ProposalDeliveryEligibilityInput,
): ProposalDeliveryEligibilityResult {
  const reasons: ProposalDeliveryEligibilityReason[] = [];
  const omittedContent: ProposalOmittedContent[] = [];
  const surface = input.surface ?? "client_proposal_candidate";
  const pricingReviewState = input.pricingReviewState ?? "placeholder";

  if (!input.isPersistedEngagement) {
    reasons.push({
      code: "engagement_not_persisted",
      severity: "error",
      message:
        "Proposal candidate snapshots only exist for persisted UUID engagements. Mock or legacy slug engagements never reach the snapshot pipeline.",
    });
  }

  // Sprint P2 only authorises `client_proposal_candidate`. Internal
  // candidates and SOW Draft are explicit later sprints.
  if (
    surface !== "client_proposal_candidate" &&
    surface !== "internal_candidate"
  ) {
    reasons.push({
      code: "sow_surface_not_authorized_yet",
      severity: "error",
      message:
        "The SOW Draft surface is Sprint P6 scope. This Sprint P2 evaluator authorises `client_proposal_candidate` (and the operator-internal `internal_candidate`) surfaces only.",
      target: surface,
    });
  }

  if (!input.proposal) {
    reasons.push({
      code: "proposal_missing",
      severity: "error",
      message:
        "No proposal row exists for this engagement. Initialize the proposal before generating a candidate.",
    });
    // Without a proposal there is nothing else to evaluate.
    return {
      eligible: false,
      reasons,
      includedOptionIds: [],
      omittedOptionIds: [],
      omittedContent,
      draftWatermark: true,
      pricingReviewState,
    };
  }

  if (input.options.length === 0) {
    reasons.push({
      code: "no_options_exist",
      severity: "error",
      message:
        "Proposal has zero options. Add at least one option before generating a candidate.",
    });
  }

  // Decide the included-options set. Either operator-selected or
  // recommended-by-flag. Operator selection takes precedence; if
  // neither is present, the evaluator surfaces `no_selection`.
  const selectedIds = (input.selectedOptionIds ?? []).filter((id) =>
    input.options.some((o) => o.id === id),
  );
  const recommendedIds = input.options.filter((o) => o.recommended).map((o) => o.id);

  let includedOptionIds: string[];
  if (selectedIds.length > 0) {
    includedOptionIds = selectedIds;
  } else if (recommendedIds.length > 0) {
    includedOptionIds = recommendedIds;
  } else {
    reasons.push({
      code: "no_selection",
      severity: "error",
      message:
        "No proposal options are marked recommended and the operator did not pass an explicit `selectedOptionIds[]`. Mark one option recommended or pass a selection.",
    });
    includedOptionIds = [];
  }

  // Per-included-option content-quality checks. A blank scope summary
  // / timeline / best-fit scenario is rejected because the client
  // surface would render an empty card.
  for (const optionId of includedOptionIds) {
    const option = input.options.find((o) => o.id === optionId);
    if (!option) continue;
    const blanks: string[] = [];
    if (looksLikePlaceholder(option.scopeSummary)) blanks.push("scopeSummary");
    if (looksLikePlaceholder(option.timeline)) blanks.push("timeline");
    if (looksLikePlaceholder(option.bestFitScenario))
      blanks.push("bestFitScenario");
    if (blanks.length > 0) {
      reasons.push({
        code: "option_blank_commercial_terms",
        severity: "error",
        message: `Option \`${option.title}\` has blank or placeholder content in: ${blanks.join(", ")}. Edit the option before regenerating.`,
        target: optionId,
      });
      omittedContent.push(
        buildOptionOmission(
          optionId,
          "option_blank_commercial_terms",
          "option_blank_commercial_terms",
          `Option \`${option.title}\` was excluded because the following fields were blank or placeholder: ${blanks.join(", ")}.`,
        ),
      );
    }
  }

  if (includedOptionIds.length > 0 && reasons.every((r) => r.code !== "option_blank_commercial_terms")) {
    // included-options set is non-empty AND no per-option blanks were
    // recorded — the proposal has a viable candidate set.
  } else if (includedOptionIds.length === 0 && input.options.length > 0) {
    reasons.push({
      code: "included_options_empty",
      severity: "error",
      message:
        "After applying selection rules the included-options set is empty. Mark an option recommended or pass an explicit `selectedOptionIds[]`.",
    });
  }

  // Commercial guard verdict.
  if (!input.commercialGuardResult) {
    reasons.push({
      code: "commercial_guard_failed",
      severity: "error",
      message:
        "The commercial guard has not been run for this candidate. The action layer must run `runProposalCommercialGuard(...)` before invoking the eligibility evaluator.",
    });
  } else if (!input.commercialGuardResult.passed) {
    reasons.push({
      code: "commercial_guard_failed",
      severity: "error",
      message: `Commercial guard rejected ${input.commercialGuardResult.violations.length} violation(s). Edit the offending fields and regenerate.`,
    });
  }

  // Pricing / terms policy (canon § Pricing / Terms Policy).
  // Implementation credit is hidden from the client artifact until a
  // commercial-approval workflow exists. The evaluator surfaces this
  // as a non-blocking note (severity: warning) when the proposal-level
  // `creditEligible` flag is true and the pricing state is still
  // placeholder. Sprint P5's renderer is what actually enforces the
  // hide.
  if (
    input.proposal.implementationCredit.creditEligible &&
    pricingReviewState === "placeholder"
  ) {
    reasons.push({
      code: "implementation_credit_pending_approval",
      severity: "warning",
      message:
        "Implementation credit is captured in the snapshot but hidden from the client artifact until a commercial-approval workflow advances `pricingReviewState`. This is the canon default — no action required unless an approval path exists.",
    });
  }

  // Eligibility is the absence of any `error`-severity reason. Warning
  // reasons (e.g. implementation-credit-pending-approval) do not block.
  const hasBlockingError = reasons.some((r) => r.severity === "error");

  const draftWatermark = (() => {
    // Initially every candidate carries the draft watermark.
    // `approval_state = 'approved'` (set by a future operator action)
    // is what eventually drops the watermark; Sprint P2 always
    // generates with `draft_watermark=true`.
    return true;
  })();

  const omittedOptionIds = input.options
    .map((o) => o.id)
    .filter((id) => !includedOptionIds.includes(id));

  // Per-option omission entries for the operator audit trail — these
  // are NOT blockers, they are explanations of why each option was
  // left out of the candidate's client-bound surface.
  for (const omittedId of omittedOptionIds) {
    if (omittedContent.some((c) => c.scope === omittedId)) continue;
    const option = input.options.find((o) => o.id === omittedId);
    if (!option) continue;
    omittedContent.push(
      buildOptionOmission(
        omittedId,
        "option_not_selected",
        "option_not_selected",
        `Option \`${option.title}\` was not part of the operator's selection / recommended set for this candidate.`,
      ),
    );
  }

  return {
    eligible: !hasBlockingError,
    reasons,
    includedOptionIds,
    omittedOptionIds,
    omittedContent,
    draftWatermark,
    pricingReviewState,
  };
}
