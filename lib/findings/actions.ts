"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivityEvent } from "@/lib/activity/log";
import type { ActivityEventType } from "@/lib/activity/types";
import {
  dbCategoryFor,
  dbConfidenceFor,
  dbReviewStatusFor,
  dbSourceTypeFor,
  isUuid,
} from "./mappers";
import type {
  FindingCategory,
  FindingConfidence,
  FindingReviewStatus,
  SourceRef,
  SourceRefType,
} from "./types";
import { summarizeFindingProvenance } from "./provenance";

/**
 * Authenticated-operator server actions for findings.
 *
 * Every action runs against the cookie-bound server Supabase client so
 * RLS evaluates with the operator's auth.uid(). `supabase.auth.getUser()`
 * provides a fast bounce-to-login when the session has lapsed.
 */

const VALID_CATEGORIES: FindingCategory[] = [
  "Workflow Friction",
  "Systems Gap",
  "Data Readiness",
  "Adoption Risk",
  "Governance / Risk",
  "Revenue Opportunity",
  "Back-office Efficiency",
  "Customer Experience",
];

const VALID_CONFIDENCES: FindingConfidence[] = [
  "high",
  "medium",
  "low",
  "needs-evidence",
];

export interface CreateManualFindingInput {
  engagementId: string;
  category: FindingCategory;
  statement: string;
  summary?: string;
  evidenceSummary?: string;
  confidence: FindingConfidence;
  suggestedImpact?: string;
  assumptionFlag?: boolean;
  assumptionNote?: string;
  reviewerNote?: string;
  /** Optional evidence references — typically intake responses or input
   *  assets the operator wants to attach as supporting evidence. */
  sourceRefs?: Array<{
    type: SourceRefType;
    sourceId?: string;
    sourceLabel?: string;
    sourceRole?: string;
    excerpt?: string;
    strength?: SourceRef["strength"];
  }>;
}

export type FindingActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "invalid-engagement"
        | "invalid-finding"
        | "missing-fields"
        | "invalid-category"
        | "invalid-confidence"
        | "engagement-not-found"
        | "finding-not-found"
        | "service-error"
        // Sprint S5 — rejection reason validation.
        | "rejection-reason-invalid";
    };

export type CreateFindingResult =
  | { ok: true; findingId: string }
  | (Exclude<FindingActionResult, { ok: true }> & { ok: false });

// ---------------------------------------------------------------------------
// Create manual finding
// ---------------------------------------------------------------------------

export async function createManualFinding(
  input: CreateManualFindingInput,
): Promise<CreateFindingResult> {
  if (!isUuid(input.engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  const statement = input.statement.trim();
  if (!statement) {
    return { ok: false, error: "missing-fields" };
  }
  if (!VALID_CATEGORIES.includes(input.category)) {
    return { ok: false, error: "invalid-category" };
  }
  if (!VALID_CONFIDENCES.includes(input.confidence)) {
    return { ok: false, error: "invalid-confidence" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", input.engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    console.error("[findings.actions] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagement?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("findings")
    .insert({
      workspace_id: engagement.workspace_id,
      engagement_id: engagement.id,
      category: dbCategoryFor(input.category),
      statement,
      summary: trimOrNull(input.summary),
      evidence_summary: trimOrNull(input.evidenceSummary),
      confidence: dbConfidenceFor(input.confidence),
      review_status: "needs_review",
      suggested_impact: trimOrNull(input.suggestedImpact),
      assumption_flag: Boolean(input.assumptionFlag),
      assumption_note: trimOrNull(input.assumptionNote),
      reviewer_note: trimOrNull(input.reviewerNote),
      ai_drafted: false,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !inserted?.id) {
    console.error("[findings.actions] finding-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  const refs = input.sourceRefs ?? [];
  if (refs.length > 0) {
    const refRows = refs
      .filter((r) => r.sourceLabel?.trim() || r.excerpt?.trim() || r.sourceId)
      .map((r) => ({
        workspace_id: engagement.workspace_id,
        engagement_id: engagement.id,
        finding_id: inserted.id,
        source_type: dbSourceTypeFor(r.type),
        source_id: r.sourceId ?? null,
        source_label: trimOrNull(r.sourceLabel),
        source_role: trimOrNull(r.sourceRole),
        excerpt: trimOrNull(r.excerpt),
        strength: r.strength ?? "adequate",
      }));
    if (refRows.length > 0) {
      const { error: refsError } = await supabase
        .from("finding_source_refs")
        .insert(refRows);
      if (refsError) {
        console.error("[findings.actions] source-refs-insert-failed", {
          name: refsError.name,
          code: refsError.code,
          message: refsError.message,
        });
        // Non-fatal: the finding exists; refs can be added later.
      }
    }
  }

  await bumpEngagement(supabase, engagement.id);
  revalidatePaths(engagement.id);

  await logActivityEvent({
    eventType: "finding_created",
    entityType: "finding",
    entityId: inserted.id,
    engagementId: engagement.id,
    title: "Finding added",
    summary: "An operator authored a manual finding.",
    metadata: {
      category: input.category,
      confidence: input.confidence,
      sourceRefsCount: refs.length,
    },
  });

  return { ok: true, findingId: inserted.id };
}

// ---------------------------------------------------------------------------
// Review actions
// ---------------------------------------------------------------------------

interface SetReviewStatusOptions {
  /** Sprint S5 — optional rejection reason for `rejected` transitions.
   *  Bounded 10–500 chars; sanitized server-side; persisted in
   *  `findings.reviewer_note` AND surfaced in activity event metadata. */
  rejectionReason?: string;
}

async function setReviewStatus(
  findingId: string,
  status: FindingReviewStatus,
  options: SetReviewStatusOptions = {},
): Promise<FindingActionResult> {
  if (!isUuid(findingId)) {
    return { ok: false, error: "invalid-finding" };
  }

  // Sprint S5 — sanitize rejection reason if provided. Bounded length
  // protects against runaway operator input and keeps activity metadata
  // small. The reason text IS operator-supplied free text; per the
  // operator-input contract it must not contain PII.
  let sanitizedRejectionReason: string | null = null;
  if (status === "rejected" && options.rejectionReason !== undefined) {
    const reason = String(options.rejectionReason).trim();
    if (reason.length > 0) {
      if (reason.length < 10 || reason.length > 500) {
        return { ok: false, error: "rejection-reason-invalid" };
      }
      sanitizedRejectionReason = reason;
    }
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // Sprint S5 — load the finding row + its source refs so we can include
  // sanitized lane counts + dominant-strength signal in the activity
  // event metadata. The refs are NEVER persisted in metadata as raw
  // strings; only counts + strengths leave this function.
  const { data: existing, error: existingError } = await supabase
    .from("findings")
    .select(
      "id, engagement_id, assumption_flag, confidence, ai_drafted, review_status",
    )
    .eq("id", findingId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      assumption_flag: boolean | null;
      confidence: string | null;
      ai_drafted: boolean | null;
      review_status: string | null;
    }>();
  if (existingError) {
    console.error("[findings.actions] finding-lookup-failed", {
      name: existingError.name,
      code: existingError.code,
      message: existingError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!existing?.id) return { ok: false, error: "finding-not-found" };

  const { data: refRows } = await supabase
    .from("finding_source_refs")
    .select("source_type, strength")
    .eq("finding_id", findingId);
  const refList = (refRows as unknown as Array<{
    source_type: string | null;
    strength: string | null;
  }>) ?? [];
  const provenance = summarizeFindingProvenance(
    refList.map((r) => ({
      id: "",
      type: mapDbSourceType(r.source_type),
      source: "",
      excerpt: "",
      strength: mapDbStrength(r.strength),
    })),
    Boolean(existing.assumption_flag),
  );

  const updatePayload: Record<string, unknown> = {
    review_status: dbReviewStatusFor(status),
    reviewed_by: user.id,
    last_reviewed_at: new Date().toISOString(),
  };
  if (status === "rejected" && sanitizedRejectionReason) {
    // Persist the rejection reason in `reviewer_note` so it shows up on
    // the finding card alongside the rejected status. Operator can edit
    // it later via `updateFindingNote` if needed.
    updatePayload.reviewer_note = sanitizedRejectionReason;
  }

  const { error: updateError } = await supabase
    .from("findings")
    .update(updatePayload)
    .eq("id", findingId);
  if (updateError) {
    console.error("[findings.actions] review-status-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);

  const eventType = REVIEW_EVENT_TYPE[status];
  if (eventType) {
    await logActivityEvent({
      eventType,
      entityType: "finding",
      entityId: existing.id,
      engagementId: existing.engagement_id,
      title: REVIEW_EVENT_TITLE[status],
      summary: REVIEW_EVENT_SUMMARY[status],
      metadata: {
        reviewStatus: status,
        priorStatus: existing.review_status ?? null,
        confidence: existing.confidence ?? null,
        aiDrafted: Boolean(existing.ai_drafted),
        // Sprint S5 — provenance-summary metadata. Counts + strengths
        // only; ZERO raw evidence text leaves this surface.
        provenance: {
          totalRefs: provenance.totalRefs,
          stakeholderResponseRefs: provenance.stakeholderResponseRefs,
          uploadedDocumentRefs: provenance.uploadedDocumentRefs,
          scorecardAnswerRefs: provenance.scorecardAnswerRefs,
          consultantNoteRefs: provenance.consultantNoteRefs,
          dominantStrength: provenance.dominantStrength,
          needsValidation: provenance.needsValidation,
        },
        ...(sanitizedRejectionReason
          ? { rejectionReason: sanitizedRejectionReason }
          : {}),
      },
    });
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// DB-type fitters reused locally for activity metadata derivation
// ---------------------------------------------------------------------------

function mapDbSourceType(raw: string | null): SourceRefType {
  switch (raw) {
    case "stakeholder_response":
      return "stakeholder-response";
    case "input_asset":
      return "uploaded-document";
    case "scorecard_answer":
      return "scorecard-answer";
    case "consultant_note":
    default:
      return "consultant-note";
  }
}

function mapDbStrength(raw: string | null): SourceRef["strength"] {
  if (raw === "strong" || raw === "adequate" || raw === "thin") return raw;
  return "thin";
}

const REVIEW_EVENT_TYPE: Partial<Record<FindingReviewStatus, ActivityEventType>> = {
  approved: "finding_approved",
  rejected: "finding_rejected",
  "report-ready": "finding_report_ready",
};

const REVIEW_EVENT_TITLE: Record<FindingReviewStatus, string> = {
  draft: "Finding moved to draft",
  "needs-review": "Finding flagged for review",
  approved: "Finding approved",
  edited: "Finding edited",
  rejected: "Finding rejected",
  "report-ready": "Finding marked report-ready",
};

const REVIEW_EVENT_SUMMARY: Record<FindingReviewStatus, string> = {
  draft: "An operator moved a finding back to draft.",
  "needs-review": "An operator flagged a finding for additional review.",
  approved: "An operator approved a finding for report consideration.",
  edited: "An operator edited a finding.",
  rejected: "An operator rejected a finding.",
  "report-ready": "An operator locked a finding as report-ready.",
};

export async function approveFinding(
  findingId: string,
): Promise<FindingActionResult> {
  return setReviewStatus(findingId, "approved");
}

export interface RejectFindingOptions {
  /** Sprint S5 — optional operator-supplied rejection reason. Bounded
   *  10–500 chars. Persisted in `findings.reviewer_note` AND in the
   *  `finding_rejected` activity event metadata for audit. */
  reason?: string;
}

export async function rejectFinding(
  findingId: string,
  options: RejectFindingOptions = {},
): Promise<FindingActionResult> {
  return setReviewStatus(findingId, "rejected", {
    rejectionReason: options.reason,
  });
}

export async function markFindingReportReady(
  findingId: string,
): Promise<FindingActionResult> {
  return setReviewStatus(findingId, "report-ready");
}

export async function markFindingNeedsReview(
  findingId: string,
): Promise<FindingActionResult> {
  return setReviewStatus(findingId, "needs-review");
}

// ---------------------------------------------------------------------------
// Reviewer note + edit
// ---------------------------------------------------------------------------

export async function updateFindingNote(
  findingId: string,
  note: string,
): Promise<FindingActionResult> {
  if (!isUuid(findingId)) {
    return { ok: false, error: "invalid-finding" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("findings")
    .select("id, engagement_id")
    .eq("id", findingId)
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "finding-not-found" };
  }

  const trimmed = note.trim();
  const { error: updateError } = await supabase
    .from("findings")
    .update({
      reviewer_note: trimmed.length > 0 ? trimmed : null,
      reviewed_by: user.id,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", findingId);
  if (updateError) {
    console.error("[findings.actions] note-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

export interface EditFindingInput {
  findingId: string;
  category?: FindingCategory;
  statement?: string;
  summary?: string;
  evidenceSummary?: string;
  confidence?: FindingConfidence;
  suggestedImpact?: string;
  assumptionFlag?: boolean;
  assumptionNote?: string;
}

export async function editFinding(
  input: EditFindingInput,
): Promise<FindingActionResult> {
  if (!isUuid(input.findingId)) {
    return { ok: false, error: "invalid-finding" };
  }
  if (input.category && !VALID_CATEGORIES.includes(input.category)) {
    return { ok: false, error: "invalid-category" };
  }
  if (input.confidence && !VALID_CONFIDENCES.includes(input.confidence)) {
    return { ok: false, error: "invalid-confidence" };
  }
  if (input.statement !== undefined && !input.statement.trim()) {
    return { ok: false, error: "missing-fields" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("findings")
    .select("id, engagement_id")
    .eq("id", input.findingId)
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "finding-not-found" };
  }

  const update: Record<string, unknown> = {
    review_status: "edited",
    reviewed_by: user.id,
    last_reviewed_at: new Date().toISOString(),
  };
  if (input.category) update.category = dbCategoryFor(input.category);
  if (input.statement !== undefined) update.statement = input.statement.trim();
  if (input.summary !== undefined) update.summary = trimOrNull(input.summary);
  if (input.evidenceSummary !== undefined)
    update.evidence_summary = trimOrNull(input.evidenceSummary);
  if (input.confidence) update.confidence = dbConfidenceFor(input.confidence);
  if (input.suggestedImpact !== undefined)
    update.suggested_impact = trimOrNull(input.suggestedImpact);
  if (input.assumptionFlag !== undefined)
    update.assumption_flag = Boolean(input.assumptionFlag);
  if (input.assumptionNote !== undefined)
    update.assumption_note = trimOrNull(input.assumptionNote);

  const { error: updateError } = await supabase
    .from("findings")
    .update(update)
    .eq("id", input.findingId);
  if (updateError) {
    console.error("[findings.actions] finding-edit-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function trimOrNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function bumpEngagement(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
) {
  await supabase
    .from("engagements")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", engagementId);
}

function revalidatePaths(engagementId: string) {
  revalidatePath(`/app/engagements/${engagementId}/findings`);
  revalidatePath(`/app/engagements/${engagementId}`);
}
