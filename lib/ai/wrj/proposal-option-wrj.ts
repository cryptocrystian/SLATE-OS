import "server-only";

import {
  synthesizeProposalOptionDraft,
  charterFor,
  type ProposalOptionDraftCandidate,
  type ProposalOptionSynthesisResult,
} from "../proposal-option-synthesis";
import type { ProposalOptionSynthesisContext } from "../proposal-option-context";
import { runWrj } from "./orchestrator";
import { buildReviseInstruction } from "./reviser";
import type { RubricCheck, WrjOutcome } from "./types";

/**
 * WRJ adapter for the proposal-option stage.
 *
 *   Writer   = the existing `synthesizeProposalOptionDraft`, reused as-is
 *              (drafts ONE option; also runs the hard financial + commercial-
 *              finality claim scanner).
 *   Reviewer = cross-family LLM against docs/68 (proposal focus).
 *   Judge    = Jev checks below (grounding, differentiation, best_fit_clarity,
 *              voice, guardrail_commercial, specificity).
 *
 * Returns the SAME single-candidate envelope `synthesizeProposalOptionDraft`
 * returns, plus a `wrj` field. Bounded revise pass (maxRevisions 1) via the
 * shared reviser.
 *
 * Proposal options are the buying-decision artifact, so two dimensions matter
 * here that the report stage doesn't have: (1) DIFFERENTIATION — each option
 * must be visibly distinct from its siblings (per its option-type charter), not
 * the same scope reworded; (2) BEST-FIT CLARITY — `bestFitScenario` must be a
 * "choose this when…" judgment, not a restatement of the scope. The financial
 * guardrail also covers commercial-finality language ("ready for signature",
 * "binding quote") as a backstop to the writer's hard scanner.
 */

export type ProposalOptionWrjResult =
  | {
      ok: true;
      candidate: ProposalOptionDraftCandidate;
      providerMeta: { provider: string; model: string };
      wrj: WrjOutcome<ProposalOptionDraftCandidate>;
    }
  | { ok: false; error: string; message?: string };

// docs/68 proposal-option checks, phrased for Jev over
// { option, otherOptions, sourceContext }. Validated in-domain against a
// known-bad (meta-opener, filler, bestFit restates scope, same scope as a
// sibling, a planted "ready for signature"/ROI claim, generic) and known-good
// draft over the real Northpath context — see docs/73.
const PROPOSAL_OPTION_CHECKS: RubricCheck[] = [
  {
    id: "grounding",
    kind: "noul",
    dimension: "grounding",
    instructions:
      "No claim in `option.bestFitScenario`, `option.scopeNarrative`, or `option.deliverables` FABRICATES a specific fact, metric, quantity, dollar figure, date, quote, or system/opportunity name that is absent from `sourceContext`. Reasonable synthesis of the supplied opportunities/roadmap/report content is expected; the check fails only when the option invents concrete specifics the context does not contain.",
    criteria: {
      true: "The option invents no specifics beyond the source context (synthesis is fine).",
      false: "The option fabricates a specific fact, figure, quote, or name absent from the source context.",
    },
    passAtOrAbove: 0.5,
  },
  {
    id: "differentiation",
    kind: "noul",
    dimension: "methodology",
    instructions:
      "The option fulfills its OWN charter — the distinct commercial positioning in `option.charter` — and is visibly DIFFERENT from the options in `otherOptions` on depth, commitment, and outcome. An option that rewords a sibling's scope, or that does not match its charter's tier (quick-win build vs full system vs managed partner), fails.",
    criteria: {
      true: "The option matches its charter's tier and is distinct from the other options.",
      false: "The option drifts off its charter tier or rewords another option's scope.",
    },
    passAtOrAbove: 0.6,
  },
  {
    id: "best_fit_clarity",
    kind: "noul",
    dimension: "commercial_realism",
    instructions:
      "`option.bestFitScenario` is a crisp 'choose THIS option when…' buyer-fit judgment — the trigger conditions and client profile this option suits — NOT a restatement of the scope or a summary of what the option does.",
    criteria: {
      true: "bestFitScenario states when a buyer should choose this option.",
      false: "bestFitScenario restates the scope instead of giving a buyer-fit judgment.",
    },
    passAtOrAbove: 0.55,
  },
  {
    id: "voice",
    kind: "score",
    dimension: "voice",
    instructions:
      "How well does the option read like a senior consultant wrote a buying-decision document, rather than an AI content generator or a brochure? Penalize meta-openers ('This option…', 'This proposal…', 'The following…'), marketing filler ('leverage', 'robust', 'seamless', 'holistic', 'unlock', 'empower', 'synergy', 'tailored solution', 'bespoke', 'world-class'), and prose that leads with description instead of substance.",
    criteria: [
      "Reads like generated/brochure content — meta-opener and/or heavy filler.",
      "Some consultant voice but noticeable filler or a weak opening.",
      "Mostly a consultant voice — leads with substance, little filler.",
      "Indistinguishable from a senior consultant — concrete, decision-grade, no filler.",
    ],
    // Floor 1.5 (not 2) — validated in-domain: Jev scores even genuinely-good,
    // dense proposal prose ~1.6-1.9 on voice (with low confidence ~0.4), while
    // brochure/meta-opener prose scores <0.5. A floor of 2 would false-positive
    // on good prose; 1.5 cleanly separates good (pass) from brochure (fail).
    // See docs/73. (The report stage keeps 2 — its GOOD prose cleared 2.36.)
    minScore: 1.5,
  },
  {
    id: "guardrail_commercial",
    kind: "noul",
    dimension: "guardrail",
    instructions:
      "Any field of `option` makes a prohibited claim: a financial/ROI/savings/payback/break-even/benchmark GUARANTEE, a dollar figure or pricing math, OR commercial-finality language ('ready for signature', 'approved by finance', 'final commercial terms', 'binding quote', 'binding offer', 'executed SOW'). The proposal is a planning draft.",
    criteria: {
      true: "The option contains a financial/pricing claim or commercial-finality language.",
      false: "The option contains no financial, pricing, or commercial-finality claim.",
    },
    failWhenYes: true,
  },
  {
    id: "specificity",
    kind: "score",
    dimension: "specificity",
    instructions:
      "How specific is the option to THIS client — naming the actual workstreams, systems, and opportunities from `sourceContext` and concrete phase lengths — rather than generic proposal language that could be sent to any client?",
    criteria: [
      "Generic — could be sent to any client; no named workstreams, systems, or phases.",
      "Mostly generic with only occasional specifics.",
      "Mostly specific — names this client's workstreams, systems, and phasing.",
      "Highly specific — named workstreams, systems, opportunities, and concrete phasing throughout.",
    ],
    minScore: 2,
  },
];

const REVIEW_FOCUS =
  "This is ONE option of a multi-option client proposal (a buying-decision document), each option a distinct commercial tier. Weight grounding in the supplied context, differentiation from the sibling options, a sharp 'choose this when' best-fit judgment, consultant voice (no meta-openers, no brochure filler), specificity to this client's named workstreams, and the absence of financial/pricing/commercial-finality claims.";

function buildState(
  candidate: ProposalOptionDraftCandidate,
  context: ProposalOptionSynthesisContext,
) {
  const otherOptions = context.siblingOptions
    .filter((o) => o.scopeSummary)
    .sort((a, b) => a.position - b.position)
    .map((o) => ({
      title: o.title,
      optionType: o.optionType,
      scopeSummary: o.scopeSummary,
    }));
  return {
    option: {
      optionType: context.option.optionType,
      title: candidate.optionTitle,
      charter: charterFor(context.option.optionType),
      bestFitScenario: candidate.bestFitScenario,
      scopeNarrative: candidate.scopeNarrative,
      timeline: candidate.timeline,
      deliverables: candidate.deliverables,
      assumptions: candidate.assumptions,
      dependencies: candidate.dependencies,
      risks: candidate.risks,
    },
    otherOptions,
    sourceContext: {
      findings: context.findings.map((f) => ({
        statement: f.statement,
        summary: f.summary,
        category: f.category,
      })),
      opportunities: context.opportunities.map((o) => ({
        title: o.title,
        description: o.description,
        category: o.category,
        quadrant: o.quadrant,
      })),
      roadmap: context.roadmap.map((r) => ({
        title: r.title,
        phase: r.phase,
        objective: r.objective,
      })),
      reportSections: context.reportSections.map((s) => ({
        title: s.title,
        summary: s.summary,
      })),
    },
  };
}

export async function synthesizeProposalOptionDraftWrj(
  context: ProposalOptionSynthesisContext,
): Promise<ProposalOptionWrjResult> {
  // Run the writer first; on failure (incl. a hard claim-violation reject),
  // surface its envelope unchanged.
  const writerResult: ProposalOptionSynthesisResult =
    await synthesizeProposalOptionDraft(context);
  if (!writerResult.ok) return writerResult;
  const candidate = writerResult.candidate;

  // Reviewer + judge over the draft, with a bounded revise pass.
  const outcome = await runWrj<ProposalOptionDraftCandidate>({
    writer: async () => candidate,
    toState: (c) => buildState(c, context),
    checks: PROPOSAL_OPTION_CHECKS,
    reviewFocus: REVIEW_FOCUS,
    maxRevisions: 1,
    revise: async (_candidate, review, verdict) => {
      const feedback = buildReviseInstruction(review, verdict);
      if (!feedback) return null;
      const revised = await synthesizeProposalOptionDraft(context, feedback);
      return revised.ok ? revised.candidate : null;
    },
  });

  if (!outcome) {
    return {
      ok: true,
      candidate,
      providerMeta: writerResult.providerMeta,
      wrj: emptyOutcome(candidate),
    };
  }
  return {
    ok: true,
    candidate: outcome.candidate,
    providerMeta: writerResult.providerMeta,
    wrj: outcome,
  };
}

function emptyOutcome(
  candidate: ProposalOptionDraftCandidate,
): WrjOutcome<ProposalOptionDraftCandidate> {
  return {
    mode: "wrj",
    candidate,
    review: { status: "error", model: null, notes: [], message: "orchestrator-null" },
    verdict: { status: "error", model: null, checks: [], passed: false, failedCount: 0 },
    revisions: 0,
    writerModel: null,
  };
}
