"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  dbRoleFor,
  isUuid,
  mapEngagementIntakeDocumentRow,
  type DbEngagementIntakeDocumentRow,
} from "./mappers";
import type {
  CreateIntakeDocumentInput,
  CreateIntakeDocumentResult,
  CreateOfflineResponseInput,
  CreateOfflineResponseResult,
  CreateOfflineStakeholderInput,
  CreateOfflineStakeholderResult,
  IntakeDocumentSourceType,
  IntakeResponseStatus,
  IntakeSourceConfidence,
  IntakeSourceType,
  MarkResponseReadyInput,
  MarkResponseReadyResult,
  OfflineIntakeErrorCode,
  StakeholderRole,
  VoidIntakeDocumentInput,
  VoidIntakeDocumentResult,
  VoidOfflineResponseInput,
  VoidOfflineResponseResult,
} from "./types";

/**
 * Sprint I2 — Offline intake server actions (no UI yet; Sprint I3
 * wires the operator surface).
 *
 * Canon: docs/37_SAPIENT_DIGITAL_OFFLINE_INTAKE_CANON.md.
 *
 * Boundary contract (preserved by every action in this module):
 *   - Cookie-bound authenticated user required.
 *   - Workspace-scoped via the RLS-respecting server client. No
 *     service-role client used here.
 *   - Engagement must belong to the operator's workspace.
 *   - Offline modes (operator_entered / meeting_notes / transcript /
 *     email_paste / document_upload) MUST NOT mint a token, MUST NOT
 *     send anything, and default client_visible = false.
 *   - Live-link mode (Mode A) is untouched by this module — use
 *     `createStakeholderSession` in `./actions.ts` for live intake.
 *   - Per-action activity events carry only safe metadata: role,
 *     source_type, question_id, response_status, document title /
 *     source_type. NEVER answer_text, NEVER content_text, NEVER raw
 *     email, NEVER PII.
 *   - Response status transitions enforced server-side:
 *       draft → ready_for_synthesis
 *       draft → voided
 *       ready_for_synthesis → voided
 *       ready_for_synthesis → superseded (auto when supersedesResponseId is set)
 *   - Documents are NEVER hard-deleted by `voidEngagementIntakeDocumentAction`
 *     — they are marked `voided_at` / `voided_by` / `void_reason` so the
 *     audit trail is preserved per docs/37 § 4 ("Void/supersede response").
 */

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const OFFLINE_SOURCE_TYPES: IntakeSourceType[] = [
  "operator_entered",
  "meeting_notes",
  "transcript",
  "email_paste",
  "document_upload",
];

const DOCUMENT_SOURCE_TYPES: IntakeDocumentSourceType[] = [
  "document_upload",
  "meeting_notes",
  "transcript",
  "email_paste",
  "external_link",
];

const SOURCE_CONFIDENCE_VALUES: IntakeSourceConfidence[] = [
  "first_hand",
  "second_hand",
  "inferred",
];

const VALID_ROLES: StakeholderRole[] = [
  "executive",
  "operations",
  "sales",
  "marketing",
  "finance",
  "it",
  "frontline",
  "customer-success",
  "other",
];

const OPERATOR_NOTES_MAX_SESSION = 2000;
const OPERATOR_NOTES_MAX_RESPONSE = 1000;
const OPERATOR_NOTES_MAX_DOCUMENT = 1000;
const VOID_REASON_MAX = 500;
const DOCUMENT_TITLE_MIN = 1;
const DOCUMENT_TITLE_MAX = 200;
const STAKEHOLDER_NAME_MAX = 200;
const QUESTION_ID_MAX = 200;
const ANSWER_TEXT_MAX = 20_000;

function isOfflineSourceType(
  value: unknown,
): value is Exclude<IntakeSourceType, "live_link"> {
  return (
    typeof value === "string" &&
    (OFFLINE_SOURCE_TYPES as string[]).includes(value)
  );
}

function isDocumentSourceType(value: unknown): value is IntakeDocumentSourceType {
  return (
    typeof value === "string" &&
    (DOCUMENT_SOURCE_TYPES as string[]).includes(value)
  );
}

function isSourceConfidence(value: unknown): value is IntakeSourceConfidence {
  return (
    typeof value === "string" &&
    (SOURCE_CONFIDENCE_VALUES as string[]).includes(value)
  );
}

function sanitizeNullableText(
  raw: string | null | undefined,
  maxLength: number,
): { ok: true; value: string | null } | { ok: false; error: OfflineIntakeErrorCode } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > maxLength) return { ok: false, error: "field-too-long" };
  return { ok: true, value: trimmed };
}

function logActionFailure(
  scope: string,
  err: { name?: string; code?: string; message?: string } | null | undefined,
) {
  if (!err) return;
  console.error(`[intake.offline-actions] ${scope}`, {
    name: err.name,
    code: err.code,
    message: err.message,
  });
}

// ---------------------------------------------------------------------------
// 1. Create offline stakeholder intake session (Mode B / Mode C)
// ---------------------------------------------------------------------------

export async function createOfflineStakeholderIntakeSessionAction(
  input: CreateOfflineStakeholderInput,
): Promise<CreateOfflineStakeholderResult> {
  if (!isUuid(input.engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  if (!VALID_ROLES.includes(input.role)) {
    return { ok: false, error: "invalid-role" };
  }
  if (!isOfflineSourceType(input.sourceType)) {
    return { ok: false, error: "invalid-source-type" };
  }
  if (
    input.sourceConfidence !== undefined &&
    !isSourceConfidence(input.sourceConfidence)
  ) {
    return { ok: false, error: "invalid-source-confidence" };
  }

  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "missing-fields" };
  if (name.length > STAKEHOLDER_NAME_MAX) {
    return { ok: false, error: "field-too-long" };
  }
  const emailRaw = (input.email ?? "").trim().toLowerCase();
  // Email is OPTIONAL for offline modes. If supplied, validate shape.
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return { ok: false, error: "missing-fields" };
  }
  const title = (input.title ?? "").trim();
  const department = (input.department ?? "").trim();

  const operatorNotesResult = sanitizeNullableText(
    input.operatorNotes,
    OPERATOR_NOTES_MAX_SESSION,
  );
  if (!operatorNotesResult.ok) return operatorNotesResult;

  let collectedAtIso: string | null = null;
  if (input.collectedAt) {
    const d = new Date(input.collectedAt);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "missing-fields" };
    collectedAtIso = d.toISOString();
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", input.engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    logActionFailure("engagement-lookup-failed", engagementError);
    return { ok: false, error: "service-error" };
  }
  if (!engagement?.id) return { ok: false, error: "engagement-not-found" };

  const nowIso = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("stakeholder_intake_sessions")
    .insert({
      workspace_id: engagement.workspace_id,
      engagement_id: engagement.id,
      stakeholder_name: name,
      stakeholder_email: emailRaw || null,
      stakeholder_title: title || null,
      role: dbRoleFor(input.role),
      department: department || null,
      status: "not_started",
      response_quality: "missing",
      // Offline modes MUST omit token_hash + token_expires_at + sent_at.
      // CHECK constraint in migration 0017 enforces this; we explicitly
      // omit here for clarity.
      token_hash: null,
      token_expires_at: null,
      sent_at: null,
      last_activity_at: nowIso,
      source_type: input.sourceType,
      entered_by: user.id,
      collected_at: collectedAtIso,
      source_confidence: input.sourceConfidence ?? null,
      operator_notes: operatorNotesResult.value,
      // Offline sessions default client_visible=false per canon.
      client_visible: false,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted?.id) {
    logActionFailure("offline-session-insert-failed", insertError);
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "offline_intake_session_created",
    entityType: "intake_session",
    entityId: inserted.id,
    engagementId: engagement.id,
    title: `Offline stakeholder staged · ${name}`,
    summary:
      "Operator staged an offline stakeholder intake session. SLATE did not send any message.",
    metadata: {
      role: input.role,
      sourceType: input.sourceType,
      sourceConfidence: input.sourceConfidence ?? null,
      hasEmail: Boolean(emailRaw),
    },
  });

  revalidatePath(`/app/engagements/${engagement.id}/intake`);
  revalidatePath(`/app/engagements/${engagement.id}`);

  return {
    ok: true,
    sessionId: inserted.id,
    sourceType: input.sourceType,
  };
}

// ---------------------------------------------------------------------------
// 2. Create offline stakeholder response (Mode B)
// ---------------------------------------------------------------------------

export async function createOfflineStakeholderResponseAction(
  input: CreateOfflineResponseInput,
): Promise<CreateOfflineResponseResult> {
  if (!isUuid(input.sessionId)) {
    return { ok: false, error: "invalid-session" };
  }
  if (!isOfflineSourceType(input.sourceType)) {
    return { ok: false, error: "invalid-source-type" };
  }
  if (
    input.supersedesResponseId !== undefined &&
    !isUuid(input.supersedesResponseId)
  ) {
    return { ok: false, error: "invalid-response" };
  }

  const questionId = (input.questionId ?? "").trim();
  if (!questionId) return { ok: false, error: "missing-fields" };
  if (questionId.length > QUESTION_ID_MAX) {
    return { ok: false, error: "field-too-long" };
  }
  const answerText = (input.answerText ?? "").trim();
  if (!answerText) return { ok: false, error: "missing-fields" };
  if (answerText.length > ANSWER_TEXT_MAX) {
    return { ok: false, error: "field-too-long" };
  }
  const questionLabelResult = sanitizeNullableText(input.questionLabel, 500);
  if (!questionLabelResult.ok) return questionLabelResult;
  const operatorNotesResult = sanitizeNullableText(
    input.operatorNotes,
    OPERATOR_NOTES_MAX_RESPONSE,
  );
  if (!operatorNotesResult.ok) return operatorNotesResult;

  let collectedAtIso: string | null = null;
  if (input.collectedAt) {
    const d = new Date(input.collectedAt);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "missing-fields" };
    collectedAtIso = d.toISOString();
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // Verify session exists + is offline mode + caller has workspace
  // access (RLS would silently filter, but explicit lookup gives a
  // clean error message).
  const { data: session, error: sessionError } = await supabase
    .from("stakeholder_intake_sessions")
    .select("id, workspace_id, engagement_id, source_type")
    .eq("id", input.sessionId)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      engagement_id: string;
      source_type: string;
    }>();
  if (sessionError) {
    logActionFailure("session-lookup-failed", sessionError);
    return { ok: false, error: "service-error" };
  }
  if (!session?.id) return { ok: false, error: "session-not-found" };
  if (session.source_type === "live_link") {
    // Live-link sessions accept responses only through the public
    // /intake/[token] route. Operator-side offline-response creation
    // against a live session would conflate the two ingest paths.
    return { ok: false, error: "session-mode-mismatch" };
  }

  // Verify supersedes target if provided.
  if (input.supersedesResponseId) {
    const { data: prior, error: priorError } = await supabase
      .from("stakeholder_responses")
      .select("id, session_id, response_status")
      .eq("id", input.supersedesResponseId)
      .maybeSingle<{
        id: string;
        session_id: string;
        response_status: string;
      }>();
    if (priorError) {
      logActionFailure("supersedes-lookup-failed", priorError);
      return { ok: false, error: "service-error" };
    }
    if (!prior?.id) return { ok: false, error: "response-not-found" };
    if (prior.session_id !== session.id) {
      return { ok: false, error: "invalid-response" };
    }
    if (prior.response_status === "voided") {
      return { ok: false, error: "response-already-voided" };
    }
  }

  const nowIso = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("stakeholder_responses")
    .insert({
      workspace_id: session.workspace_id,
      engagement_id: session.engagement_id,
      session_id: session.id,
      question_id: questionId,
      question_label: questionLabelResult.value,
      answer_text: answerText,
      answer_json: null,
      source_type: input.sourceType,
      response_status: "draft" satisfies IntakeResponseStatus,
      entered_by: user.id,
      collected_at: collectedAtIso,
      operator_notes: operatorNotesResult.value,
      supersedes_response_id: input.supersedesResponseId ?? null,
      // Offline responses default client_visible=false.
      client_visible: false,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted?.id) {
    logActionFailure("offline-response-insert-failed", insertError);
    return { ok: false, error: "service-error" };
  }

  // Bump session last_activity_at; best-effort.
  await supabase
    .from("stakeholder_intake_sessions")
    .update({ last_activity_at: nowIso })
    .eq("id", session.id);

  await logActivityEvent({
    eventType: "offline_intake_response_created",
    entityType: "stakeholder_response",
    entityId: inserted.id,
    engagementId: session.engagement_id,
    title: "Offline intake response drafted",
    summary:
      "Operator staged an offline stakeholder response. Response remains draft until marked ready for synthesis.",
    metadata: {
      sessionId: session.id,
      sourceType: input.sourceType,
      questionId,
      responseStatus: "draft",
      supersedes: Boolean(input.supersedesResponseId),
    },
  });

  revalidatePath(`/app/engagements/${session.engagement_id}/intake`);

  return {
    ok: true,
    responseId: inserted.id,
    sessionId: session.id,
    responseStatus: "draft",
  };
}

// ---------------------------------------------------------------------------
// 3. Mark stakeholder response ready for synthesis
// ---------------------------------------------------------------------------

export async function markStakeholderResponseReadyForSynthesisAction(
  input: MarkResponseReadyInput,
): Promise<MarkResponseReadyResult> {
  if (!isUuid(input.responseId)) {
    return { ok: false, error: "invalid-response" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: readError } = await supabase
    .from("stakeholder_responses")
    .select(
      "id, session_id, engagement_id, response_status, source_type, supersedes_response_id",
    )
    .eq("id", input.responseId)
    .maybeSingle<{
      id: string;
      session_id: string;
      engagement_id: string;
      response_status: string;
      source_type: string;
      supersedes_response_id: string | null;
    }>();
  if (readError) {
    logActionFailure("mark-ready-read-failed", readError);
    return { ok: false, error: "service-error" };
  }
  if (!existing?.id) return { ok: false, error: "response-not-found" };
  if (existing.response_status === "voided") {
    return { ok: false, error: "response-already-voided" };
  }
  if (existing.response_status === "superseded") {
    return { ok: false, error: "response-not-eligible" };
  }
  if (existing.response_status === "ready_for_synthesis") {
    // Idempotent — already ready.
    return { ok: true, responseId: existing.id };
  }

  const { error: updateError } = await supabase
    .from("stakeholder_responses")
    .update({ response_status: "ready_for_synthesis" })
    .eq("id", existing.id)
    .eq("response_status", "draft"); // race-safe transition gate
  if (updateError) {
    logActionFailure("mark-ready-update-failed", updateError);
    return { ok: false, error: "service-error" };
  }

  // Presentation Pass — when a session crosses from "no ready responses"
  // to "≥ 1 ready response", auto-flip the session.status from
  // `not_started` to `completed` so downstream AI synthesis prompts +
  // operator-facing assumption copy no longer claim "intake has not
  // started" while ready responses exist. Best-effort: failure does
  // not block the promote.
  //
  // Idempotent semantics:
  //   - If `existing.session_id` already has another `ready_for_synthesis`
  //     response, no change (session is already at least `completed`).
  //   - If the session.status is anything other than `not_started`
  //     (e.g. `in_progress`, `completed`), no change.
  //   - Only the `not_started → completed` transition fires here.
  const { error: sessionUpdateError } = await supabase
    .from("stakeholder_intake_sessions")
    .update({ status: "completed" })
    .eq("id", existing.session_id)
    .eq("status", "not_started");
  if (sessionUpdateError) {
    logActionFailure("session-status-auto-update-failed", sessionUpdateError);
  }

  // If this response supersedes a prior, auto-flip the prior to
  // 'superseded'. Best-effort: failure does not block the promote.
  if (existing.supersedes_response_id) {
    const { error: supersedeError } = await supabase
      .from("stakeholder_responses")
      .update({ response_status: "superseded" })
      .eq("id", existing.supersedes_response_id)
      .eq("response_status", "ready_for_synthesis");
    if (supersedeError) {
      logActionFailure("auto-supersede-failed", supersedeError);
    }
  }

  await logActivityEvent({
    eventType: "offline_intake_response_ready",
    entityType: "stakeholder_response",
    entityId: existing.id,
    engagementId: existing.engagement_id,
    title: "Offline intake response marked ready for synthesis",
    summary:
      "Operator marked an offline intake response ready. Findings synthesis may now consume it.",
    metadata: {
      sessionId: existing.session_id,
      sourceType: existing.source_type,
      priorSupersededId: existing.supersedes_response_id ?? null,
    },
  });

  revalidatePath(`/app/engagements/${existing.engagement_id}/intake`);

  return { ok: true, responseId: existing.id };
}

// ---------------------------------------------------------------------------
// 4. Void offline stakeholder response (soft-delete)
// ---------------------------------------------------------------------------

export async function voidStakeholderResponseAction(
  input: VoidOfflineResponseInput,
): Promise<VoidOfflineResponseResult> {
  if (!isUuid(input.responseId)) {
    return { ok: false, error: "invalid-response" };
  }

  const reasonResult = sanitizeNullableText(input.reason, VOID_REASON_MAX);
  if (!reasonResult.ok) return reasonResult;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: readError } = await supabase
    .from("stakeholder_responses")
    .select("id, session_id, engagement_id, response_status, source_type")
    .eq("id", input.responseId)
    .maybeSingle<{
      id: string;
      session_id: string;
      engagement_id: string;
      response_status: string;
      source_type: string;
    }>();
  if (readError) {
    logActionFailure("void-response-read-failed", readError);
    return { ok: false, error: "service-error" };
  }
  if (!existing?.id) return { ok: false, error: "response-not-found" };
  if (existing.response_status === "voided") {
    return { ok: false, error: "response-already-voided" };
  }

  const { error: updateError } = await supabase
    .from("stakeholder_responses")
    .update({ response_status: "voided" })
    .eq("id", existing.id);
  if (updateError) {
    logActionFailure("void-response-update-failed", updateError);
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "offline_intake_response_voided",
    entityType: "stakeholder_response",
    entityId: existing.id,
    engagementId: existing.engagement_id,
    title: "Offline intake response voided",
    summary:
      "Operator voided an offline intake response. Audit trail preserved; findings synthesis will skip this row.",
    metadata: {
      sessionId: existing.session_id,
      sourceType: existing.source_type,
      priorStatus: existing.response_status,
      reason: reasonResult.value,
    },
  });

  revalidatePath(`/app/engagements/${existing.engagement_id}/intake`);

  return { ok: true, responseId: existing.id };
}

// ---------------------------------------------------------------------------
// 5. Create engagement intake document (Mode C / per-stakeholder source)
// ---------------------------------------------------------------------------

export async function createEngagementIntakeDocumentAction(
  input: CreateIntakeDocumentInput,
): Promise<CreateIntakeDocumentResult> {
  if (!isUuid(input.engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  if (input.stakeholderId !== undefined && !isUuid(input.stakeholderId)) {
    return { ok: false, error: "invalid-session" };
  }
  if (!isDocumentSourceType(input.sourceType)) {
    return { ok: false, error: "invalid-source-type" };
  }
  if (
    input.sourceConfidence !== undefined &&
    !isSourceConfidence(input.sourceConfidence)
  ) {
    return { ok: false, error: "invalid-source-confidence" };
  }

  const title = (input.title ?? "").trim();
  if (
    title.length < DOCUMENT_TITLE_MIN ||
    title.length > DOCUMENT_TITLE_MAX
  ) {
    return { ok: false, error: title.length === 0 ? "missing-fields" : "field-too-long" };
  }

  // At least one of contentText / externalUrl / storagePath must be
  // present, except for the title-only draft path where the operator
  // saves a stub before attaching content. Enforce per source_type:
  //   external_link → externalUrl required
  //   meeting_notes / transcript / email_paste → contentText required
  //   document_upload → storagePath required
  switch (input.sourceType) {
    case "external_link":
      if (!input.externalUrl || !input.externalUrl.trim()) {
        return { ok: false, error: "invalid-content" };
      }
      break;
    case "meeting_notes":
    case "transcript":
    case "email_paste":
      if (!input.contentText || !input.contentText.trim()) {
        return { ok: false, error: "invalid-content" };
      }
      break;
    case "document_upload":
      if (!input.storagePath || !input.storagePath.trim()) {
        return { ok: false, error: "invalid-content" };
      }
      break;
  }

  const contentTextResult = sanitizeNullableText(input.contentText, 100_000);
  if (!contentTextResult.ok) return contentTextResult;
  const externalUrlResult = sanitizeNullableText(input.externalUrl, 2048);
  if (!externalUrlResult.ok) return externalUrlResult;
  const storagePathResult = sanitizeNullableText(input.storagePath, 1024);
  if (!storagePathResult.ok) return storagePathResult;
  const mimeTypeResult = sanitizeNullableText(input.mimeType, 200);
  if (!mimeTypeResult.ok) return mimeTypeResult;
  const operatorNotesResult = sanitizeNullableText(
    input.operatorNotes,
    OPERATOR_NOTES_MAX_DOCUMENT,
  );
  if (!operatorNotesResult.ok) return operatorNotesResult;

  if (
    input.sizeBytes !== undefined &&
    input.sizeBytes !== null &&
    (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0)
  ) {
    return { ok: false, error: "invalid-content" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", input.engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    logActionFailure("document-engagement-lookup-failed", engagementError);
    return { ok: false, error: "service-error" };
  }
  if (!engagement?.id) return { ok: false, error: "engagement-not-found" };

  // Verify stakeholder belongs to the same engagement if provided.
  if (input.stakeholderId) {
    const { data: session, error: sessionError } = await supabase
      .from("stakeholder_intake_sessions")
      .select("id, engagement_id")
      .eq("id", input.stakeholderId)
      .maybeSingle<{ id: string; engagement_id: string }>();
    if (sessionError) {
      logActionFailure("document-session-lookup-failed", sessionError);
      return { ok: false, error: "service-error" };
    }
    if (!session?.id) return { ok: false, error: "session-not-found" };
    if (session.engagement_id !== engagement.id) {
      return { ok: false, error: "invalid-session" };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("engagement_intake_documents")
    .insert({
      workspace_id: engagement.workspace_id,
      engagement_id: engagement.id,
      stakeholder_id: input.stakeholderId ?? null,
      title,
      source_type: input.sourceType,
      content_text: contentTextResult.value,
      external_url: externalUrlResult.value,
      storage_path: storagePathResult.value,
      mime_type: mimeTypeResult.value,
      size_bytes:
        input.sizeBytes === undefined || input.sizeBytes === null
          ? null
          : input.sizeBytes,
      source_confidence: input.sourceConfidence ?? null,
      operator_notes: operatorNotesResult.value,
      // Documents default client_visible=false; never elevated by this
      // action. A future operator-elevation surface (Sprint I3 / I4) is
      // the only path that may flip this.
      client_visible: false,
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted?.id) {
    logActionFailure("document-insert-failed", insertError);
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "intake_document_created",
    entityType: "engagement_intake_document",
    entityId: inserted.id,
    engagementId: engagement.id,
    title: `Intake document attached · ${title}`,
    summary:
      "Operator attached an offline intake document. Document is operator-side input for findings synthesis; never client-facing.",
    metadata: {
      stakeholderId: input.stakeholderId ?? null,
      sourceType: input.sourceType,
      sourceConfidence: input.sourceConfidence ?? null,
      hasContentText: Boolean(contentTextResult.value),
      hasExternalUrl: Boolean(externalUrlResult.value),
      hasStoragePath: Boolean(storagePathResult.value),
    },
  });

  revalidatePath(`/app/engagements/${engagement.id}/intake`);

  return {
    ok: true,
    documentId: inserted.id,
    sourceType: input.sourceType,
  };
}

// ---------------------------------------------------------------------------
// 6. Void engagement intake document (soft-delete)
// ---------------------------------------------------------------------------

export async function voidEngagementIntakeDocumentAction(
  input: VoidIntakeDocumentInput,
): Promise<VoidIntakeDocumentResult> {
  if (!isUuid(input.documentId)) {
    return { ok: false, error: "invalid-document" };
  }

  const reasonResult = sanitizeNullableText(input.reason, VOID_REASON_MAX);
  if (!reasonResult.ok) return reasonResult;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: readError } = await supabase
    .from("engagement_intake_documents")
    .select("id, engagement_id, source_type, voided_at")
    .eq("id", input.documentId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      source_type: string;
      voided_at: string | null;
    }>();
  if (readError) {
    logActionFailure("void-document-read-failed", readError);
    return { ok: false, error: "service-error" };
  }
  if (!existing?.id) return { ok: false, error: "document-not-found" };
  if (existing.voided_at) {
    return { ok: false, error: "document-already-voided" };
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("engagement_intake_documents")
    .update({
      voided_at: nowIso,
      voided_by: user.id,
      void_reason: reasonResult.value,
    })
    .eq("id", existing.id);
  if (updateError) {
    logActionFailure("void-document-update-failed", updateError);
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "intake_document_voided",
    entityType: "engagement_intake_document",
    entityId: existing.id,
    engagementId: existing.engagement_id,
    title: "Intake document voided",
    summary:
      "Operator voided an offline intake document. Audit trail preserved; findings synthesis will skip this document.",
    metadata: {
      sourceType: existing.source_type,
      reason: reasonResult.value,
    },
  });

  revalidatePath(`/app/engagements/${existing.engagement_id}/intake`);

  return { ok: true, documentId: existing.id };
}

// ---------------------------------------------------------------------------
// Re-exports for clarity (callers of this module can import the result
// types alongside the actions without dipping into ./types).
// ---------------------------------------------------------------------------

export type {
  CreateIntakeDocumentInput,
  CreateIntakeDocumentResult,
  CreateOfflineResponseInput,
  CreateOfflineResponseResult,
  CreateOfflineStakeholderInput,
  CreateOfflineStakeholderResult,
  MarkResponseReadyInput,
  MarkResponseReadyResult,
  OfflineIntakeErrorCode,
  VoidIntakeDocumentInput,
  VoidIntakeDocumentResult,
  VoidOfflineResponseInput,
  VoidOfflineResponseResult,
};

// NOTE: The mapEngagementIntakeDocumentRow helper and the
// DbEngagementIntakeDocumentRow type live in ./mappers — query modules
// should import them directly from there. "use server" files can only
// export async functions, so we cannot re-export helpers from this file.
