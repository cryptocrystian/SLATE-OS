import "server-only";

import { getJevConfig } from "./config";
import type { RubricCheck, CheckResult, JudgeVerdict } from "./types";

/**
 * Jev judge — runs a set of docs/68 rubric checks over a candidate as typed,
 * calibrated judgments (TypeSafe System One HTTP API).
 *
 *   POST https://api.typesafe.ai/v1/systemone
 *   Authorization: Bearer <JEV_API_KEY>
 *   body: { state, model, questions: { <id>: { type, instructions, criteria } } }
 *   -> { answers: { <id>: { noul } | { score, confidence, probabilities } } }
 *
 * The judge NEVER mutates the candidate. It returns pass/fail + probabilities
 * the operator (and the orchestrator's revise step) can act on. Typed output
 * guarantees the interface, not truth — thresholds are ours and are validated
 * in-domain (see docs/72 known-answer cases).
 */

interface SystemOneAnswer {
  type?: string;
  noul?: number;
  score?: number;
  confidence?: number;
  probabilities?: Record<string, number>;
}

function buildQuestion(check: RubricCheck): Record<string, unknown> {
  if (check.kind === "noul") {
    const criteria =
      check.criteria && !Array.isArray(check.criteria)
        ? check.criteria
        : undefined;
    return { type: "noul", instructions: check.instructions, ...(criteria ? { criteria } : {}) };
  }
  // score
  const criteria = Array.isArray(check.criteria) ? check.criteria : undefined;
  return { type: "score", instructions: check.instructions, ...(criteria ? { criteria } : {}) };
}

function resolvePass(check: RubricCheck, ans: SystemOneAnswer): boolean {
  if (check.kind === "noul") {
    const p = typeof ans.noul === "number" ? ans.noul : 0;
    if (check.failWhenYes) return p < (check.passAtOrAbove ?? 0.5);
    return p >= (check.passAtOrAbove ?? 0.5);
  }
  const s = typeof ans.score === "number" ? ans.score : 0;
  return s >= (check.minScore ?? 2);
}

/**
 * Judge a candidate. `state` is the serialized candidate + source context the
 * checks reference. Returns a verdict; on any failure returns a non-throwing
 * `unavailable`/`error` verdict so the loop degrades gracefully (Jev is
 * advisory, never a hard blocker on infra failure).
 */
export async function judgeCandidate(
  state: unknown,
  checks: RubricCheck[],
): Promise<JudgeVerdict> {
  const config = getJevConfig();
  if (!config) {
    return { status: "unavailable", model: null, checks: [], passed: false, failedCount: 0, message: "JEV_API_KEY not set" };
  }
  if (checks.length === 0) {
    return { status: "judged", model: config.model, checks: [], passed: true, failedCount: 0 };
  }

  const questions: Record<string, unknown> = {};
  for (const c of checks) questions[c.id] = buildQuestion(c);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const resp = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ state, model: config.model, questions }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      return { status: "error", model: config.model, checks: [], passed: false, failedCount: 0, message: `status ${resp.status}` };
    }
    const json = (await resp.json()) as { answers?: Record<string, SystemOneAnswer> };
    const answers = json.answers ?? {};

    const results: CheckResult[] = checks.map((c) => {
      const a = answers[c.id] ?? {};
      const passed = resolvePass(c, a);
      return {
        id: c.id,
        kind: c.kind,
        dimension: c.dimension,
        noul: c.kind === "noul" ? a.noul : undefined,
        score: c.kind === "score" ? a.score : undefined,
        confidence: a.confidence,
        probabilities: a.probabilities,
        passed,
      };
    });
    const failedCount = results.filter((r) => !r.passed).length;
    return {
      status: "judged",
      model: config.model,
      checks: results,
      passed: failedCount === 0,
      failedCount,
    };
  } catch (e) {
    return {
      status: "error",
      model: config.model,
      checks: [],
      passed: false,
      failedCount: 0,
      message: e instanceof Error ? e.name : "unknown",
    };
  } finally {
    clearTimeout(timeout);
  }
}
