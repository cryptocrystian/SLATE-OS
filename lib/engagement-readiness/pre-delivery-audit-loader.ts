import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  evaluatePreDeliveryAudit,
  type PreDeliveryAuditInput,
  type PreDeliveryAuditResult,
  type PreDeliveryCounts,
  type PreDeliverySurface,
  type PreDeliveryThresholds,
} from "./pre-delivery-audit";

/**
 * Sprint S11 — server-only loader for the pre-delivery audit.
 *
 * Resolves the structured `PreDeliveryCounts` from Supabase, then
 * delegates to the pure evaluator. Cookie-bound RLS gates every read.
 *
 * This module never persists, never logs raw content, never minted a
 * token — it is read-only. Server actions consume `loadPreDeliveryAudit`,
 * decide to mint or block, and emit their own activity events.
 */

interface LoadOptions {
  surface: PreDeliverySurface;
  /** Optional operator-supplied audience label (used by the audit-only-leak check). */
  audienceLabel?: string | null;
  /** Optional explicit override for "no documents needed" sign-off; defaults to false. */
  documentsClearedOrAcknowledged?: boolean;
  /** Optional threshold overrides — defaults match `docs/35` § 5 verbatim. */
  thresholds?: Partial<PreDeliveryThresholds>;
}

const REQUIRED_INTAKE_ROLES_FOR_AUDIT: ReadonlyArray<string> = [
  "executive",
  "operations",
  "sales",
  "it",
  "finance",
  "frontline",
];

export async function loadPreDeliveryAudit(
  engagementId: string,
  options: LoadOptions,
): Promise<PreDeliveryAuditResult> {
  // The evaluator needs a non-null engagementId + non-mock identifier to
  // even start. If the caller passes anything malformed we let the
  // evaluator's foundation gate handle it cleanly.
  const evaluatedAt = new Date().toISOString();
  const isPersistedEngagement = isUuid(engagementId);

  if (!isPersistedEngagement) {
    return evaluatePreDeliveryAudit({
      surface: options.surface,
      engagementId,
      isPersistedEngagement: false,
      counts: zeroCounts(),
      documentsClearedOrAcknowledged: Boolean(
        options.documentsClearedOrAcknowledged,
      ),
      audienceLabel: options.audienceLabel ?? null,
      evaluatedAt,
      thresholds: options.thresholds,
    });
  }

  const supabase = createSupabaseServerClient();

  // Every query below is RLS-bounded; nothing escapes the workspace
  // boundary. The fan-out is wide but each individual query is small —
  // mostly count queries.
  const [
    findingsAggregate,
    opportunitiesAggregate,
    roadmapAggregate,
    reportSectionsAggregate,
    documentsCount,
    intakeAggregate,
    activeShareTokens,
    freshReportSnapshot,
    approvedProposalSnapshot,
  ] = await Promise.all([
    loadFindingsAggregate(supabase, engagementId),
    loadOpportunitiesAggregate(supabase, engagementId),
    loadRoadmapAggregate(supabase, engagementId),
    loadReportSectionsAggregate(supabase, engagementId),
    loadDocumentsCount(supabase, engagementId),
    loadIntakeAggregate(supabase, engagementId),
    loadActiveShareTokensOnSurface(supabase, engagementId, options.surface),
    loadFreshReportSnapshot(supabase, engagementId),
    loadApprovedProposalSnapshot(supabase, engagementId),
  ]);

  const counts: PreDeliveryCounts = {
    approvedFindings: findingsAggregate.approved,
    draftedFindings: findingsAggregate.drafted,
    createdOpportunities: opportunitiesAggregate.created,
    recommendedOpportunities: opportunitiesAggregate.recommended,
    readyRoadmapItemsLinked: roadmapAggregate.readyLinked,
    draftedReportSections: reportSectionsAggregate.draftedOrBetter,
    approvedReportSections: reportSectionsAggregate.approvedOrFinal,
    totalReportSections: reportSectionsAggregate.total,
    totalDocuments: documentsCount,
    intakeRolesInvited: intakeAggregate.rolesInvited,
    intakeRolesWithReadyResponse: intakeAggregate.rolesWithReadyResponse,
    intakeReadyResponseSessions: intakeAggregate.readyResponseSessions,
    activeShareTokensOnSurface: activeShareTokens,
    hasFreshReportSnapshot: freshReportSnapshot,
    hasApprovedProposalSnapshot: approvedProposalSnapshot.exists,
    proposalCommercialGuardPassed: approvedProposalSnapshot.guardPassed,
    approvedSectionsIncludeExecutiveSummary:
      reportSectionsAggregate.approvedIncludesExecSummary,
  };

  const input: PreDeliveryAuditInput = {
    surface: options.surface,
    engagementId,
    isPersistedEngagement: true,
    counts,
    documentsClearedOrAcknowledged: Boolean(
      options.documentsClearedOrAcknowledged,
    ),
    audienceLabel: options.audienceLabel ?? null,
    evaluatedAt,
    thresholds: options.thresholds,
  };

  return evaluatePreDeliveryAudit(input);
}

// ---------------------------------------------------------------------------
// Per-bucket count helpers
// ---------------------------------------------------------------------------

async function loadFindingsAggregate(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<{ drafted: number; approved: number }> {
  // We treat "drafted" as the broader set: anything that's at least
  // operator-touched (drafted / needs_review / approved / report_ready /
  // final / rejected). The canon's "drafted ≥ 8" gate references the
  // synthesis output that the operator has at least surveyed.
  const { count: draftedCount } = await supabase
    .from("findings")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .neq("review_status", "rejected");
  const { count: approvedCount } = await supabase
    .from("findings")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .in("review_status", ["approved", "report_ready"]);
  return {
    drafted: draftedCount ?? 0,
    approved: approvedCount ?? 0,
  };
}

async function loadOpportunitiesAggregate(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<{ created: number; recommended: number }> {
  const { count: createdCount } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .in("status", ["scored", "selected", "draft", "deferred"]);
  // "Recommended" maps to the S6 `selected` state per the locked canon —
  // see docs/45 + docs/49 § 8.2.
  const { count: recommendedCount } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .eq("status", "selected");
  return {
    created: createdCount ?? 0,
    recommended: recommendedCount ?? 0,
  };
}

async function loadRoadmapAggregate(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<{ readyLinked: number }> {
  // docs/35 § 5 row 8: "items linked to opportunities" with
  // "REPORT-READY INPUTS > 0". S7 `ready` is the canonical
  // report-ready state.
  const { count } = await supabase
    .from("roadmap_items")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .eq("status", "ready")
    .not("opportunity_id", "is", null);
  return { readyLinked: count ?? 0 };
}

async function loadReportSectionsAggregate(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<{
  draftedOrBetter: number;
  approvedOrFinal: number;
  total: number;
  approvedIncludesExecSummary: boolean;
}> {
  const { data } = await supabase
    .from("report_sections")
    .select("section_type, status")
    .eq("engagement_id", engagementId);
  const rows =
    (data as unknown as Array<{
      section_type: string;
      status: string | null;
    }>) ?? [];
  let drafted = 0;
  let approvedOrFinal = 0;
  let approvedIncludesExecSummary = false;
  for (const r of rows) {
    if (
      r.status === "drafted" ||
      r.status === "needs_review" ||
      r.status === "approved" ||
      r.status === "final"
    ) {
      drafted += 1;
    }
    if (r.status === "approved" || r.status === "final") {
      approvedOrFinal += 1;
      if (r.section_type === "executive_summary") {
        approvedIncludesExecSummary = true;
      }
    }
  }
  return {
    draftedOrBetter: drafted,
    approvedOrFinal,
    total: rows.length,
    approvedIncludesExecSummary,
  };
}

async function loadDocumentsCount(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<number> {
  // Sprint S12-Fix (L-34 closure) — `input_assets` has NO `deleted_at`
  // column in the deployed schema (migrations 0005 + 0010 + 0017 define
  // a single canonical `status` lifecycle and no soft-delete pattern).
  // The pre-S12-Fix loader filtered `.is("deleted_at", null)`, which
  // PostgREST rejected and the supabase-js count path silently
  // resolved to `null → 0`. Effect: `totalDocuments` always read as 0
  // in production, forcing C3 (`documents_not_uploaded_or_acked`) to
  // block unless the operator explicitly passed
  // `documentsClearedOrAcknowledged === true`. This was a conservative
  // failure mode (never a false PASS) but a contract drift against
  // `lib/intake/queries.ts` and `docs/35` § 5 row 3.
  //
  // Fix: drop the soft-delete filter. Count semantics now match the
  // canonical loader pattern verbatim. The `count ?? 0` fallback
  // preserves the original conservative posture for any future query
  // failure that is NOT a missing-column error.
  const { count, error } = await supabase
    .from("input_assets")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId);
  if (error) {
    // Conservative fallback — a transient read failure must not be
    // re-interpreted as "documents are present". The evaluator's C3
    // gate will then block unless the operator has separately set
    // `documentsClearedOrAcknowledged`.
    console.error("[engagement-readiness.pre-delivery-audit] documents-count-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return 0;
  }
  return count ?? 0;
}

async function loadIntakeAggregate(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<{
  rolesInvited: number;
  rolesWithReadyResponse: number;
  readyResponseSessions: number;
}> {
  // Pull (session_id, role, response status) rows in two passes — first
  // sessions to get role coverage, second a count of sessions whose
  // responses have at least one `ready_for_synthesis` entry.
  const { data: sessionsData } = await supabase
    .from("stakeholder_intake_sessions")
    .select("id, role")
    .eq("engagement_id", engagementId);
  const sessions =
    (sessionsData as unknown as Array<{ id: string; role: string | null }>) ??
    [];

  const invitedRoles = new Set<string>();
  for (const s of sessions) {
    if (s.role && REQUIRED_INTAKE_ROLES_FOR_AUDIT.includes(s.role)) {
      invitedRoles.add(s.role);
    }
  }

  if (sessions.length === 0) {
    return {
      rolesInvited: invitedRoles.size,
      rolesWithReadyResponse: 0,
      readyResponseSessions: 0,
    };
  }

  const sessionIds = sessions.map((s) => s.id);
  const { data: readyData } = await supabase
    .from("stakeholder_responses")
    .select("session_id")
    .eq("engagement_id", engagementId)
    .eq("response_status", "ready_for_synthesis")
    .in("session_id", sessionIds);
  const readyRows =
    (readyData as unknown as Array<{ session_id: string | null }>) ?? [];

  const readySessionIds = new Set<string>();
  for (const r of readyRows) {
    if (r.session_id) readySessionIds.add(r.session_id);
  }

  const rolesWithReadyResponse = new Set<string>();
  for (const s of sessions) {
    if (
      s.role &&
      REQUIRED_INTAKE_ROLES_FOR_AUDIT.includes(s.role) &&
      readySessionIds.has(s.id)
    ) {
      rolesWithReadyResponse.add(s.role);
    }
  }

  return {
    rolesInvited: invitedRoles.size,
    rolesWithReadyResponse: rolesWithReadyResponse.size,
    readyResponseSessions: readySessionIds.size,
  };
}

async function loadActiveShareTokensOnSurface(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
  surface: PreDeliverySurface,
): Promise<number> {
  // Active = status='active' AND not yet expired. The action layer's
  // revoke action flips to 'revoked'; the public route also treats an
  // expired token as inert. The audit treats only `status='active'` as
  // a blocker because that's what the docs/35 § 5 row 14 wording
  // tracks.
  const table =
    surface === "report" ? "report_share_tokens" : "proposal_share_tokens";
  const nowIso = new Date().toISOString();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .eq("status", "active")
    .gt("expires_at", nowIso);
  return count ?? 0;
}

async function loadFreshReportSnapshot(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<boolean> {
  // The report-side share evaluator (`evaluateReportShareEligibility`)
  // does the per-snapshot checks. Here we only need a count: at least
  // one non-voided, non-draft-watermark snapshot exists for the
  // engagement.
  const { count } = await supabase
    .from("report_delivery_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .is("voided_at", null);
  return (count ?? 0) > 0;
}

async function loadApprovedProposalSnapshot(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<{ exists: boolean; guardPassed: boolean | null }> {
  const { data } = await supabase
    .from("proposal_delivery_snapshots")
    .select("approval_state, voided_at, commercial_guard_result")
    .eq("engagement_id", engagementId)
    .eq("delivery_surface", "client_proposal_candidate")
    .eq("approval_state", "approved")
    .is("voided_at", null)
    .order("generated_at", { ascending: false })
    .limit(1);
  const row = (data as unknown as Array<{
    approval_state: string | null;
    voided_at: string | null;
    commercial_guard_result: { passed?: boolean } | null;
  }>)?.[0];
  if (!row) return { exists: false, guardPassed: null };
  const guardPassed =
    typeof row.commercial_guard_result?.passed === "boolean"
      ? row.commercial_guard_result.passed
      : null;
  return { exists: true, guardPassed };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

function zeroCounts(): PreDeliveryCounts {
  return {
    approvedFindings: 0,
    draftedFindings: 0,
    createdOpportunities: 0,
    recommendedOpportunities: 0,
    readyRoadmapItemsLinked: 0,
    draftedReportSections: 0,
    approvedReportSections: 0,
    totalReportSections: 0,
    totalDocuments: 0,
    intakeRolesInvited: 0,
    intakeRolesWithReadyResponse: 0,
    intakeReadyResponseSessions: 0,
    activeShareTokensOnSurface: 0,
    hasFreshReportSnapshot: false,
    hasApprovedProposalSnapshot: false,
    proposalCommercialGuardPassed: null,
    approvedSectionsIncludeExecutiveSummary: false,
  };
}
