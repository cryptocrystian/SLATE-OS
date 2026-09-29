import "server-only";

import { getReviewerConfig } from "./config";
import type { Review, ReviewNote } from "./types";

/**
 * Cross-family reviewer — an LLM from a DIFFERENT family than the writer
 * critiques the draft against the docs/68 rubric and returns structured notes
 * the revise step (or the operator) can act on. Cross-family is the point: a
 * same-family reviewer shares the writer's blind spots.
 *
 * Routed through OpenRouter (OpenAI-compatible schema) so an OpenAI writer can
 * be paired with an Anthropic/Google reviewer via one integration. Returns a
 * non-throwing `unavailable`/`error` review on any failure — the loop still
 * proceeds to the Jev judge.
 */

const REVIEWER_PREAMBLE = [
  "You are a senior reviewer at a top strategy firm, critiquing a colleague's draft deliverable BEFORE a client sees it.",
  "You do not rewrite it. You return a short, specific list of the most important defects, judged against this bar:",
  "- Grounding: every claim traces to the supplied evidence; thin claims are hedged, not asserted.",
  "- Specificity: uses THIS client's named systems, roles, workflows, numbers — not generic language that could fit any company.",
  "- Insight: non-obvious and decision-useful, not a restatement of the inputs.",
  "- Methodology: does its section/stage job; distinct from sibling sections; provenance links populated.",
  "- Voice: human, plain, no filler (leverage, seamless, robust, holistic, unlock, empower, cutting-edge).",
  "- Commercial realism: scope/timeline/pricing a real buyer in this situation would accept.",
  "- Guardrails: no financial/ROI/savings guarantee, no peer/industry benchmark claim, no binding-commitment language.",
  "Only flag real defects. If the draft is strong, return an empty notes array. Do not invent problems to look thorough.",
  'Return JSON only: { "notes": [ { "dimension": one of ["grounding","specificity","insight","methodology","voice","commercial_realism","guardrail","other"], "severity": one of ["high","medium","low"], "note": "one sentence: the defect + the fix" } ] }',
].join("\n");

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

function parseNotes(content: string): ReviewNote[] {
  try {
    const parsed = JSON.parse(content) as { notes?: unknown };
    if (!parsed || !Array.isArray(parsed.notes)) return [];
    const out: ReviewNote[] = [];
    for (const n of parsed.notes) {
      if (!n || typeof n !== "object") continue;
      const o = n as Record<string, unknown>;
      if (typeof o.note !== "string" || o.note.trim().length === 0) continue;
      const dim = typeof o.dimension === "string" ? o.dimension : "other";
      const sev = o.severity === "high" || o.severity === "medium" || o.severity === "low" ? o.severity : "medium";
      out.push({ dimension: dim as ReviewNote["dimension"], severity: sev, note: o.note.trim().slice(0, 400) });
    }
    return out.slice(0, 12);
  } catch {
    return [];
  }
}

/**
 * Review a candidate. `candidateState` is the serialized draft + the source
 * context it should be grounded in; `focus` is optional stage-specific
 * emphasis appended to the shared bar.
 */
export async function reviewCandidate(
  candidateState: unknown,
  focus?: string,
): Promise<Review> {
  const config = getReviewerConfig();
  if (!config) {
    return { status: "unavailable", model: null, notes: [], message: "OPEN_ROUTER_API_KEY not set" };
  }

  const system = focus ? `${REVIEWER_PREAMBLE}\n\nStage focus: ${focus}` : REVIEWER_PREAMBLE;
  const user = `Draft + source context to review (JSON):\n${JSON.stringify(candidateState, null, 2)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const resp = await fetch(config.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      return { status: "error", model: config.model, notes: [], message: `status ${resp.status}` };
    }
    const json = (await resp.json()) as ChatCompletion;
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return { status: "error", model: config.model, notes: [], message: "empty response" };
    }
    return { status: "reviewed", model: config.model, notes: parseNotes(content) };
  } catch (e) {
    return {
      status: "error",
      model: config.model,
      notes: [],
      message: e instanceof Error ? e.name : "unknown",
    };
  } finally {
    clearTimeout(timeout);
  }
}
