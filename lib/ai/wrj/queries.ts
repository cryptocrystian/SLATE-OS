import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WrjRunSummary, WrjRunCheckSummary } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Latest WRJ verdict for a stage's most recent completed synthesis run.
 *
 * The stage action writes a sanitized `synthesis` summary into
 * `ai_synthesis_runs.output_summary` (writer/reviewer/judge counts + per-check
 * bands, no raw text). This reads the newest completed run of `runType` and
 * returns its summary for the operator verdict card. RLS-bound (operator
 * session); returns null on any error or when the run predates WRJ / ran in
 * single mode.
 */
async function getLatestWrjSummary(
  engagementId: string,
  runType: string,
): Promise<WrjRunSummary | null> {
  if (!UUID_RE.test(engagementId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_synthesis_runs")
    .select("output_summary")
    .eq("engagement_id", engagementId)
    .eq("run_type", runType)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ output_summary: unknown }>();
  if (error || !data) return null;

  const summary = (data.output_summary as { synthesis?: unknown } | null)
    ?.synthesis;
  return parseWrjRunSummary(summary);
}

export function getLatestFindingsWrjSummary(
  engagementId: string,
): Promise<WrjRunSummary | null> {
  return getLatestWrjSummary(engagementId, "findings_draft");
}

/** Defensive parse of the persisted summary (unknown JSON → typed). */
function parseWrjRunSummary(raw: unknown): WrjRunSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const mode = o.mode === "wrj" ? "wrj" : o.mode === "single" ? "single" : null;
  if (!mode) return null;
  if (mode === "single") return { mode };

  const reviewerRaw = o.reviewer as Record<string, unknown> | undefined;
  const judgeRaw = o.judge as Record<string, unknown> | undefined;
  const checksRaw = Array.isArray(judgeRaw?.checks) ? judgeRaw!.checks : [];
  const checks: WrjRunCheckSummary[] = checksRaw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      id: typeof c.id === "string" ? c.id : "check",
      dimension: typeof c.dimension === "string" ? c.dimension : undefined,
      passed: c.passed === true,
      noul: typeof c.noul === "number" ? c.noul : undefined,
      score: typeof c.score === "number" ? c.score : undefined,
      confidence: typeof c.confidence === "number" ? c.confidence : undefined,
    }));

  return {
    mode,
    revisions: typeof o.revisions === "number" ? o.revisions : undefined,
    reviewer: reviewerRaw
      ? {
          status: typeof reviewerRaw.status === "string" ? reviewerRaw.status : "unknown",
          model: typeof reviewerRaw.model === "string" ? reviewerRaw.model : null,
          noteCount: typeof reviewerRaw.noteCount === "number" ? reviewerRaw.noteCount : 0,
          highSeverity: typeof reviewerRaw.highSeverity === "number" ? reviewerRaw.highSeverity : 0,
        }
      : undefined,
    judge: judgeRaw
      ? {
          status: typeof judgeRaw.status === "string" ? judgeRaw.status : "unknown",
          model: typeof judgeRaw.model === "string" ? judgeRaw.model : null,
          passed: judgeRaw.passed === true,
          failedCount: typeof judgeRaw.failedCount === "number" ? judgeRaw.failedCount : 0,
          checks,
        }
      : undefined,
  };
}
