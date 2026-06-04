import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  evaluateIntakeReadiness,
  type IntakeLane,
  type IntakeReadinessOutput,
  type IntakeRoleCoverage,
} from "@/lib/engagement-readiness/intake-readiness";
import { getCrmContextForEngagement } from "@/lib/crm/queries";
import type {
  CrmContextSourceStatus,
} from "@/lib/crm/types";
import { tsRoleFor } from "@/lib/intake/mappers";
import { isUuid } from "@/lib/findings/mappers";
import type { StakeholderRole } from "@/lib/intake/types";

/**
 * Sprint S4 — Evidence aggregation for AI findings synthesis.
 *
 * Canon: `docs/39` § 4 (canonical input hierarchy) + `docs/43`.
 *
 * Pulls together every input lane the synthesis pipeline is canon-
 * authorized to consume:
 *
 *   - PRIMARY:   live-link stakeholder responses (`source_type='live_link'`,
 *                `response_status='ready_for_synthesis'`).
 *   - SECONDARY: transcript / meeting-notes responses (`source_type IN
 *                ('transcript', 'meeting_notes')`, `response_status=
 *                'ready_for_synthesis'`).
 *   - SECONDARY: CRM context (engagement-level only; per `docs/42` § 5
 *                and `docs/39` § 4.5 CRM is never per-stakeholder
 *                evidence).
 *   - TERTIARY:  offline operator-entered responses (`source_type IN
 *                ('operator_entered', 'email_paste', 'document_upload')`,
 *                `response_status='ready_for_synthesis'`).
 *
 * Excludes by construction:
 *   - `response_status IN ('draft', 'superseded', 'voided')`. Drafts
 *     never reach synthesis.
 *   - Test-labeled walkthrough rows (operator_notes prefix "I3 LIVE
 *     WALKTHROUGH TEST", answer prefix "S2 AUDIT FIXTURE -", etc.).
 *     These are filtered server-side so synthesis can't accidentally
 *     consume audit-only data.
 *
 * Provides:
 *   - Per-lane buckets the prompt builder can attribute by category.
 *   - Role coverage shape the readiness helper consumes.
 *   - CRM context summary (engagement-level enrichment).
 *   - Warnings — operator-readable advisories that don't block synthesis.
 *
 * NEVER includes:
 *   - Raw `stakeholder_email`, `entered_by`, `created_by` user ids in
 *     the bundle's evidence items.
 *   - The full `answer_text` is preserved (it IS what the AI reads) but
 *     this module also exposes the `excerpt` truncated for activity
 *     metadata and logs. Activity logging callers must use `excerpt`.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EvidenceLane =
  /** docs/39 § 4.1 — primary. */
  | "live_link"
  /** docs/39 § 4.2 — secondary. Multiple source types share this lane. */
  | "transcript"
  /** docs/39 § 4.4 — tertiary. */
  | "offline_operator";

export interface EvidenceItem {
  /** stakeholder_responses.id */
  responseId: string;
  /** stakeholder_intake_sessions.id */
  sessionId: string;
  /** Lane bucket for synthesis weighting and prompt attribution. */
  lane: EvidenceLane;
  /** Verbatim source_type from the response row. */
  sourceType:
    | "live_link"
    | "transcript"
    | "meeting_notes"
    | "operator_entered"
    | "email_paste"
    | "document_upload";
  /** Canonical role of the stakeholder this response came from. */
  role: StakeholderRole;
  /** Display name (NOT email). */
  stakeholderName: string | null;
  /** Title — operator-facing context for the synthesis prompt. */
  stakeholderTitle: string | null;
  /** Canonical question id (one of seed-questions or operator-typed). */
  questionId: string;
  /** Human-readable question label when present. */
  questionLabel: string | null;
  /** Full answer text — fed to AI prompt verbatim, capped at 5000 chars. */
  answerText: string;
  /** Truncated excerpt (≤ 240 chars) for logging + activity metadata. */
  excerpt: string;
  /** ISO 8601 — when the response was created. */
  createdAt: string;
}

export interface EvidenceBundleSourceCounts {
  liveLink: number;
  transcript: number;
  meetingNotes: number;
  operatorEntered: number;
  emailPaste: number;
  documentUpload: number;
  /** Excluded by lane filter (drafts, superseded, voided). */
  excludedByStatus: number;
  /** Filtered out by audit-label heuristics. */
  excludedByTestLabel: number;
}

export interface EvidenceBundleQuestionCoverage {
  questionId: string;
  /** Distinct lanes that contributed for this question. */
  lanes: EvidenceLane[];
  /** Total response count across lanes. */
  responseCount: number;
}

export interface EvidenceBundleWarning {
  code:
    | "no-primary-evidence"
    | "tertiary-only"
    | "missing-required-role"
    | "missing-canonical-question"
    | "thin-coverage"
    | "crm-not-linked"
    | "crm-fetch-failed";
  message: string;
}

export interface EvidenceBundle {
  engagementId: string;
  /** Total `ready_for_synthesis` items across every lane after exclusions. */
  totalReadyEvidence: number;
  /** Per-source counts (split + excluded). */
  sourceCounts: EvidenceBundleSourceCounts;
  /** Per-lane buckets — primary key for prompt attribution. */
  byLane: Record<EvidenceLane, EvidenceItem[]>;
  /** Role coverage shape compatible with `evaluateIntakeReadiness`. */
  roleCoverage: IntakeRoleCoverage[];
  /** Per-question coverage matrix. */
  questionCoverage: EvidenceBundleQuestionCoverage[];
  /** CRM enrichment status + minimal summary. Never per-stakeholder. */
  crm: EvidenceCrmSummary;
  /** Operator-readable warnings (don't block synthesis on their own). */
  warnings: EvidenceBundleWarning[];
  /** Readiness verdict from the S1 helper. */
  readiness: IntakeReadinessOutput;
  /** ISO 8601 — when the bundle was assembled. */
  builtAt: string;
}

export interface EvidenceCrmSummary {
  status: CrmContextSourceStatus["status"];
  /** Brief context — operator-facing one-liner for the prompt header.
   *  NEVER per-stakeholder. */
  brand: string | null;
  leadSource: string | null;
  pipelineStageHint: string | null;
  /** Provider name (e.g. "attio") when linked. */
  provider: string | null;
}

export interface BuildEvidenceBundleOptions {
  /** Hard cap for fetched evidence rows. Default 200. */
  maxEvidenceItems?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_EVIDENCE = 200;
const ANSWER_TEXT_CAP = 5_000;
const EXCERPT_LIMIT = 240;

/** Prefixes used by the I2/I3 walkthrough and the S1/S2 audit fixture.
 *  Filtering these out keeps audit-only data from leaking into a real
 *  synthesis run on the SLATE Pilot Test Client fixture. The Sapient
 *  Digital Sprint I3 test row was clearly labelled with these prefixes;
 *  this filter is conservative and operator-readable. */
const TEST_LABEL_NEEDLES = [
  "I3 WALKTHROUGH TEST",
  "I3 LIVE WALKTHROUGH TEST",
  "S1 AUDIT",
  "S2 AUDIT FIXTURE",
];

const CANONICAL_QUESTION_IDS = [
  "repetitive_workflows",
  "handoff_pain",
  "core_systems",
  "trust_friction",
  "automation_wishlist",
  "risks_and_constraints",
  "success_for_role",
];

const REQUIRED_ROLES: StakeholderRole[] = [
  "executive",
  "operations",
  "sales",
  "it",
  "finance",
  "frontline",
];

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Assemble the evidence bundle for an engagement.
 *
 * Server-only. Reads via the cookie-bound Supabase server client; RLS
 * is the boundary, not application code. CRM context is fetched via
 * `getCrmContextForEngagement` which has its own workspace-scoped read
 * gating.
 *
 * Returns `null` only when the engagement id is malformed; for missing
 * engagements (RLS filter) the caller should distinguish via its own
 * lookup. The bundle itself is always well-formed even when zero
 * evidence is present.
 */
export async function buildEvidenceBundleForEngagement(
  engagementId: string,
  options: BuildEvidenceBundleOptions = {},
): Promise<EvidenceBundle | null> {
  if (!isUuid(engagementId)) return null;
  const maxItems = options.maxEvidenceItems ?? DEFAULT_MAX_EVIDENCE;

  const supabase = createSupabaseServerClient();

  // 1. Fetch the engagement's stakeholder sessions (needed for role
  //    attribution + name/title). Excluded sessions don't enter the
  //    bundle.
  const { data: sessionRows, error: sessionsError } = await supabase
    .from("stakeholder_intake_sessions")
    .select(
      "id, role, stakeholder_name, stakeholder_title, source_type",
    )
    .eq("engagement_id", engagementId);
  if (sessionsError) {
    console.error("[findings.evidence] sessions-fetch-failed", {
      name: sessionsError.name,
      code: sessionsError.code,
      message: sessionsError.message,
    });
    return null;
  }
  const sessions = (sessionRows ?? []) as Array<{
    id: string;
    role: string | null;
    stakeholder_name: string | null;
    stakeholder_title: string | null;
    source_type: string | null;
  }>;
  const sessionMap = new Map<
    string,
    {
      role: StakeholderRole;
      stakeholderName: string | null;
      stakeholderTitle: string | null;
      sourceType: string | null;
    }
  >();
  for (const s of sessions) {
    sessionMap.set(s.id, {
      role: tsRoleFor(s.role),
      stakeholderName: s.stakeholder_name?.trim() || null,
      stakeholderTitle: s.stakeholder_title?.trim() || null,
      sourceType: s.source_type,
    });
  }

  // 2. Fetch ready_for_synthesis responses. Strict status filter so
  //    drafts / superseded / voided never reach the bundle.
  let responseRows: Array<{
    id: string;
    session_id: string;
    source_type: string;
    response_status: string;
    question_id: string;
    question_label: string | null;
    answer_text: string | null;
    operator_notes: string | null;
    created_at: string;
  }> = [];
  if (sessions.length > 0) {
    const { data: respRows, error: respError } = await supabase
      .from("stakeholder_responses")
      .select(
        "id, session_id, source_type, response_status, question_id, question_label, answer_text, operator_notes, created_at",
      )
      .eq("engagement_id", engagementId)
      .eq("response_status", "ready_for_synthesis")
      .order("created_at", { ascending: true })
      .limit(maxItems);
    if (respError) {
      console.error("[findings.evidence] responses-fetch-failed", {
        name: respError.name,
        code: respError.code,
        message: respError.message,
      });
      return null;
    }
    responseRows = (respRows ?? []) as typeof responseRows;
  }

  // 3. Bucket + sanitize + exclude test-label artifacts.
  const sourceCounts: EvidenceBundleSourceCounts = {
    liveLink: 0,
    transcript: 0,
    meetingNotes: 0,
    operatorEntered: 0,
    emailPaste: 0,
    documentUpload: 0,
    excludedByStatus: 0,
    excludedByTestLabel: 0,
  };
  const byLane: Record<EvidenceLane, EvidenceItem[]> = {
    live_link: [],
    transcript: [],
    offline_operator: [],
  };
  const questionMap = new Map<string, EvidenceBundleQuestionCoverage>();

  for (const row of responseRows) {
    const session = sessionMap.get(row.session_id);
    if (!session) continue;
    const sourceType = row.source_type as EvidenceItem["sourceType"];
    const answerText = (row.answer_text ?? "").trim();
    if (answerText.length === 0) continue;

    // Heuristic exclude — drop rows clearly tagged as walkthrough /
    // audit fixture by either the answer prefix or operator-notes
    // prefix. Operator can override by re-saving without the prefix.
    const combined = `${answerText} ${row.operator_notes ?? ""}`.toUpperCase();
    if (TEST_LABEL_NEEDLES.some((needle) => combined.includes(needle))) {
      sourceCounts.excludedByTestLabel += 1;
      continue;
    }

    const lane = laneForSourceType(sourceType);
    if (!lane) continue;

    const cappedAnswer = answerText.slice(0, ANSWER_TEXT_CAP);
    const excerpt = truncate(cappedAnswer, EXCERPT_LIMIT);

    const item: EvidenceItem = {
      responseId: row.id,
      sessionId: row.session_id,
      lane,
      sourceType,
      role: session.role,
      stakeholderName: session.stakeholderName,
      stakeholderTitle: session.stakeholderTitle,
      questionId: row.question_id,
      questionLabel: row.question_label?.trim() || null,
      answerText: cappedAnswer,
      excerpt,
      createdAt: row.created_at,
    };
    byLane[lane].push(item);
    incrementSourceCount(sourceCounts, sourceType);

    const qc = questionMap.get(row.question_id) ?? {
      questionId: row.question_id,
      lanes: [],
      responseCount: 0,
    };
    if (!qc.lanes.includes(lane)) qc.lanes.push(lane);
    qc.responseCount += 1;
    questionMap.set(row.question_id, qc);
  }

  const totalReady =
    byLane.live_link.length +
    byLane.transcript.length +
    byLane.offline_operator.length;

  // 4. Role coverage — feed the S1 readiness helper.
  const roleCoverage = buildRoleCoverage(byLane);

  // 5. CRM enrichment summary. CRM is engagement-level context only;
  //    we never derive stakeholder claims from it.
  const crmStatus = await getCrmContextForEngagement(engagementId);
  const crm = summarizeCrm(crmStatus);

  // 6. Warnings (advisory; do not block synthesis on their own).
  const warnings: EvidenceBundleWarning[] = [];
  if (byLane.live_link.length === 0 && byLane.transcript.length === 0) {
    warnings.push({
      code: "no-primary-evidence",
      message:
        "No primary or secondary lane evidence. Synthesis will rely entirely on operator-entered offline notes, which is tertiary signal per docs/39 § 4.",
    });
  } else if (byLane.live_link.length === 0) {
    warnings.push({
      code: "tertiary-only",
      message:
        "No live-link primary evidence. Synthesis will weight transcripts (secondary) at moderate confidence per docs/39 § 4.5.",
    });
  }
  const coveredRoles = new Set(
    roleCoverage
      .filter((r) => r.sessionsWithReadyResponses > 0)
      .map((r) => r.role),
  );
  for (const role of REQUIRED_ROLES) {
    if (!coveredRoles.has(role)) {
      warnings.push({
        code: "missing-required-role",
        message: `Required role coverage missing: ${role}.`,
      });
    }
  }
  for (const qid of CANONICAL_QUESTION_IDS) {
    if (!questionMap.has(qid)) {
      warnings.push({
        code: "missing-canonical-question",
        message: `Canonical intake question not yet answered: ${qid}.`,
      });
    }
  }
  if (crm.status === "not-linked") {
    warnings.push({
      code: "crm-not-linked",
      message:
        "Account is not linked to Attio. Engagement-level CRM context will not enrich the synthesis prompt.",
    });
  } else if (crm.status === "fetch-failed") {
    warnings.push({
      code: "crm-fetch-failed",
      message:
        "Attio context fetch failed. Synthesis proceeds without CRM enrichment.",
    });
  }
  if (totalReady > 0 && totalReady < 6) {
    warnings.push({
      code: "thin-coverage",
      message: `Only ${totalReady} ready-for-synthesis responses available. Findings will be assumption-heavy.`,
    });
  }

  // 7. Readiness verdict via the S1 pure helper.
  const readiness = evaluateIntakeReadiness({
    roleCoverage,
    totalReadyResponses: totalReady,
    totalDocuments: 0, // S4 does not load documents into the bundle.
    documentsClearedOrAcknowledged: true, // operator must clear in S11; S4 doesn't gate on docs.
  });

  return {
    engagementId,
    totalReadyEvidence: totalReady,
    sourceCounts,
    byLane,
    roleCoverage,
    questionCoverage: Array.from(questionMap.values()).sort((a, b) =>
      a.questionId.localeCompare(b.questionId),
    ),
    crm,
    warnings,
    readiness,
    builtAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function laneForSourceType(
  sourceType: string,
): EvidenceLane | null {
  switch (sourceType) {
    case "live_link":
      return "live_link";
    case "transcript":
    case "meeting_notes":
      return "transcript";
    case "operator_entered":
    case "email_paste":
    case "document_upload":
      return "offline_operator";
    default:
      return null;
  }
}

function incrementSourceCount(
  counts: EvidenceBundleSourceCounts,
  sourceType: EvidenceItem["sourceType"],
): void {
  switch (sourceType) {
    case "live_link":
      counts.liveLink += 1;
      break;
    case "transcript":
      counts.transcript += 1;
      break;
    case "meeting_notes":
      counts.meetingNotes += 1;
      break;
    case "operator_entered":
      counts.operatorEntered += 1;
      break;
    case "email_paste":
      counts.emailPaste += 1;
      break;
    case "document_upload":
      counts.documentUpload += 1;
      break;
  }
}

function buildRoleCoverage(
  byLane: Record<EvidenceLane, EvidenceItem[]>,
): IntakeRoleCoverage[] {
  // Bucket by role across lanes. The S1 helper expects per-role rows
  // with `contributingLanes` so it can advisory-warn on lane
  // composition.
  const map = new Map<
    StakeholderRole,
    {
      sessionsInvited: Set<string>;
      sessionsWithReady: Set<string>;
      lanes: Set<IntakeLane>;
    }
  >();
  function ensure(role: StakeholderRole) {
    let entry = map.get(role);
    if (!entry) {
      entry = {
        sessionsInvited: new Set(),
        sessionsWithReady: new Set(),
        lanes: new Set<IntakeLane>(),
      };
      map.set(role, entry);
    }
    return entry;
  }
  for (const lane of ["live_link", "transcript", "offline_operator"] as const) {
    const helperLane: IntakeLane =
      lane === "live_link"
        ? "live_link"
        : lane === "transcript"
          ? "transcript"
          : "offline_operator";
    for (const item of byLane[lane]) {
      const entry = ensure(item.role);
      entry.sessionsInvited.add(item.sessionId);
      entry.sessionsWithReady.add(item.sessionId);
      entry.lanes.add(helperLane);
    }
  }
  return Array.from(map.entries()).map(([role, entry]) => ({
    role,
    sessionsInvited: entry.sessionsInvited.size,
    sessionsWithReadyResponses: entry.sessionsWithReady.size,
    contributingLanes: Array.from(entry.lanes),
  }));
}

function summarizeCrm(
  status: CrmContextSourceStatus | null,
): EvidenceCrmSummary {
  if (!status) {
    return {
      status: "not-configured",
      brand: null,
      leadSource: null,
      pipelineStageHint: null,
      provider: null,
    };
  }
  if (status.status === "linked") {
    return {
      status: "linked",
      brand: status.context.account.brand,
      leadSource: status.context.account.leadSource,
      pipelineStageHint:
        status.context.deals[0]?.pipelineStage ?? null,
      provider: status.context.provider,
    };
  }
  return {
    status: status.status,
    brand: null,
    leadSource: null,
    pipelineStageHint: null,
    provider: status.status === "not-configured" ? null : status.provider,
  };
}

function truncate(s: string, max: number): string {
  const trimmed = s.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
