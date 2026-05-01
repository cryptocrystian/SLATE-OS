export type SectionId =
  | "company"
  | "business"
  | "friction"
  | "systems"
  | "ai"
  | "data"
  | "urgency"
  | "contact";

export interface Section {
  id: SectionId;
  title: string;
  eyebrow: string;
  intent: string;
}

export const SECTIONS: Section[] = [
  {
    id: "company",
    eyebrow: "Section 1 · Company Profile",
    title: "Tell us about the business.",
    intent: "Industry and shape of the company so the diagnostic stays grounded.",
  },
  {
    id: "business",
    eyebrow: "Section 2 · Business Model & Goals",
    title: "What is the operation trying to do better?",
    intent: "Where AI could create commercial leverage, not just curiosity.",
  },
  {
    id: "friction",
    eyebrow: "Section 3 · Workflow Friction",
    title: "Where does the day-to-day work break down?",
    intent: "Friction is the strongest signal of where AI is likely to pay back.",
  },
  {
    id: "systems",
    eyebrow: "Section 4 · Systems & Tools",
    title: "What does the current systems landscape look like?",
    intent: "Integration readiness shapes what is realistic in 30/60/90 days.",
  },
  {
    id: "ai",
    eyebrow: "Section 5 · AI Adoption",
    title: "How has the team used AI so far?",
    intent: "Existing momentum changes the recommended starting point.",
  },
  {
    id: "data",
    eyebrow: "Section 6 · Data & Risk",
    title: "How sensitive is the data and the operating risk?",
    intent: "Risk posture determines which patterns are appropriate.",
  },
  {
    id: "urgency",
    eyebrow: "Section 7 · Urgency & Investment Readiness",
    title: "How urgent is this, and is the team ready to invest?",
    intent: "Helps SLATE recommend the right next step, not just any step.",
  },
  {
    id: "contact",
    eyebrow: "Section 8 · Result Prep",
    title: "Where should we send the result?",
    intent: "Used only to deliver the result and a recommended next step.",
  },
];

export type Dimension = "ai" | "friction" | "systems" | "fit";

export type AnswerValue = string | string[] | number;
export type Answers = Record<string, AnswerValue>;

export interface Choice {
  value: string;
  label: string;
  description?: string;
  weights?: Partial<Record<Dimension, number>>;
}

interface BaseQuestion {
  id: string;
  section: SectionId;
  prompt: string;
  whyWeAsk?: string;
  optional?: boolean;
}

export interface SingleChoiceQuestion extends BaseQuestion {
  type: "single";
  choices: Choice[];
}

export interface MultiChoiceQuestion extends BaseQuestion {
  type: "multi";
  choices: Choice[];
  max?: number;
}

export interface ScaleQuestion extends BaseQuestion {
  type: "scale";
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
  weights?: Partial<Record<Dimension, number>>;
}

export interface TextQuestion extends BaseQuestion {
  type: "text";
  placeholder?: string;
  inputKind?: "text" | "email";
}

export type Question =
  | SingleChoiceQuestion
  | MultiChoiceQuestion
  | ScaleQuestion
  | TextQuestion;

export type ResultClassificationId =
  | "not-ready"
  | "automation-ready"
  | "quick-win"
  | "audit-ready"
  | "strategic";

export interface ResultClassification {
  id: ResultClassificationId;
  label: string;
  short: string;
  description: string;
  recommendedNextStep: {
    title: string;
    description: string;
    cta: string;
    secondaryCta?: string;
  };
}

export interface OpportunityArea {
  id: string;
  title: string;
  category: "GrowthOps" | "AdvisoryOps" | "AI Systems";
  summary: string;
  validationNote: string;
}

export interface ScoreResult {
  ai: number;
  friction: number;
  systems: number;
  fit: number;
  classification: ResultClassification;
  opportunities: OpportunityArea[];
  riskNotes: string[];
}
