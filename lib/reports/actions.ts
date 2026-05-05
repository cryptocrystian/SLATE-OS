"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivityEvent } from "@/lib/activity/log";
import {
  dbConfidenceFor,
  dbSectionStatusFor,
  dbSectionTypeFor,
  isUuid,
} from "./mappers";
import { SECTION_LABEL, SECTION_ORDER } from "./helpers";
import type {
  ReportConfidence,
  ReportSectionStatus,
  ReportSectionType,
} from "./types";

/**
 * Authenticated-operator server actions for reports.
 *
 * Every action runs against the cookie-bound server Supabase client so
 * RLS evaluates with the operator's auth.uid().
 */

export type ReportActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "invalid-engagement"
        | "invalid-section"
        | "engagement-not-found"
        | "report-not-found"
        | "section-not-found"
        | "service-error";
    };

export type InitializeReportResult =
  | { ok: true; reportId: string; created: boolean }
  | (Exclude<ReportActionResult, { ok: true }> & { ok: false });

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

export async function initializeReportForEngagement(
  engagementId: string,
): Promise<InitializeReportResult> {
  if (!isUuid(engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id, name, account_id")
    .eq("id", engagementId)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      name: string | null;
      account_id: string | null;
    }>();
  if (engagementError) {
    console.error("[reports.actions] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagement?.id) return { ok: false, error: "engagement-not-found" };

  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("engagement_id", engagementId)
    .maybeSingle<{ id: string }>();
  if (existing?.id) {
    return { ok: true, reportId: existing.id, created: false };
  }

  let companyName: string | null = null;
  if (engagement.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", engagement.account_id)
      .maybeSingle<{ name: string | null }>();
    companyName = account?.name?.trim() || null;
  }
  const display =
    companyName ?? engagement.name?.trim() ?? "Engagement";
  const title = `${display} · AI Opportunity Sprint Report`;
  const now = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("reports")
    .insert({
      workspace_id: engagement.workspace_id,
      engagement_id: engagement.id,
      title,
      status: "draft",
      generated_at: now,
      last_edited_at: now,
      recommended_next_step:
        "Approve foundation sections, then promote findings into the opportunity portfolio.",
      consultant_notes: [],
      export_status: "locked",
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !inserted?.id) {
    console.error("[reports.actions] report-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  const sectionRows = SECTION_ORDER.map((t, idx) => ({
    workspace_id: engagement.workspace_id,
    engagement_id: engagement.id,
    report_id: inserted.id,
    section_type: dbSectionTypeFor(t),
    title: SECTION_LABEL[t],
    status: "not_started",
    summary: null,
    draft_preview: null,
    evidence_notes: null,
    ai_drafted: false,
    confidence: "needs_evidence",
    position: idx,
  }));
  const { error: sectionsError } = await supabase
    .from("report_sections")
    .insert(sectionRows);
  if (sectionsError) {
    console.error("[reports.actions] sections-insert-failed", {
      name: sectionsError.name,
      code: sectionsError.code,
      message: sectionsError.message,
    });
    // Non-fatal — report exists; sections can be re-seeded.
  }

  await bumpEngagement(supabase, engagement.id);
  revalidatePaths(engagement.id);

  await logActivityEvent({
    eventType: "report_initialized",
    entityType: "report",
    entityId: inserted.id,
    engagementId: engagement.id,
    title: "Report outline initialized",
    summary: "Twelve canonical sections seeded as not-started.",
    metadata: { sectionsSeeded: sectionRows.length },
  });

  return { ok: true, reportId: inserted.id, created: true };
}

// ---------------------------------------------------------------------------
// Section status changes
// ---------------------------------------------------------------------------

async function setSectionStatus(
  sectionId: string,
  status: ReportSectionStatus,
): Promise<ReportActionResult> {
  if (!isUuid(sectionId)) {
    return { ok: false, error: "invalid-section" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("report_sections")
    .select("id, engagement_id, report_id")
    .eq("id", sectionId)
    .maybeSingle<{ id: string; engagement_id: string; report_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "section-not-found" };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("report_sections")
    .update({
      status: dbSectionStatusFor(status),
      reviewed_by: user.id,
      last_reviewed_at: now,
    })
    .eq("id", sectionId);
  if (updateError) {
    console.error("[reports.actions] section-status-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await supabase
    .from("reports")
    .update({ last_edited_at: now })
    .eq("id", existing.report_id);

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);

  await logActivityEvent({
    eventType: "report_section_status_changed",
    entityType: "report_section",
    entityId: existing.id,
    engagementId: existing.engagement_id,
    title: `Report section moved to ${status}`,
    summary: "An operator updated a report section's review state.",
    metadata: { sectionStatus: status },
  });

  return { ok: true };
}

export async function approveReportSection(
  sectionId: string,
): Promise<ReportActionResult> {
  return setSectionStatus(sectionId, "approved");
}

export async function markReportSectionNeedsReview(
  sectionId: string,
): Promise<ReportActionResult> {
  return setSectionStatus(sectionId, "needs-review");
}

export async function markReportSectionFinal(
  sectionId: string,
): Promise<ReportActionResult> {
  return setSectionStatus(sectionId, "final");
}

export async function markReportSectionDrafted(
  sectionId: string,
): Promise<ReportActionResult> {
  return setSectionStatus(sectionId, "drafted");
}

// ---------------------------------------------------------------------------
// Section content edits
// ---------------------------------------------------------------------------

export interface UpdateReportSectionDraftInput {
  sectionId: string;
  summary?: string;
  draftPreview?: string;
  evidenceNotes?: string;
  aiDrafted?: boolean;
  confidence?: ReportConfidence;
}

export async function updateReportSectionDraft(
  input: UpdateReportSectionDraftInput,
): Promise<ReportActionResult> {
  if (!isUuid(input.sectionId)) {
    return { ok: false, error: "invalid-section" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("report_sections")
    .select("id, engagement_id, report_id, status")
    .eq("id", input.sectionId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      report_id: string;
      status: string | null;
    }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "section-not-found" };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    reviewed_by: user.id,
    last_reviewed_at: now,
  };
  if (input.summary !== undefined) {
    update.summary = trimOrNull(input.summary);
  }
  if (input.draftPreview !== undefined) {
    update.draft_preview = trimOrNull(input.draftPreview);
  }
  if (input.evidenceNotes !== undefined) {
    update.evidence_notes = trimOrNull(input.evidenceNotes);
  }
  if (input.aiDrafted !== undefined) {
    update.ai_drafted = Boolean(input.aiDrafted);
  }
  if (input.confidence) {
    update.confidence = dbConfidenceFor(input.confidence);
  }
  // If the section had no draft content yet, promote it to drafted.
  if (existing.status === "not_started" && (input.summary || input.draftPreview)) {
    update.status = "drafted";
  }

  const { error: updateError } = await supabase
    .from("report_sections")
    .update(update)
    .eq("id", input.sectionId);
  if (updateError) {
    console.error("[reports.actions] section-edit-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await supabase
    .from("reports")
    .update({ last_edited_at: now })
    .eq("id", existing.report_id);

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

export async function updateReportSectionNote(
  sectionId: string,
  note: string,
): Promise<ReportActionResult> {
  if (!isUuid(sectionId)) {
    return { ok: false, error: "invalid-section" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("report_sections")
    .select("id, engagement_id, report_id")
    .eq("id", sectionId)
    .maybeSingle<{ id: string; engagement_id: string; report_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "section-not-found" };
  }

  const trimmed = note.trim();
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("report_sections")
    .update({
      reviewer_note: trimmed.length > 0 ? trimmed : null,
      reviewed_by: user.id,
      last_reviewed_at: now,
    })
    .eq("id", sectionId);
  if (updateError) {
    console.error("[reports.actions] section-note-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await supabase
    .from("reports")
    .update({ last_edited_at: now })
    .eq("id", existing.report_id);

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Link management
// ---------------------------------------------------------------------------

export type ReportLinkKind = "finding" | "opportunity" | "roadmap-item";

export async function linkReportSection(
  sectionId: string,
  kind: ReportLinkKind,
  refId: string,
): Promise<ReportActionResult> {
  if (!isUuid(sectionId) || !isUuid(refId)) {
    return { ok: false, error: "invalid-section" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("report_sections")
    .select("id, workspace_id, engagement_id, report_id")
    .eq("id", sectionId)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      engagement_id: string;
      report_id: string;
    }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "section-not-found" };
  }

  const tableByKind: Record<ReportLinkKind, string> = {
    finding: "report_section_finding_links",
    opportunity: "report_section_opportunity_links",
    "roadmap-item": "report_section_roadmap_links",
  };
  const refColByKind: Record<ReportLinkKind, string> = {
    finding: "finding_id",
    opportunity: "opportunity_id",
    "roadmap-item": "roadmap_item_id",
  };

  const insertRow: Record<string, unknown> = {
    workspace_id: existing.workspace_id,
    engagement_id: existing.engagement_id,
    report_section_id: existing.id,
  };
  insertRow[refColByKind[kind]] = refId;

  const { error: insertError } = await supabase
    .from(tableByKind[kind])
    .insert(insertRow);
  // Unique violation (23505) is benign — link already exists.
  if (insertError && insertError.code !== "23505") {
    console.error("[reports.actions] link-insert-failed", {
      kind,
      name: insertError.name,
      code: insertError.code,
      message: insertError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

export async function unlinkReportSection(
  sectionId: string,
  kind: ReportLinkKind,
  refId: string,
): Promise<ReportActionResult> {
  if (!isUuid(sectionId) || !isUuid(refId)) {
    return { ok: false, error: "invalid-section" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("report_sections")
    .select("id, engagement_id")
    .eq("id", sectionId)
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "section-not-found" };
  }

  const tableByKind: Record<ReportLinkKind, string> = {
    finding: "report_section_finding_links",
    opportunity: "report_section_opportunity_links",
    "roadmap-item": "report_section_roadmap_links",
  };
  const refColByKind: Record<ReportLinkKind, string> = {
    finding: "finding_id",
    opportunity: "opportunity_id",
    "roadmap-item": "roadmap_item_id",
  };

  const { error: deleteError } = await supabase
    .from(tableByKind[kind])
    .delete()
    .eq("report_section_id", existing.id)
    .eq(refColByKind[kind], refId);
  if (deleteError) {
    console.error("[reports.actions] link-delete-failed", {
      kind,
      name: deleteError.name,
      code: deleteError.code,
      message: deleteError.message,
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
  revalidatePath(`/app/engagements/${engagementId}/report`);
  revalidatePath(`/app/engagements/${engagementId}/proposal`);
  revalidatePath(`/app/engagements/${engagementId}`);
}

// Suppress unused-symbol lint when the section type union isn't directly
// referenced — exported for downstream callers that build forms.
export type { ReportSectionType };
