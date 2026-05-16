"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { runProposalCommercialGuard } from "./commercial-guard";
import {
  evaluateProposalDeliveryEligibility,
  type ProposalDeliveryEligibilityReason,
  type ProposalDeliveryEligibilityResult,
} from "./eligibility";
import { isUuid } from "./mappers";
import { getProposalForEngagementPersisted } from "./queries";
import {
  PROPOSAL_GROUP_B_OMISSION_ENTRY,
  type ProposalOptionSnapshot,
  type ProposalSourceContextSnapshot,
} from "./delivery-snapshot-types";
import type { ProposalOption } from "./types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P2 — operator-only proposal
 * delivery candidate snapshot action.
 *
 * Pipeline:
 *   1. Validate UUIDs + operator session.
 *   2. Load proposal + options via the existing cookie-bound RLS query
 *      helper.
 *   3. Resolve the included-options set (either operator-passed
 *      `selectedOptionIds[]` or the recommended-by-flag set).
 *   4. Build the option_snapshot + source_context_snapshot payloads.
 *   5. Run the commercial guard against the included content.
 *   6. Run the eligibility evaluator.
 *   7. If blocked → log `proposal_snapshot_failed` (with safe counts /
 *      reason codes only — NEVER violation text), return error.
 *   8. Insert the `proposal_delivery_snapshots` row with status
 *      `candidate` + delivery_surface `client_proposal_candidate` +
 *      approval_state `unreviewed` + pricing_review_state `placeholder`
 *      + draft_watermark `true`.
 *   9. Log `proposal_snapshot_generated` activity event.
 *  10. Revalidate the proposal page; return `{ ok: true, snapshotId }`.
 *
 * No public route is created here. No share token is minted. No
 * `Prepare Client Review` / `Prepare SOW Draft` / `Send to Client`
 * unlock. No email / CRM. No PDF binary. No Group-B wiring.
 *
 * NOTE — there is intentionally no operator-facing UI button mounted
 * in Sprint P2. The Sprint P3 prompt will introduce the internal
 * candidate route and the Past Proposal Candidates panel; that's
 * where the operator surfaces the Generate / Open / Void controls.
 * Sprint P2 ships the foundation only.
 */

export type GenerateProposalCandidateError =
  | "unauthenticated"
  | "invalid-engagement"
  | "invalid-proposal"
  | "engagement-not-found"
  | "proposal-not-found"
  | "no-options"
  | "multiple-proposals-need-id"
  | "eligibility-blocked"
  | "commercial-guard-violation"
  | "service-error";

export interface GenerateProposalCandidateSuccess {
  ok: true;
  snapshotId: string;
  deliverySurface: "client_proposal_candidate";
  draftWatermark: boolean;
  approvalState: "unreviewed";
  pricingReviewState: "placeholder";
  includedOptionCount: number;
  omittedOptionCount: number;
}

export interface GenerateProposalCandidateFailure {
  ok: false;
  error: GenerateProposalCandidateError;
  eligibilityReasons?: ProposalDeliveryEligibilityReason[];
  /**
   * Per-field violation summary. Only the `{field, code}` shape — the
   * banned phrase text is NEVER returned to the caller and is NEVER
   * persisted in the activity-event metadata.
   */
  violations?: ReadonlyArray<{ field: string; code: string }>;
}

export type GenerateProposalCandidateResult =
  | GenerateProposalCandidateSuccess
  | GenerateProposalCandidateFailure;

export async function generateProposalCandidateAction(args: {
  engagementId: string;
  proposalId?: string;
  selectedOptionIds?: string[];
}): Promise<GenerateProposalCandidateResult> {
  const { engagementId } = args;
  if (!isUuid(engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  if (args.proposalId !== undefined && !isUuid(args.proposalId)) {
    return { ok: false, error: "invalid-proposal" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // Resolve engagement → workspace_id (RLS scope) + verify existence.
  const { data: engagementRow, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    console.error("[proposals.snapshot-actions] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  const proposal = await getProposalForEngagementPersisted(engagementRow.id);
  if (!proposal) {
    return { ok: false, error: "proposal-not-found" };
  }

  // The current schema is a single proposal per engagement. The
  // `multiple-proposals-need-id` error is reserved for a future
  // schema; today we just verify the passed `proposalId` (if any)
  // matches the resolved proposal.
  if (args.proposalId && proposal.id !== args.proposalId) {
    return { ok: false, error: "proposal-not-found" };
  }

  if (proposal.options.length === 0) {
    // Surface the "no options" path as a structured error so the
    // caller can show a targeted hint. The eligibility evaluator
    // would also flag this; we short-circuit here so we don't waste
    // a guard scan on an empty option set.
    await logActivityEvent({
      eventType: "proposal_snapshot_failed",
      entityType: "proposal_delivery_snapshot",
      entityId: null,
      engagementId: engagementRow.id,
      title: "Proposal snapshot generation failed",
      summary:
        "Proposal has zero options. Add at least one option before generating a candidate.",
      metadata: {
        proposalId: proposal.id,
        failureReason: "no_options_exist",
      },
    });
    return { ok: false, error: "no-options" };
  }

  // Decide which options will be included in the snapshot.
  const selectedFromArgs = (args.selectedOptionIds ?? []).filter((id) =>
    proposal.options.some((o) => o.id === id),
  );
  const recommendedIds = proposal.options
    .filter((o) => o.recommended)
    .map((o) => o.id);
  const includedIds =
    selectedFromArgs.length > 0 ? selectedFromArgs : recommendedIds;

  // Build the option snapshot for every option (included and excluded
  // alike) so the audit trail preserves the full state at generation.
  // The renderer filters by `includedInArtifact` per option.
  const optionSnapshot: ProposalOptionSnapshot[] = proposal.options.map(
    (option) => optionToSnapshot(option, includedIds.includes(option.id)),
  );

  const sourceContextSnapshot: ProposalSourceContextSnapshot = {
    implementationCredit: { ...proposal.implementationCredit },
    // Sprint P2 does not yet wire the report-snapshot reference. The
    // future hook lands when Sprint P5's renderer needs the friendly
    // "based on the diagnostic findings shared in your prepared
    // report" context; until then we capture `null`.
    reportSnapshotId: null,
    linkedOpportunityIds: dedupe(
      proposal.options
        .filter((o) => includedIds.includes(o.id))
        .flatMap((o) => o.includedOpportunityIds),
    ),
    linkedRoadmapItemIds: dedupe(
      proposal.options
        .filter((o) => includedIds.includes(o.id))
        .flatMap((o) => o.linkedRoadmapItemIds),
    ),
  };

  // Run the commercial guard before the eligibility evaluator. The
  // evaluator consumes the guard's `passed` flag as one of its
  // 13 conditions.
  const commercialGuardResult = runProposalCommercialGuard({
    optionSnapshot,
    sourceContextSnapshot,
  });

  const eligibility = evaluateProposalDeliveryEligibility({
    proposal,
    options: proposal.options,
    selectedOptionIds: selectedFromArgs.length > 0 ? selectedFromArgs : undefined,
    commercialGuardResult,
    isPersistedEngagement: true,
    surface: "client_proposal_candidate",
    // Sprint P2 always generates with `placeholder` — a future
    // commercial-approval workflow advances this state.
    pricingReviewState: "placeholder",
  });

  if (!commercialGuardResult.passed) {
    await logActivityEvent({
      eventType: "proposal_snapshot_failed",
      entityType: "proposal_delivery_snapshot",
      entityId: null,
      engagementId: engagementRow.id,
      title: "Proposal snapshot generation failed",
      summary:
        "Generation blocked by export-time commercial guard. No snapshot was created.",
      metadata: {
        proposalId: proposal.id,
        failureReason: "commercial_guard_violation",
        violationCount: commercialGuardResult.violations.length,
      },
    });
    return {
      ok: false,
      error: "commercial-guard-violation",
      violations: commercialGuardResult.violations.map((v) => ({
        field: v.field,
        code: v.code,
      })),
      eligibilityReasons: eligibility.reasons,
    };
  }

  if (!eligibility.eligible) {
    await logActivityEvent({
      eventType: "proposal_snapshot_failed",
      entityType: "proposal_delivery_snapshot",
      entityId: null,
      engagementId: engagementRow.id,
      title: "Proposal snapshot generation failed",
      summary:
        "Generation blocked by proposal-delivery eligibility evaluator. No snapshot was created.",
      metadata: {
        proposalId: proposal.id,
        failureReason: "eligibility_blocked",
        blockerCount: eligibility.reasons.filter((r) => r.severity === "error")
          .length,
      },
    });
    return {
      ok: false,
      error: "eligibility-blocked",
      eligibilityReasons: eligibility.reasons,
    };
  }

  const omittedContent = [
    PROPOSAL_GROUP_B_OMISSION_ENTRY,
    ...eligibility.omittedContent,
  ];

  const operatorLabel = buildOperatorLabel(user);

  const { data: snapshotRow, error: insertError } = await supabase
    .from("proposal_delivery_snapshots")
    .insert({
      workspace_id: engagementRow.workspace_id,
      engagement_id: engagementRow.id,
      proposal_id: proposal.id,
      status: "candidate",
      delivery_surface: "client_proposal_candidate",
      proposal_status_at_generation: proposal.status,
      generated_by: user.id,
      generated_by_label: operatorLabel,
      option_snapshot: optionSnapshot,
      source_context_snapshot: sourceContextSnapshot,
      commercial_guard_result: commercialGuardResult,
      omitted_content: omittedContent,
      draft_watermark: eligibility.draftWatermark,
      approval_state: "unreviewed",
      pricing_review_state: eligibility.pricingReviewState,
      selected_option_ids: eligibility.includedOptionIds,
      app_version: null,
      commit_sha: null,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !snapshotRow?.id) {
    console.error("[proposals.snapshot-actions] insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  const includedOptionCount = eligibility.includedOptionIds.length;
  const omittedOptionCount = eligibility.omittedOptionIds.length;

  await logActivityEvent({
    eventType: "proposal_snapshot_generated",
    entityType: "proposal_delivery_snapshot",
    entityId: snapshotRow.id,
    engagementId: engagementRow.id,
    title: "Proposal candidate generated",
    summary:
      "Operator-only metadata-only proposal candidate. No public route exists yet; the operator hand-delivers or reviews internally.",
    metadata: {
      proposalId: proposal.id,
      deliverySurface: "client_proposal_candidate",
      draftWatermark: eligibility.draftWatermark,
      approvalState: "unreviewed",
      pricingReviewState: eligibility.pricingReviewState,
      includedOptionCount,
      omittedOptionCount,
    },
  });

  revalidatePath(`/app/engagements/${engagementRow.id}/proposal`);
  revalidatePath(`/app/engagements/${engagementRow.id}`);

  return {
    ok: true,
    snapshotId: snapshotRow.id,
    deliverySurface: "client_proposal_candidate",
    draftWatermark: eligibility.draftWatermark,
    approvalState: "unreviewed",
    pricingReviewState: "placeholder",
    includedOptionCount,
    omittedOptionCount,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function optionToSnapshot(
  option: ProposalOption,
  included: boolean,
): ProposalOptionSnapshot {
  return {
    optionId: option.id,
    // The TS `Proposal` shape has no `position` field on options after
    // mapping (it's stripped). The renderer / panel orders by the
    // option array's natural order, which the queries already sort by
    // `position` ascending then `created_at` ascending. Capture 0 for
    // the placeholder; the panel can ignore position when sorting by
    // the array order it received.
    position: 0,
    optionType: option.type,
    title: option.title,
    bestFitScenario: option.bestFitScenario,
    scopeSummary: option.scopeSummary,
    timeline: option.timeline,
    deliverables: option.deliverables,
    assumptions: option.assumptions,
    dependencies: option.dependencies,
    risks: option.risks,
    pricingPlaceholder: option.pricingPlaceholder,
    recommended: option.recommended,
    includedInArtifact: included,
  };
}

function dedupe<T>(values: ReadonlyArray<T>): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function buildOperatorLabel(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const metaName =
    typeof user.user_metadata?.display_name === "string"
      ? (user.user_metadata.display_name as string)
      : typeof user.user_metadata?.name === "string"
        ? (user.user_metadata.name as string)
        : null;
  if (metaName && metaName.trim().length > 0) {
    return deriveInitials(metaName.trim());
  }
  if (typeof user.email === "string" && user.email.length > 0) {
    const local = user.email.split("@")[0];
    if (local && local.length > 0) {
      return deriveInitials(local).slice(0, 4);
    }
  }
  return null;
}

function deriveInitials(displayName: string): string {
  const parts = displayName
    .split(/[\s._-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return displayName.slice(0, 2).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------------------------------------------------------------------------
// Void action — Sprint P3
// ---------------------------------------------------------------------------

export type VoidProposalDeliverySnapshotError =
  | "unauthenticated"
  | "invalid-snapshot"
  | "snapshot-not-found"
  | "already-voided"
  | "service-error";

export type VoidProposalDeliverySnapshotResult =
  | { ok: true; snapshotId: string }
  | { ok: false; error: VoidProposalDeliverySnapshotError };

/**
 * Phase 1B Proposal/SOW Delivery Sprint P3 — operator-only soft void
 * for a proposal delivery snapshot. The row is **not deleted**:
 * `status='voided'`, `voided_at`, `voided_by`, `void_reason`, and
 * `approval_state='revoked'` (so an approved candidate cannot keep its
 * approved badge after a void). Activity event
 * `proposal_snapshot_voided` is emitted with sanitized metadata.
 *
 * No cascade-revoke of proposal share tokens here — `proposal_share_tokens`
 * does not exist until Sprint P4. The Sprint P4 commit will extend this
 * action with a `cascadeRevokeActiveProposalShareTokens` helper
 * mirroring the report-side pattern.
 */
export async function voidProposalDeliverySnapshotAction(args: {
  snapshotId: string;
  reason: string;
}): Promise<VoidProposalDeliverySnapshotResult> {
  const { snapshotId, reason } = args;
  if (!isUuid(snapshotId)) {
    return { ok: false, error: "invalid-snapshot" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: row, error: fetchError } = await supabase
    .from("proposal_delivery_snapshots")
    .select("id, engagement_id, proposal_id, status, approval_state")
    .eq("id", snapshotId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      proposal_id: string;
      status: string;
      approval_state: string;
    }>();
  if (fetchError) {
    console.error("[proposals.snapshot-actions] void-fetch-failed", {
      name: fetchError.name,
      code: fetchError.code,
      message: fetchError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!row?.id) return { ok: false, error: "snapshot-not-found" };
  if (row.status === "voided") {
    return { ok: false, error: "already-voided" };
  }

  const now = new Date().toISOString();
  const trimmedReason = reason.trim().slice(0, 280);
  const { error: updateError } = await supabase
    .from("proposal_delivery_snapshots")
    .update({
      status: "voided",
      voided_at: now,
      voided_by: user.id,
      void_reason: trimmedReason,
      // A voided candidate cannot keep the operator's prior approval.
      approval_state: "revoked",
    })
    .eq("id", snapshotId);
  if (updateError) {
    console.error("[proposals.snapshot-actions] void-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "proposal_snapshot_voided",
    entityType: "proposal_delivery_snapshot",
    entityId: snapshotId,
    engagementId: row.engagement_id,
    title: "Proposal candidate voided",
    summary: "Operator marked an earlier proposal candidate snapshot stale.",
    metadata: {
      proposalId: row.proposal_id,
      priorApprovalState: row.approval_state,
      reason: trimmedReason.slice(0, 120),
    },
  });

  revalidatePath(`/app/engagements/${row.engagement_id}/proposal`);
  revalidatePath(
    `/app/engagements/${row.engagement_id}/proposal/candidate/${snapshotId}`,
  );

  return { ok: true, snapshotId };
}

// ---------------------------------------------------------------------------
// Approve action — Sprint P3
// ---------------------------------------------------------------------------

export type ApproveProposalDeliverySnapshotError =
  | "unauthenticated"
  | "invalid-snapshot"
  | "snapshot-not-found"
  | "snapshot-voided"
  | "already-approved"
  | "commercial-guard-not-passed"
  | "service-error";

export type ApproveProposalDeliverySnapshotResult =
  | { ok: true; snapshotId: string }
  | { ok: false; error: ApproveProposalDeliverySnapshotError };

/**
 * Phase 1B Proposal/SOW Delivery Sprint P3 — operator-only approval
 * flip for a proposal delivery snapshot. Approval is the prerequisite
 * for Sprint P6's SOW Draft eligibility (`docs/24` § SOW Eligibility
 * Rules item 2); it does NOT unlock client delivery — `Prepare Client
 * Review` stays locked until Sprint P5 ships the public route.
 *
 * Approval rules:
 *   - Snapshot must exist and not be voided.
 *   - Commercial guard result must have passed at generation time
 *     (a failed guard means there is no eligible snapshot to approve).
 *   - Pricing review state is NOT auto-advanced — approving a
 *     candidate means "the content is operator-approved", not "the
 *     pricing is approved". The Sprint P5 client render will continue
 *     to hide pricing while `pricing_review_state='placeholder'`.
 *   - `draft_watermark` is flipped to `false`. The internal candidate
 *     route still renders a "Proposal discussion draft" marker per
 *     `docs/24` § Required Disclaimers / Markings, but the
 *     operator-only "Draft Candidate" warning chrome is removed.
 */
export async function approveProposalDeliverySnapshotAction(args: {
  snapshotId: string;
}): Promise<ApproveProposalDeliverySnapshotResult> {
  const { snapshotId } = args;
  if (!isUuid(snapshotId)) {
    return { ok: false, error: "invalid-snapshot" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: row, error: fetchError } = await supabase
    .from("proposal_delivery_snapshots")
    .select(
      "id, engagement_id, proposal_id, status, approval_state, commercial_guard_result",
    )
    .eq("id", snapshotId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      proposal_id: string;
      status: string;
      approval_state: string;
      commercial_guard_result: { passed?: boolean } | null;
    }>();
  if (fetchError) {
    console.error("[proposals.snapshot-actions] approve-fetch-failed", {
      name: fetchError.name,
      code: fetchError.code,
      message: fetchError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!row?.id) return { ok: false, error: "snapshot-not-found" };
  if (row.status === "voided") {
    return { ok: false, error: "snapshot-voided" };
  }
  if (row.approval_state === "approved") {
    return { ok: false, error: "already-approved" };
  }
  if (!row.commercial_guard_result?.passed) {
    return { ok: false, error: "commercial-guard-not-passed" };
  }

  const { error: updateError } = await supabase
    .from("proposal_delivery_snapshots")
    .update({
      approval_state: "approved",
      // Operator approval removes the operator-only "Draft Candidate"
      // warning; the mandatory "Proposal discussion draft" marker
      // remains on the client surface per docs/24.
      draft_watermark: false,
    })
    .eq("id", snapshotId);
  if (updateError) {
    console.error("[proposals.snapshot-actions] approve-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "proposal_snapshot_approved",
    entityType: "proposal_delivery_snapshot",
    entityId: snapshotId,
    engagementId: row.engagement_id,
    title: "Proposal candidate approved",
    summary:
      "Operator approved the content of a proposal candidate. Pricing approval is independent; Send to Client and SOW Draft remain locked.",
    metadata: {
      proposalId: row.proposal_id,
    },
  });

  revalidatePath(`/app/engagements/${row.engagement_id}/proposal`);
  revalidatePath(
    `/app/engagements/${row.engagement_id}/proposal/candidate/${snapshotId}`,
  );

  return { ok: true, snapshotId };
}

// Re-export for any downstream P3+ surface that needs to consume the
// eligibility shape.
export type {
  ProposalDeliveryEligibilityResult,
  ProposalDeliveryEligibilityReason,
};
