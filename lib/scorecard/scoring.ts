import { QUESTIONS } from "./questions";
import type {
  Answers,
  Choice,
  Dimension,
  OpportunityArea,
  ResultClassification,
  ScoreResult,
} from "./types";

const DIMENSIONS: Dimension[] = ["ai", "friction", "systems", "fit"];

const BASELINE = 35; // every prospect starts in the middle of the band

const OPPORTUNITY_LIBRARY: Record<string, OpportunityArea> = {
  "data-reconciliation": {
    id: "data-reconciliation",
    title: "Cross-system data reconciliation",
    category: "AI Systems",
    summary:
      "Repetitive reconciliation across multiple systems is a frequent quick-win surface for AI-assisted workflows.",
    validationNote:
      "Validate the actual systems, volumes, and exception rate in a paid Opportunity Sprint.",
  },
  "manual-reporting": {
    id: "manual-reporting",
    title: "Operating reports and dashboards",
    category: "AI Systems",
    summary:
      "AI-assisted summarization and pattern detection can compress reporting cycles when the underlying data is clean.",
    validationNote:
      "Confirm data quality and decision use of the report before building.",
  },
  "client-comms": {
    id: "client-comms",
    title: "Client communication and follow-up",
    category: "AdvisoryOps",
    summary:
      "AI drafting paired with human review can reduce response latency without giving up voice or judgment.",
    validationNote:
      "Verify content sensitivity and approval workflow with stakeholders.",
  },
  "doc-review": {
    id: "doc-review",
    title: "Document review and synthesis",
    category: "AI Systems",
    summary:
      "Long-form review tasks are a strong fit for AI summarization with consultant-grade approval gates.",
    validationNote:
      "Anchor with sample documents and a review process before scoping.",
  },
  "intake-discovery": {
    id: "intake-discovery",
    title: "Stakeholder intake and discovery",
    category: "AdvisoryOps",
    summary:
      "Structured AI-guided intake captures more signal in less time, then synthesizes findings for human review.",
    validationNote:
      "Pilot in a real engagement with a paid AI Opportunity Sprint.",
  },
  "qa-review": {
    id: "qa-review",
    title: "QA and compliance review",
    category: "AI Systems",
    summary:
      "Pattern-checking with explicit rules and confidence labels can lift consistency without removing oversight.",
    validationNote:
      "Map the rule set and exception handling before any rollout.",
  },
  "ops-handoffs": {
    id: "ops-handoffs",
    title: "Cross-functional handoffs",
    category: "AdvisoryOps",
    summary:
      "Structured handoff packets and AI-drafted briefs can reduce dropped context between ops, sales, and delivery.",
    validationNote:
      "Workflow mapping in the Opportunity Sprint surfaces the right handoff points.",
  },
  knowledge: {
    id: "knowledge",
    title: "Internal knowledge retrieval",
    category: "AI Systems",
    summary:
      "Curated, evidence-citing retrieval over internal docs is a defensible early AI investment.",
    validationNote:
      "Audit source quality and access controls before deployment.",
  },
};

const CLASSIFICATIONS: Record<string, ResultClassification> = {
  "not-ready": {
    id: "not-ready",
    label: "Not AI-ready yet",
    short: "Foundations first",
    description:
      "Friction and goals are real, but the systems and operating posture aren't yet ready to absorb an AI rollout. Foundation work pays back faster than chasing AI.",
    recommendedNextStep: {
      title: "Start with operating foundations",
      description:
        "A short systems readiness review identifies the foundation work that has to land before AI can create leverage.",
      cta: "Apply for AI Systems Review",
      secondaryCta: "See what the review covers",
    },
  },
  "automation-ready": {
    id: "automation-ready",
    label: "Automation-ready",
    short: "Automation-ready",
    description:
      "Workflow friction is real and the systems landscape is workable. Targeted automation is the most likely first investment to pay back.",
    recommendedNextStep: {
      title: "Validate a Quick-Win Build",
      description:
        "An AI Opportunity Sprint isolates the highest-leverage automation candidates and turns them into a 30/60/90-day plan.",
      cta: "Apply for AI Systems Review",
      secondaryCta: "See what the sprint includes",
    },
  },
  "quick-win": {
    id: "quick-win",
    label: "Quick-win candidate",
    short: "Quick-win candidate",
    description:
      "Several high-friction workflows are ready for AI assistance. Confidence and adoption signals are strong enough to act in this quarter.",
    recommendedNextStep: {
      title: "Run an AI Opportunity Sprint",
      description:
        "A paid sprint validates the candidate workflows with stakeholder evidence and produces an implementation plan.",
      cta: "Apply for AI Systems Review",
      secondaryCta: "See what the sprint includes",
    },
  },
  "audit-ready": {
    id: "audit-ready",
    label: "Audit-ready",
    short: "Audit-ready",
    description:
      "The operating posture is mature enough for a structured audit across AI readiness, workflow friction, and systems readiness. The output is a portfolio of opportunities, not a single workflow.",
    recommendedNextStep: {
      title: "Run an AI Opportunity Sprint",
      description:
        "Stakeholder discovery, systems review, opportunity scoring, and a 30/60/90-day roadmap.",
      cta: "Apply for AI Systems Review",
      secondaryCta: "See what the sprint includes",
    },
  },
  strategic: {
    id: "strategic",
    label: "Strategic AI systems candidate",
    short: "Strategic candidate",
    description:
      "Goals, scale, and operating maturity all point to AI as a strategic investment — likely a portfolio of workflows, not a single tool.",
    recommendedNextStep: {
      title: "Engage Saipien Labs as an AI partner",
      description:
        "Begin with an AI Opportunity Sprint, then scope a Workflow System or Managed AI Partner engagement.",
      cta: "Apply for AI Systems Review",
      secondaryCta: "See what a Managed AI Partner looks like",
    },
  },
};

function dimensionTotalsFromAnswers(answers: Answers) {
  const totals: Record<Dimension, number> = {
    ai: 0,
    friction: 0,
    systems: 0,
    fit: 0,
  };

  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (a == null) continue;

    if (q.type === "single") {
      const choice = q.choices.find((c) => c.value === a);
      addWeights(totals, choice?.weights);
    } else if (q.type === "multi") {
      const selected = Array.isArray(a) ? a : [];
      for (const v of selected) {
        const choice = q.choices.find((c) => c.value === v);
        addWeights(totals, choice?.weights);
      }
    } else if (q.type === "scale") {
      const numeric = typeof a === "number" ? a : Number(a);
      if (!Number.isFinite(numeric) || !q.weights) continue;
      // Normalize 1..max to 0..1 then scale by weights
      const norm = (numeric - q.min) / (q.max - q.min);
      for (const dim of DIMENSIONS) {
        const w = q.weights[dim];
        if (typeof w === "number") totals[dim] += w * norm * 2; // *2 to compete with categorical weights
      }
    }
  }

  return totals;
}

function addWeights(
  totals: Record<Dimension, number>,
  weights: Choice["weights"] | undefined,
) {
  if (!weights) return;
  for (const dim of DIMENSIONS) {
    const w = weights[dim];
    if (typeof w === "number") totals[dim] += w;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalize(score: number, scale: number) {
  return clamp(Math.round(BASELINE + (score / scale) * 40), 0, 100);
}

function classify(
  ai: number,
  friction: number,
  systems: number,
  fit: number,
): ResultClassification {
  if (systems < 35 && ai < 35) return CLASSIFICATIONS["not-ready"];
  if (fit >= 70 && ai >= 60 && systems >= 55) return CLASSIFICATIONS.strategic;
  if (ai >= 60 && systems >= 50) return CLASSIFICATIONS["audit-ready"];
  if (friction >= 60 && fit >= 50) return CLASSIFICATIONS["quick-win"];
  return CLASSIFICATIONS["automation-ready"];
}

function pickOpportunities(answers: Answers): OpportunityArea[] {
  const friction = answers["friction.areas"];
  const selected = Array.isArray(friction) ? friction : [];
  const matched = selected
    .map((id) => OPPORTUNITY_LIBRARY[id])
    .filter((x): x is OpportunityArea => Boolean(x));

  if (matched.length >= 3) return matched.slice(0, 3);

  const fallback = ["doc-review", "manual-reporting", "knowledge"]
    .map((id) => OPPORTUNITY_LIBRARY[id])
    .filter((x): x is OpportunityArea => Boolean(x));

  const seen = new Set(matched.map((m) => m.id));
  for (const f of fallback) {
    if (matched.length >= 3) break;
    if (!seen.has(f.id)) matched.push(f);
  }
  return matched.slice(0, 3);
}

function deriveRiskNotes(
  answers: Answers,
  ai: number,
  systems: number,
): string[] {
  const notes: string[] = [];
  const sensitivity = answers["data.sensitivity"];
  if (sensitivity === "regulated") {
    notes.push(
      "Regulated data requires explicit governance and human-in-the-loop review before any AI rollout.",
    );
  }
  if (sensitivity === "client-confidential") {
    notes.push(
      "Client-confidential data should stay in well-scoped systems with documented access controls.",
    );
  }
  if (systems < 45) {
    notes.push(
      "Systems landscape is fragmented. Foundation work tends to pay back faster than AI in this state.",
    );
  }
  if (ai >= 70) {
    notes.push(
      "Existing AI use is real. The risk now is deploying patterns inconsistently across teams without a shared standard.",
    );
  }
  if (notes.length === 0) {
    notes.push(
      "No headline risks surfaced from self-reported answers. A paid sprint validates this with stakeholder evidence.",
    );
  }
  return notes;
}

export function scoreScorecard(answers: Answers): ScoreResult {
  const totals = dimensionTotalsFromAnswers(answers);
  // Scales chosen so a maxed-out, friction-heavy answer set lands in the
  // "Audit-ready"/"Strategic" bands without anyone hitting 100.
  const ai = normalize(totals.ai, 12);
  const friction = normalize(totals.friction, 14);
  const systems = normalize(totals.systems, 10);
  const fit = normalize(totals.fit, 14);

  const classification = classify(ai, friction, systems, fit);
  const opportunities = pickOpportunities(answers);
  const riskNotes = deriveRiskNotes(answers, ai, systems);

  return {
    ai,
    friction,
    systems,
    fit,
    classification,
    opportunities,
    riskNotes,
  };
}
