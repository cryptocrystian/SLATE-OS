import "server-only";

import { reviewCandidate } from "./reviewer";
import { judgeCandidate } from "./jev-judge";
import type { RubricCheck, Review, JudgeVerdict, WrjOutcome } from "./types";

/**
 * Writer · Reviewer · Judge orchestrator.
 *
 * DESIGN
 * ------
 *   writer  → produces the draft (the existing per-stage synthesis, reused)
 *   reviewer→ cross-family LLM critiques it against docs/68 (advisory notes)
 *   judge   → Jev returns typed, calibrated pass/fail + probabilities
 *   revise  → (optional) apply reviewer+judge feedback, bounded, then re-judge
 *
 * The loop is generic over the stage's candidate type `C`. A stage adapter
 * supplies the writer, how to serialize the candidate for review/judging, the
 * Jev checks, and an optional reviser. The orchestrator NEVER blocks: it
 * always returns the best candidate it has plus the review + verdict as
 * metadata. The permanent human-approval gate remains the actual gate; WRJ
 * makes the draft better and surfaces calibrated quality signals to the
 * operator — it does not auto-approve or auto-reject.
 *
 * Reviewer and judge run in parallel over the same draft (they are
 * independent). Both degrade gracefully: an unavailable/errored reviewer or
 * judge yields a status marker, not a thrown error, so the WRJ candidate is
 * always usable.
 */

export interface WrjStage<C> {
  /** Produce the draft. Return null on writer failure (caller falls back). */
  writer: () => Promise<C | null>;
  /** Serialize candidate (+ the source context it should be grounded in). */
  toState: (candidate: C) => unknown;
  /** Jev rubric checks for this stage. */
  checks: RubricCheck[];
  /** Optional stage-specific emphasis appended to the reviewer's bar. */
  reviewFocus?: string;
  /**
   * Optional reviser: given the draft + review + verdict, produce an improved
   * draft (or null to keep the current one). Runs at most `maxRevisions` times
   * and only while the judge still reports failures.
   */
  revise?: (
    candidate: C,
    review: Review,
    verdict: JudgeVerdict,
  ) => Promise<C | null>;
  /** Max revise passes. Default 1 (bounded — avoid open-ended loops). */
  maxRevisions?: number;
}

export async function runWrj<C>(stage: WrjStage<C>): Promise<WrjOutcome<C> | null> {
  const writerModel = process.env.SLATE_AI_FINDINGS_MODEL ?? null; // best-effort tag
  const first = await stage.writer();
  if (first === null) return null; // writer failed — caller uses the single path / surfaces the error

  let candidate = first;
  let [review, verdict] = await Promise.all([
    reviewCandidate(stage.toState(candidate), stage.reviewFocus),
    judgeCandidate(stage.toState(candidate), stage.checks),
  ]);

  let revisions = 0;
  const maxRevisions = stage.maxRevisions ?? 1;
  while (
    stage.revise &&
    revisions < maxRevisions &&
    verdict.status === "judged" &&
    !verdict.passed
  ) {
    const revised = await stage.revise(candidate, review, verdict);
    if (!revised) break;
    candidate = revised;
    revisions += 1;
    // Re-judge the revision; re-review too so the notes track the new draft.
    [review, verdict] = await Promise.all([
      reviewCandidate(stage.toState(candidate), stage.reviewFocus),
      judgeCandidate(stage.toState(candidate), stage.checks),
    ]);
  }

  return { mode: "wrj", candidate, review, verdict, revisions, writerModel };
}
