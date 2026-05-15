"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { capabilityMaturityFromFindings } from "@/lib/charts/adapters/capability-maturity-heatmap-adapter";
import { executiveSummaryPortfolioFromOpportunities } from "@/lib/charts/adapters/executive-summary-2x2-adapter";
import { risksFromOpportunities } from "@/lib/charts/adapters/risk-adjusted-priority-quadrant-adapter";
import { roadmapGanttFromRoadmapItems } from "@/lib/charts/adapters/roadmap-gantt-adapter";
import { stakeholderCoverageFromIntake } from "@/lib/charts/adapters/stakeholder-coverage-matrix-adapter";
import {
  latestIsoTimestamp,
  type ChartAdapterResult,
  type ReportExhibitSlot,
} from "@/lib/charts/adapters/types";
import { getFindingsForEngagementPersisted } from "@/lib/findings/queries";
import { getIntakeRecordForEngagement } from "@/lib/intake/queries";
import { getOpportunitiesForEngagementPersisted } from "@/lib/opportunities/queries";
import { getRoadmapForEngagementPersisted } from "@/lib/roadmap/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getReportForEngagementPersisted,
} from "./queries";
import { isUuid } from "./mappers";
import {
  evaluateReportPdfCandidateReadiness,
  type ReportPdfCandidateReadinessResult,
} from "./report-pdf-readiness";
import { runReportPdfClaimGuard } from "./report-pdf-claim-guard";

/**
 * Phase 1B Sprint 4C-B — operator-only report PDF candidate snapshot
 * action.
 *
 * Pipeline:
 *   1. Validate UUIDs + operator session.
 *   2. Load report + adapter inputs (findings, opportunities, intake,
 *      roadmap) using the same query helpers as `/report/print`.
 *   3. Run the five Group-A adapters with a shared `generatedAt` clock.
 *   4. Evaluate R2 readiness.
 *   5. If blocked → log `report_pdf_candidate_failed`, return error.
 *   6. If requires_acceptance → log failure with the requires-acceptance
 *      details, return error (acceptance UX is backlog).
 *   7. Run the export-time claim-guard scan.
 *   8. If violations → log failure, return error.
 *   9. Insert `report_delivery_snapshots` row with status='candidate'
 *      and delivery_surface='client_pdf_candidate'.
 *  10. Log `report_pdf_candidate_generated` activity event.
 *  11. Revalidate the report page; return `{ ok: true, snapshotId }`.
 *
 * No PDF binary is generated, no file is stored, no public link is
 * created. The candidate route `/report/pdf-candidate/[snapshotId]`
 * renders the snapshot for operator browser Save-as-PDF.
 */

export type GenerateReportPdfCandidateError =
  | "unauthenticated"
  | "invalid-engagement"
  | "engagement-not-found"
  | "report-not-found"
  | "readiness-blocked"
  | "stale-acceptance-required"
  | "claim-guard-violation"
  | "service-error";

export interface GenerateReportPdfCandidateSuccess {
  ok: true;
  snapshotId: string;
  deliverySurface: "client_pdf_candidate";
  draftWatermark: boolean;
  includedSectionCount: number;
  includedExhibitCount: number;
  omittedExhibitCount: number;
}

export interface GenerateReportPdfCandidateFailure {
  ok: false;
  error: GenerateReportPdfCandidateError;
  blockers?: ReportPdfCandidateReadinessResult["issues"];
  staleSlots?: ReportExhibitSlot[];
  violations?: ReadonlyArray<{ field: string; code: string }>;
}

export type GenerateReportPdfCandidateResult =
  | GenerateReportPdfCandidateSuccess
  | GenerateReportPdfCandidateFailure;

export async function generateReportPdfCandidateAction(args: {
  engagementId: string;
  acceptedStaleSlots?: ReportExhibitSlot[];
}): Promise<GenerateReportPdfCandidateResult> {
  const { engagementId } = args;
  if (!isUuid(engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // Resolve engagement → workspace_id (also used as the RLS scope).
  const { data: engagementRow, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    console.error("[reports.pdf-candidate] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  const report = await getReportForEngagementPersisted(engagementRow.id);
  if (!report) {
    return { ok: false, error: "report-not-found" };
  }

  const generatedAt = new Date().toISOString();

  const [findings, opportunities, roadmap, intakeRecord] = await Promise.all([
    getFindingsForEngagementPersisted(engagementRow.id),
    getOpportunitiesForEngagementPersisted(engagementRow.id),
    getRoadmapForEngagementPersisted(engagementRow.id),
    getIntakeRecordForEngagement(engagementRow.id),
  ]);

  const opportunitiesLastTouched = latestIsoTimestamp(
    opportunities.map((o) => o.updatedAt),
  );
  const findingsLastTouched = latestIsoTimestamp(
    findings.flatMap((f) => [f.updatedAt, f.lastReviewedAt]),
  );
  const stakeholdersLastTouched = latestIsoTimestamp(
    (intakeRecord?.stakeholders ?? []).map((s) => s.lastActivityAt),
  );
  const roadmapLastTouched = latestIsoTimestamp(roadmap.map((r) => r.updatedAt));

  const adapterResults: Record<
    ReportExhibitSlot,
    ChartAdapterResult<unknown>
  > = {
    executive_summary_portfolio: executiveSummaryPortfolioFromOpportunities({
      opportunities,
      generatedAt,
      lastTouchedAt: opportunitiesLastTouched,
    }),
    findings_risk_priority: risksFromOpportunities({
      opportunities,
      generatedAt,
      lastTouchedAt: opportunitiesLastTouched,
    }),
    diagnostic_capability_maturity: capabilityMaturityFromFindings({
      findings,
      capabilities: [],
      dimensions: [],
      generatedAt,
      lastTouchedAt: findingsLastTouched,
    }),
    diagnostic_stakeholder_coverage: stakeholderCoverageFromIntake({
      stakeholders: intakeRecord?.stakeholders ?? [],
      roles: Array.from(
        new Set(
          (intakeRecord?.stakeholders ?? []).map(
            (s) => s.role as unknown as string,
          ),
        ),
      ),
      topics: [],
      generatedAt,
      lastTouchedAt: stakeholdersLastTouched,
    }),
    roadmap_90_day_sequence: roadmapGanttFromRoadmapItems({
      items: roadmap,
      generatedAt,
      lastTouchedAt: roadmapLastTouched,
    }),
  };

  const readiness = evaluateReportPdfCandidateReadiness({
    report,
    adapterResults,
    acceptedStaleSlots: args.acceptedStaleSlots,
  });

  if (readiness.status === "blocked") {
    await logActivityEvent({
      eventType: "report_pdf_candidate_failed",
      entityType: "report_delivery_snapshot",
      entityId: null,
      engagementId: engagementRow.id,
      title: "Report PDF candidate failed",
      summary:
        "Generation blocked by R2 readiness checks. No snapshot was created.",
      metadata: {
        failureReason: "r2_check_failed",
        blockerCount: readiness.issues.filter((i) => i.severity === "error")
          .length,
      },
    });
    return {
      ok: false,
      error: "readiness-blocked",
      blockers: readiness.issues,
    };
  }

  if (readiness.status === "requires_acceptance") {
    const staleSlots = readiness.issues
      .filter((i) => i.code === "stale_slot_requires_acceptance" && i.target)
      .map((i) => i.target as ReportExhibitSlot);
    await logActivityEvent({
      eventType: "report_pdf_candidate_failed",
      entityType: "report_delivery_snapshot",
      entityId: null,
      engagementId: engagementRow.id,
      title: "Report PDF candidate failed",
      summary:
        "Generation requires explicit operator acceptance of stale source data.",
      metadata: {
        failureReason: "stale_acceptance_required",
        staleSlotCount: staleSlots.length,
      },
    });
    return {
      ok: false,
      error: "stale-acceptance-required",
      staleSlots,
      blockers: readiness.issues,
    };
  }

  // Run the export-time claim-guard scan.
  const claimGuardResult = runReportPdfClaimGuard({
    report,
    sectionSnapshot: readiness.payload.sectionSnapshot,
    exhibitSnapshot: readiness.payload.exhibitSnapshot,
    omittedExhibits: readiness.omittedExhibits,
  });

  if (!claimGuardResult.passed) {
    await logActivityEvent({
      eventType: "report_pdf_candidate_failed",
      entityType: "report_delivery_snapshot",
      entityId: null,
      engagementId: engagementRow.id,
      title: "Report PDF candidate failed",
      summary:
        "Generation blocked by export-time claim-guard scan. No snapshot was created.",
      metadata: {
        failureReason: "claim_guard_violation",
        violationCount: claimGuardResult.violations.length,
      },
    });
    return {
      ok: false,
      error: "claim-guard-violation",
      violations: claimGuardResult.violations.map((v) => ({
        field: v.field,
        code: v.code,
      })),
    };
  }

  // Build the operator label — initials of display name when available;
  // otherwise the local-part of the email; otherwise null. No full name
  // by default per docs/20 § Open Decisions item 9.
  const operatorLabel = buildOperatorLabel(user);

  const { data: snapshotRow, error: insertError } = await supabase
    .from("report_delivery_snapshots")
    .insert({
      workspace_id: engagementRow.workspace_id,
      engagement_id: engagementRow.id,
      report_id: report.id,
      status: "candidate",
      delivery_surface: "client_pdf_candidate",
      report_status_at_generation: report.status,
      generated_by: user.id,
      generated_by_label: operatorLabel,
      generated_at: generatedAt,
      section_snapshot: readiness.payload.sectionSnapshot,
      exhibit_snapshot: readiness.payload.exhibitSnapshot,
      source_summary_snapshot: readiness.payload.sourceSummarySnapshot,
      claim_guard_result: claimGuardResult,
      omitted_exhibits: readiness.omittedExhibits,
      draft_watermark: readiness.draftWatermark,
      app_version: null,
      commit_sha: null,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !snapshotRow?.id) {
    console.error("[reports.pdf-candidate] snapshot-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  const includedExhibitCount = readiness.includedExhibitSlots.length;
  const omittedExhibitCount = readiness.omittedExhibits.length;

  await logActivityEvent({
    eventType: "report_pdf_candidate_generated",
    entityType: "report_delivery_snapshot",
    entityId: snapshotRow.id,
    engagementId: engagementRow.id,
    title: "Report PDF candidate generated",
    summary: readiness.draftWatermark
      ? "Operator-only candidate with Draft Candidate watermark. No client delivery."
      : "Operator-only candidate. No client delivery.",
    metadata: {
      deliverySurface: "client_pdf_candidate",
      draftWatermark: readiness.draftWatermark,
      includedSectionCount: readiness.includedSectionIds.length,
      includedExhibitCount,
      omittedExhibitCount,
      freshSlots: readiness.payload.sourceSummarySnapshot.digest.freshSlots,
      staleSlots: readiness.payload.sourceSummarySnapshot.digest.staleSlots,
      unknownSlots:
        readiness.payload.sourceSummarySnapshot.digest.unknownSlots,
    },
  });

  // Engagement timeline + report page should reflect the new snapshot.
  revalidatePath(`/app/engagements/${engagementRow.id}/report`);
  revalidatePath(`/app/engagements/${engagementRow.id}`);

  return {
    ok: true,
    snapshotId: snapshotRow.id,
    deliverySurface: "client_pdf_candidate",
    draftWatermark: readiness.draftWatermark,
    includedSectionCount: readiness.includedSectionIds.length,
    includedExhibitCount,
    omittedExhibitCount,
  };
}

export type VoidReportDeliverySnapshotError =
  | "unauthenticated"
  | "invalid-snapshot"
  | "snapshot-not-found"
  | "already-voided"
  | "service-error";

export type VoidReportDeliverySnapshotResult =
  | { ok: true; snapshotId: string }
  | { ok: false; error: VoidReportDeliverySnapshotError };

export async function voidReportDeliverySnapshotAction(args: {
  snapshotId: string;
  reason: string;
}): Promise<VoidReportDeliverySnapshotResult> {
  const { snapshotId, reason } = args;
  if (!isUuid(snapshotId)) {
    return { ok: false, error: "invalid-snapshot" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: row, error: fetchError } = await supabase
    .from("report_delivery_snapshots")
    .select("id, engagement_id, status")
    .eq("id", snapshotId)
    .maybeSingle<{ id: string; engagement_id: string; status: string }>();
  if (fetchError) {
    console.error("[reports.pdf-candidate] void-fetch-failed", {
      name: fetchError.name,
      code: fetchError.code,
      message: fetchError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!row?.id) return { ok: false, error: "snapshot-not-found" };
  if (row.status === "voided") {
    return { ok: false, error: "already-voided" };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("report_delivery_snapshots")
    .update({
      status: "voided",
      voided_at: now,
      voided_by: user.id,
      void_reason: reason.slice(0, 280),
    })
    .eq("id", snapshotId);
  if (updateError) {
    console.error("[reports.pdf-candidate] void-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "report_delivery_snapshot_voided",
    entityType: "report_delivery_snapshot",
    entityId: snapshotId,
    engagementId: row.engagement_id,
    title: "Report delivery snapshot voided",
    summary: "Operator marked an earlier candidate snapshot stale.",
    metadata: { reason: reason.slice(0, 120) },
  });

  // Sprint 4D-C — void cascade. Any active share token backed by this
  // snapshot is now structurally rejected by the public route's
  // eligibility re-check, but we also flip the row state to `revoked`
  // so the operator UI does not display a stale "Active" badge. Each
  // cascaded revoke emits its own `report_share_token_revoked`
  // activity event so the audit trail is preserved.
  await cascadeRevokeActiveShareTokens({
    supabase,
    snapshotId,
    engagementId: row.engagement_id,
    actorUserId: user.id,
  });

  revalidatePath(`/app/engagements/${row.engagement_id}/report`);

  return { ok: true, snapshotId };
}

async function cascadeRevokeActiveShareTokens(args: {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  snapshotId: string;
  engagementId: string;
  actorUserId: string;
}): Promise<void> {
  const { supabase, snapshotId, engagementId, actorUserId } = args;
  const { data: activeTokens, error: readError } = await supabase
    .from("report_share_tokens")
    .select("id")
    .eq("snapshot_id", snapshotId)
    .eq("status", "active");
  if (readError) {
    console.error("[reports.pdf-candidate] void-cascade-read-failed", {
      name: readError.name,
      code: readError.code,
      message: readError.message,
    });
    return;
  }
  const ids = (activeTokens ?? []).map((row) => row.id as string);
  if (ids.length === 0) return;

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("report_share_tokens")
    .update({
      status: "revoked",
      revoked_at: now,
      revoked_by: actorUserId,
      revoke_reason: "snapshot_voided",
    })
    .in("id", ids);
  if (updateError) {
    console.error("[reports.pdf-candidate] void-cascade-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return;
  }

  await Promise.all(
    ids.map((tokenId) =>
      logActivityEvent({
        eventType: "report_share_token_revoked",
        entityType: "report_share_token",
        entityId: tokenId,
        engagementId,
        title: "Report share token revoked",
        summary:
          "Share token revoked automatically because the backing snapshot was voided.",
        metadata: {
          snapshotId,
          reason: "snapshot_voided",
        },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildOperatorLabel(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const metaName =
    typeof user.user_metadata?.display_name === "string"
      ? (user.user_metadata.display_name as string)
      : typeof user.user_metadata?.name === "string"
        ? (user.user_metadata.name as string)
        : null;
  if (metaName && metaName.trim().length > 0) {
    return deriveInitials(metaName.trim());
  }
  if (typeof user.email === "string" && user.email.length > 0) {
    const local = user.email.split("@")[0];
    if (local && local.length > 0) {
      return deriveInitials(local).slice(0, 4);
    }
  }
  return null;
}

function deriveInitials(displayName: string): string {
  const parts = displayName
    .split(/[\s._-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return displayName.slice(0, 2).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
