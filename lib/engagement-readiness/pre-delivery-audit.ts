/**
 * Sprint S11 — Pre-Delivery Audit (Code-Side Enforcement).
 *
 * Pure evaluator. No DB, no I/O, no React.
 *
 * Canon: `docs/35` § 5 (the 15-row quality gate that, until S11, was
 * operator discipline only). This module is the code-side enforcement
 * point per `docs/39` § 5 (Sprint S11 row).
 *
 * The evaluator is **surface-aware**: report mint (`/r`) and proposal
 * mint (`/p`) share a cross-surface subset of conditions, then layer
 * surface-specific conditions on top. SOW Draft is internal-only and
 * has no public route, so it has no audit surface here.
 *
 * # Threshold mapping — `docs/35` § 5 ↔ S11 codes
 *
 * Cross-surface (both report and proposal):
 *
 *   ╶ C1  `intake_required_roles_missing`     — stakeholder intake "invited" — must cover ≥ MIN_REQUIRED_ROLES of the 6 canonical roles. Defaults: 3.
 *   ╶ C2  `intake_substantive_responses_missing` — stakeholder intake "completed" — ≥ MIN_READY_RESPONSE_SESSIONS sessions with at least one `ready_for_synthesis` response. Default: 2.
 *   ╶ C3  `documents_not_uploaded_or_acked`   — ≥ MIN_DOCUMENTS uploaded OR `documentsClearedOrAcknowledged === true`. Default: 1.
 *   ╶ C4  `findings_drafted_too_few`          — drafted findings ≥ MIN_FINDINGS_DRAFTED. Default: 8.
 *   ╶ C5  `findings_approved_too_few`         — approved findings ≥ MIN_FINDINGS_APPROVED. Default: 5.
 *   ╶ C6  `opportunities_created_too_few`     — created opportunities ≥ MIN_OPPORTUNITIES_CREATED. Default: 3.
 *   ╶ C7  `opportunities_recommended_missing` — ≥ MIN_OPPORTUNITIES_RECOMMENDED with `status='selected'`. Default: 1.
 *   ╶ C8  `roadmap_items_linked_too_few`      — roadmap items ≥ MIN_ROADMAP_ITEMS with `status='ready'` and `linkedOpportunityId` non-null. Default: 3.
 *   ╶ C13 `stale_active_share_tokens`          — active (non-revoked, non-expired) tokens > MAX_PRE_MINT_ACTIVE_TOKENS on the SAME surface. Default: 0.
 *   ╶ C14 `audit_only_label_leak`              — operator-supplied audience label matches an audit/test prefix (e.g. `AUDIT`, `WALKTHROUGH`, `TEST`). Default: blocks.
 *
 * Report-only (`/r` mint):
 *
 *   ╶ C9  `report_sections_drafted_too_few`   — drafted+approved+final report sections ≥ MIN_REPORT_SECTIONS_DRAFTED. Default: 10 (of 12).
 *   ╶ C10 `report_sections_approved_too_few`  — approved+final report sections ≥ MIN_REPORT_SECTIONS_APPROVED including `executive-summary`. Default: 8.
 *   ╶ C11 `report_snapshot_missing`           — fresh, non-draft, non-voided `report_delivery_snapshots` row exists. (`Share disabled` text on the renderer is the snapshot's `Share disabled` flag.)
 *
 * Proposal-only (`/p` mint):
 *
 *   ╶ C12 `proposal_snapshot_not_approved`    — fresh, non-voided proposal candidate snapshot with `approval_state='approved'`. (S9-Fix-aligned: the snapshot is the operative gate, not `proposals.status`.)
 *   ╶ C15 `commercial_guard_not_passed`       — the approved snapshot's commercial guard `passed === true`.
 *
 * # Severity model
 *
 *   - `block`   — at least one condition fails; mint MUST be refused.
 *   - `warning` — non-blocking observation (currently used for advisories like "no fresh PDF candidate within X days"); does NOT block mint.
 *   - `pass`    — every applicable condition cleared.
 *
 * # `evaluatedAt`
 *
 *   The evaluator does NOT call `Date.now()` — the caller passes a
 *   pre-computed timestamp. This keeps the function fully pure and
 *   makes the smoke tests deterministic.
 *
 * # What this module does NOT do
 *
 *   - It does NOT call the existing per-snapshot eligibility evaluators
 *     (`evaluateReportShareEligibility` / `evaluateProposalShareEligibility`).
 *     Those evaluate the snapshot itself; this pre-delivery audit
 *     evaluates the upstream chain. Both gates fire — the snapshot
 *     evaluator runs AFTER this evaluator passes.
 *   - It does NOT perform the mint. The mint action consumes the
 *     result.
 *   - It does NOT touch SOW Draft state. SOW Drafts stay internal.
 *
 * Per the user's S11 task spec — "Use the exact docs/35 wording where
 * possible. If docs/35 differs from the above list, follow docs/35 and
 * document any mapping."
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PreDeliverySurface = "report" | "proposal";

export type PreDeliverySeverity = "pass" | "warning" | "block";

export type PreDeliveryReasonCode =
  | "engagement_not_persisted"
  | "intake_required_roles_missing"
  | "intake_substantive_responses_missing"
  | "documents_not_uploaded_or_acked"
  | "findings_drafted_too_few"
  | "findings_approved_too_few"
  | "opportunities_created_too_few"
  | "opportunities_recommended_missing"
  | "roadmap_items_linked_too_few"
  | "report_sections_drafted_too_few"
  | "report_sections_approved_too_few"
  | "report_snapshot_missing"
  | "proposal_snapshot_not_approved"
  | "stale_active_share_tokens"
  | "commercial_guard_not_passed"
  | "audit_only_label_leak";

export interface PreDeliveryReason {
  code: PreDeliveryReasonCode;
  severity: "block" | "warning";
  /** Operator-readable, plain language. No internal IDs / no raw text. */
  message: string;
  /** Numeric threshold the input failed, if applicable. */
  threshold?: number;
  /** Observed value the input carried, if applicable. */
  observed?: number;
}

export interface PreDeliveryCounts {
  approvedFindings: number;
  draftedFindings: number;
  createdOpportunities: number;
  recommendedOpportunities: number;
  readyRoadmapItemsLinked: number;
  draftedReportSections: number;
  approvedReportSections: number;
  totalReportSections: number;
  totalDocuments: number;
  intakeRolesInvited: number;
  intakeRolesWithReadyResponse: number;
  intakeReadyResponseSessions: number;
  activeShareTokensOnSurface: number;
  hasFreshReportSnapshot: boolean;
  hasApprovedProposalSnapshot: boolean;
  proposalCommercialGuardPassed: boolean | null;
  /** Whether the approved report sections include `executive-summary`. */
  approvedSectionsIncludeExecutiveSummary: boolean;
}

export interface PreDeliveryAuditInput {
  surface: PreDeliverySurface;
  /** UUID — must be non-empty for the evaluator to even start. */
  engagementId: string;
  isPersistedEngagement: boolean;
  counts: PreDeliveryCounts;
  documentsClearedOrAcknowledged: boolean;
  /** Optional operator-supplied audience label being attached to the mint. */
  audienceLabel?: string | null;
  /** ISO timestamp. Caller-supplied to keep the evaluator pure. */
  evaluatedAt: string;
  /** Optional threshold overrides — defaults match docs/35 § 5 verbatim. */
  thresholds?: Partial<PreDeliveryThresholds>;
}

export interface PreDeliveryThresholds {
  /** docs/35 § 5 row 1 — invited roles. Default: 3 of the 6 canonical. */
  minRequiredIntakeRoles: number;
  /** docs/35 § 5 row 2 — completed (substantive). Default: 2. */
  minIntakeReadyResponseSessions: number;
  /** docs/35 § 5 row 3 — supporting docs. Default: 1. */
  minDocuments: number;
  /** docs/35 § 5 row 4. Default: 8. */
  minFindingsDrafted: number;
  /** docs/35 § 5 row 5. Default: 5. */
  minFindingsApproved: number;
  /** docs/35 § 5 row 6. Default: 3. */
  minOpportunitiesCreated: number;
  /** docs/35 § 5 row 7. Default: 1. */
  minOpportunitiesRecommended: number;
  /** docs/35 § 5 row 8. Default: 3. */
  minRoadmapItemsLinked: number;
  /** docs/35 § 5 row 9. Default: 10 (of 12). */
  minReportSectionsDrafted: number;
  /** docs/35 § 5 row 10. Default: 8 (of 12). */
  minReportSectionsApproved: number;
  /** docs/35 § 5 row 14 (per-surface). Default: 0. */
  maxPreMintActiveTokens: number;
}

export const DEFAULT_PRE_DELIVERY_THRESHOLDS: PreDeliveryThresholds = {
  minRequiredIntakeRoles: 3,
  minIntakeReadyResponseSessions: 2,
  minDocuments: 1,
  minFindingsDrafted: 8,
  minFindingsApproved: 5,
  minOpportunitiesCreated: 3,
  minOpportunitiesRecommended: 1,
  minRoadmapItemsLinked: 3,
  minReportSectionsDrafted: 10,
  minReportSectionsApproved: 8,
  maxPreMintActiveTokens: 0,
};

export interface PreDeliveryAuditResult {
  ready: boolean;
  severity: PreDeliverySeverity;
  blockingReasons: PreDeliveryReason[];
  warnings: PreDeliveryReason[];
  surface: PreDeliverySurface;
  evaluatedAt: string;
  thresholds: PreDeliveryThresholds;
  /** Echo of the input counts for caller convenience (e.g. UI display). */
  counts: PreDeliveryCounts;
}

// ---------------------------------------------------------------------------
// Audit-only / test-only label detector — protects against accidentally
// minting a real client token while the audience label still carries an
// internal QA / audit / walkthrough prefix.
// ---------------------------------------------------------------------------

const AUDIT_ONLY_PREFIX_PATTERNS: ReadonlyArray<RegExp> = [
  /^\s*audit\b/i,
  /^\s*walkthrough\b/i,
  /^\s*test\b/i,
  /^\s*controlled\b/i,
  /^\s*sample\b/i,
  /^\s*staging\b/i,
  /^\s*dev\b/i,
  /^\s*qa\b/i,
];

function audienceLabelLooksAuditOnly(
  raw: string | null | undefined,
): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  return AUDIT_ONLY_PREFIX_PATTERNS.some((re) => re.test(trimmed));
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export function evaluatePreDeliveryAudit(
  input: PreDeliveryAuditInput,
): PreDeliveryAuditResult {
  const thresholds: PreDeliveryThresholds = {
    ...DEFAULT_PRE_DELIVERY_THRESHOLDS,
    ...input.thresholds,
  };

  const blockingReasons: PreDeliveryReason[] = [];
  const warnings: PreDeliveryReason[] = [];

  // -----------------------------------------------------------------------
  // Foundation: engagement existence / persistence
  // -----------------------------------------------------------------------
  if (!input.isPersistedEngagement || input.engagementId.length === 0) {
    blockingReasons.push({
      code: "engagement_not_persisted",
      severity: "block",
      message:
        "Engagement does not exist as a persisted UUID engagement. Mock or legacy slug engagements cannot mint client-facing share links.",
    });
    // Short-circuit — every downstream check assumes a persisted engagement.
    return finalize({
      input,
      thresholds,
      blockingReasons,
      warnings,
    });
  }

  // -----------------------------------------------------------------------
  // Cross-surface conditions (apply to BOTH /r and /p mint)
  // -----------------------------------------------------------------------

  // C1 — Stakeholder intake invited
  if (input.counts.intakeRolesInvited < thresholds.minRequiredIntakeRoles) {
    blockingReasons.push({
      code: "intake_required_roles_missing",
      severity: "block",
      message: `Stakeholder intake — invited: only ${input.counts.intakeRolesInvited} of the ${thresholds.minRequiredIntakeRoles} required canonical roles are represented. Invite more stakeholders before minting a share link.`,
      threshold: thresholds.minRequiredIntakeRoles,
      observed: input.counts.intakeRolesInvited,
    });
  }

  // C2 — Stakeholder intake completed
  if (
    input.counts.intakeReadyResponseSessions <
    thresholds.minIntakeReadyResponseSessions
  ) {
    blockingReasons.push({
      code: "intake_substantive_responses_missing",
      severity: "block",
      message: `Stakeholder intake — completed: only ${input.counts.intakeReadyResponseSessions} session(s) carry a "ready for synthesis" response; canon requires at least ${thresholds.minIntakeReadyResponseSessions}.`,
      threshold: thresholds.minIntakeReadyResponseSessions,
      observed: input.counts.intakeReadyResponseSessions,
    });
  }

  // C3 — Documents
  if (
    !input.documentsClearedOrAcknowledged &&
    input.counts.totalDocuments < thresholds.minDocuments
  ) {
    blockingReasons.push({
      code: "documents_not_uploaded_or_acked",
      severity: "block",
      message: `Documents: ${input.counts.totalDocuments} uploaded and no explicit "no documents needed" sign-off. Upload at least ${thresholds.minDocuments} supporting document or record the no-docs acknowledgement before minting.`,
      threshold: thresholds.minDocuments,
      observed: input.counts.totalDocuments,
    });
  }

  // C4 — Findings drafted
  if (input.counts.draftedFindings < thresholds.minFindingsDrafted) {
    blockingReasons.push({
      code: "findings_drafted_too_few",
      severity: "block",
      message: `Findings — drafted: only ${input.counts.draftedFindings} drafted findings; canon requires at least ${thresholds.minFindingsDrafted}.`,
      threshold: thresholds.minFindingsDrafted,
      observed: input.counts.draftedFindings,
    });
  }

  // C5 — Findings approved
  if (input.counts.approvedFindings < thresholds.minFindingsApproved) {
    blockingReasons.push({
      code: "findings_approved_too_few",
      severity: "block",
      message: `Findings — approved: only ${input.counts.approvedFindings} approved findings; canon requires at least ${thresholds.minFindingsApproved}.`,
      threshold: thresholds.minFindingsApproved,
      observed: input.counts.approvedFindings,
    });
  }

  // C6 — Opportunities created
  if (input.counts.createdOpportunities < thresholds.minOpportunitiesCreated) {
    blockingReasons.push({
      code: "opportunities_created_too_few",
      severity: "block",
      message: `Opportunities — created: only ${input.counts.createdOpportunities} opportunities with proper scoring; canon requires at least ${thresholds.minOpportunitiesCreated}.`,
      threshold: thresholds.minOpportunitiesCreated,
      observed: input.counts.createdOpportunities,
    });
  }

  // C7 — Opportunities recommended (operator-selected per S6)
  if (
    input.counts.recommendedOpportunities <
    thresholds.minOpportunitiesRecommended
  ) {
    blockingReasons.push({
      code: "opportunities_recommended_missing",
      severity: "block",
      message: `Opportunities — recommended: only ${input.counts.recommendedOpportunities} opportunit(ies) marked as recommended (operator-selected); canon requires at least ${thresholds.minOpportunitiesRecommended}.`,
      threshold: thresholds.minOpportunitiesRecommended,
      observed: input.counts.recommendedOpportunities,
    });
  }

  // C8 — Roadmap items linked
  if (
    input.counts.readyRoadmapItemsLinked < thresholds.minRoadmapItemsLinked
  ) {
    blockingReasons.push({
      code: "roadmap_items_linked_too_few",
      severity: "block",
      message: `Roadmap — items linked to opportunities: only ${input.counts.readyRoadmapItemsLinked} ready, linked items; canon requires at least ${thresholds.minRoadmapItemsLinked}.`,
      threshold: thresholds.minRoadmapItemsLinked,
      observed: input.counts.readyRoadmapItemsLinked,
    });
  }

  // C13 — Stale active share tokens on THIS surface
  if (
    input.counts.activeShareTokensOnSurface > thresholds.maxPreMintActiveTokens
  ) {
    blockingReasons.push({
      code: "stale_active_share_tokens",
      severity: "block",
      message: `Stale share tokens: ${input.counts.activeShareTokensOnSurface} active ${input.surface} share token(s) exist on this engagement. Revoke them before minting a fresh token.`,
      threshold: thresholds.maxPreMintActiveTokens,
      observed: input.counts.activeShareTokensOnSurface,
    });
  }

  // C14 — Audit-only / test-only label leak
  if (audienceLabelLooksAuditOnly(input.audienceLabel)) {
    blockingReasons.push({
      code: "audit_only_label_leak",
      severity: "block",
      message:
        "Audience label looks like an internal audit / walkthrough / test label. Use a real audience label (recipient role or team) before minting a client-facing token.",
    });
  }

  // -----------------------------------------------------------------------
  // Surface-specific conditions
  // -----------------------------------------------------------------------

  if (input.surface === "report") {
    // C9 — Report sections drafted (drafted + approved + final all count)
    if (
      input.counts.draftedReportSections < thresholds.minReportSectionsDrafted
    ) {
      blockingReasons.push({
        code: "report_sections_drafted_too_few",
        severity: "block",
        message: `Report sections — drafted: only ${input.counts.draftedReportSections} of ${input.counts.totalReportSections} sections drafted; canon requires at least ${thresholds.minReportSectionsDrafted} of 12.`,
        threshold: thresholds.minReportSectionsDrafted,
        observed: input.counts.draftedReportSections,
      });
    }

    // C10 — Report sections approved (with executive-summary required)
    if (
      input.counts.approvedReportSections <
      thresholds.minReportSectionsApproved
    ) {
      blockingReasons.push({
        code: "report_sections_approved_too_few",
        severity: "block",
        message: `Report sections — approved: only ${input.counts.approvedReportSections} of ${input.counts.totalReportSections} sections approved; canon requires at least ${thresholds.minReportSectionsApproved} of 12, including Executive Summary.`,
        threshold: thresholds.minReportSectionsApproved,
        observed: input.counts.approvedReportSections,
      });
    } else if (!input.counts.approvedSectionsIncludeExecutiveSummary) {
      blockingReasons.push({
        code: "report_sections_approved_too_few",
        severity: "block",
        message:
          "Report sections — approved: Executive Summary is not in the approved set. Canon requires Executive Summary plus other key sections before minting a report link.",
      });
    }

    // C11 — Report PDF candidate fresh + non-draft
    if (!input.counts.hasFreshReportSnapshot) {
      blockingReasons.push({
        code: "report_snapshot_missing",
        severity: "block",
        message:
          "Report PDF candidate: no fresh, non-draft report delivery snapshot exists. Generate (and approve) a candidate before minting a /r link.",
      });
    }
  }

  if (input.surface === "proposal") {
    // C12 — Proposal Candidate fresh + approved (snapshot-side)
    if (!input.counts.hasApprovedProposalSnapshot) {
      blockingReasons.push({
        code: "proposal_snapshot_not_approved",
        severity: "block",
        message:
          "Proposal Candidate: no approved, non-voided proposal delivery snapshot exists. Generate and Approve a candidate before minting a /p link.",
      });
    }

    // C15 — Commercial guard passed on the approved snapshot
    if (input.counts.proposalCommercialGuardPassed !== true) {
      blockingReasons.push({
        code: "commercial_guard_not_passed",
        severity: "block",
        message:
          "Commercial guard — proposal: the approved proposal snapshot's commercial guard did not pass (or is unknown). Resolve flagged option content and regenerate before minting.",
      });
    }
  }

  return finalize({
    input,
    thresholds,
    blockingReasons,
    warnings,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function finalize(args: {
  input: PreDeliveryAuditInput;
  thresholds: PreDeliveryThresholds;
  blockingReasons: PreDeliveryReason[];
  warnings: PreDeliveryReason[];
}): PreDeliveryAuditResult {
  const ready = args.blockingReasons.length === 0;
  const severity: PreDeliverySeverity = ready
    ? args.warnings.length > 0
      ? "warning"
      : "pass"
    : "block";
  return {
    ready,
    severity,
    blockingReasons: args.blockingReasons,
    warnings: args.warnings,
    surface: args.input.surface,
    evaluatedAt: args.input.evaluatedAt,
    thresholds: args.thresholds,
    counts: args.input.counts,
  };
}

/** Public — exported so the loader, UI components, and smoke can render the canonical list. */
export const PRE_DELIVERY_REASON_DISPLAY: Record<
  PreDeliveryReasonCode,
  { shortLabel: string; family: string }
> = {
  engagement_not_persisted: {
    shortLabel: "Persisted engagement",
    family: "foundation",
  },
  intake_required_roles_missing: {
    shortLabel: "Stakeholder intake — invited",
    family: "intake",
  },
  intake_substantive_responses_missing: {
    shortLabel: "Stakeholder intake — completed",
    family: "intake",
  },
  documents_not_uploaded_or_acked: {
    shortLabel: "Supporting documents",
    family: "intake",
  },
  findings_drafted_too_few: {
    shortLabel: "Findings — drafted",
    family: "synthesis",
  },
  findings_approved_too_few: {
    shortLabel: "Findings — approved",
    family: "synthesis",
  },
  opportunities_created_too_few: {
    shortLabel: "Opportunities — created",
    family: "synthesis",
  },
  opportunities_recommended_missing: {
    shortLabel: "Opportunities — recommended",
    family: "synthesis",
  },
  roadmap_items_linked_too_few: {
    shortLabel: "Roadmap — linked items",
    family: "synthesis",
  },
  report_sections_drafted_too_few: {
    shortLabel: "Report sections — drafted",
    family: "report",
  },
  report_sections_approved_too_few: {
    shortLabel: "Report sections — approved",
    family: "report",
  },
  report_snapshot_missing: {
    shortLabel: "Report PDF candidate",
    family: "report",
  },
  proposal_snapshot_not_approved: {
    shortLabel: "Proposal Candidate — approved",
    family: "proposal",
  },
  commercial_guard_not_passed: {
    shortLabel: "Commercial guard — proposal",
    family: "proposal",
  },
  stale_active_share_tokens: {
    shortLabel: "Stale share tokens",
    family: "delivery",
  },
  audit_only_label_leak: {
    shortLabel: "Audience label discipline",
    family: "delivery",
  },
};
