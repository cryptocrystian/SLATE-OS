import "server-only";

import { synthesizeDraftFindings } from "../findings-synthesis";
import type { FindingsSynthesisContext } from "../findings-context";
import type { DraftFindingCandidate, ProviderInvocationResult } from "../types";
import { runWrj } from "./orchestrator";
import type { RubricCheck, WrjOutcome } from "./types";

/**
 * WRJ adapter for the findings stage.
 *
 *   Writer   = the existing `synthesizeDraftFindings` (gpt-4o), reused as-is.
 *   Reviewer = cross-family LLM against docs/68 (findings focus).
 *   Judge    = Jev checks below (coverage, grounding, calibration, guardrail,
 *              specificity, insight).
 *
 * Returns the SAME envelope `synthesizeDraftFindings` returns, so the action
 * treats it as a drop-in, plus a `wrj` field carrying the review + verdict for
 * the operator and for A/B against the single-model path. No revise pass yet
 * (the writer prompt doesn't ingest feedback); the value here is surfacing
 * calibrated quality signals. Revise is a follow-up once the writer accepts
 * corrective instructions.
 */

export type FindingsWrjResult =
  | {
      ok: true;
      candidates: DraftFindingCandidate[];
      providerMeta: { provider: string; model: string };
      wrj: WrjOutcome<DraftFindingCandidate[]>;
    }
  | { ok: false; error: string; message?: string };

// docs/68 findings checks, phrased for Jev over { findings, sourceContext }.
const FINDINGS_CHECKS: RubricCheck[] = [
  {
    id: "coverage",
    kind: "noul",
    dimension: "methodology",
    instructions:
      "In the provided `state`, every stakeholder role in `sourceContext.intake` that raised a material operational issue is represented by at least one entry in `findings`. In particular, operations/delivery concerns (staffing, resourcing, capacity, stale operational data) are not dropped.",
    criteria: {
      true: "Every role with a material issue is represented in the findings.",
      false: "At least one role's material issue is missing from the findings.",
    },
    passAtOrAbove: 0.6,
  },
  {
    id: "grounding",
    kind: "noul",
    dimension: "grounding",
    instructions:
      "Every finding's claim in `findings` is supported by evidence present in `sourceContext.intake`. No finding asserts something the intake does not support.",
    criteria: {
      true: "All findings are grounded in the supplied intake evidence.",
      false: "At least one finding is not supported by the intake evidence.",
    },
    passAtOrAbove: 0.6,
  },
  {
    id: "calibration",
    kind: "noul",
    dimension: "grounding",
    instructions:
      "Each finding's `confidence` label is justified by its evidence: a claim resting on a single stakeholder's remark is not marked `high`. Confidence is calibrated, not uniformly high.",
    criteria: {
      true: "Confidence labels are honestly calibrated to evidence strength.",
      false: "Confidence is over-stated (e.g. single-source claims marked high).",
    },
    passAtOrAbove: 0.6,
  },
  {
    id: "guardrail_financial",
    kind: "noul",
    dimension: "guardrail",
    instructions:
      "Any finding makes a financial, ROI, savings, cost-reduction, payback, or peer/industry benchmark GUARANTEE or claim (e.g. 'will cut costs 30%', 'top quartile').",
    criteria: {
      true: "A finding contains a financial/benchmark guarantee or claim.",
      false: "No finding contains any financial or benchmark claim.",
    },
    failWhenYes: true,
  },
  {
    id: "specificity",
    kind: "score",
    dimension: "specificity",
    instructions:
      "How specific are the findings to THIS company, using named systems, roles, workflows, and numbers from the intake — rather than generic language that could describe any company?",
    criteria: [
      "Generic — could describe any company; no named systems, roles, or numbers.",
      "Mostly generic with only occasional specifics.",
      "Mostly specific — names this company's systems, roles, and workflows.",
      "Highly specific — named systems, roles, and concrete numbers throughout.",
    ],
    minScore: 2,
  },
  {
    id: "insight",
    kind: "score",
    dimension: "insight",
    instructions:
      "How insightful and decision-useful are the findings beyond restating what stakeholders said — do they synthesize across the intake into non-obvious observations a client would pay to learn?",
    criteria: [
      "Pure restatement of intake answers; no synthesis.",
      "Mostly restatement with slight synthesis.",
      "Real synthesis across stakeholders into useful observations.",
      "Sharp, non-obvious, decision-grade insight.",
    ],
    minScore: 2,
  },
];

const REVIEW_FOCUS =
  "These are 3–7 draft discovery findings for an AI advisory report. Weight coverage across stakeholders (especially operations/delivery), specificity (named systems/roles/volumes from the intake), honest confidence calibration, and grounding in the cited evidence.";

function buildState(
  candidates: DraftFindingCandidate[],
  context: FindingsSynthesisContext,
) {
  const bundle = context.evidenceBundle;
  const intake = bundle
    ? [...bundle.byLane.live_link, ...bundle.byLane.transcript, ...bundle.byLane.offline_operator].map(
        (e) => ({
          role: e.role,
          stakeholder: e.stakeholderName,
          question: e.questionLabel ?? e.questionId,
          answer: e.answerText,
        }),
      )
    : [];
  return {
    findings: candidates.map((c) => ({
      category: c.category,
      statement: c.statement,
      summary: c.summary,
      confidence: c.confidence,
      assumptionFlag: c.assumptionFlag,
      sourceRefs: (c.sourceRefs ?? []).map((r) => ({
        role: r.sourceRole ?? null,
        label: r.sourceLabel,
        strength: r.strength,
      })),
    })),
    sourceContext: {
      stakeholderRoles: bundle?.roleCoverage.map((r) => r.role) ?? [],
      intake,
    },
  };
}

export async function synthesizeDraftFindingsWrj(
  context: FindingsSynthesisContext,
): Promise<FindingsWrjResult> {
  // Run the writer first; on failure, surface its envelope unchanged.
  const writerResult: ProviderInvocationResult = await synthesizeDraftFindings(context);
  if (!writerResult.ok) return writerResult;
  const candidates = writerResult.candidates;

  // Reviewer + judge over the already-produced draft.
  const outcome = await runWrj<DraftFindingCandidate[]>({
    writer: async () => candidates,
    toState: (c) => buildState(c, context),
    checks: FINDINGS_CHECKS,
    reviewFocus: REVIEW_FOCUS,
  });

  if (!outcome) {
    // Writer returned candidates, so this should not happen; fall back to the
    // plain success envelope rather than failing.
    return { ok: true, candidates, providerMeta: writerResult.providerMeta, wrj: emptyOutcome(candidates) };
  }
  return {
    ok: true,
    candidates: outcome.candidate,
    providerMeta: writerResult.providerMeta,
    wrj: outcome,
  };
}

function emptyOutcome(candidates: DraftFindingCandidate[]): WrjOutcome<DraftFindingCandidate[]> {
  return {
    mode: "wrj",
    candidate: candidates,
    review: { status: "error", model: null, notes: [], message: "orchestrator-null" },
    verdict: { status: "error", model: null, checks: [], passed: false, failedCount: 0 },
    revisions: 0,
    writerModel: null,
  };
}
