"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { isAiConfigured } from "@/lib/ai/provider";
import { buildRoadmapSynthesisContext } from "@/lib/ai/roadmap-context";
import {
  synthesizeRoadmapDraft,
  type RoadmapDraftCandidate,
  type RoadmapDraftDbPhase,
} from "@/lib/ai/roadmap-synthesis";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { isUuid } from "./mappers";

/**
 * Operator-only AI synthesis entry point for **roadmap drafting** — AI
 * Synthesis Step 5. Engagement-level batch action that appends planned
 * roadmap items; **never modifies, deletes, reorders, or finalizes
 * existing items**.
 *
 *   1. Validate UUID + auth + AI configuration.
 *   2. Build a structured synthesis context (server-only, RLS-bounded).
 *   3. Open an `ai_synthesis_runs` row (`run_type=roadmap_draft`,
 *      `status=started`) with safe input counts only.
 *   4. Call the LLM provider, validate the JSON response against the
 *      bounded allowlist + the combined banned-claim scanner
 *      (financial + commercial-finality + roadmap-commitment).
 *   5. Determine each new item's `position` by appending after the
 *      current max position in its target phase. Existing items keep
 *      their positions verbatim.
 *   6. Insert each new item with `status='planned'`. Item-level
 *      `roadmap_item_created` activity events fire individually
 *      (consistent with `createRoadmapItem`) plus a single
 *      `ai_roadmap_items_drafted` event summarizing the batch.
 *   7. Close the synthesis run, revalidate the roadmap + report +
 *      proposal routes (those pages read roadmap context).
 *
 * No prompt body, raw response, file name, signed URL, stakeholder
 * excerpt, or storage path is ever returned to the caller or stored on
 * the run row.
 */

export type GenerateRoadmapDraftError =
  | "unauthenticated"
  | "invalid-engagement"
  | "engagement-not-found"
  | "ai-not-configured"
  | "ai-provider-failed"
  | "ai-response-invalid"
  | "ai-claim-violation"
  | "ai-rate-limited"
  | "ai-timeout"
  | "service-error";

export type GenerateRoadmapDraftResult =
  | {
      ok: true;
      engagementId: string;
      generatedCount: number;
      skippedDuplicateCount: number;
      provider: string;
      model: string;
    }
  | { ok: false; error: GenerateRoadmapDraftError };

export async function generateRoadmapDraftAction(args: {
  engagementId: string;
}): Promise<GenerateRoadmapDraftResult> {
  const { engagementId } = args;
  if (!isUuid(engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  if (!isAiConfigured()) {
    return { ok: false, error: "ai-not-configured" };
  }

  const { data: engagementRow, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    console.error("[roadmap.synthesis] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  const contextResult = await buildRoadmapSynthesisContext({ engagementId });
  if (!contextResult.ok) {
    switch (contextResult.error) {
      case "engagement-not-found":
        return { ok: false, error: "engagement-not-found" };
      case "unauthenticated":
        return { ok: false, error: "unauthenticated" };
      default:
        return { ok: false, error: "service-error" };
    }
  }
  const context = contextResult.context;

  // Open synthesis run with safe input counts only.
  // Sprint S7 — extended to record opportunity-status counts so the
  // audit trail makes the eligibility filter visible without leaking
  // any raw text. `selected` is the only eligible status per
  // `docs/48` § 3; the additional counts are projected from the
  // `existingOpportunities` shape on the engagement (see context loader).
  const inputSummary = {
    findings: context.findings.length,
    opportunities: context.opportunities.length,
    existingRoadmap: context.existingRoadmap.length,
    reportSections: context.reportSections.length,
    proposalOptions: context.proposalOptions.length,
  };

  const { data: runRow, error: runInsertError } = await supabase
    .from("ai_synthesis_runs")
    .insert({
      workspace_id: engagementRow.workspace_id,
      engagement_id: engagementRow.id,
      run_type: "roadmap_draft",
      status: "started",
      input_summary: inputSummary,
      created_by_profile_id: user.id,
      created_by_user_id: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (runInsertError || !runRow?.id) {
    console.error("[roadmap.synthesis] run-insert-failed", {
      name: runInsertError?.name,
      code: runInsertError?.code,
      message: runInsertError?.message,
    });
    return { ok: false, error: "service-error" };
  }
  const runId = runRow.id;

  // Call the provider.
  const synthesisResult = await synthesizeRoadmapDraft(context);
  if (!synthesisResult.ok) {
    await markRunFailed(runId, synthesisResult.error, synthesisResult.message);
    await logActivityEvent({
      eventType: "ai_synthesis_failed",
      entityType: "ai_synthesis_run",
      entityId: runId,
      engagementId: engagementRow.id,
      title: "AI roadmap synthesis failed",
      summary: "The roadmap-draft synthesis run did not complete.",
      metadata: {
        runType: "roadmap_draft",
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
      case "ai-claim-violation":
        return { ok: false, error: "ai-claim-violation" };
      case "ai-request-failed":
      default:
        return { ok: false, error: "ai-provider-failed" };
    }
  }

  // Determine starting position per phase by max(existing.position) + 1.
  // This is append-only: existing items keep their positions verbatim.
  const positionByPhase = buildPositionMap(context.existingRoadmap);
  // Defense-in-depth dedup against existing titles, even though the
  // synthesizer already filtered them out.
  const existingTitleKeys = new Set(
    context.existingRoadmap.map((r) => normalizeTitle(r.title)),
  );

  let generated = 0;
  let skippedDuplicates = 0;
  const insertedItemIds: string[] = [];
  const insertErrors: string[] = [];

  for (const candidate of synthesisResult.candidates) {
    const titleKey = normalizeTitle(candidate.title);
    if (existingTitleKeys.has(titleKey)) {
      skippedDuplicates += 1;
      continue;
    }
    existingTitleKeys.add(titleKey);

    const nextPosition = positionByPhase.get(candidate.phase) ?? 0;
    positionByPhase.set(candidate.phase, nextPosition + 1);

    const { data: inserted, error: insertError } = await supabase
      .from("roadmap_items")
      .insert({
        workspace_id: engagementRow.workspace_id,
        engagement_id: engagementRow.id,
        opportunity_id: candidate.linkedOpportunityId,
        phase: candidate.phase,
        title: candidate.title,
        objective: candidate.objective,
        priority: candidate.priority,
        key_actions: candidate.keyActions,
        dependencies: candidate.dependencies,
        success_criteria: candidate.successCriteria,
        risks: candidate.risks,
        owner_placeholder: null,
        readiness_note: null,
        position: nextPosition,
        status: "planned",
      })
      .select("id")
      .single<{ id: string }>();
    if (insertError || !inserted?.id) {
      insertErrors.push(insertError?.code ?? "unknown");
      console.error("[roadmap.synthesis] item-insert-failed", {
        name: insertError?.name,
        code: insertError?.code,
        message: insertError?.message,
      });
      continue;
    }

    insertedItemIds.push(inserted.id);
    generated += 1;

    // Per-item activity event — mirrors `createRoadmapItem` so the
    // engagement timeline carries one row per inserted item.
    await logActivityEvent({
      eventType: "roadmap_item_created",
      entityType: "roadmap_item",
      entityId: inserted.id,
      engagementId: engagementRow.id,
      title: "Roadmap item sequenced (AI draft)",
      summary: "AI synthesis appended a planned roadmap item for operator review.",
      metadata: {
        runType: "roadmap_draft",
        runId,
        phase: candidate.phase,
        priority: candidate.priority,
        linkedOpportunity: Boolean(candidate.linkedOpportunityId),
      },
    });
  }

  // Bump engagement activity timestamp.
  const now = new Date().toISOString();
  await supabase
    .from("engagements")
    .update({ last_activity_at: now })
    .eq("id", engagementRow.id);

  const completedSummary = {
    runType: "roadmap_draft",
    generatedCount: generated,
    skippedDuplicateCount: skippedDuplicates,
    candidateCount: synthesisResult.candidates.length,
    insertErrorCount: insertErrors.length,
    insertedItemIds,
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
      completed_at: now,
      ...(generated === 0
        ? { error_code: "no-items-persisted" }
        : { error_code: null, error_message: null }),
    })
    .eq("id", runId);

  // Single batch-summary activity event.
  await logActivityEvent({
    eventType:
      generated > 0 ? "ai_roadmap_items_drafted" : "ai_synthesis_failed",
    entityType: "ai_synthesis_run",
    entityId: runId,
    engagementId: engagementRow.id,
    title:
      generated > 0
        ? "AI roadmap items drafted"
        : "AI roadmap synthesis produced no items",
    summary:
      generated > 0
        ? `${generated} planned roadmap item${generated === 1 ? "" : "s"} appended. Existing items were not modified.`
        : "Synthesis completed but no items were persisted.",
    metadata: {
      runType: "roadmap_draft",
      generatedCount: generated,
      skippedDuplicateCount: skippedDuplicates,
      // Sprint S7 — sanitized source-evidence summary so an auditor
      // can see at a glance which selected opportunities the run
      // consumed. Counts only, never IDs.
      sourceOpportunities: {
        total: context.opportunities.length,
      },
      provider: synthesisResult.providerMeta.provider,
      model: synthesisResult.providerMeta.model,
    },
  });

  revalidatePaths(engagementRow.id);

  if (generated === 0) {
    return { ok: false, error: "ai-response-invalid" };
  }

  return {
    ok: true,
    engagementId,
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

function buildPositionMap(
  existingRoadmap: Array<{ phase: string }>,
): Map<RoadmapDraftDbPhase, number> {
  const phaseCounts: Map<RoadmapDraftDbPhase, number> = new Map([
    ["first_30", 0],
    ["days_31_60", 0],
    ["days_61_90", 0],
  ]);
  for (const item of existingRoadmap) {
    const phase = item.phase as RoadmapDraftDbPhase;
    if (!phaseCounts.has(phase)) continue;
    phaseCounts.set(phase, (phaseCounts.get(phase) ?? 0) + 1);
  }
  return phaseCounts;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

function revalidatePaths(engagementId: string) {
  revalidatePath(`/app/engagements/${engagementId}/roadmap`);
  revalidatePath(`/app/engagements/${engagementId}/report`);
  revalidatePath(`/app/engagements/${engagementId}/proposal`);
  revalidatePath(`/app/engagements/${engagementId}`);
}

export type { RoadmapDraftCandidate };
