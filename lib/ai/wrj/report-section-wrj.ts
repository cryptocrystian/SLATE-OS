import "server-only";

import {
  synthesizeReportSectionDraft,
  charterFor,
  type ReportSectionDraftCandidate,
  type ReportSectionSynthesisResult,
} from "../report-section-synthesis";
import type { ReportSectionSynthesisContext } from "../report-section-context";
import { runWrj } from "./orchestrator";
import type { RubricCheck, WrjOutcome } from "./types";

/**
 * WRJ adapter for the report-section stage.
 *
 *   Writer   = the existing `synthesizeReportSectionDraft`, reused as-is
 *              (drafts ONE section; also runs the hard banned-claim scanner).
 *   Reviewer = cross-family LLM against docs/68 (report-section focus).
 *   Judge    = Jev checks below (grounding, charter_fit, voice, guardrail,
 *              specificity).
 *
 * Returns the SAME envelope `synthesizeReportSectionDraft` returns (a single
 * candidate), so the action treats it as a drop-in, plus a `wrj` field carrying
 * the review + verdict for the operator and for A/B against the single-model
 * path. No revise pass yet.
 *
 * Report sections differ from findings/opportunities in two ways that shape the
 * checks: (1) the writer already runs a hard financial-claim scanner that
 * REJECTS the candidate (so a claim never reaches persistence) — the Jev
 * guardrail here is a calibrated backstop, not the primary gate; (2) each
 * section has a distinct CHARTER (the specific job it does in the report), so
 * "charter fit" — does this section do its own job without re-narrating the
 * others — is the report-specific quality dimension findings/opportunities lack.
 */

export type ReportSectionWrjResult =
  | {
      ok: true;
      candidate: ReportSectionDraftCandidate;
      providerMeta: { provider: string; model: string };
      wrj: WrjOutcome<ReportSectionDraftCandidate>;
    }
  | { ok: false; error: string; message?: string };

// docs/68 report-section checks, phrased for Jev over
// { section, precedingSections, sourceContext }. Thresholds validated in-domain
// against a known-bad (meta-opener, filler slop, re-narrates siblings, a
// planted financial claim, off-charter) and known-good draft of the same
// section over the real Northpath context — see docs/73.
const REPORT_SECTION_CHECKS: RubricCheck[] = [
  {
    id: "grounding",
    kind: "noul",
    dimension: "grounding",
    instructions:
      "No claim in `section.summary` or `section.draftPreview` FABRICATES a specific fact, metric, quantity, percentage, date, quote, system name, or stakeholder statement that is absent from `sourceContext`. Reasonable synthesis and interpretation that connects the supplied facts is expected and does NOT count against this — the check fails only when the section invents concrete specifics the source context does not contain.",
    criteria: {
      true: "The section invents no specifics beyond the source context (synthesis of supplied facts is fine).",
      false: "The section fabricates a specific fact, metric, quote, or name absent from the source context.",
    },
    passAtOrAbove: 0.5,
  },
  {
    id: "charter_fit",
    kind: "noul",
    dimension: "methodology",
    instructions:
      "The section fulfills its OWN charter — the specific job described in `section.charter` — and does NOT merely re-narrate the material already covered by the sections listed in `precedingSections`. A section that restates the same findings the earlier sections already established, instead of doing its distinct job, fails.",
    criteria: {
      true: "The section does its own charter's job and builds on, rather than repeats, the preceding sections.",
      false: "The section drifts off its charter or re-narrates content the preceding sections already covered.",
    },
    passAtOrAbove: 0.6,
  },
  {
    id: "voice",
    kind: "score",
    dimension: "voice",
    instructions:
      "How well does the section read like a senior human consultant wrote it, rather than an AI content generator? Penalize meta-openers that describe the document ('This section...', 'This report...', 'In this section...', 'The following...'), marketing filler ('leverage', 'robust', 'seamless', 'holistic', 'unlock', 'empower', 'synergy', 'cutting-edge', 'world-class', 'path forward'), and prose that leads with description instead of the substantive point.",
    criteria: [
      "Reads like generated content — meta-opener and/or heavy filler; buries the point.",
      "Some consultant voice but noticeable filler or a weak, descriptive opening.",
      "Mostly a consultant voice — leads with the point, little filler.",
      "Indistinguishable from a senior human consultant — leads with the substantive point, no filler, varied structure.",
    ],
    minScore: 2,
  },
  {
    id: "guardrail_financial",
    kind: "noul",
    dimension: "guardrail",
    instructions:
      "Any field of `section` makes a financial, ROI, savings, cost-reduction, payback, break-even, hours-saved, or peer/industry benchmark GUARANTEE or quantified claim (e.g. 'will reduce costs 30%', 'payback in 6 months', 'top quartile', 'above average').",
    criteria: {
      true: "The section contains a financial/benchmark guarantee or quantified claim.",
      false: "The section contains no financial or benchmark claim.",
    },
    failWhenYes: true,
  },
  {
    id: "specificity",
    kind: "score",
    dimension: "specificity",
    instructions:
      "How specific is the section to THIS client — naming the systems, roles, and workflows from `sourceContext` (e.g. the specific disconnected tools, the manual processes) — rather than generic advisory language that could appear in any report?",
    criteria: [
      "Generic — could appear in any report; no named systems, roles, or workflows.",
      "Mostly generic with only occasional specifics.",
      "Mostly specific — names this client's systems, roles, and workflows.",
      "Highly specific — named systems, roles, and concrete operational detail throughout.",
    ],
    minScore: 2,
  },
];

const REVIEW_FOCUS =
  "This is ONE section of a multi-section AI advisory discovery report, each section with a distinct charter. Weight grounding in the supplied context, charter fit (does its own job without re-narrating earlier sections), consultant voice (no meta-openers, no marketing filler), specificity to this client's named systems, and the absence of financial/benchmark claims.";

function buildState(
  candidate: ReportSectionDraftCandidate,
  context: ReportSectionSynthesisContext,
) {
  const precedingSections = context.siblingSections
    .filter((s) => s.position < context.section.position && s.summary)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ title: s.title, summary: s.summary }));
  return {
    section: {
      sectionType: context.section.sectionType,
      title: candidate.sectionTitle,
      charter: charterFor(context.section.sectionType),
      summary: candidate.summary,
      draftPreview: candidate.draftPreview,
      evidenceNotes: candidate.evidenceNotes,
      assumptionsAndLimits: candidate.assumptionsAndLimits,
    },
    precedingSections,
    sourceContext: {
      findings: context.findings.map((f) => ({
        statement: f.statement,
        summary: f.summary,
        category: f.category,
        confidence: f.confidence,
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
      intake: context.intake.map((i) => ({
        role: i.role,
        status: i.status,
        responseQuality: i.responseQuality,
      })),
    },
  };
}

export async function synthesizeReportSectionDraftWrj(
  context: ReportSectionSynthesisContext,
): Promise<ReportSectionWrjResult> {
  // Run the writer first; on failure (incl. a hard claim-violation reject),
  // surface its envelope unchanged.
  const writerResult: ReportSectionSynthesisResult =
    await synthesizeReportSectionDraft(context);
  if (!writerResult.ok) return writerResult;
  const candidate = writerResult.candidate;

  // Reviewer + judge over the already-produced draft.
  const outcome = await runWrj<ReportSectionDraftCandidate>({
    writer: async () => candidate,
    toState: (c) => buildState(c, context),
    checks: REPORT_SECTION_CHECKS,
    reviewFocus: REVIEW_FOCUS,
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
  candidate: ReportSectionDraftCandidate,
): WrjOutcome<ReportSectionDraftCandidate> {
  return {
    mode: "wrj",
    candidate,
    review: { status: "error", model: null, notes: [], message: "orchestrator-null" },
    verdict: { status: "error", model: null, checks: [], passed: false, failedCount: 0 },
    revisions: 0,
    writerModel: null,
  };
}
