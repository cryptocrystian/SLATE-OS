import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isUuid,
  mapEngagementIntakeDocumentRow,
  tsRoleFor,
  type DbEngagementIntakeDocumentRow,
} from "./mappers";
import type {
  EngagementIntakeDocument,
  IntakeResponseStatus,
  IntakeSourceConfidence,
  IntakeSourceType,
  StakeholderRole,
} from "./types";

/**
 * Sprint I3 — Server-only query layer for offline intake (Mode B + C).
 *
 * The existing `lib/intake/queries.ts` reads the columns common to
 * live + offline intake and projects them into the legacy `Stakeholder`
 * shape; that shape predates Sprint I2 and intentionally omits
 * offline-specific fields (source_type, response_status, operator notes).
 *
 * This module is the additive read layer for the offline operator UI.
 * It is server-only (no client-facing helpers), respects RLS via the
 * cookie-bound Supabase client, and projects offline-specific columns
 * into typed offline shapes.
 *
 * Boundary contract:
 *   - Never reads via service-role.
 *   - Never returns content_text of intake documents (operators view
 *     content through the action layer or in a future dedicated viewer).
 *   - Never crosses into live-link Mode A territory — Mode A sessions
 *     remain readable through `getIntakeRecordForEngagement`.
 */

// ---------------------------------------------------------------------------
// Offline session + response shapes
// ---------------------------------------------------------------------------

const OFFLINE_SESSION_SELECT = `
  id,
  workspace_id,
  engagement_id,
  stakeholder_name,
  stakeholder_email,
  stakeholder_title,
  role,
  department,
  status,
  response_quality,
  source_type,
  source_confidence,
  operator_notes,
  client_visible,
  entered_by,
  collected_at,
  last_activity_at,
  created_at,
  updated_at
` as const;

const OFFLINE_RESPONSE_SELECT = `
  id,
  session_id,
  engagement_id,
  question_id,
  question_label,
  answer_text,
  source_type,
  response_status,
  operator_notes,
  supersedes_response_id,
  client_visible,
  entered_by,
  collected_at,
  created_at,
  updated_at
` as const;

const OFFLINE_DOCUMENT_SELECT = `
  id,
  workspace_id,
  engagement_id,
  stakeholder_id,
  title,
  source_type,
  content_text,
  external_url,
  storage_path,
  mime_type,
  size_bytes,
  source_confidence,
  operator_notes,
  client_visible,
  created_by,
  voided_at,
  voided_by,
  void_reason,
  created_at,
  updated_at
` as const;

export interface OfflineStakeholderSession {
  id: string;
  engagementId: string;
  name: string;
  email: string | null;
  title: string | null;
  role: StakeholderRole;
  department: string | null;
  sourceType: IntakeSourceType;
  sourceConfidence: IntakeSourceConfidence | null;
  operatorNotes: string | null;
  clientVisible: boolean;
  collectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  responses: OfflineStakeholderResponse[];
}

export interface OfflineStakeholderResponse {
  id: string;
  sessionId: string;
  engagementId: string;
  questionId: string;
  questionLabel: string | null;
  /**
   * NOTE: answer_text is intentionally INCLUDED for the operator-facing
   * surface (this is operator-only data). It is never exposed to client
   * routes / share token viewers per docs/37 boundary.
   */
  answerText: string;
  sourceType: IntakeSourceType;
  responseStatus: IntakeResponseStatus;
  operatorNotes: string | null;
  supersedesResponseId: string | null;
  clientVisible: boolean;
  collectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbOfflineSessionRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  stakeholder_name: string | null;
  stakeholder_email: string | null;
  stakeholder_title: string | null;
  role: string | null;
  department: string | null;
  status: string | null;
  response_quality: string | null;
  source_type: string;
  source_confidence: string | null;
  operator_notes: string | null;
  client_visible: boolean;
  entered_by: string | null;
  collected_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbOfflineResponseRow {
  id: string;
  session_id: string;
  engagement_id: string;
  question_id: string;
  question_label: string | null;
  answer_text: string | null;
  source_type: string;
  response_status: string;
  operator_notes: string | null;
  supersedes_response_id: string | null;
  client_visible: boolean;
  entered_by: string | null;
  collected_at: string | null;
  created_at: string;
  updated_at: string;
}

const OFFLINE_SOURCE_TYPES: IntakeSourceType[] = [
  "live_link",
  "operator_entered",
  "meeting_notes",
  "transcript",
  "email_paste",
  "document_upload",
];

const RESPONSE_STATUSES: IntakeResponseStatus[] = [
  "draft",
  "ready_for_synthesis",
  "superseded",
  "voided",
];

const SOURCE_CONFIDENCES: IntakeSourceConfidence[] = [
  "first_hand",
  "second_hand",
  "inferred",
];

function fitSourceType(value: string): IntakeSourceType {
  return (OFFLINE_SOURCE_TYPES as string[]).includes(value)
    ? (value as IntakeSourceType)
    : "operator_entered";
}

function fitResponseStatus(value: string): IntakeResponseStatus {
  return (RESPONSE_STATUSES as string[]).includes(value)
    ? (value as IntakeResponseStatus)
    : "draft";
}

function fitSourceConfidence(
  value: string | null,
): IntakeSourceConfidence | null {
  if (!value) return null;
  return (SOURCE_CONFIDENCES as string[]).includes(value)
    ? (value as IntakeSourceConfidence)
    : null;
}

function mapOfflineSession(
  row: DbOfflineSessionRow,
  responses: OfflineStakeholderResponse[],
): OfflineStakeholderSession {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    name: row.stakeholder_name?.trim() || "Unnamed stakeholder",
    email: row.stakeholder_email?.trim() || null,
    title: row.stakeholder_title?.trim() || null,
    role: tsRoleFor(row.role),
    department: row.department?.trim() || null,
    sourceType: fitSourceType(row.source_type),
    sourceConfidence: fitSourceConfidence(row.source_confidence),
    operatorNotes: row.operator_notes,
    clientVisible: row.client_visible,
    collectedAt: row.collected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    responses,
  };
}

function mapOfflineResponse(
  row: DbOfflineResponseRow,
): OfflineStakeholderResponse {
  return {
    id: row.id,
    sessionId: row.session_id,
    engagementId: row.engagement_id,
    questionId: row.question_id,
    questionLabel: row.question_label,
    answerText: row.answer_text ?? "",
    sourceType: fitSourceType(row.source_type),
    responseStatus: fitResponseStatus(row.response_status),
    operatorNotes: row.operator_notes,
    supersedesResponseId: row.supersedes_response_id,
    clientVisible: row.client_visible,
    collectedAt: row.collected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Public query helpers
// ---------------------------------------------------------------------------

/**
 * Fetch every offline stakeholder session (source_type != 'live_link')
 * for an engagement, along with its responses grouped underneath each
 * session. Live-link Mode A sessions are intentionally excluded — the
 * operator's live-link workspace already shows those.
 */
export async function getOfflineSessionsForEngagement(
  engagementId: string,
): Promise<OfflineStakeholderSession[]> {
  if (!isUuid(engagementId)) return [];
  const supabase = createSupabaseServerClient();

  const { data: sessions, error: sessionsError } = await supabase
    .from("stakeholder_intake_sessions")
    .select(OFFLINE_SESSION_SELECT)
    .eq("engagement_id", engagementId)
    .neq("source_type", "live_link")
    .order("created_at", { ascending: true });
  if (sessionsError) {
    console.error("[intake.offline-queries] sessions-fetch-failed", {
      name: sessionsError.name,
      code: sessionsError.code,
      message: sessionsError.message,
    });
    return [];
  }
  const sessionRows = (sessions as unknown as DbOfflineSessionRow[]) ?? [];
  if (sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((s) => s.id);
  const { data: responses, error: responsesError } = await supabase
    .from("stakeholder_responses")
    .select(OFFLINE_RESPONSE_SELECT)
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });
  let responseRows: DbOfflineResponseRow[] = [];
  if (responsesError) {
    console.error("[intake.offline-queries] responses-fetch-failed", {
      name: responsesError.name,
      code: responsesError.code,
      message: responsesError.message,
    });
  } else {
    responseRows = (responses as unknown as DbOfflineResponseRow[]) ?? [];
  }

  return sessionRows.map((sessionRow) => {
    const sessionResponses = responseRows
      .filter((r) => r.session_id === sessionRow.id)
      .map(mapOfflineResponse);
    return mapOfflineSession(sessionRow, sessionResponses);
  });
}

/**
 * Fetch every non-voided intake document for an engagement.
 *
 * Documents NEVER reach client-facing routes. This helper is for the
 * operator-side intake surface only.
 */
export async function getEngagementIntakeDocuments(
  engagementId: string,
): Promise<EngagementIntakeDocument[]> {
  if (!isUuid(engagementId)) return [];
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("engagement_intake_documents")
    .select(OFFLINE_DOCUMENT_SELECT)
    .eq("engagement_id", engagementId)
    .is("voided_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[intake.offline-queries] documents-fetch-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as DbEngagementIntakeDocumentRow[]) ?? [];
  return rows.map(mapEngagementIntakeDocumentRow);
}

// ---------------------------------------------------------------------------
// Readiness aggregation (docs/37 § 5 — offline synthesis gate)
// ---------------------------------------------------------------------------

export interface OfflineIntakeReadinessSummary {
  /** Total non-voided offline sessions. */
  offlineSessionCount: number;
  /** Sessions with at least one ready-for-synthesis response. */
  sessionsWithReadyResponse: number;
  /** Total responses across all offline sessions, by status. */
  draftResponseCount: number;
  readyResponseCount: number;
  supersededResponseCount: number;
  voidedResponseCount: number;
  /** Non-voided documents available to synthesis. */
  documentCount: number;
}

/**
 * Aggregate offline-intake readiness counts for the operator-only
 * readiness hint card. This is a derived/projection helper — does not
 * reflect any client-facing artifact.
 */
export async function getOfflineIntakeReadinessSummary(
  engagementId: string,
): Promise<OfflineIntakeReadinessSummary> {
  const empty: OfflineIntakeReadinessSummary = {
    offlineSessionCount: 0,
    sessionsWithReadyResponse: 0,
    draftResponseCount: 0,
    readyResponseCount: 0,
    supersededResponseCount: 0,
    voidedResponseCount: 0,
    documentCount: 0,
  };
  if (!isUuid(engagementId)) return empty;

  const [sessions, documents] = await Promise.all([
    getOfflineSessionsForEngagement(engagementId),
    getEngagementIntakeDocuments(engagementId),
  ]);

  let draft = 0;
  let ready = 0;
  let superseded = 0;
  let voided = 0;
  let sessionsWithReady = 0;

  for (const session of sessions) {
    let sessionReady = false;
    for (const response of session.responses) {
      switch (response.responseStatus) {
        case "draft":
          draft += 1;
          break;
        case "ready_for_synthesis":
          ready += 1;
          sessionReady = true;
          break;
        case "superseded":
          superseded += 1;
          break;
        case "voided":
          voided += 1;
          break;
      }
    }
    if (sessionReady) sessionsWithReady += 1;
  }

  return {
    offlineSessionCount: sessions.length,
    sessionsWithReadyResponse: sessionsWithReady,
    draftResponseCount: draft,
    readyResponseCount: ready,
    supersededResponseCount: superseded,
    voidedResponseCount: voided,
    documentCount: documents.length,
  };
}
