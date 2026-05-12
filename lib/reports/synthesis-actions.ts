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
  // link rows, reviewer note, and every other column are preserved.
  // Status is demoted to `needs_review` per docs/17.
  const now = new Date().toISOString();
  const evidenceNotesField = composeEvidenceNotes(synthesisResult.candidate);
  const { error: updateError } = await supabase
    .from("report_sections")
    .update({
      title: synthesisResult.candidate.sectionTitle,
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
