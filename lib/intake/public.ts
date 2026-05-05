import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logActivityEvent } from "@/lib/activity/log";
import {
  hashIntakeToken,
  isPlausibleRawToken,
} from "./tokens";
import { tsRoleFor } from "./mappers";
import type { StakeholderRole } from "./types";

/**
 * Server-only helpers for the public `/intake/[token]` route.
 *
 * Uses the service-role client because the route is anonymous: there is
 * no operator session, and stakeholders never authenticate with a
 * Supabase user. Token-hash lookup is the boundary — the raw token is
 * never persisted, never logged, and never returned to the client.
 *
 * Information returned to the public route is intentionally narrow.
 * Internal fit score, lead trust reasons, recommended-action copy, and
 * engagement economics never reach this surface.
 */

export type PublicSessionLookup =
  | {
      ok: true;
      session: PublicStakeholderSession;
    }
  | {
      ok: false;
      reason: "invalid" | "not-found" | "expired";
    };

export interface PublicStakeholderSession {
  /** Internal id used when persisting responses. Treat as opaque on the
   *  client; the page does not display it. */
  id: string;
  status: "invited" | "in_progress" | "completed" | "needs_follow_up";
  role: StakeholderRole;
  stakeholderName: string | null;
  stakeholderTitle: string | null;
  department: string | null;
  /** Public-safe engagement context. */
  engagement: {
    id: string;
    companyName: string | null;
    engagementName: string | null;
    targetDate: string | null;
  };
  /** Existing responses keyed by question id, used to pre-fill the form
   *  when a stakeholder revisits a partially-completed link. */
  existingResponses: Array<{ questionId: string; answerText: string }>;
}

interface RawSessionRow {
  id: string;
  engagement_id: string;
  status: string;
  role: string | null;
  stakeholder_name: string | null;
  stakeholder_title: string | null;
  department: string | null;
  token_expires_at: string | null;
  engagements: {
    id: string;
    name: string | null;
    target_date: string | null;
    accounts: { name: string | null } | null;
  } | null;
}

interface RawResponseRow {
  question_id: string;
  answer_text: string | null;
}

export async function loadStakeholderSessionByToken(
  rawToken: string,
): Promise<PublicSessionLookup> {
  if (!isPlausibleRawToken(rawToken)) {
    return { ok: false, reason: "invalid" };
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const tokenHash = hashIntakeToken(rawToken);
  const { data, error } = await supabase
    .from("stakeholder_intake_sessions")
    .select(
      `
        id,
        engagement_id,
        status,
        role,
        stakeholder_name,
        stakeholder_title,
        department,
        token_expires_at,
        engagements:engagement_id (
          id,
          name,
          target_date,
          accounts:account_id ( name )
        )
      `,
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) {
    if (error) {
      console.error("[intake.public] session-lookup-failed", {
        name: error.name,
        code: error.code,
        message: error.message,
      });
    }
    return { ok: false, reason: "not-found" };
  }

  const row = data as unknown as RawSessionRow;
  if (row.token_expires_at) {
    const expires = new Date(row.token_expires_at);
    if (Number.isFinite(expires.getTime()) && expires.getTime() < Date.now()) {
      return { ok: false, reason: "expired" };
    }
  }

  const { data: existing } = await supabase
    .from("stakeholder_responses")
    .select("question_id, answer_text")
    .eq("session_id", row.id);
  const existingResponses =
    ((existing as unknown as RawResponseRow[]) ?? []).map((r) => ({
      questionId: r.question_id,
      answerText: r.answer_text ?? "",
    })) ?? [];

  const status = mapStatus(row.status);

  return {
    ok: true,
    session: {
      id: row.id,
      status,
      role: tsRoleFor(row.role),
      stakeholderName: row.stakeholder_name,
      stakeholderTitle: row.stakeholder_title,
      department: row.department,
      engagement: {
        id: row.engagement_id,
        companyName: row.engagements?.accounts?.name ?? null,
        engagementName: row.engagements?.name ?? null,
        targetDate: row.engagements?.target_date ?? null,
      },
      existingResponses,
    },
  };
}

export interface SubmitResponsesInput {
  rawToken: string;
  answers: Array<{ questionId: string; questionLabel: string; answerText: string }>;
}

export type SubmitResponsesResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid"
        | "not-found"
        | "expired"
        | "no-answers"
        | "service-error";
    };

export async function submitStakeholderResponses(
  input: SubmitResponsesInput,
): Promise<SubmitResponsesResult> {
  if (!isPlausibleRawToken(input.rawToken)) {
    return { ok: false, reason: "invalid" };
  }
  const sanitized = input.answers
    .map((a) => ({
      questionId: String(a.questionId ?? "").trim(),
      questionLabel: String(a.questionLabel ?? "").trim(),
      answerText: String(a.answerText ?? "").trim(),
    }))
    .filter((a) => a.questionId.length > 0 && a.answerText.length > 0);

  if (sanitized.length === 0) {
    return { ok: false, reason: "no-answers" };
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return { ok: false, reason: "service-error" };
  }

  const tokenHash = hashIntakeToken(input.rawToken);
  const { data: session, error: sessionError } = await supabase
    .from("stakeholder_intake_sessions")
    .select("id, workspace_id, engagement_id, status, token_expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      engagement_id: string;
      status: string;
      token_expires_at: string | null;
    }>();
  if (sessionError) {
    console.error("[intake.public] submit-session-lookup-failed", {
      name: sessionError.name,
      code: sessionError.code,
      message: sessionError.message,
    });
    return { ok: false, reason: "service-error" };
  }
  if (!session) {
    return { ok: false, reason: "not-found" };
  }
  if (session.token_expires_at) {
    const expires = new Date(session.token_expires_at);
    if (Number.isFinite(expires.getTime()) && expires.getTime() < Date.now()) {
      return { ok: false, reason: "expired" };
    }
  }

  const nowIso = new Date().toISOString();

  // Upsert each response (one per question per session).
  const upsertRows = sanitized.map((a) => ({
    workspace_id: session.workspace_id,
    engagement_id: session.engagement_id,
    session_id: session.id,
    question_id: a.questionId,
    question_label: a.questionLabel || null,
    answer_text: a.answerText,
    answer_json: null,
    updated_at: nowIso,
  }));

  const { error: upsertError } = await supabase
    .from("stakeholder_responses")
    .upsert(upsertRows, { onConflict: "session_id,question_id" });
  if (upsertError) {
    console.error("[intake.public] submit-upsert-failed", {
      name: upsertError.name,
      code: upsertError.code,
      message: upsertError.message,
    });
    return { ok: false, reason: "service-error" };
  }

  const responseQuality = classifyQuality(
    sanitized.map((a) => a.answerText),
  );

  const { error: sessionUpdateError } = await supabase
    .from("stakeholder_intake_sessions")
    .update({
      status: "completed",
      response_quality: responseQuality,
      started_at: nowIso,
      completed_at: nowIso,
      last_activity_at: nowIso,
    })
    .eq("id", session.id);
  if (sessionUpdateError) {
    console.error("[intake.public] submit-session-update-failed", {
      name: sessionUpdateError.name,
      code: sessionUpdateError.code,
      message: sessionUpdateError.message,
    });
    // Responses were saved — return success but log the bookkeeping miss.
  }

  // Best-effort engagement timestamp bump.
  await supabase
    .from("engagements")
    .update({ last_activity_at: nowIso })
    .eq("id", session.engagement_id);

  // Service-role activity event — no operator session here. The raw
  // token is never persisted in the metadata.
  await logActivityEvent(
    {
      eventType: "intake_response_submitted",
      entityType: "intake_session",
      entityId: session.id,
      engagementId: session.engagement_id,
      title: "Stakeholder submitted intake responses",
      summary: `Quality classified as ${responseQuality}.`,
      metadata: {
        responseQuality,
        responsesCount: sanitized.length,
      },
    },
    { viaServiceRole: true },
  );

  return { ok: true };
}

function mapStatus(
  raw: string | null,
): PublicStakeholderSession["status"] {
  switch (raw) {
    case "in_progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "needs_follow_up":
      return "needs_follow_up";
    case "invited":
    case "not_started":
    default:
      return "invited";
  }
}

function classifyQuality(answers: string[]): "strong" | "adequate" | "thin" {
  const totalChars = answers.reduce((acc, t) => acc + t.length, 0);
  const filled = answers.filter((t) => t.length > 0).length;
  if (filled >= 5 && totalChars >= 600) return "strong";
  if (filled >= 3 && totalChars >= 200) return "adequate";
  return "thin";
}
