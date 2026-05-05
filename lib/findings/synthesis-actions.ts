"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { isAiConfigured } from "@/lib/ai/provider";
import { buildFindingsSynthesisContext } from "@/lib/ai/findings-context";
import {
  FINDINGS_SYNTHESIS_BOUNDS,
  synthesizeDraftFindings,
} from "@/lib/ai/findings-synthesis";
import type {
  DraftFindingCandidate,
  DraftFindingSourceRef,
} from "@/lib/ai/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { isUuid } from "./mappers";

/**
 * Operator-only AI synthesis entry point for findings.
 *
 * Flow:
 *   1. Validate UUID and require an authenticated operator session.
 *   2. Build a structured synthesis context (server-only, RLS-bounded).
 *   3. Open an `ai_synthesis_runs` row in `started` state.
 *   4. Call the LLM provider, validate the JSON response.
 *   5. Insert generated findings (`ai_drafted=true`, `review_status=
 *      needs_review`) plus their typed source refs.
 *   6. Update the run row to `completed` or `failed`, emit a single
 *      activity event, revalidate the affected routes.
 *
 * Failure modes are encoded in the discriminated `error` union so the
 * UI can render controlled messaging without needing access to raw
 * provider errors. No prompt body, raw response, file name, signed URL,
 * stakeholder excerpt, or storage path is ever returned to the caller.
 */

export type GenerateFindingsError =
  | "unauthenticated"
  | "invalid-engagement"
  | "engagement-not-found"
  | "ai-not-configured"
  | "ai-provider-failed"
  | "ai-response-invalid"
  | "ai-rate-limited"
  | "ai-timeout"
  | "service-error";

export type GenerateFindingsResult =
  | {
      ok: true;
      generatedCount: number;
      skippedDuplicateCount: number;
      provider: string;
      model: string;
    }
  | { ok: false; error: GenerateFindingsError };

export async function generateDraftFindingsForEngagement(
  engagementId: string,
): Promise<GenerateFindingsResult> {
  if (!isUuid(engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }

  // Auth gate first — never let a malformed call leak DB errors.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  if (!isAiConfigured()) {
    return { ok: false, error: "ai-not-configured" };
  }

  // Resolve workspace id once. RLS will reject any later write the
  // operator does not own; this lookup keeps inserts well-typed.
  const { data: engagementRow, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    console.error("[findings.synthesis] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  // Build context.
  const contextResult = await buildFindingsSynthesisContext(engagementId);
  if (!contextResult.ok) {
    if (contextResult.error === "engagement-not-found") {
      return { ok: false, error: "engagement-not-found" };
    }
    if (contextResult.error === "unauthenticated") {
      return { ok: false, error: "unauthenticated" };
    }
    return { ok: false, error: "service-error" };
  }
  const context = contextResult.context;

  // Open synthesis run row. We log only safe summary metadata.
  const inputSummary = {
    intakeResponses: context.intake.responses.length,
    intakeSessions: context.intake.sessionCount,
    completedSessions: context.intake.completedCount,
    inputAssets: context.inputAssets.length,
    scorecardAnswers: context.scorecard?.answers.length ?? 0,
    existingFindings: context.existingFindings.length,
    minFindings: FINDINGS_SYNTHESIS_BOUNDS.MIN_FINDINGS,
    maxFindings: FINDINGS_SYNTHESIS_BOUNDS.MAX_FINDINGS,
  };

  const { data: runRow, error: runInsertError } = await supabase
    .from("ai_synthesis_runs")
    .insert({
      workspace_id: engagementRow.workspace_id,
      engagement_id: engagementRow.id,
      run_type: "findings_draft",
      status: "started",
      input_summary: inputSummary,
      created_by_profile_id: user.id,
      created_by_user_id: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (runInsertError || !runRow?.id) {
    console.error("[findings.synthesis] run-insert-failed", {
      name: runInsertError?.name,
      code: runInsertError?.code,
      message: runInsertError?.message,
    });
    return { ok: false, error: "service-error" };
  }
  const runId = runRow.id;

  // Call provider.
  const synthesisResult = await synthesizeDraftFindings(context);
  if (!synthesisResult.ok) {
    await markRunFailed(runId, synthesisResult.error, synthesisResult.message);
    await logActivityEvent({
      eventType: "ai_synthesis_failed",
      entityType: "ai_synthesis_run",
      entityId: runId,
      engagementId: engagementRow.id,
      title: "AI synthesis run failed",
      summary: "The findings synthesis run did not complete.",
      metadata: {
        runType: "findings_draft",
        errorCode: synthesisResult.error,
      },
    });
    revalidatePaths(engagementRow.id);
    switch (synthesisResult.error) {
      case "ai-not-configured":
        return { ok: false, error: "ai-not-configured" };
      case "ai-rate-limited":
        return { ok: false, error: "ai-rate-limited" };
      case "ai-timeout":
        return { ok: false, error: "ai-timeout" };
      case "ai-response-invalid":
        return { ok: false, error: "ai-response-invalid" };
      case "ai-request-failed":
      default:
        return { ok: false, error: "ai-provider-failed" };
    }
  }

  // Persist findings.
  const existingStatements = new Set(
    context.existingFindings
      .map((f) => normalizeStatement(f.statement))
      .filter((s) => s.length > 0),
  );

  let generated = 0;
  let skippedDuplicates = 0;
  const insertErrors: string[] = [];

  for (const candidate of synthesisResult.candidates) {
    const normalized = normalizeStatement(candidate.statement);
    if (existingStatements.has(normalized)) {
      skippedDuplicates += 1;
      continue;
    }
    existingStatements.add(normalized);

    const { data: insertedFinding, error: findingError } = await supabase
      .from("findings")
      .insert({
        workspace_id: engagementRow.workspace_id,
        engagement_id: engagementRow.id,
        category: candidate.category,
        statement: candidate.statement,
        summary: candidate.summary || null,
        evidence_summary: candidate.evidenceSummary || null,
        confidence: candidate.confidence,
        review_status: "needs_review",
        suggested_impact: candidate.suggestedImpact ?? null,
        assumption_flag: candidate.assumptionFlag,
        assumption_note: candidate.assumptionNote ?? null,
        ai_drafted: true,
      })
      .select("id")
      .single<{ id: string }>();
    if (findingError || !insertedFinding?.id) {
      insertErrors.push(findingError?.code ?? "unknown");
      console.error("[findings.synthesis] finding-insert-failed", {
        name: findingError?.name,
        code: findingError?.code,
        message: findingError?.message,
      });
      continue;
    }

    if (candidate.sourceRefs.length > 0) {
      const refRows = candidate.sourceRefs.map((ref) =>
        toSourceRefRow({
          ref,
          workspaceId: engagementRow.workspace_id,
          engagementId: engagementRow.id,
          findingId: insertedFinding.id,
        }),
      );
      const { error: refsError } = await supabase
        .from("finding_source_refs")
        .insert(refRows);
      if (refsError) {
        console.error("[findings.synthesis] source-refs-insert-failed", {
          name: refsError.name,
          code: refsError.code,
          message: refsError.message,
        });
        // Non-fatal: the finding row is in needs_review and a consultant
        // can still review it — refs can be added manually.
      }
    }

    generated += 1;
  }

  const completedSummary = {
    runType: "findings_draft",
    generatedCount: generated,
    skippedDuplicateCount: skippedDuplicates,
    candidateCount: synthesisResult.candidates.length,
    insertErrorCount: insertErrors.length,
    provider: synthesisResult.providerMeta.provider,
    model: synthesisResult.providerMeta.model,
  };

  await supabase
    .from("ai_synthesis_runs")
    .update({
      status: generated > 0 ? "completed" : "failed",
      provider: synthesisResult.providerMeta.provider,
      model: synthesisResult.providerMeta.model,
      output_summary: completedSummary,
      completed_at: new Date().toISOString(),
      ...(generated === 0
        ? { error_code: "no-findings-persisted" }
        : { error_code: null, error_message: null }),
    })
    .eq("id", runId);

  await bumpEngagement(supabase, engagementRow.id);
  revalidatePaths(engagementRow.id);

  await logActivityEvent({
    eventType: generated > 0 ? "ai_findings_generated" : "ai_synthesis_failed",
    entityType: "ai_synthesis_run",
    entityId: runId,
    engagementId: engagementRow.id,
    title:
      generated > 0
        ? "AI draft findings generated"
        : "AI synthesis produced no findings",
    summary:
      generated > 0
        ? `${generated} draft finding${generated === 1 ? "" : "s"} added in needs-review.`
        : "Synthesis completed but no findings were persisted.",
    metadata: {
      runType: "findings_draft",
      generatedCount: generated,
      skippedDuplicateCount: skippedDuplicates,
      provider: synthesisResult.providerMeta.provider,
      model: synthesisResult.providerMeta.model,
    },
  });

  return {
    ok: true,
    generatedCount: generated,
    skippedDuplicateCount: skippedDuplicates,
    provider: synthesisResult.providerMeta.provider,
    model: synthesisResult.providerMeta.model,
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function markRunFailed(
  runId: string,
  errorCode: string,
  errorMessage: string | undefined,
) {
  const supabase = createSupabaseServerClient();
  await supabase
    .from("ai_synthesis_runs")
    .update({
      status: "failed",
      error_code: errorCode,
      error_message: errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

interface SourceRefInsertInput {
  ref: DraftFindingSourceRef;
  workspaceId: string;
  engagementId: string;
  findingId: string;
}

function toSourceRefRow({
  ref,
  workspaceId,
  engagementId,
  findingId,
}: SourceRefInsertInput) {
  // Translate the model's "missing" strength to "thin" for DB compatibility
  // (the existing finding_source_refs.strength vocabulary is "strong" /
  // "adequate" / "thin"). "missing" is recorded on the candidate object
  // itself for prompt-side reasoning but not persisted.
  const strength =
    ref.strength === "missing" ? "thin" : ref.strength;
  return {
    workspace_id: workspaceId,
    engagement_id: engagementId,
    finding_id: findingId,
    source_type: ref.sourceType,
    source_id: ref.sourceId ?? null,
    source_label: ref.sourceLabel,
    source_role: ref.sourceRole ?? null,
    excerpt: ref.excerpt ?? null,
    strength,
  };
}

function normalizeStatement(statement: string): string {
  return statement.toLowerCase().replace(/\s+/g, " ").trim();
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

// Re-export the candidate type so the action file is the single import
// path callers use.
export type { DraftFindingCandidate };
