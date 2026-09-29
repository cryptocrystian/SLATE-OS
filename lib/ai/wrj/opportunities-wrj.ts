import "server-only";

import { synthesizeDraftOpportunities } from "../opportunities-synthesis";
import type { OpportunitySynthesisContext } from "../opportunities-context";
import type {
  DraftOpportunityCandidate,
  OpportunityProviderInvocationResult,
} from "../types";
import { runWrj } from "./orchestrator";
import type { RubricCheck, WrjOutcome } from "./types";

/**
 * WRJ adapter for the opportunities stage.
 *
 *   Writer   = the existing `synthesizeDraftOpportunities`, reused as-is.
 *   Reviewer = cross-family LLM against docs/68 (opportunities focus).
 *   Judge    = Jev checks below (coverage, grounding, calibration, guardrail,
 *              specificity, actionability).
 *
 * Returns the SAME envelope `synthesizeDraftOpportunities` returns, so the
 * action treats it as a drop-in, plus a `wrj` field carrying the review +
 * verdict for the operator and for A/B against the single-model path. No revise
 * pass yet (the writer prompt doesn't ingest feedback); the value here is
 * surfacing calibrated quality signals. Revise is a follow-up once the writer
 * accepts corrective instructions.
 */

export type OpportunitiesWrjResult =
  | {
      ok: true;
      candidates: DraftOpportunityCandidate[];
      providerMeta: { provider: string; model: string };
      wrj: WrjOutcome<DraftOpportunityCandidate[]>;
    }
  | { ok: false; error: string; message?: string };

// docs/68 opportunities checks, phrased for Jev over
// { opportunities, sourceContext }. Distinct from the findings gate: findings
// are observations; opportunities are decision-grade proposals whose
// impact/complexity/risk scores DRIVE the downstream quadrant + priority, so
// score calibration and actionability matter here in a way they don't for
// findings. Thresholds validated in-domain against a known-bad (generic,
// all-quick-win, overreaching) and known-good draft over the real Northpath
// approved findings — see docs/73.
const OPPORTUNITY_CHECKS: RubricCheck[] = [
  {
    id: "coverage",
    kind: "noul",
    dimension: "methodology",
    instructions:
      "The opportunities collectively address the MOST MATERIAL problems in `sourceContext.findings` — in particular the highest-impact operational problems: disconnected/unintegrated core systems and major manual back-office work (timesheets, invoicing, and proposal/report production). Opportunities are a prioritized SUBSET, so not every finding needs its own opportunity — constraints like adoption resistance or confidentiality may be reflected as risks rather than standalone opportunities. The test is only whether the biggest problems each have at least one opportunity that would move them.",
    criteria: {
      true: "Each of the biggest operational problems is addressed by at least one opportunity.",
      false: "A top material problem (disconnected systems or major manual back-office work) has no opportunity addressing it.",
    },
    passAtOrAbove: 0.6,
  },
  {
    id: "grounding",
    kind: "noul",
    dimension: "grounding",
    instructions:
      "Every opportunity in `opportunities` is supported by the findings it links to in `sourceContext.findings`. No opportunity proposes solving a problem, or asserts a capability/pain, that its linked findings do not actually support (no scope invented beyond the evidence).",
    criteria: {
      true: "Every opportunity is grounded in its linked findings.",
      false: "At least one opportunity overreaches beyond its linked findings.",
    },
    passAtOrAbove: 0.55,
  },
  {
    id: "calibration",
    kind: "noul",
    dimension: "commercial_realism",
    instructions:
      "The opportunity scores are calibrated, not uniformly optimistic. It is NOT the case that nearly every opportunity is scored as a low-complexity, low-risk, high-impact quick win. Genuine systems-integration or governance work carries real complexity/risk. Also `evidenceStrength` tracks provenance: an opportunity whose linked findings are all `needsValidation = true` is not marked `strong`.",
    criteria: {
      true: "Scores and evidence strength are differentiated and plausible.",
      false: "Scores are uniformly optimistic or evidence strength ignores weak provenance.",
    },
    passAtOrAbove: 0.5,
  },
  {
    id: "guardrail_financial",
    kind: "noul",
    dimension: "guardrail",
    instructions:
      "Any opportunity's description, sourceSummary, recommendedAction, or implementationShape makes a financial, ROI, savings, cost-reduction, payback, hours-saved, or peer/industry benchmark GUARANTEE or quantified claim (e.g. 'will cut costs 30%', 'saves 10 hours/week', 'top quartile').",
    criteria: {
      true: "An opportunity contains a financial/benchmark guarantee or quantified claim.",
      false: "No opportunity contains any financial or benchmark claim.",
    },
    failWhenYes: true,
  },
  {
    id: "specificity",
    kind: "score",
    dimension: "specificity",
    instructions:
      "How specific are the opportunities to THIS company — naming the systems, workflows, and roles from `sourceContext.findings` (e.g. the specific disconnected tools, the manual processes named) — rather than generic AI-consulting boilerplate that could be proposed to any company?",
    criteria: [
      "Generic — could be proposed to any company; no named systems, workflows, or roles.",
      "Mostly generic with only occasional specifics.",
      "Mostly specific — names this company's systems, workflows, and roles.",
      "Highly specific — named systems, workflows, and concrete operational detail throughout.",
    ],
    minScore: 2,
  },
  {
    id: "actionability",
    kind: "score",
    dimension: "methodology",
    instructions:
      "How actionable are the opportunities — do `implementationShape` and `recommendedAction` describe a concrete, decision-grade implementation concept (a specific system, integration, or workflow change a consultant could scope) rather than a vague aspiration ('leverage AI', 'improve efficiency')?",
    criteria: [
      "Vague aspiration — no concrete implementation concept.",
      "Some direction but mostly high-level.",
      "Mostly concrete — a scopeable implementation concept for most opportunities.",
      "Highly concrete — specific, scopeable implementation shapes throughout.",
    ],
    minScore: 2,
  },
];

const REVIEW_FOCUS =
  "These are 2–6 draft AI opportunities for an advisory report, each derived from consultant-approved findings. Weight grounding in the linked findings (no invented scope), calibrated impact/complexity/risk scores (not everything is a quick win), specificity to this company's named systems and workflows, and concrete, scopeable implementation shapes.";

function buildState(
  candidates: DraftOpportunityCandidate[],
  context: OpportunitySynthesisContext,
) {
  const findingById = new Map(
    context.findings.map((f) => [f.findingId, f]),
  );
  return {
    opportunities: candidates.map((c) => ({
      title: c.title,
      category: c.category,
      description: c.description,
      businessImpactScore: c.businessImpactScore,
      complexityScore: c.complexityScore,
      riskScore: c.riskScore,
      timeToValueScore: c.timeToValueScore,
      adoptionLikelihoodScore: c.adoptionLikelihoodScore,
      strategicValueScore: c.strategicValueScore,
      evidenceStrength: c.evidenceStrength,
      sourceSummary: c.sourceSummary,
      recommendedAction: c.recommendedAction,
      implementationShape: c.implementationShape,
      linkedFindings: c.linkedFindingIds.map((id) => {
        const f = findingById.get(id);
        return f
          ? {
              statement: f.statement,
              summary: f.summary,
              confidence: f.confidence,
              needsValidation: f.needsValidation,
              assumptionFlag: f.assumptionFlag,
            }
          : { statement: "(linked finding not in context)", summary: null };
      }),
    })),
    sourceContext: {
      findings: context.findings.map((f) => ({
        statement: f.statement,
        summary: f.summary,
        category: f.category,
        confidence: f.confidence,
        needsValidation: f.needsValidation,
        assumptionFlag: f.assumptionFlag,
      })),
    },
  };
}

export async function synthesizeDraftOpportunitiesWrj(
  context: OpportunitySynthesisContext,
): Promise<OpportunitiesWrjResult> {
  // Run the writer first; on failure, surface its envelope unchanged.
  const writerResult: OpportunityProviderInvocationResult =
    await synthesizeDraftOpportunities(context);
  if (!writerResult.ok) return writerResult;
  const candidates = writerResult.candidates;

  // Reviewer + judge over the already-produced draft.
  const outcome = await runWrj<DraftOpportunityCandidate[]>({
    writer: async () => candidates,
    toState: (c) => buildState(c, context),
    checks: OPPORTUNITY_CHECKS,
    reviewFocus: REVIEW_FOCUS,
  });

  if (!outcome) {
    // Writer returned candidates, so this should not happen; fall back to the
    // plain success envelope rather than failing.
    return {
      ok: true,
      candidates,
      providerMeta: writerResult.providerMeta,
      wrj: emptyOutcome(candidates),
    };
  }
  return {
    ok: true,
    candidates: outcome.candidate,
    providerMeta: writerResult.providerMeta,
    wrj: outcome,
  };
}

function emptyOutcome(
  candidates: DraftOpportunityCandidate[],
): WrjOutcome<DraftOpportunityCandidate[]> {
  return {
    mode: "wrj",
    candidate: candidates,
    review: { status: "error", model: null, notes: [], message: "orchestrator-null" },
    verdict: { status: "error", model: null, checks: [], passed: false, failedCount: 0 },
    revisions: 0,
    writerModel: null,
  };
}
