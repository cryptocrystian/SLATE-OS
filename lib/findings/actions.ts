"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
        | "service-error";
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

  return { ok: true, findingId: inserted.id };
}

// ---------------------------------------------------------------------------
// Review actions
// ---------------------------------------------------------------------------

async function setReviewStatus(
  findingId: string,
  status: FindingReviewStatus,
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
  if (existingError) {
    console.error("[findings.actions] finding-lookup-failed", {
      name: existingError.name,
      code: existingError.code,
      message: existingError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!existing?.id) return { ok: false, error: "finding-not-found" };

  const { error: updateError } = await supabase
    .from("findings")
    .update({
      review_status: dbReviewStatusFor(status),
      reviewed_by: user.id,
      last_reviewed_at: new Date().toISOString(),
    })
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
  return { ok: true };
}

export async function approveFinding(
  findingId: string,
): Promise<FindingActionResult> {
  return setReviewStatus(findingId, "approved");
}

export async function rejectFinding(
  findingId: string,
): Promise<FindingActionResult> {
  return setReviewStatus(findingId, "rejected");
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
