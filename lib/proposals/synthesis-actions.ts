"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { isAiConfigured } from "@/lib/ai/provider";
import { buildProposalOptionSynthesisContext } from "@/lib/ai/proposal-option-context";
import {
  synthesizeProposalOptionDraft,
  type ProposalOptionDraftCandidate,
} from "@/lib/ai/proposal-option-synthesis";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { isUuid } from "./mappers";

/**
 * Operator-only AI synthesis entry point for **one proposal option at a
 * time** — AI Synthesis Step 4.
 *
 * Mirrors AI Synthesis Step 3 (report sections):
 *
 *   1. Validate UUIDs; require an authenticated operator session.
 *   2. Build a structured synthesis context (server-only, RLS-bounded).
 *   3. Open an `ai_synthesis_runs` row (`run_type=proposal_option_draft`,
 *      `status=started`) with safe input counts only.
 *   4. Call the LLM provider, validate the JSON response against the
 *      bounded allowlist + the combined financial / commercial-finality
 *      banned-claim scanner.
 *   5. Persist the draft via a **partial-field update** that NEVER
 *      touches `pricing_placeholder`, `recommended`, `option_type`,
 *      `position`, `proposal_id`, `engagement_id`, `workspace_id`, or
 *      the link rows. Existing approve / mark-recommended / link /
 *      unlink actions on the proposal continue to work unchanged.
 *   6. Update the run row to `completed` / `failed`, emit an
 *      `ai_proposal_option_drafted` activity event, revalidate the
 *      proposal route.
 *
 * No prompt body, raw response, file name, signed URL, stakeholder
 * excerpt, or storage path is ever returned to the caller or stored on
 * the run row.
 */

export type GenerateProposalOptionError =
  | "unauthenticated"
  | "invalid-engagement"
  | "invalid-option"
  | "engagement-not-found"
  | "proposal-not-found"
  | "option-not-found"
  | "ai-not-configured"
  | "ai-provider-failed"
  | "ai-response-invalid"
  | "ai-claim-violation"
  | "ai-rate-limited"
  | "ai-timeout"
  | "service-error";

export type GenerateProposalOptionResult =
  | {
      ok: true;
      optionId: string;
      provider: string;
      model: string;
    }
  | { ok: false; error: GenerateProposalOptionError };

export async function generateProposalOptionDraftAction(args: {
  engagementId: string;
  optionId: string;
}): Promise<GenerateProposalOptionResult> {
  const { engagementId, optionId } = args;
  if (!isUuid(engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  if (!isUuid(optionId)) {
    return { ok: false, error: "invalid-option" };
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
    console.error("[proposals.synthesis] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  const contextResult = await buildProposalOptionSynthesisContext({
    engagementId,
    optionId,
  });
  if (!contextResult.ok) {
    switch (contextResult.error) {
      case "engagement-not-found":
        return { ok: false, error: "engagement-not-found" };
      case "proposal-not-found":
        return { ok: false, error: "proposal-not-found" };
      case "option-not-found":
        return { ok: false, error: "option-not-found" };
      case "unauthenticated":
        return { ok: false, error: "unauthenticated" };
      default:
        return { ok: false, error: "service-error" };
    }
  }
  const context = contextResult.context;

  // Open synthesis run with safe counts only.
  const inputSummary = {
    optionId: context.option.optionId,
    optionType: context.option.optionType,
    proposalStatus: context.proposal.status,
    findings: context.findings.length,
    opportunities: context.opportunities.length,
    roadmap: context.roadmap.length,
    reportSections: context.reportSections.length,
    siblingOptions: context.siblingOptions.length,
  };

  const { data: runRow, error: runInsertError } = await supabase
    .from("ai_synthesis_runs")
    .insert({
      workspace_id: engagementRow.workspace_id,
      engagement_id: engagementRow.id,
      run_type: "proposal_option_draft",
      status: "started",
      input_summary: inputSummary,
      created_by_profile_id: user.id,
      created_by_user_id: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (runInsertError || !runRow?.id) {
    console.error("[proposals.synthesis] run-insert-failed", {
      name: runInsertError?.name,
      code: runInsertError?.code,
      message: runInsertError?.message,
    });
    return { ok: false, error: "service-error" };
  }
  const runId = runRow.id;

  // Call the provider.
  const synthesisResult = await synthesizeProposalOptionDraft(context);
  if (!synthesisResult.ok) {
    await markRunFailed(runId, synthesisResult.error, synthesisResult.message);
    await logActivityEvent({
      eventType: "ai_synthesis_failed",
      entityType: "ai_synthesis_run",
      entityId: runId,
      engagementId: engagementRow.id,
      title: "AI proposal option synthesis failed",
      summary: "The proposal-option synthesis run did not complete.",
      metadata: {
        runType: "proposal_option_draft",
        optionId,
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

  // Persist via a partial-field update. We explicitly DO NOT include:
  //   pricing_placeholder
  //   recommended
  //   option_type
  //   position
  //   proposal_id / engagement_id / workspace_id
  // …so operator-set commercial levers and structural fields are
  // preserved verbatim. Link rows live in their own tables and are
  // also untouched.
  const now = new Date().toISOString();
  const candidate = synthesisResult.candidate;
  const { error: updateError } = await supabase
    .from("proposal_options")
    .update({
      title: candidate.optionTitle,
      best_fit_scenario: candidate.bestFitScenario,
      scope_summary: candidate.scopeNarrative,
      timeline: candidate.timeline,
      deliverables: candidate.deliverables,
      assumptions: candidate.assumptions,
      dependencies: candidate.dependencies,
      risks: candidate.risks,
    })
    .eq("id", optionId);
  if (updateError) {
    console.error("[proposals.synthesis] option-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    await markRunFailed(runId, "service-error", updateError.code);
    return { ok: false, error: "service-error" };
  }

  // Bump proposal `last_reviewed_at` is intentionally NOT set —
  // an AI draft is not a review event. Only operator review actions
  // (Approve / Needs review / Reopen) touch `reviewed_by` /
  // `last_reviewed_at`. We do touch the engagement's
  // `last_activity_at` so the engagement timeline reflects the run.
  await supabase
    .from("engagements")
    .update({ last_activity_at: now })
    .eq("id", engagementRow.id);

  const completedSummary = {
    runType: "proposal_option_draft",
    optionId,
    optionType: context.option.optionType,
    deliverablesCount: candidate.deliverables.length,
    assumptionsCount: candidate.assumptions.length,
    dependenciesCount: candidate.dependencies.length,
    risksCount: candidate.risks.length,
    provider: synthesisResult.providerMeta.provider,
    model: synthesisResult.providerMeta.model,
  };

  await supabase
    .from("ai_synthesis_runs")
    .update({
      status: "completed",
      provider: synthesisResult.providerMeta.provider,
      model: synthesisResult.providerMeta.model,
      output_summary: completedSummary,
      completed_at: now,
      error_code: null,
      error_message: null,
    })
    .eq("id", runId);

  await logActivityEvent({
    eventType: "ai_proposal_option_drafted",
    entityType: "proposal_option",
    entityId: optionId,
    engagementId: engagementRow.id,
    title: "AI proposal option drafted",
    summary:
      "The AI synthesis pipeline produced an option draft. Pricing, recommendation, and option type were preserved; the operator must review before any client-facing action.",
    metadata: {
      runType: "proposal_option_draft",
      optionType: context.option.optionType,
      provider: synthesisResult.providerMeta.provider,
      model: synthesisResult.providerMeta.model,
    },
  });

  revalidatePaths(engagementRow.id);

  return {
    ok: true,
    optionId,
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

function revalidatePaths(engagementId: string) {
  revalidatePath(`/app/engagements/${engagementId}/proposal`);
  revalidatePath(`/app/engagements/${engagementId}`);
}

export type { ProposalOptionDraftCandidate };
