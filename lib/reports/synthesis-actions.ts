"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { isAiConfigured } from "@/lib/ai/provider";
import { buildReportSectionSynthesisContext } from "@/lib/ai/report-section-context";
import {
  synthesizeReportSectionDraft,
  type ReportSectionDraftCandidate,
} from "@/lib/ai/report-section-synthesis";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { isUuid } from "./mappers";

/**
 * Section types whose client-facing heading is canonical and must not be
 * overwritten by the model's `sectionTitle`. Keyed by DB `section_type`.
 * The consolidation (SECTION_ORDER in ./helpers.ts) broadened
 * `workflow_friction` to cover current-state + friction, so its heading
 * is pinned rather than left to the model (which kept re-titling it
 * "Workflow Friction Analysis").
 */
const LOCKED_SECTION_TITLES: Record<string, string> = {
  workflow_friction: "Current State & Operating Friction",
};

/**
 * Operator-only AI synthesis entry point for **one report section at a
 * time** — AI Synthesis Step 3, per `docs/17` § Report Wiring Sequence.
 *
 * Flow mirrors Step 1 (findings) and Step 2 (opportunities):
 *
 *   1. Validate UUIDs; require an authenticated operator session.
 *   2. Build a structured synthesis context (server-only, RLS-bounded):
 *      engagement + account + target section (with its persisted
 *      `exhibit_slot`) + sibling sections + approved findings +
 *      scored/selected opportunities + roadmap items + intake aggregates.
 *      No file binaries, no stakeholder PII, no Saipien Fit Score.
 *   3. Reject when the section is already `final` — the safe default
 *      per `docs/17` § Acceptance Criteria. The operator must demote
 *      the section before regenerating.
 *   4. Open an `ai_synthesis_runs` row (`run_type=report_section_draft`,
 *      `status=started`) with safe input counts only.
 *   5. Call the LLM provider, validate the JSON response against the
 *      Group-A allowlist + the banned-claim scanner (no benchmark / ROI
 *      / savings / payback / break-even / "guaranteed" language).
 *   6. Persist the draft via a **partial-field update** so the
 *      section's `exhibit_slot`, link rows, reviewer note, and every
 *      other field outside the draft scope are preserved verbatim.
 *      Status is demoted to `needs_review` — never `approved` /
 *      `final`. The pipeline never approves its own output.
 *   7. Update the run row to `completed` / `failed`, emit an activity
 *      event, revalidate the report route.
 *
 * No prompt body, raw response, file name, signed URL, stakeholder
 * excerpt, or storage path is ever returned to the caller or stored on
 * the run row.
 */

export type GenerateReportSectionError =
  | "unauthenticated"
  | "invalid-engagement"
  | "invalid-section"
  | "engagement-not-found"
  | "report-not-found"
  | "section-not-found"
  | "section-is-final"
  | "ai-not-configured"
  | "ai-provider-failed"
  | "ai-response-invalid"
  | "ai-claim-violation"
  | "ai-rate-limited"
  | "ai-timeout"
  | "service-error";

export type GenerateReportSectionResult =
  | {
      ok: true;
      sectionId: string;
      provider: string;
      model: string;
      /** Sprint S8 — source link counts persisted into the three
       *  `report_section_*_links` tables. Returned for the operator
       *  notice UI; never includes raw UUIDs. */
      sourceFindingCount: number;
      sourceOpportunityCount: number;
      sourceRoadmapItemCount: number;
    }
  | { ok: false; error: GenerateReportSectionError };

const EVIDENCE_NOTES_HEADER_ASSUMPTIONS = "Assumptions & limits:";

export async function generateReportSectionDraftAction(args: {
  engagementId: string;
  sectionId: string;
}): Promise<GenerateReportSectionResult> {
  const { engagementId, sectionId } = args;
  if (!isUuid(engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  if (!isUuid(sectionId)) {
    return { ok: false, error: "invalid-section" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  if (!isAiConfigured()) {
    return { ok: false, error: "ai-not-configured" };
  }

  // Engagement existence + workspace_id lookup. The query helpers
  // already enforce RLS via the authenticated server client; this is a
  // lightweight existence check.
  const { data: engagementRow, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    console.error("[reports.synthesis] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  // Build context. The builder enforces the Group-A boundary, the
  // approved-findings filter, and the no-PII rule.
  const contextResult = await buildReportSectionSynthesisContext({
    engagementId,
    sectionId,
  });
  if (!contextResult.ok) {
    switch (contextResult.error) {
      case "engagement-not-found":
        return { ok: false, error: "engagement-not-found" };
      case "report-not-found":
        return { ok: false, error: "report-not-found" };
      case "section-not-found":
        return { ok: false, error: "section-not-found" };
      case "section-is-final":
        return { ok: false, error: "section-is-final" };
      case "unauthenticated":
        return { ok: false, error: "unauthenticated" };
      default:
        return { ok: false, error: "service-error" };
    }
  }
  const context = contextResult.context;

  // Open synthesis run.
  const inputSummary = {
    sectionId: context.section.sectionId,
    sectionType: context.section.sectionType,
    exhibitSlot: context.section.exhibitSlot,
    findings: context.findings.length,
    opportunities: context.opportunities.length,
    roadmap: context.roadmap.length,
    intake: context.intake.length,
  };

  const { data: runRow, error: runInsertError } = await supabase
    .from("ai_synthesis_runs")
    .insert({
      workspace_id: engagementRow.workspace_id,
      engagement_id: engagementRow.id,
      run_type: "report_section_draft",
      status: "started",
      input_summary: inputSummary,
      created_by_profile_id: user.id,
      created_by_user_id: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (runInsertError || !runRow?.id) {
    console.error("[reports.synthesis] run-insert-failed", {
      name: runInsertError?.name,
      code: runInsertError?.code,
      message: runInsertError?.message,
    });
    return { ok: false, error: "service-error" };
  }
  const runId = runRow.id;

  // Call the provider.
  const synthesisResult = await synthesizeReportSectionDraft(context);
  if (!synthesisResult.ok) {
    await markRunFailed(runId, synthesisResult.error, synthesisResult.message);
    await logActivityEvent({
      eventType: "ai_synthesis_failed",
      entityType: "ai_synthesis_run",
      entityId: runId,
      engagementId: engagementRow.id,
      title: "AI report section synthesis failed",
      summary: "The report-section synthesis run did not complete.",
      metadata: {
        runType: "report_section_draft",
        sectionId,
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

  // Persist the draft via a partial-field update so `exhibit_slot`,
  // reviewer note, and every other column are preserved. Status is
  // demoted to `needs_review` per docs/17.
  const now = new Date().toISOString();
  const evidenceNotesField = composeEvidenceNotes(synthesisResult.candidate);
  const { error: updateError } = await supabase
    .from("report_sections")
    .update({
      title:
        LOCKED_SECTION_TITLES[context.section.sectionType] ??
        synthesisResult.candidate.sectionTitle,
      summary: synthesisResult.candidate.summary,
      draft_preview: synthesisResult.candidate.draftPreview,
      evidence_notes: evidenceNotesField,
      ai_drafted: true,
      status: "needs_review",
      reviewed_by: user.id,
      last_reviewed_at: now,
    })
    .eq("id", sectionId);
  if (updateError) {
    console.error("[reports.synthesis] section-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    await markRunFailed(runId, "service-error", updateError.code);
    return { ok: false, error: "service-error" };
  }

  // Sprint S8 — persist structural source provenance. The validator
  // already coerced the model's grounded ID arrays against the upstream
  // allowlist; here we write the link rows. Unique-violation (23505)
  // is benign — the section was already linked to that artifact.
  const linkCounts = await persistGroundedLinks(supabase, {
    workspaceId: engagementRow.workspace_id,
    engagementId: engagementRow.id,
    sectionId,
    findingIds: synthesisResult.candidate.groundedFindingIds,
    opportunityIds: synthesisResult.candidate.groundedOpportunityIds,
    roadmapItemIds: synthesisResult.candidate.groundedRoadmapItemIds,
  });

  // Bump report + engagement timestamps.
  await supabase
    .from("reports")
    .update({ last_edited_at: now })
    .eq("engagement_id", engagementRow.id);
  await supabase
    .from("engagements")
    .update({ last_activity_at: now })
    .eq("id", engagementRow.id);

  const completedSummary = {
    runType: "report_section_draft",
    sectionId,
    sectionType: context.section.sectionType,
    exhibitSlot: context.section.exhibitSlot,
    evidenceNotesCount: synthesisResult.candidate.evidenceNotes.length,
    assumptionsCount: synthesisResult.candidate.assumptionsAndLimits.length,
    // Sprint S8 — source counts (no UUIDs)
    sourceFindingCount: linkCounts.findings,
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
    eventType: "ai_report_section_drafted",
    entityType: "report_section",
    entityId: sectionId,
    engagementId: engagementRow.id,
    title: "AI report section drafted",
    summary:
      "The AI synthesis pipeline produced a draft. Section is in needs-review for operator approval.",
    metadata: {
      runType: "report_section_draft",
      sectionType: context.section.sectionType,
      exhibitSlot: context.section.exhibitSlot,
      // Sprint S8 — sanitized source-count metadata (no UUIDs, no raw text).
      sourceFindingCount: linkCounts.findings,
      sourceOpportunityCount: linkCounts.opportunities,
      sourceRoadmapItemCount: linkCounts.roadmapItems,
      provider: synthesisResult.providerMeta.provider,
      model: synthesisResult.providerMeta.model,
    },
  });

  revalidatePaths(engagementRow.id);

  return {
    ok: true,
    sectionId,
    provider: synthesisResult.providerMeta.provider,
    model: synthesisResult.providerMeta.model,
    sourceFindingCount: linkCounts.findings,
    sourceOpportunityCount: linkCounts.opportunities,
    sourceRoadmapItemCount: linkCounts.roadmapItems,
  };
}

// ---------------------------------------------------------------------------
// Sprint S8 — bulk drafting orchestrator
// ---------------------------------------------------------------------------

export type GenerateAllReportSectionsError =
  | "unauthenticated"
  | "invalid-engagement"
  | "engagement-not-found"
  | "report-not-found"
  | "ai-not-configured"
  | "service-error";

export interface GenerateAllReportSectionsResult {
  ok: true;
  total: number;
  attempted: number;
  succeeded: number;
  failed: number;
  /** Count of sections skipped because they were already operator-blessed
   *  (status `approved` or `final`). Both are explicit operator outputs;
   *  the bulk button only drafts sections that haven't been blessed. */
  skippedBlessed: number;
  /**
   * Per-attempt outcomes — sanitized. Each entry carries only the
   * section type and `ok|error_code`; never the section body or
   * provider response.
   */
  results: Array<{
    sectionType: string;
    ok: boolean;
    errorCode?: string;
  }>;
}

export type GenerateAllReportSectionsFailure = {
  ok: false;
  error: GenerateAllReportSectionsError;
};

/**
 * Sprint S8 — bulk drafter.
 *
 * Iterates every non-final report section sequentially, calling the
 * per-section `generateReportSectionDraftAction` for each. Sequential
 * (not parallel) because:
 *
 *   - The OpenAI rate-limit budget is the same whether we fan out or
 *     not; sequential drafting is the conservative posture and matches
 *     the per-section UI affordance.
 *   - Each section's `ai_synthesis_runs` row is the atomic unit of
 *     audit; we want each run independently visible.
 *   - The activity timeline reads more naturally when section events
 *     appear in canonical order.
 *
 * Sections in `final` or `approved` status are skipped — both are
 * operator-blessed states. To re-draft a blessed section, the operator
 * uses the per-section "Generate AI draft" button on
 * `ReportSectionActionBar`, which is an explicit per-section intent.
 * The bulk button is for "remaining" sections, never for replacing
 * what the operator has already approved.
 *
 * Returns a counts summary even when individual sections fail. The
 * orchestrator never aborts the loop on a single-section failure: it
 * records the failure and continues so the operator gets as much
 * coverage as the upstream evidence allows.
 */
export async function generateAllReportSectionDraftsAction(args: {
  engagementId: string;
}): Promise<
  GenerateAllReportSectionsResult | GenerateAllReportSectionsFailure
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
    console.error("[reports.synthesis.bulk] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  const { data: reportRow, error: reportError } = await supabase
    .from("reports")
    .select("id")
    .eq("engagement_id", engagementRow.id)
    .maybeSingle<{ id: string }>();
  if (reportError) {
    console.error("[reports.synthesis.bulk] report-lookup-failed", {
      name: reportError.name,
      code: reportError.code,
      message: reportError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!reportRow?.id) {
    return { ok: false, error: "report-not-found" };
  }

  const { data: sectionsData, error: sectionsError } = await supabase
    .from("report_sections")
    .select("id, section_type, status, position, created_at")
    .eq("report_id", reportRow.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (sectionsError) {
    console.error("[reports.synthesis.bulk] sections-lookup-failed", {
      name: sectionsError.name,
      code: sectionsError.code,
      message: sectionsError.message,
    });
    return { ok: false, error: "service-error" };
  }
  const sectionRows =
    (sectionsData as unknown as Array<{
      id: string;
      section_type: string;
      status: string | null;
    }>) ?? [];

  const total = sectionRows.length;
  // Sprint S8 — exclude both `final` (locked) and `approved` (operator
  // blessed) sections from bulk drafting. Both states are explicit
  // operator outputs; the bulk button is for "remaining" sections only.
  const draftable = sectionRows.filter(
    (s) => s.status !== "final" && s.status !== "approved",
  );
  const skippedBlessed = total - draftable.length;

  let succeeded = 0;
  let failed = 0;
  const results: GenerateAllReportSectionsResult["results"] = [];

  for (const section of draftable) {
    const r = await generateReportSectionDraftAction({
      engagementId,
      sectionId: section.id,
    });
    if (r.ok) {
      succeeded += 1;
      results.push({ sectionType: section.section_type, ok: true });
    } else {
      failed += 1;
      results.push({
        sectionType: section.section_type,
        ok: false,
        errorCode: r.error,
      });
    }
  }

  // Sanitized bulk-summary activity event. Never includes section body,
  // provider response, or upstream UUIDs — only section types + counts.
  const sectionTypes = Array.from(
    new Set(results.filter((r) => r.ok).map((r) => r.sectionType)),
  ).sort();
  const errorCodeCounts = results
    .filter((r) => !r.ok && r.errorCode)
    .reduce<Record<string, number>>((acc, r) => {
      const code = r.errorCode!;
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {});

  await logActivityEvent({
    eventType: "ai_report_sections_drafted",
    entityType: "report",
    entityId: reportRow.id,
    engagementId: engagementRow.id,
    title:
      failed === 0
        ? "AI bulk report drafting completed"
        : "AI bulk report drafting completed with partial failures",
    summary:
      `Sections attempted: ${draftable.length}. Succeeded: ${succeeded}. Failed: ${failed}. ` +
      `Skipped (operator-blessed): ${skippedBlessed}.`,
    metadata: {
      runType: "report_sections_bulk_draft",
      total,
      attempted: draftable.length,
      succeeded,
      failed,
      skippedBlessed,
      sectionTypes,
      errorCodeCounts,
    },
  });

  revalidatePaths(engagementRow.id);

  return {
    ok: true,
    total,
    attempted: draftable.length,
    succeeded,
    failed,
    skippedBlessed,
    results,
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

/**
 * Sprint S8 — write the three flavors of report-section provenance link
 * rows for the IDs the model grounded its draft in. Unique-violation
 * (23505) is benign — the section already had that link. The total
 * count returned is the link rows actually inserted *or already
 * present* — i.e. the section's current source coverage in the link
 * tables for each kind. We re-query after insert to capture both the
 * newly inserted rows and any pre-existing links from a prior
 * operator action.
 */
async function persistGroundedLinks(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  args: {
    workspaceId: string;
    engagementId: string;
    sectionId: string;
    findingIds: string[];
    opportunityIds: string[];
    roadmapItemIds: string[];
  },
): Promise<{ findings: number; opportunities: number; roadmapItems: number }> {
  await insertLinkRows(supabase, "report_section_finding_links", "finding_id", {
    workspaceId: args.workspaceId,
    engagementId: args.engagementId,
    sectionId: args.sectionId,
    refIds: args.findingIds,
  });
  await insertLinkRows(
    supabase,
    "report_section_opportunity_links",
    "opportunity_id",
    {
      workspaceId: args.workspaceId,
      engagementId: args.engagementId,
      sectionId: args.sectionId,
      refIds: args.opportunityIds,
    },
  );
  await insertLinkRows(
    supabase,
    "report_section_roadmap_links",
    "roadmap_item_id",
    {
      workspaceId: args.workspaceId,
      engagementId: args.engagementId,
      sectionId: args.sectionId,
      refIds: args.roadmapItemIds,
    },
  );

  // Re-count current link coverage so the activity metadata reflects
  // the section's total source provenance (newly-inserted + pre-existing
  // operator-added links).
  const [findingsCount, opportunitiesCount, roadmapItemsCount] =
    await Promise.all([
      countLinks(supabase, "report_section_finding_links", args.sectionId),
      countLinks(supabase, "report_section_opportunity_links", args.sectionId),
      countLinks(supabase, "report_section_roadmap_links", args.sectionId),
    ]);
  return {
    findings: findingsCount,
    opportunities: opportunitiesCount,
    roadmapItems: roadmapItemsCount,
  };
}

async function insertLinkRows(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  table:
    | "report_section_finding_links"
    | "report_section_opportunity_links"
    | "report_section_roadmap_links",
  refColumn: "finding_id" | "opportunity_id" | "roadmap_item_id",
  args: {
    workspaceId: string;
    engagementId: string;
    sectionId: string;
    refIds: string[];
  },
) {
  if (args.refIds.length === 0) return;
  for (const refId of args.refIds) {
    const insertRow: Record<string, unknown> = {
      workspace_id: args.workspaceId,
      engagement_id: args.engagementId,
      report_section_id: args.sectionId,
    };
    insertRow[refColumn] = refId;
    const { error } = await supabase.from(table).insert(insertRow);
    // 23505 = unique_violation — link already exists, benign.
    if (error && error.code !== "23505") {
      console.error("[reports.synthesis] link-insert-failed", {
        table,
        refColumn,
        name: error.name,
        code: error.code,
        message: error.message,
      });
    }
  }
}

async function countLinks(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  table:
    | "report_section_finding_links"
    | "report_section_opportunity_links"
    | "report_section_roadmap_links",
  sectionId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("report_section_id", sectionId);
  if (error) {
    console.error("[reports.synthesis] link-count-failed", {
      table,
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return 0;
  }
  return count ?? 0;
}

function composeEvidenceNotes(
  candidate: ReportSectionDraftCandidate,
): string | null {
  const evidenceBlock = candidate.evidenceNotes
    .map((n) => `• ${n}`)
    .join("\n");
  const assumptionsBlock =
    candidate.assumptionsAndLimits.length > 0
      ? `\n\n${EVIDENCE_NOTES_HEADER_ASSUMPTIONS}\n` +
        candidate.assumptionsAndLimits.map((n) => `• ${n}`).join("\n")
      : "";
  const combined = `${evidenceBlock}${assumptionsBlock}`.trim();
  return combined.length > 0 ? combined : null;
}

function revalidatePaths(engagementId: string) {
  revalidatePath(`/app/engagements/${engagementId}/report`);
  revalidatePath(`/app/engagements/${engagementId}`);
}
