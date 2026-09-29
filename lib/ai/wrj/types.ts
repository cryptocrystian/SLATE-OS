import "server-only";

/**
 * Writer · Reviewer · Judge — shared types.
 *
 * These describe the artifacts the loop produces around a stage's candidate
 * (findings, opportunities, report section, proposal option). They are
 * additive telemetry: the candidate itself keeps its existing shape so
 * downstream is untouched; the WRJ metadata rides alongside for the operator
 * and for A/B comparison against the single-model path.
 */

// ---------------------------------------------------------------------------
// Judge (Jev) — rubric checks and verdicts
// ---------------------------------------------------------------------------

/**
 * A single judged check, phrased for Jev. `noul` for a yes/no gate
 * (probability of yes); `score` for a graded rubric dimension (ordered
 * levels). `dimension` tags which docs/68 dimension it serves (for rollups).
 */
export interface RubricCheck {
  id: string;
  kind: "noul" | "score";
  /** The judgment, stated completely (Jev never sees the id). */
  instructions: string;
  /** noul: {true,false} descriptions; score: ordered level array (2–10). */
  criteria?: { true: string; false: string } | string[];
  /** docs/68 dimension this check serves. */
  dimension?:
    | "grounding"
    | "specificity"
    | "insight"
    | "methodology"
    | "voice"
    | "commercial_realism"
    | "guardrail";
  /**
   * For a noul gate: the yes-probability at/above which the check PASSES.
   * For a "must NOT hold" guardrail (e.g. "contains a financial guarantee"),
   * set `failWhenYes: true` so a high yes-probability fails.
   */
  passAtOrAbove?: number;
  failWhenYes?: boolean;
  /** For a score: the minimum acceptable score (0-indexed level). */
  minScore?: number;
}

export interface CheckResult {
  id: string;
  kind: "noul" | "score";
  dimension?: RubricCheck["dimension"];
  /** noul: the yes-probability (0–1). */
  noul?: number;
  /** score: weighted level + confidence + per-level probabilities. */
  score?: number;
  confidence?: number;
  probabilities?: Record<string, number>;
  /** Resolved pass/fail for this check against its threshold. */
  passed: boolean;
}

export type JudgeStatus =
  | "judged" // Jev ran and returned verdicts
  | "unavailable" // Jev not configured
  | "error"; // Jev call failed

export interface JudgeVerdict {
  status: JudgeStatus;
  model: string | null;
  checks: CheckResult[];
  /** Overall gate: all checks passed. */
  passed: boolean;
  /** Count of failed checks, for a compact operator summary. */
  failedCount: number;
  message?: string;
}

// ---------------------------------------------------------------------------
// Reviewer (cross-family LLM)
// ---------------------------------------------------------------------------

export interface ReviewNote {
  dimension: RubricCheck["dimension"] | "other";
  severity: "high" | "medium" | "low";
  /** What's wrong + how to fix it, one sentence. */
  note: string;
}

export type ReviewStatus = "reviewed" | "unavailable" | "error";

export interface Review {
  status: ReviewStatus;
  model: string | null;
  notes: ReviewNote[];
  message?: string;
}

// ---------------------------------------------------------------------------
// The composed WRJ outcome around a candidate of type C
// ---------------------------------------------------------------------------

export interface WrjOutcome<C> {
  mode: "wrj";
  /** The final candidate (possibly revised). Same shape the single path emits. */
  candidate: C;
  review: Review;
  verdict: JudgeVerdict;
  /** How many revise passes ran (0 = writer draft accepted as-is). */
  revisions: number;
  writerModel: string | null;
}
