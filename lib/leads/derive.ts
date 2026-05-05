import type { Answers, ScoreResult } from "@/lib/scorecard/types";

export interface DerivedFitDimension {
  dimensionId:
    | "business_value"
    | "budget"
    | "pain_intensity"
    | "technical_readiness"
    | "buyer_readiness"
    | "expansion";
  value: number; // 0–100
  note: string;
}

export interface DerivedQualificationSignal {
  label: string;
  detail: string;
  direction: "positive" | "watch" | "negative";
  position: number;
}

export interface DerivedLeadStatus {
  status:
    | "new"
    | "needs_review"
    | "high_fit"
    | "diagnostic_requested"
    | "nurture"
    | "disqualified"
    | "converted";
  recommendedAction: { headline: string; detail: string; cta: string };
}

const SIZE_VALUE: Record<string, number> = {
  "1-10": 25,
  "11-50": 55,
  "51-200": 80,
  "201-1000": 85,
  "1000+": 70,
};

const TIMELINE_BUYER_READINESS: Record<string, number> = {
  "this-quarter": 90,
  "next-quarter": 70,
  "this-year": 50,
  exploring: 25,
};

const INVESTMENT_BUDGET: Record<string, number> = {
  "under-25k": 25,
  "25-75k": 60,
  "75-200k": 80,
  "200k+": 90,
  unsure: 45,
};

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function lookup(
  table: Record<string, number>,
  key: string | undefined,
  fallback: number,
): number {
  if (!key) return fallback;
  const v = table[key];
  return typeof v === "number" ? v : fallback;
}

/**
 * Derive six lead fit dimensions from scorecard answers + the computed
 * score result. Values are 0–100 directional and never inferred from the
 * internal fit score directly (that's stored separately on the lead row).
 */
export function deriveFitDimensions(
  answers: Answers,
  result: ScoreResult,
): DerivedFitDimension[] {
  const goal = asString(answers["business.goal"]);
  const size = asString(answers["company.size"]);
  const timeline = asString(answers["urgency.timeline"]);
  const investment = asString(answers["urgency.investment"]);

  const businessValue = goal === "explore" ? 30 : goal ? 70 : 50;
  const budget = lookup(INVESTMENT_BUDGET, investment, 50);
  const buyerReadiness = lookup(TIMELINE_BUYER_READINESS, timeline, 50);
  const expansion = lookup(SIZE_VALUE, size, 50);

  return [
    {
      dimensionId: "business_value",
      value: clamp(businessValue),
      note:
        goal === "explore"
          ? "Self-reported goal is exploratory — leverage is uncertain."
          : "Self-reported commercial goal is concrete enough to pursue.",
    },
    {
      dimensionId: "budget",
      value: clamp(budget),
      note: investment
        ? `Self-reported investment band: ${investment}.`
        : "No investment band reported; default mid-band.",
    },
    {
      dimensionId: "pain_intensity",
      value: clamp(result.friction),
      note: "Mirrors prospect-facing Workflow Friction score.",
    },
    {
      dimensionId: "technical_readiness",
      value: clamp(result.systems),
      note: "Mirrors prospect-facing Systems Readiness score.",
    },
    {
      dimensionId: "buyer_readiness",
      value: clamp(buyerReadiness),
      note: timeline
        ? `Self-reported timeline: ${timeline}.`
        : "No timeline reported; default mid-band.",
    },
    {
      dimensionId: "expansion",
      value: clamp(expansion),
      note: size
        ? `Self-reported headcount band: ${size}.`
        : "No headcount band reported; default mid-band.",
    },
  ];
}

/**
 * Derive a small set of internal qualification signals from answers +
 * scoring. These never appear on public surfaces.
 */
export function deriveQualificationSignals(
  answers: Answers,
  result: ScoreResult,
): DerivedQualificationSignal[] {
  const out: DerivedQualificationSignal[] = [];
  let position = 0;

  const goal = asString(answers["business.goal"]);
  if (goal === "explore") {
    out.push({
      label: "Exploratory goal",
      detail:
        "Top goal answer is 'exploring what's possible.' Risk of soft commercial commitment.",
      direction: "negative",
      position: position++,
    });
  } else if (goal) {
    out.push({
      label: "Concrete commercial goal",
      detail: `Self-reported goal: ${goal}.`,
      direction: "positive",
      position: position++,
    });
  }

  const timeline = asString(answers["urgency.timeline"]);
  if (timeline === "this-quarter" || timeline === "next-quarter") {
    out.push({
      label: "Near-term timeline",
      detail: `Wants a path forward ${timeline.replace("-", " ")}.`,
      direction: "positive",
      position: position++,
    });
  } else if (timeline === "exploring") {
    out.push({
      label: "No timeline",
      detail: "Self-reported as exploratory — slow conversion path.",
      direction: "watch",
      position: position++,
    });
  }

  const investment = asString(answers["urgency.investment"]);
  if (investment === "200k+" || investment === "75-200k") {
    out.push({
      label: "Material investment band",
      detail: `Self-reported investment band: ${investment}.`,
      direction: "positive",
      position: position++,
    });
  } else if (investment === "under-25k") {
    out.push({
      label: "Below sprint floor",
      detail:
        "Self-reported investment band is below the AI Opportunity Sprint engagement floor.",
      direction: "negative",
      position: position++,
    });
  }

  if (result.friction >= 65) {
    out.push({
      label: "High workflow friction",
      detail:
        "Friction score signals real day-to-day cost — strongest indicator that AI can land.",
      direction: "positive",
      position: position++,
    });
  }
  if (result.systems < 45) {
    out.push({
      label: "Foundation work likely first",
      detail:
        "Systems Readiness is low — foundation work usually needs to land before AI rollout.",
      direction: "watch",
      position: position++,
    });
  }

  const sensitivity = asString(answers["data.sensitivity"]);
  if (sensitivity === "regulated") {
    out.push({
      label: "Regulated data",
      detail: "Requires explicit governance and human-in-the-loop review.",
      direction: "watch",
      position: position++,
    });
  }

  return out;
}

/**
 * Map classification + internal fit to an initial lead status and a
 * recommended-action block stored on the lead row. Operators retriage
 * later via the (still-mock) lead dashboard.
 */
export function deriveLeadStatus(
  result: ScoreResult,
): DerivedLeadStatus {
  const classificationId = result.classification.id;
  const fit = result.fit;

  if (classificationId === "not-ready") {
    return {
      status: "disqualified",
      recommendedAction: {
        headline: "Education path",
        detail:
          "Foundations not yet in place. Send education resources and re-evaluate next quarter.",
        cta: "Send education path",
      },
    };
  }
  if (classificationId === "strategic" || fit >= 75) {
    return {
      status: "high_fit",
      recommendedAction: {
        headline: "Move into AI Systems Review",
        detail:
          "Internal fit is strong. Move quickly into a paid AI Opportunity Sprint.",
        cta: "Open AI Systems Review",
      },
    };
  }
  if (fit >= 50) {
    return {
      status: "needs_review",
      recommendedAction: {
        headline: "Triage on the lead inbox",
        detail:
          "Mixed signals — review qualification dimensions before scheduling discovery.",
        cta: "Open lead",
      },
    };
  }
  return {
    status: "nurture",
    recommendedAction: {
      headline: "Nurture",
      detail:
        "Real interest, but not sprint-ready yet. Stay in touch and re-evaluate next quarter.",
      cta: "Add to nurture",
    },
  };
}
