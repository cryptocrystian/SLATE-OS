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
      /** Sprint S9 — current link-row coverage after grounded
       *  persistence (includes newly inserted + pre-existing operator
       *  links). Counts only. */
      sourceOpportunityCount: number;
      sourceRoadmapItemCount: number;
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
  // preserved verbatim.
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

  // Sprint S9 — persist structural source provenance. The validator
  // already coerced the model's grounded ID arrays against the upstream
  // allowlist; here we write the link rows. Unique-violation (23505)
  // is benign — the option was already linked to that artifact.
  const linkCounts = await persistGroundedLinks(supabase, {
    workspaceId: engagementRow.workspace_id,
    engagementId: engagementRow.id,
    optionId,
    opportunityIds: candidate.groundedOpportunityIds,
    roadmapItemIds: candidate.groundedRoadmapItemIds,
  });

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
    // Sprint S9 — source counts (no UUIDs)
    sourceReportSectionCount: context.reportSections.length,
    sourceFindingCount: context.findings.length,
    sourceOpportunityCount: linkCounts.opportunities,
    sourceRoadmapItemCount: linkCounts.roadmapItems,
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
      // Sprint S9 — sanitized source-count metadata (no UUIDs, no raw text).
      sourceReportSectionCount: context.reportSections.length,
      sourceFindingCount: context.findings.length,
      sourceOpportunityCount: linkCounts.opportunities,
      sourceRoadmapItemCount: linkCounts.roadmapItems,
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
    sourceOpportunityCount: linkCounts.opportunities,
    sourceRoadmapItemCount: linkCounts.roadmapItems,
  };
}

// ---------------------------------------------------------------------------
// Sprint S9 — bulk drafting orchestrator
// ---------------------------------------------------------------------------

export type GenerateAllProposalOptionsError =
  | "unauthenticated"
  | "invalid-engagement"
  | "engagement-not-found"
  | "proposal-not-found"
  | "ai-not-configured"
  | "service-error";

export interface GenerateAllProposalOptionsResult {
  ok: true;
  total: number;
  attempted: number;
  succeeded: number;
  failed: number;
  /**
   * Per-attempt outcomes — sanitized. Each entry carries only the
   * option type and `ok|error_code`; never the option body or
   * provider response.
   */
  results: Array<{
    optionType: string;
    ok: boolean;
    errorCode?: string;
  }>;
}

export type GenerateAllProposalOptionsFailure = {
  ok: false;
  error: GenerateAllProposalOptionsError;
};

/**
 * Sprint S9 — bulk drafter for proposal options.
 *
 * Iterates every option on the engagement's proposal sequentially,
 * calling the per-option `generateProposalOptionDraftAction` for each.
 * Sequential (not parallel) for the same reasons as S8's bulk drafter:
 *
 *   - OpenAI rate-limit budget consumed identically.
 *   - Each `ai_synthesis_runs` row stays atomic and independently audit-visible.
 *   - Activity timeline reads naturally in canonical order.
 *
 * Unlike the S8 bulk drafter, this one does NOT skip any options
 * regardless of their current content state. Proposal options have no
 * "approved/final" lifecycle equivalent — operator review happens at the
 * proposal level via `approveProposal`, not per option. The operator's
 * intent in clicking "Draft all proposal options" is to refresh all
 * three canonical SOW shapes from the upstream evidence.
 *
 * Returns a counts summary even when individual options fail. The
 * orchestrator never aborts the loop on a single-option failure: it
 * records the failure and continues.
 */
export async function generateAllProposalOptionDraftsAction(args: {
  engagementId: string;
}): Promise<
  GenerateAllProposalOptionsResult | GenerateAllProposalOptionsFailure
> {
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
    console.error("[proposals.synthesis.bulk] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  const { data: proposalRow, error: proposalError } = await supabase
    .from("proposals")
    .select("id")
    .eq("engagement_id", engagementRow.id)
    .maybeSingle<{ id: string }>();
  if (proposalError) {
    console.error("[proposals.synthesis.bulk] proposal-lookup-failed", {
      name: proposalError.name,
      code: proposalError.code,
      message: proposalError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!proposalRow?.id) {
    return { ok: false, error: "proposal-not-found" };
  }

  const { data: optionsData, error: optionsError } = await supabase
    .from("proposal_options")
    .select("id, option_type, position, created_at")
    .eq("proposal_id", proposalRow.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (optionsError) {
    console.error("[proposals.synthesis.bulk] options-lookup-failed", {
      name: optionsError.name,
      code: optionsError.code,
      message: optionsError.message,
    });
    return { ok: false, error: "service-error" };
  }
  const optionRows =
    (optionsData as unknown as Array<{
      id: string;
      option_type: string;
    }>) ?? [];

  const total = optionRows.length;
  let succeeded = 0;
  let failed = 0;
  const results: GenerateAllProposalOptionsResult["results"] = [];

  for (const option of optionRows) {
    const r = await generateProposalOptionDraftAction({
      engagementId,
      optionId: option.id,
    });
    if (r.ok) {
      succeeded += 1;
      results.push({ optionType: option.option_type, ok: true });
    } else {
      failed += 1;
      results.push({
        optionType: option.option_type,
        ok: false,
        errorCode: r.error,
      });
    }
  }

  // Sanitized bulk-summary activity event. Never includes option body,
  // provider response, or upstream UUIDs — only option types + counts.
  const optionTypes = Array.from(
    new Set(results.filter((r) => r.ok).map((r) => r.optionType)),
  ).sort();
  const errorCodeCounts = results
    .filter((r) => !r.ok && r.errorCode)
    .reduce<Record<string, number>>((acc, r) => {
      const code = r.errorCode!;
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {});

  await logActivityEvent({
    eventType: "ai_proposal_options_drafted",
    entityType: "proposal",
    entityId: proposalRow.id,
    engagementId: engagementRow.id,
    title:
      failed === 0
        ? "AI bulk proposal drafting completed"
        : "AI bulk proposal drafting completed with partial failures",
    summary:
      `Options attempted: ${total}. Succeeded: ${succeeded}. Failed: ${failed}.`,
    metadata: {
      runType: "proposal_options_bulk_draft",
      total,
      attempted: total,
      succeeded,
      failed,
      optionTypes,
      errorCodeCounts,
    },
  });

  revalidatePaths(engagementRow.id);

  return {
    ok: true,
    total,
    attempted: total,
    succeeded,
    failed,
    results,
  };
}

// ---------------------------------------------------------------------------
// Sprint S9 — link-row persistence helper
// ---------------------------------------------------------------------------

/**
 * Sprint S9 — write the two flavors of proposal-option provenance link
 * rows for the IDs the model grounded its draft in. Unique-violation
 * (23505) is benign — the option already had that link. The total
 * count returned is the link rows currently present for each kind —
 * we re-query after insert to capture both newly inserted rows and any
 * pre-existing operator-added links.
 */
async function persistGroundedLinks(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  args: {
    workspaceId: string;
    engagementId: string;
    optionId: string;
    opportunityIds: string[];
    roadmapItemIds: string[];
  },
): Promise<{ opportunities: number; roadmapItems: number }> {
  await insertOptionLinkRows(
    supabase,
    "proposal_option_opportunity_links",
    "opportunity_id",
    {
      workspaceId: args.workspaceId,
      engagementId: args.engagementId,
      optionId: args.optionId,
      refIds: args.opportunityIds,
    },
  );
  await insertOptionLinkRows(
    supabase,
    "proposal_option_roadmap_links",
    "roadmap_item_id",
    {
      workspaceId: args.workspaceId,
      engagementId: args.engagementId,
      optionId: args.optionId,
      refIds: args.roadmapItemIds,
    },
  );

  const [opportunitiesCount, roadmapItemsCount] = await Promise.all([
    countOptionLinks(
      supabase,
      "proposal_option_opportunity_links",
      args.optionId,
    ),
    countOptionLinks(supabase, "proposal_option_roadmap_links", args.optionId),
  ]);
  return {
    opportunities: opportunitiesCount,
    roadmapItems: roadmapItemsCount,
  };
}

async function insertOptionLinkRows(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  table:
    | "proposal_option_opportunity_links"
    | "proposal_option_roadmap_links",
  refColumn: "opportunity_id" | "roadmap_item_id",
  args: {
    workspaceId: string;
    engagementId: string;
    optionId: string;
    refIds: string[];
  },
) {
  if (args.refIds.length === 0) return;
  for (const refId of args.refIds) {
    const insertRow: Record<string, unknown> = {
      workspace_id: args.workspaceId,
      engagement_id: args.engagementId,
      proposal_option_id: args.optionId,
    };
    insertRow[refColumn] = refId;
    const { error } = await supabase.from(table).insert(insertRow);
    // 23505 = unique_violation — link already exists, benign.
    if (error && error.code !== "23505") {
      console.error("[proposals.synthesis] link-insert-failed", {
        table,
        refColumn,
        name: error.name,
        code: error.code,
        message: error.message,
      });
    }
  }
}

async function countOptionLinks(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  table:
    | "proposal_option_opportunity_links"
    | "proposal_option_roadmap_links",
  optionId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("proposal_option_id", optionId);
  if (error) {
    console.error("[proposals.synthesis] link-count-failed", {
      table,
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return 0;
  }
  return count ?? 0;
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
