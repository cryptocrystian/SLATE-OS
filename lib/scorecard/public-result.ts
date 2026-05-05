import type { ScoreResult } from "./types";

/**
 * Public-facing scorecard result shape. Identical to {@link ScoreResult}
 * with the **internal** `fit` score deliberately removed. Anything the
 * public scorecard API returns to the browser must conform to this shape
 * — `fit` is operator-only and only ever touches the database column
 * `scorecard_submissions.internal_fit_score`.
 */
export type PublicScoreResult = Omit<ScoreResult, "fit">;

export function toPublicScoreResult(result: ScoreResult): PublicScoreResult {
  // Explicit allowlist of public fields. If the upstream shape grows new
  // operator-only fields, they stay out of the public response by default.
  return {
    ai: result.ai,
    friction: result.friction,
    systems: result.systems,
    classification: result.classification,
    opportunities: result.opportunities,
    riskNotes: result.riskNotes,
  };
}
