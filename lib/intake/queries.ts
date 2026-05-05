import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deriveFollowUps,
  deriveRoleCoverage,
  isUuid,
  mapInputAssetRow,
  mapSessionToStakeholder,
  type DbInputAssetRow,
  type DbIntakeResponseRow,
  type DbIntakeSessionRow,
  type SessionWithResponses,
} from "./mappers";
import type { IntakeRecord, Stakeholder } from "./types";

/**
 * Server-only query layer for the persisted stakeholder intake
 * workspace. Reads via the authenticated server Supabase client so RLS
 * is the boundary, not application code.
 */

const SESSION_SELECT = `
  id,
  workspace_id,
  engagement_id,
  contact_id,
  stakeholder_name,
  stakeholder_email,
  stakeholder_title,
  role,
  department,
  status,
  response_quality,
  token_hash,
  token_expires_at,
  sent_at,
  started_at,
  completed_at,
  last_activity_at,
  created_at,
  updated_at
` as const;

const RESPONSE_SELECT = `
  id,
  session_id,
  question_id,
  question_label,
  answer_text,
  answer_json,
  created_at,
  updated_at
` as const;

const ASSET_SELECT = `
  id,
  workspace_id,
  engagement_id,
  session_id,
  title,
  asset_type,
  source,
  status,
  evidence_quality,
  linked_role,
  summary,
  metadata,
  created_at,
  updated_at
` as const;

/** Aggregated intake counts shown on the engagement detail panel. */
export interface IntakeStatusSummary {
  total: number;
  invited: number;
  inProgress: number;
  completed: number;
  needsFollowUp: number;
  notStarted: number;
  rolesCovered: string[];
  rolesMissing: string[];
  lastResponseAt: string | null;
  strongResponses: number;
}

export async function getIntakeRecordForEngagement(
  engagementId: string,
): Promise<IntakeRecord | null> {
  if (!isUuid(engagementId)) return null;
  const supabase = createSupabaseServerClient();

  const { data: sessions, error: sessionsError } = await supabase
    .from("stakeholder_intake_sessions")
    .select(SESSION_SELECT)
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: true });
  if (sessionsError) {
    console.error("[intake.queries] sessions-fetch-failed", {
      name: sessionsError.name,
      code: sessionsError.code,
      message: sessionsError.message,
    });
    return null;
  }
  const sessionRows = (sessions as unknown as DbIntakeSessionRow[]) ?? [];

  let responseRows: DbIntakeResponseRow[] = [];
  if (sessionRows.length > 0) {
    const sessionIds = sessionRows.map((s) => s.id);
    const { data: responses, error: responsesError } = await supabase
      .from("stakeholder_responses")
      .select(RESPONSE_SELECT)
      .in("session_id", sessionIds);
    if (responsesError) {
      console.error("[intake.queries] responses-fetch-failed", {
        name: responsesError.name,
        code: responsesError.code,
        message: responsesError.message,
      });
    } else {
      responseRows = (responses as unknown as DbIntakeResponseRow[]) ?? [];
    }
  }

  const { data: assets, error: assetsError } = await supabase
    .from("input_assets")
    .select(ASSET_SELECT)
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false });
  if (assetsError) {
    console.error("[intake.queries] assets-fetch-failed", {
      name: assetsError.name,
      code: assetsError.code,
      message: assetsError.message,
    });
  }
  const assetRows = (assets as unknown as DbInputAssetRow[]) ?? [];

  const stakeholders: Stakeholder[] = sessionRows.map((session) => {
    const responses = responseRows.filter((r) => r.session_id === session.id);
    return mapSessionToStakeholder({
      session,
      responses,
    } satisfies SessionWithResponses);
  });

  return {
    engagementId,
    stakeholders,
    roleCoverage: deriveRoleCoverage(stakeholders),
    supportingInputs: assetRows.map(mapInputAssetRow),
    followUps: deriveFollowUps(stakeholders),
    intakeRiskNotes: deriveIntakeRisks(stakeholders),
  };
}

export async function getIntakeStatusSummary(
  engagementId: string,
): Promise<IntakeStatusSummary | null> {
  if (!isUuid(engagementId)) return null;
  const record = await getIntakeRecordForEngagement(engagementId);
  if (!record) return null;
  const total = record.stakeholders.length;
  const invited = record.stakeholders.filter(
    (s) => s.status !== "not-started",
  ).length;
  const inProgress = record.stakeholders.filter(
    (s) => s.status === "in-progress",
  ).length;
  const completed = record.stakeholders.filter(
    (s) => s.status === "completed",
  ).length;
  const needsFollowUp = record.stakeholders.filter(
    (s) => s.status === "needs-follow-up",
  ).length;
  const notStarted = record.stakeholders.filter(
    (s) => s.status === "not-started",
  ).length;
  const rolesCovered = record.roleCoverage
    .filter((r) => r.status === "covered")
    .map((r) => r.role);
  const rolesMissing = record.roleCoverage
    .filter((r) => r.required && r.status !== "covered")
    .map((r) => r.role);
  const lastResponseAt =
    record.stakeholders
      .map((s) => s.lastActivity)
      .find((v) => v && v !== "—") ?? null;
  const strongResponses = record.stakeholders.filter(
    (s) => s.responseQuality === "strong",
  ).length;
  return {
    total,
    invited,
    inProgress,
    completed,
    needsFollowUp,
    notStarted,
    rolesCovered,
    rolesMissing,
    lastResponseAt,
    strongResponses,
  };
}

function deriveIntakeRisks(stakeholders: Stakeholder[]): string[] {
  const notes: string[] = [];
  if (stakeholders.length === 0) {
    notes.push(
      "No stakeholders invited yet — synthesis cannot start until intake responses begin to land.",
    );
    return notes;
  }
  const stalled = stakeholders.filter((s) => s.status === "needs-follow-up");
  if (stalled.length > 0) {
    notes.push(
      `${stalled.length} stakeholder${stalled.length === 1 ? "" : "s"} stalled mid-intake — schedule a personal follow-up.`,
    );
  }
  const dormant = stakeholders.filter((s) => s.status === "not-started");
  if (dormant.length > 0) {
    notes.push(
      `${dormant.length} stakeholder${dormant.length === 1 ? "" : "s"} have not opened the intake link — confirm delivery before the kickoff.`,
    );
  }
  return notes;
}
