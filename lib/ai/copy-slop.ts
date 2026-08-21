/**
 * Copy-slop critique — deterministic "does this read like AI filler" gate.
 *
 * SLATE's client deliverables must read as human strategy-consulting output,
 * not generated boilerplate. AI synthesis produces competent prose that still
 * carries tell-tale slop: empty intensifiers, corporate buzzwords, LLM
 * discourse markers, hollow value claims, and over-hedging. This module scans
 * generated prose for those signatures and returns a density-scored critique
 * so the pipeline can surface (and gate on) slop BEFORE an operator — let
 * alone a client — ever sees the draft.
 *
 * Pure, dependency-free, server-safe. No I/O, no AI call — this is the cheap
 * deterministic pass; an optional LLM rewrite can run only on drafts this
 * flags. Patterns are conservative (high-precision) to avoid nagging on
 * legitimate usage; the goal is catching the recurring generated-prose tells,
 * not policing every adverb.
 */

export type CopySlopCategory =
  | "filler" // empty intensifiers / throat-clearing
  | "buzzword" // corporate/tech boilerplate
  | "ai-tell" // LLM discourse markers + signature words
  | "hollow-claim" // vague value assertions with no specifics
  | "hedge" // over-qualification
  | "cliche"; // tired metaphors

export interface CopySlopPattern {
  category: CopySlopCategory;
  re: RegExp;
  /** Human-readable label for the tell. */
  label: string;
  /** Suggested direction for the fix (operator-facing). */
  hint: string;
}

/**
 * High-precision patterns. Each `re` MUST be global + case-insensitive so
 * `matchAll` finds every occurrence. Word boundaries keep them from firing
 * inside larger words.
 */
export const COPY_SLOP_PATTERNS: readonly CopySlopPattern[] = [
  // ---- AI discourse markers / signature vocabulary ----
  { category: "ai-tell", re: /\bit'?s (?:important|worth) (?:to note|noting|mentioning)\b/gi, label: "it's important to note", hint: "State the point directly; drop the throat-clearing." },
  { category: "ai-tell", re: /\b(?:furthermore|moreover|additionally|in addition,)\b/gi, label: "additive discourse marker", hint: "Let the sentences carry the connection; cut the connector." },
  { category: "ai-tell", re: /\b(?:in conclusion|in summary|to summarize|overall,)\b/gi, label: "essay wrap-up marker", hint: "A strategy doc doesn't announce its conclusion; just make the point." },
  { category: "ai-tell", re: /\bdelv(?:e|ing|ed)\b/gi, label: "delve", hint: "Use plain verbs (examine, look at)." },
  { category: "ai-tell", re: /\b(?:testament to|a tapestry of|navigating the (?:complex|landscape)|underscore[sd]?|pivotal|realm of|plethora|myriad of)\b/gi, label: "LLM signature phrase", hint: "Replace with concrete, specific language." },
  { category: "ai-tell", re: /\b(?:elevate|empower|unlock|harness(?:ing)? the power of|foster(?:ing)?|facilitate|utiliz(?:e|ing|ed))\b/gi, label: "AI verb tell", hint: "Prefer plain verbs (use, help, enable, run)." },

  // ---- Corporate / tech buzzwords ----
  { category: "buzzword", re: /\b(?:leverage|leveraging|synerg(?:y|ies|istic)|holistic|seamless(?:ly)?|robust|cutting[- ]edge|state[- ]of[- ]the[- ]art|best[- ]in[- ]class|game[- ]?chang(?:er|ing)|world[- ]class|next[- ]gen(?:eration)?|turnkey|bleeding[- ]edge)\b/gi, label: "corporate buzzword", hint: "Say the specific thing the buzzword stands in for." },
  { category: "buzzword", re: /\bstreamlin(?:e|es|ing|ed)\b/gi, label: "streamline (overused)", hint: "Name the concrete change (fewer steps, one hand-off, etc.)." },

  // ---- Hollow value claims ----
  { category: "hollow-claim", re: /\b(?:aims? to|designed to|intended to|helps? to|seeks? to) (?:improve|enhance|optimiz|drive|deliver|maximiz|boost)\w*\b/gi, label: "hollow 'aims to improve' claim", hint: "State the mechanism and the measurable outcome, not the aspiration." },
  { category: "hollow-claim", re: /\b(?:operational efficiency|customer satisfaction|business value|value proposition|actionable insights?|drive growth|driving value|move the needle|value[- ]add(?:ed)?)\b/gi, label: "vague value phrase", hint: "Tie it to a specific metric or workflow." },
  { category: "hollow-claim", re: /\bin today'?s (?:fast[- ]paced|ever[- ](?:changing|evolving)|competitive|digital) \w+\b/gi, label: "'in today's fast-paced world' opener", hint: "Delete; open on the client's actual situation." },

  // ---- Empty intensifiers / filler ----
  { category: "filler", re: /\b(?:very|really|truly|quite|extremely|incredibly|highly|significantly|substantially) (?:important|significant|critical|effective|efficient|valuable|powerful|robust)\b/gi, label: "intensifier + vague adjective", hint: "Cut the intensifier or replace with a specific." },
  { category: "filler", re: /\b(?:a wide (?:range|array|variety) of|a host of|a number of|various \w+ (?:and|,))\b/gi, label: "vague quantity filler", hint: "Give the actual count or list." },

  // ---- Over-hedging ----
  { category: "hedge", re: /\b(?:potentially|possibly) (?:could|may|might)\b/gi, label: "stacked hedge", hint: "Pick one modality or commit to the claim." },

  // ---- Tired metaphors / cliches ----
  { category: "cliche", re: /\b(?:low[- ]hanging fruit|move the needle|boil the ocean|north star|deep dive|circle back|at the end of the day|when it comes to)\b/gi, label: "cliche", hint: "Replace with plain, specific language." },
] as const;

export interface CopySlopFlag {
  category: CopySlopCategory;
  label: string;
  hint: string;
  /** The matched text, verbatim. */
  match: string;
  /** Character offset in the scanned text. */
  index: number;
}

export interface CopySlopResult {
  flags: CopySlopFlag[];
  wordCount: number;
  /** Flags per 100 words — the density that matters more than raw count. */
  density: number;
  /** none | low | elevated | high — a coarse operator-facing band. */
  severity: "none" | "low" | "elevated" | "high";
  /** Distinct tells that fired, for a compact summary. */
  categories: CopySlopCategory[];
}

const EMPTY: CopySlopResult = {
  flags: [],
  wordCount: 0,
  density: 0,
  severity: "none",
  categories: [],
};

/** Density thresholds (flags per 100 words). Tuned conservative. */
const BAND_LOW = 0.8;
const BAND_ELEVATED = 2;
const BAND_HIGH = 4;

/**
 * Scan prose for slop tells. Returns every match with its category + a fix
 * hint, plus a density score and a coarse severity band. Empty/blank input
 * returns a clean result.
 */
export function critiqueCopySlop(input: string | null | undefined): CopySlopResult {
  if (!input) return EMPTY;
  const text = input.trim();
  if (text.length === 0) return EMPTY;

  const wordCount = (text.match(/\b[\w'-]+\b/g) ?? []).length;
  if (wordCount === 0) return EMPTY;

  const flags: CopySlopFlag[] = [];
  for (const p of COPY_SLOP_PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      flags.push({
        category: p.category,
        label: p.label,
        hint: p.hint,
        match: m[0],
        index: m.index ?? 0,
      });
    }
  }
  flags.sort((a, b) => a.index - b.index);

  const density = (flags.length / wordCount) * 100;
  const severity =
    flags.length === 0
      ? "none"
      : density >= BAND_HIGH
        ? "high"
        : density >= BAND_ELEVATED
          ? "elevated"
          : density >= BAND_LOW
            ? "low"
            : "low";

  const categories = [...new Set(flags.map((f) => f.category))];
  return { flags, wordCount, density: round2(density), severity, categories };
}

/**
 * Critique several prose fields together (e.g., a section's summary + draft +
 * evidence), returning one combined result. Field labels are ignored — the
 * caller decides how to attribute; this just pools the text with separators so
 * cross-field density is meaningful.
 */
export function critiqueCopySlopFields(
  fields: ReadonlyArray<string | null | undefined>,
): CopySlopResult {
  const joined = fields.filter(Boolean).join("\n\n");
  return critiqueCopySlop(joined);
}

/**
 * The banned/discouraged phrase guidance, rendered for an AI system prompt so
 * generation avoids the tells the linter catches. Keep this in sync with the
 * patterns above — prevention upstream is cheaper than flagging downstream.
 */
export const COPY_SLOP_PROMPT_GUIDANCE = [
  "Write like a senior strategy consultant, not an AI. Ban these tells:",
  "- No throat-clearing: never \"it's important to note\", \"furthermore\", \"in conclusion\", \"delve\".",
  "- No corporate buzzwords: leverage, synergy, seamless, robust, holistic, streamline, cutting-edge, world-class, game-changer, turnkey.",
  "- No hollow claims: never \"aims to improve operational efficiency and customer satisfaction\" or \"drive value\". State the specific mechanism and a measurable outcome instead.",
  "- No AI verbs: use plain verbs (use, help, run, cut, add) not empower, elevate, unlock, foster, facilitate, utilize.",
  "- No empty intensifiers (very/highly/significantly + vague adjective) and no \"a wide range of\" — give the actual specifics or counts.",
  "- No cliches: low-hanging fruit, move the needle, deep dive, north star, at the end of the day.",
  "Prefer short, concrete, specific sentences grounded in this client's actual situation and evidence.",
].join("\n");

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
