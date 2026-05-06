"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { isAiConfigured } from "@/lib/ai/provider";
import { buildOpportunitySynthesisContext } from "@/lib/ai/opportunities-context";
import {
  OPPORTUNITY_SYNTHESIS_BOUNDS,
  synthesizeDraftOpportunities,
} from "@/lib/ai/opportunities-synthesis";
import type { DraftOpportunityCandidate } from "@/lib/ai/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { computeQuadrant } from "./helpers";
import {
  dbPriorityFor,
  dbQuadrantFor,
  isUuid,
} from "./mappers";
import type {
  OpportunityPriority,
  OpportunityQuadrant,
} from "./types";

/**
 * Operator-only AI synthesis entry point for opportunities.
 *
 * Flow mirrors `lib/findings/synthesis-actions.ts`:
 *   1. Validate UUID and require an authenticated operator session.
 *   2. Build a structured opportunity synthesis context from
 *      approved/report-ready findings (server-only, RLS-bounded).
 *   3. Open an `ai_synthesis_runs` row (`run_type=opportunity_draft`,
 *      `status=started`) with safe input counts only.
 *   4. Call the LLM provider, validate the JSON response.
 *   5. Insert generated opportunities (`status=draft`) with scores
 *      clamped server-side and quadrant/priority derived from the
 *      scores — model-provided priority/quadrant is ignored.
 *   6. Persist `opportunity_finding_links` rows for traceability.
 *   7. Update the run row to `completed`/`failed`, emit a single
 *      activity event, revalidate the affected routes.
 *
 * No prompt body, raw response, file name, signed URL, stakeholder
 * excerpt, or storage path is ever returned to the caller.
 */

export type GenerateOpportunitiesError =
  | "unauthenticated"
  | "invalid-engagement"
  | "engagement-not-found"
  | "ai-not-configured"
  | "no-approved-findings"
  | "ai-provider-failed"
  | "ai-response-invalid"
  | "ai-rate-limited"
  | "ai-timeout"
  | "service-error";

export type GenerateOpportunitiesResult =
  | {
      ok: true;
      generatedCount: number;
      skippedDuplicateCount: number;
      provider: string;
      model: string;
    }
  | { ok: false; error: GenerateOpportunitiesError };

export async function generateDraftOpportunitiesForEngagement(
  engagementId: string,
): Promise<GenerateOpportunitiesResult> {
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
    console.error("[opportunities.synthesis] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  const contextResult = await buildOpportunitySynthesisContext(engagementId);
  if (!contextResult.ok) {
    if (contextResult.error === "engagement-not-found") {
      return { ok: false, error: "engagement-not-found" };
    }
    if (contextResult.error === "unauthenticated") {
      return { ok: false, error: "unauthenticated" };
    }
    if (contextResult.error === "no-approved-findings") {
      return { ok: false, error: "no-approved-findings" };
    }
    return { ok: false, error: "service-error" };
  }
  const context = contextResult.context;

  const inputSummary = {
    findings: context.findings.length,
    inputAssets: context.inputAssets.length,
    scorecardAnswers: context.scorecard?.answers.length ?? 0,
    existingOpportunities: context.existingOpportunities.length,
    minOpportunities: OPPORTUNITY_SYNTHESIS_BOUNDS.MIN_OPPORTUNITIES,
    maxOpportunities: OPPORTUNITY_SYNTHESIS_BOUNDS.MAX_OPPORTUNITIES,
  };

  const { data: runRow, error: runInsertError } = await supabase
    .from("ai_synthesis_runs")
    .insert({
      workspace_id: engagementRow.workspace_id,
      engagement_id: engagementRow.id,
      run_type: "opportunity_draft",
      status: "started",
      input_summary: inputSummary,
      created_by_profile_id: user.id,
      created_by_user_id: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (runInsertError || !runRow?.id) {
    console.error("[opportunities.synthesis] run-insert-failed", {
      name: runInsertError?.name,
      code: runInsertError?.code,
      message: runInsertError?.message,
    });
    return { ok: false, error: "service-error" };
  }
  const runId = runRow.id;

  const synthesisResult = await synthesizeDraftOpportunities(context);
  if (!synthesisResult.ok) {
    await markRunFailed(runId, synthesisResult.error, synthesisResult.message);
    await logActivityEvent({
      eventType: "ai_synthesis_failed",
      entityType: "ai_synthesis_run",
      entityId: runId,
      engagementId: engagementRow.id,
      title: "AI opportunity synthesis failed",
      summary: "The opportunity synthesis run did not complete.",
      metadata: {
        runType: "opportunity_draft",
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

  // Build a duplicate-detection set across both existing opportunities
  // and any newly generated ones (within this batch). Duplicates are
  // dropped rather than coerced.
  const seenTitles = new Set<string>(
    context.existingOpportunities
      .map((o) => normalizeTitle(o.title))
      .filter((t) => t.length > 0),
  );

  let generated = 0;
  let skippedDuplicates = 0;
  const insertErrors: string[] = [];
  let linkErrorCount = 0;

  for (const candidate of synthesisResult.candidates) {
    const titleKey = normalizeTitle(candidate.title);
    if (seenTitles.has(titleKey)) {
      skippedDuplicates += 1;
      continue;
    }
    seenTitles.add(titleKey);

    const quadrant = pickQuadrant(
      candidate.businessImpactScore,
      candidate.complexityScore,
      candidate.riskScore,
    );
    const priority = priorityFromQuadrant(quadrant);

    const { data: insertedOpportunity, error: opportunityError } = await supabase
      .from("opportunities")
      .insert({
        workspace_id: engagementRow.workspace_id,
        engagement_id: engagementRow.id,
        title: candidate.title,
        category: candidate.category,
        description: candidate.description || null,
        priority: dbPriorityFor(priority),
        quadrant: dbQuadrantFor(quadrant),
        business_impact_score: candidate.businessImpactScore,
        complexity_score: candidate.complexityScore,
        risk_score: candidate.riskScore,
        time_to_value_score: candidate.timeToValueScore,
        adoption_likelihood_score: candidate.adoptionLikelihoodScore,
        strategic_value_score: candidate.strategicValueScore,
        evidence_strength: candidate.evidenceStrength,
        source_summary: candidate.sourceSummary || null,
        recommended_action: candidate.recommendedAction || null,
        implementation_shape: candidate.implementationShape || null,
        dependencies: candidate.dependencies,
        risks: candidate.risks,
        success_signals: candidate.successSignals,
        status: "draft",
      })
      .select("id")
      .single<{ id: string }>();
    if (opportunityError || !insertedOpportunity?.id) {
      insertErrors.push(opportunityError?.code ?? "unknown");
      console.error("[opportunities.synthesis] opportunity-insert-failed", {
        name: opportunityError?.name,
        code: opportunityError?.code,
        message: opportunityError?.message,
      });
      continue;
    }

    if (candidate.linkedFindingIds.length > 0) {
      const linkRows = candidate.linkedFindingIds.map((findingId) => ({
        workspace_id: engagementRow.workspace_id,
        engagement_id: engagementRow.id,
        opportunity_id: insertedOpportunity.id,
        finding_id: findingId,
        strength: candidate.evidenceStrength,
      }));
      const { error: linksError } = await supabase
        .from("opportunity_finding_links")
        .insert(linkRows);
      if (linksError) {
        linkErrorCount += 1;
        console.error("[opportunities.synthesis] links-insert-failed", {
          name: linksError.name,
          code: linksError.code,
          message: linksError.message,
        });
        // Non-fatal: opportunity remains as a draft; operator can
        // attach evidence manually before moving it forward.
      }
    }

    generated += 1;
  }

  const completedSummary = {
    runType: "opportunity_draft",
    generatedCount: generated,
    skippedDuplicateCount: skippedDuplicates,
    candidateCount: synthesisResult.candidates.length,
    insertErrorCount: insertErrors.length,
    linkErrorCount,
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
        ? { error_code: "no-opportunities-persisted" }
        : { error_code: null, error_message: null }),
    })
    .eq("id", runId);

  await bumpEngagement(supabase, engagementRow.id);
  revalidatePaths(engagementRow.id);

  await logActivityEvent({
    eventType: generated > 0 ? "ai_opportunities_generated" : "ai_synthesis_failed",
    entityType: "ai_synthesis_run",
    entityId: runId,
    engagementId: engagementRow.id,
    title:
      generated > 0
        ? "AI draft opportunities generated"
        : "AI opportunity synthesis produced no opportunities",
    summary:
      generated > 0
        ? `${generated} draft opportunit${generated === 1 ? "y" : "ies"} added in draft.`
        : "Synthesis completed but no opportunities were persisted.",
    metadata: {
      runType: "opportunity_draft",
      generatedCount: generated,
      skippedDuplicateCount: skippedDuplicates,
      provider: synthesisResult.providerMeta.provider,
      model: synthesisResult.providerMeta.model,
    },
  });

  if (generated === 0) {
    return { ok: false, error: "ai-response-invalid" };
  }

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

function pickQuadrant(
  impact: number,
  complexity: number,
  risk: number,
): OpportunityQuadrant {
  // Mirror `createOpportunity`: high risk overrides quadrant placement
  // so a fake "quick win" cannot slip past the operator filter.
  if (risk >= 85) return "defer-avoid";
  return computeQuadrant(impact, complexity);
}

function priorityFromQuadrant(
  quadrant: OpportunityQuadrant,
): OpportunityPriority {
  switch (quadrant) {
    case "quick-win":
      return "quick-win";
    case "strategic-build":
      return "strategic-build";
    case "low-priority":
      return "low-priority";
    case "defer-avoid":
      return "defer";
    default:
      return "low-priority";
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
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
  revalidatePath(`/app/engagements/${engagementId}/opportunities`);
  revalidatePath(`/app/engagements/${engagementId}/roadmap`);
  revalidatePath(`/app/engagements/${engagementId}`);
}

// Re-export the candidate type so the action file is the single import
// path callers use.
export type { DraftOpportunityCandidate };
