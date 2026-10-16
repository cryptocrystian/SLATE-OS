import { QUESTIONS } from "./questions";
import type { Answers, MultiChoiceQuestion } from "./types";

/**
 * Stack inventory (FDE A1 playbook §11).
 *
 * The `systems.stack.*` questions are optional and carry no weights, so they
 * never move the score. This module turns those answers into labelled rows
 * for operator surfaces.
 */

export const STACK_QUESTION_PREFIX = "systems.stack.";

const STACK_CATEGORY_LABELS: Record<string, string> = {
  "systems.stack.crm": "CRM",
  "systems.stack.finance": "Finance / ERP",
  "systems.stack.workplace": "Workplace",
  "systems.stack.support": "Support",
};

export interface StackInventoryRow {
  questionId: string;
  category: string;
  systems: string[];
}

export const STACK_QUESTIONS: MultiChoiceQuestion[] = QUESTIONS.filter(
  (q): q is MultiChoiceQuestion =>
    q.type === "multi" && q.id.startsWith(STACK_QUESTION_PREFIX),
);

export function stackInventoryFromAnswers(answers: Answers): StackInventoryRow[] {
  const rows: StackInventoryRow[] = [];
  for (const q of STACK_QUESTIONS) {
    const raw = answers[q.id];
    const selected = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
    const systems = selected
      .map((value) => q.choices.find((c) => c.value === value)?.label)
      .filter((label): label is string => typeof label === "string");
    if (systems.length === 0) continue;
    rows.push({
      questionId: q.id,
      category: STACK_CATEGORY_LABELS[q.id] ?? q.prompt,
      systems,
    });
  }
  return rows;
}
