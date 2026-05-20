"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { runSowDraftCommercialGuard, type SowDraftFields } from "./commercial-guard";
import { mapProposalDeliverySnapshotRow } from "./delivery-snapshot-mappers";
import {
  PROPOSAL_GROUP_B_OMISSION_ENTRY,
  type DbProposalDeliverySnapshotRow,
  type ProposalDeliverySnapshot,
  type ProposalOptionSnapshot,
  type ProposalSourceContextSnapshot,
} from "./delivery-snapshot-types";
import { isUuid } from "./mappers";
import {
  evaluateSowDraftEligibility,
  LEGAL_BOUNDARY_NOTICE,
  type SowDraftEligibilityReason,
} from "./sow-draft-eligibility";

/**
 * Phase 1B SOW Draft Sprint P6-B — operator-only SOW Draft candidate
 * snapshot action.
 *
 * Pipeline:
 *   1. Validate UUIDs + operator session.
 *   2. Resolve engagement + workspace boundary.
 *   3. Load the source Proposal Candidate snapshot via the
 *      cookie-bound RLS query helper.
 *   4. Verify the source snapshot belongs to the engagement and is in
 *      `approval_state='approved'` + `status != 'voided'` (the SOW
 *      eligibility evaluator re-checks these; the action gates here
 *      so we don't waste cycles on obvious blockers).
 *   5. Resolve the included-options set (operator-passed
 *      `selectedOptionIds[]` → recommended-from-source → all-included-
 *      from-source fallback).
 *   6. Build the `sowDraftSnapshot` jsonb under
 *      `source_context_snapshot.sowDraft` per `docs/26` § SOW Snapshot
 *      Model.
 *   7. Run `runSowDraftCommercialGuard` against the selected options +
 *      SOW Draft fields.
 *   8. Run `evaluateSowDraftEligibility`.
 *   9. If commercial guard fails OR eligibility blocks → log
 *      `sow_draft_failed` with safe counts / reason codes only (NEVER
 *      violation text), return error.
 *  10. Insert the `proposal_delivery_snapshots` row with status
 *      `candidate` + delivery_surface `sow_draft_candidate` +
 *      approval_state `unreviewed` + pricing_review_state copied from
 *      source + draft_watermark `true`.
 *  11. Log `sow_draft_generated` activity event.
 *  12. Revalidate the proposal page; return `{ ok: true, snapshotId }`.
 *
 * Sprint P6-B has NO UI button mounted for this action — Sprint P6-C
 * wires it into the proposal page's Past SOW Drafts panel and unlocks
 * `Prepare SOW Draft` at the END of P6-C. Sprint P6-B ships the
 * foundation only.
 *
 * No public route. No share token. No `Send to Client` unlock. No
 * email / CRM. No PDF binary. No Group-B wiring.
 */

export type GenerateSowDraftCandidateError =
  | "unauthenticated"
  | "invalid-engagement"
  | "invalid-proposal"
  | "invalid-source-snapshot"
  | "engagement-not-found"
  | "source-snapshot-not-found"
  | "source-snapshot-wrong-engagement"
  | "source-snapshot-voided"
  | "source-snapshot-not-approved"
  | "source-surface-not-proposal-candidate"
  | "eligibility-blocked"
  | "commercial-guard-violation"
  | "service-error";

export interface GenerateSowDraftCandidateSuccess {
  ok: true;
  snapshotId: string;
  deliverySurface: "sow_draft_candidate";
  draftWatermark: boolean;
  approvalState: "unreviewed";
  pricingReviewState: ProposalDeliverySnapshot["pricingReviewState"];
  includedOptionCount: number;
  omittedOptionCount: number;
}

export interface GenerateSowDraftCandidateFailure {
  ok: false;
  error: GenerateSowDraftCandidateError;
  eligibilityReasons?: SowDraftEligibilityReason[];
  /**
   * Per-field violation summary. Only `{field, code}` — banned phrase
   * text is NEVER returned to the caller and NEVER persisted in
   * activity-event metadata.
   */
  violations?: ReadonlyArray<{ field: string; code: string }>;
}

export type GenerateSowDraftCandidateResult =
  | GenerateSowDraftCandidateSuccess
  | GenerateSowDraftCandidateFailure;

const SNAPSHOT_SELECT = `
  id,
  workspace_id,
  engagement_id,
  proposal_id,
  status,
  delivery_surface,
  proposal_status_at_generation,
  generated_by,
  generated_by_label,
  generated_at,
  option_snapshot,
  source_context_snapshot,
  commercial_guard_result,
  omitted_content,
  draft_watermark,
  approval_state,
  pricing_review_state,
  selected_option_ids,
  artifact_path,
  artifact_mime_type,
  artifact_size_bytes,
  app_version,
  commit_sha,
  voided_at,
  voided_by,
  void_reason,
  created_at,
  updated_at
` as const;

export async function generateSowDraftCandidateAction(args: {
  engagementId: string;
  proposalId?: string;
  sourceProposalSnapshotId: string;
  selectedOptionIds?: string[];
}): Promise<GenerateSowDraftCandidateResult> {
  const { engagementId, sourceProposalSnapshotId } = args;
  if (!isUuid(engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  if (args.proposalId !== undefined && !isUuid(args.proposalId)) {
    return { ok: false, error: "invalid-proposal" };
  }
  if (!isUuid(sourceProposalSnapshotId)) {
    return { ok: false, error: "invalid-source-snapshot" };
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
    console.error("[proposals.sow-draft-actions] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  // Load the source Proposal Candidate snapshot.
  const { data: sourceRow, error: sourceFetchError } = await supabase
    .from("proposal_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", sourceProposalSnapshotId)
    .maybeSingle();
  if (sourceFetchError) {
    console.error("[proposals.sow-draft-actions] source-fetch-failed", {
      name: sourceFetchError.name,
      code: sourceFetchError.code,
      message: sourceFetchError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!sourceRow) {
    return { ok: false, error: "source-snapshot-not-found" };
  }

  const source = mapProposalDeliverySnapshotRow(
    sourceRow as unknown as DbProposalDeliverySnapshotRow,
  );

  // Defense-in-depth gates BEFORE we waste cycles on guard / eligibility.
  if (source.engagementId !== engagementRow.id) {
    return { ok: false, error: "source-snapshot-wrong-engagement" };
  }
  if (source.status === "voided") {
    return { ok: false, error: "source-snapshot-voided" };
  }
  if (source.deliverySurface !== "client_proposal_candidate") {
    return { ok: false, error: "source-surface-not-proposal-candidate" };
  }
  if (source.approvalState !== "approved") {
    return { ok: false, error: "source-snapshot-not-approved" };
  }
  if (args.proposalId && args.proposalId !== source.proposalId) {
    // Proposal id mismatch — the source snapshot belongs to a
    // different proposal than the operator claimed.
    return { ok: false, error: "invalid-proposal" };
  }

  // Resolve the included-options set per `docs/26` § Open Decisions
  // (canon default: operator-selected with recommended-from-source
  // fallback).
  const sourceIncludedOptions = source.optionSnapshot.filter(
    (o) => o.includedInArtifact,
  );
  const recommendedIds = sourceIncludedOptions
    .filter((o) => o.recommended)
    .map((o) => o.optionId);
  const selectedFromArgs = (args.selectedOptionIds ?? []).filter((id) =>
    sourceIncludedOptions.some((o) => o.optionId === id),
  );
  const includedIds =
    selectedFromArgs.length > 0
      ? selectedFromArgs
      : recommendedIds.length > 0
        ? recommendedIds
        : sourceIncludedOptions.map((o) => o.optionId);

  // Build the SOW-side optionSnapshot — same per-option content the
  // source captured, but with `includedInArtifact` set per the SOW
  // selection (the operator may include a subset of the source's
  // included options).
  const sowOptionSnapshot: ProposalOptionSnapshot[] = source.optionSnapshot.map(
    (o) => ({
      ...o,
      includedInArtifact: includedIds.includes(o.optionId),
    }),
  );

  // Build the SOW-specific source context. The proposal-side
  // implementation credit is captured verbatim (snapshot-pure
  // semantics) but the SOW renderer hides it until commercial
  // approval per canon.
  const sowDraft: SowDraftFields = buildSowDraftFromSource(
    source,
    sowOptionSnapshot.filter((o) => o.includedInArtifact),
  );

  const sowSourceContext: ProposalSourceContextSnapshot & {
    sowDraft: SowDraftFields;
  } = {
    implementationCredit: { ...source.sourceContextSnapshot.implementationCredit },
    reportSnapshotId: source.sourceContextSnapshot.reportSnapshotId,
    linkedOpportunityIds: [...source.sourceContextSnapshot.linkedOpportunityIds],
    linkedRoadmapItemIds: [...source.sourceContextSnapshot.linkedRoadmapItemIds],
    sowDraft,
  };

  // Run the SOW commercial guard BEFORE the eligibility evaluator.
  // The evaluator consumes the guard's `passed` flag as one of its
  // 15 conditions.
  const commercialGuardResult = runSowDraftCommercialGuard({
    optionSnapshot: sowOptionSnapshot,
    sourceContextSnapshot: sowSourceContext,
    sowDraft,
  });

  const eligibility = evaluateSowDraftEligibility({
    isPersistedEngagement: true,
    sourceProposalSnapshot: source,
    selectedOptionIds: selectedFromArgs.length > 0 ? selectedFromArgs : undefined,
    resolvedIncludedOptionIds: includedIds,
    commercialGuardResult,
  });

  if (!commercialGuardResult.passed) {
    await logActivityEvent({
      eventType: "sow_draft_failed",
      entityType: "proposal_delivery_snapshot",
      entityId: null,
      engagementId: engagementRow.id,
      title: "SOW Draft generation failed",
      summary:
        "Generation blocked by export-time SOW commercial guard. No SOW snapshot was created.",
      metadata: {
        proposalId: source.proposalId,
        sourceProposalSnapshotId: source.id,
        failureReason: "sow_commercial_guard_violation",
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
      eventType: "sow_draft_failed",
      entityType: "proposal_delivery_snapshot",
      entityId: null,
      engagementId: engagementRow.id,
      title: "SOW Draft generation failed",
      summary:
        "Generation blocked by SOW Draft eligibility evaluator. No SOW snapshot was created.",
      metadata: {
        proposalId: source.proposalId,
        sourceProposalSnapshotId: source.id,
        failureReason: "sow_eligibility_blocked",
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
      proposal_id: source.proposalId,
      status: "candidate",
      delivery_surface: "sow_draft_candidate",
      // Mirror the source proposal's status — same convention used by
      // the report-side pipeline. The SOW snapshot is a derivative
      // artifact; the proposal status at generation is captured as
      // audit context.
      proposal_status_at_generation: source.proposalStatusAtGeneration,
      generated_by: user.id,
      generated_by_label: operatorLabel,
      option_snapshot: sowOptionSnapshot,
      source_context_snapshot: sowSourceContext,
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
    console.error("[proposals.sow-draft-actions] insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  const includedOptionCount = eligibility.includedOptionIds.length;
  const omittedOptionCount = eligibility.omittedOptionIds.length;

  await logActivityEvent({
    eventType: "sow_draft_generated",
    entityType: "proposal_delivery_snapshot",
    entityId: snapshotRow.id,
    engagementId: engagementRow.id,
    title: "SOW Draft generated",
    summary:
      "Operator-only SOW Draft candidate. No public route exists; SLATE does not deliver this artifact to a client. Pricing remains hidden until a commercial-approval workflow exists.",
    metadata: {
      proposalId: source.proposalId,
      sourceProposalSnapshotId: source.id,
      deliverySurface: "sow_draft_candidate",
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
    deliverySurface: "sow_draft_candidate",
    draftWatermark: eligibility.draftWatermark,
    approvalState: "unreviewed",
    pricingReviewState: eligibility.pricingReviewState,
    includedOptionCount,
    omittedOptionCount,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the SOW Draft jsonb payload from the source Proposal Candidate
 * snapshot + the operator-selected included options. The canon
 * (`docs/26` § SOW Snapshot Model) specifies the shape; this helper
 * is the single point of construction so the SOW renderer in Sprint
 * P6-C reads a stable contract.
 *
 * Promoted fields use the FIRST included option's content as the SOW
 * Draft's base scope statement / timeline. Multi-option SOW Drafts
 * (operator-selected multiple options) are an explicit canon-allowed
 * shape but the base scope copy comes from the first option to keep
 * the SOW Draft readable as a single artifact. The full per-option
 * detail is preserved in the snapshot's `option_snapshot` for the
 * Sprint P6-C renderer.
 */
function buildSowDraftFromSource(
  source: ProposalDeliverySnapshot,
  includedOptions: ProposalOptionSnapshot[],
): SowDraftFields {
  const primary = includedOptions[0];
  const pricingNotice =
    source.pricingReviewState === "placeholder"
      ? "Pricing is pending manual review and is intentionally omitted from this draft."
      : "Estimated · subject to final approval. Not a binding quote.";
  // Imported from `sow-draft-eligibility` so the action layer + the
  // eligibility evaluator emit byte-identical legal-boundary text.
  const legalBoundaryNotice = LEGAL_BOUNDARY_NOTICE;

  return {
    scopeStatement: primary?.scopeSummary ?? "",
    // Flatten deliverables across all included options so the SOW
    // Draft reads as a single deliverable list. Sprint P6-C renderer
    // can render them grouped by option if needed.
    deliverables: dedupe(includedOptions.flatMap((o) => o.deliverables)),
    // SOW-specific; not promoted from source. Operator fills in
    // post-generation via a future SOW editor surface; default empty.
    exclusions: [],
    assumptions: dedupe(includedOptions.flatMap((o) => o.assumptions)),
    dependencies: dedupe(includedOptions.flatMap((o) => o.dependencies)),
    proposedTimeline: primary?.timeline ?? "",
    // SOW-specific structured shape per canon; default empty so
    // the operator fills in via a future SOW editor.
    responsibilities: {
      client: [],
      operator: [],
    },
    openQuestions: [],
    pricingNotice,
    legalBoundaryNotice,
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

// Re-export the eligibility reason shape for any P6-C consumer that
// needs to surface the failure reasons in the UI.
export type { SowDraftEligibilityReason };
