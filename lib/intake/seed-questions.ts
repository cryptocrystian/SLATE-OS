import type { StakeholderRole } from "./types";

/**
 * Static intake question seed used by the public stakeholder route and
 * by the operator workspace's response renderer. MVP-scoped: identical
 * questions for every role, with a short role-specific prompt at the top
 * to set context. Role-specific question banks land later.
 */

export interface IntakeQuestion {
  id: string;
  label: string;
  helper?: string;
  required: boolean;
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "repetitive_workflows",
    label: "What are the most repetitive workflows in your area?",
    helper:
      "Think about tasks you (or your team) do every week that feel templated or rule-based.",
    required: true,
  },
  {
    id: "handoff_pain",
    label: "Where do handoffs slow down or create rework?",
    helper:
      "Hand-offs between teams, tools, or steps. Where does information get lost or duplicated?",
    required: true,
  },
  {
    id: "core_systems",
    label: "Which systems or tools do you rely on most?",
    helper: "Name the 3–5 you use every day.",
    required: false,
  },
  {
    id: "trust_friction",
    label: "What information is hard to find or hard to trust?",
    helper:
      "Anywhere people quietly double-check, re-export, or rebuild before acting.",
    required: false,
  },
  {
    id: "automation_wishlist",
    label: "Where would automation or AI assistance help most?",
    helper:
      "Be concrete. Tasks, decisions, or moments that could be supported, not replaced.",
    required: true,
  },
  {
    id: "risks_and_constraints",
    label: "What risks or constraints should we be careful about?",
    helper:
      "Compliance, data sensitivity, change-resistance, dependencies on people or vendors.",
    required: false,
  },
  {
    id: "success_for_role",
    label: "What would make this initiative successful for your role?",
    helper:
      "What would have to be true 90 days from now for this to feel like a win?",
    required: true,
  },
];

const ROLE_PROMPTS: Record<StakeholderRole, string> = {
  executive:
    "Answer from an executive lens: where is the business value, where is the risk?",
  operations:
    "Answer from an operations lens: where do workflows actually break?",
  sales:
    "Answer from a sales lens: where does the sales motion lose energy or context?",
  marketing:
    "Answer from a marketing lens: where do handoffs and content cycles slow down?",
  finance:
    "Answer from a finance / admin lens: where is friction or unclear ownership?",
  it: "Answer from a systems / IT lens: which integrations and constraints matter most?",
  frontline:
    "Answer from a frontline lens: what does the day-to-day actually look like?",
  "customer-success":
    "Answer from a customer-success lens: where do customers feel friction?",
  other: "Answer from your point of view — focus on what you see most clearly.",
};

export function rolePromptFor(role: StakeholderRole): string {
  return ROLE_PROMPTS[role] ?? ROLE_PROMPTS.other;
}
