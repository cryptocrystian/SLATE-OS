import { describe, expect, it } from "vitest";
import { QUESTIONS } from "@/lib/scorecard/questions";
import { scoreScorecard } from "@/lib/scorecard/scoring";
import { STACK_QUESTIONS, stackInventoryFromAnswers } from "@/lib/scorecard/stack";
import type { Answers } from "@/lib/scorecard/types";

const BASE: Answers = {
  "company.size": "51-200",
  "business.goal": "throughput",
  "systems.maturity": "core",
  "systems.documentation": 3,
  "ai.usage": "team",
};

const STACK: Answers = {
  "systems.stack.crm": ["hubspot", "salesforce"],
  "systems.stack.finance": ["netsuite"],
  "systems.stack.workplace": ["google-workspace", "slack"],
  "systems.stack.support": ["zendesk"],
};

describe("scorecard stack inventory", () => {
  it("defines four optional multi-choice stack questions", () => {
    expect(STACK_QUESTIONS.map((q) => q.id)).toEqual([
      "systems.stack.crm",
      "systems.stack.finance",
      "systems.stack.workplace",
      "systems.stack.support",
    ]);
    for (const q of STACK_QUESTIONS) expect(q.optional).toBe(true);
  });

  it("carries no scoring weights", () => {
    for (const q of STACK_QUESTIONS) {
      for (const c of q.choices) expect(c.weights).toBeUndefined();
    }
  });

  it("never changes the score", () => {
    const without = scoreScorecard(BASE);
    const withStack = scoreScorecard({ ...BASE, ...STACK });
    expect(withStack.ai).toBe(without.ai);
    expect(withStack.friction).toBe(without.friction);
    expect(withStack.systems).toBe(without.systems);
    expect(withStack.fit).toBe(without.fit);
    expect(withStack.classification.id).toBe(without.classification.id);
  });

  it("maps answers to labelled inventory rows and skips unanswered or unknown values", () => {
    const rows = stackInventoryFromAnswers({
      ...STACK,
      "systems.stack.support": ["not-a-choice"],
    });
    expect(rows).toEqual([
      { questionId: "systems.stack.crm", category: "CRM", systems: ["HubSpot", "Salesforce"] },
      { questionId: "systems.stack.finance", category: "Finance / ERP", systems: ["NetSuite"] },
      {
        questionId: "systems.stack.workplace",
        category: "Workplace",
        systems: ["Google Workspace (Gmail, Drive)", "Slack"],
      },
    ]);
  });

  it("keeps stack question ids unique", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
