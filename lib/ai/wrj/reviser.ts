import "server-only";

import type { Review, JudgeVerdict } from "./types";

/**
 * Reviser feedback builder.
 *
 * Turns the reviewer's notes + the judge's failed checks into one corrective
 * instruction block that a stage writer appends to its prompt for a bounded
 * revise pass. The writer then re-drafts; the orchestrator re-reviews and
 * re-judges. This is advisory self-correction — it makes the draft better
 * before the permanent human gate; it never replaces it.
 *
 * Guidance is keyed by check id so each stage's checks map to a concrete,
 * actionable correction. Unknown ids fall back to the check's dimension.
 */

const CHECK_GUIDANCE: Record<string, string> = {
  coverage:
    "Cover the material stakeholder concerns or problems that the previous draft missed.",
  grounding:
    "Remove anything not supported by the supplied evidence. Do not fabricate specifics — no invented numbers, percentages, dates, quotes, or system names.",
  calibration:
    "Calibrate confidence and scores to the actual evidence strength — do not mark everything high confidence or score everything as a low-complexity quick win.",
  guardrail_financial:
    "Remove ALL financial, ROI, savings, cost-reduction, payback, hours-saved, and peer/industry benchmark claims.",
  specificity:
    "Name this client's actual systems, roles, workflows, and concrete operational detail instead of generic language that could describe any company.",
  charter_fit:
    "Do THIS section's own specific job (per its charter). Do not re-narrate material the earlier sections already established — build on it in a clause at most.",
  voice:
    "Lead with the substantive point in the first sentence. Cut meta-openers (\"This section…\", \"This report…\", \"The following…\") and marketing filler (\"leverage\", \"robust\", \"seamless\", \"holistic\", \"unlock\", \"empower\", \"synergy\", \"path forward\"). Vary sentence length and structure.",
  actionability:
    "Make each implementation shape and recommended action concrete and scopeable — a specific system, integration, or workflow change — not a vague aspiration.",
};

function guidanceFor(checkId: string, dimension?: string): string {
  return (
    CHECK_GUIDANCE[checkId] ??
    (dimension
      ? `Improve the "${dimension}" quality of the draft.`
      : `Address the "${checkId}" check that did not pass.`)
  );
}

/**
 * Build the corrective instruction for a revise pass, or null when there is
 * nothing actionable to correct (no failed checks and no notes worth acting on).
 */
export function buildReviseInstruction(
  review: Review,
  verdict: JudgeVerdict,
): string | null {
  const failed =
    verdict.status === "judged" ? verdict.checks.filter((c) => !c.passed) : [];
  // Reviewer notes worth acting on: high + medium severity (low is noise).
  const notes =
    review.status === "reviewed"
      ? review.notes.filter((n) => n.severity !== "low")
      : [];

  if (failed.length === 0 && notes.length === 0) return null;

  const parts: string[] = [
    "REVISION FEEDBACK — your previous draft was reviewed and must be improved. Produce a FULLY REWRITTEN draft in the same JSON schema that resolves every point below. Do not mention, acknowledge, or reference this feedback in the output — just return the improved draft.",
  ];

  if (failed.length > 0) {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const c of failed) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      lines.push(`- ${guidanceFor(c.id, c.dimension)}`);
    }
    parts.push("Quality checks that did not pass — fix each:\n" + lines.join("\n"));
  }

  if (notes.length > 0) {
    const lines = notes
      .map((n) => `- [${n.dimension}/${n.severity}] ${n.note}`)
      .join("\n");
    parts.push("Reviewer notes — address each:\n" + lines);
  }

  return parts.join("\n\n");
}
