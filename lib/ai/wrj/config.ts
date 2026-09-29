import "server-only";

/**
 * Writer · Reviewer · Judge (WRJ) — configuration + mode flag.
 *
 * WRJ is a PARALLEL synthesis path that runs alongside the existing
 * single-model pipeline (`lib/ai/*-synthesis.ts`). It never replaces it:
 *
 *   - `SLATE_AI_SYNTHESIS_MODE` selects the path. Default `single` keeps the
 *     current behavior exactly; `wrj` routes stages that have a WRJ adapter
 *     through the writer→reviewer→judge loop. Removing the flag reverts.
 *   - Both paths emit the SAME candidate shape, so downstream (actions,
 *     persistence, deliverables) is untouched and A/B is a config toggle.
 *
 * Roles (see DESIGN in orchestrator.ts):
 *   - Writer   — produces the draft. Reuses the existing per-stage synthesis
 *                (its prompt/context), on the writer model family.
 *   - Reviewer — a CROSS-FAMILY LLM that critiques the draft against docs/68.
 *                Cross-family is deliberate: a same-family reviewer shares the
 *                writer's blind spots. Routed via OpenRouter so we can target
 *                Anthropic/Google while the writer is OpenAI.
 *   - Judge    — Jev (TypeSafe System One): typed, calibrated verdicts +
 *                probabilities against the docs/68 checks. HTTP, not the SDK,
 *                so we authenticate with our own JEV_API_KEY.
 */

export type SynthesisMode = "single" | "wrj";

/** Global default mode. Per-stage overrides can layer on later. */
export function getSynthesisMode(): SynthesisMode {
  const raw = (process.env.SLATE_AI_SYNTHESIS_MODE ?? "single").trim().toLowerCase();
  return raw === "wrj" ? "wrj" : "single";
}

export function isWrjMode(): boolean {
  return getSynthesisMode() === "wrj";
}

// ---------------------------------------------------------------------------
// Reviewer (cross-family LLM via OpenRouter)
// ---------------------------------------------------------------------------

export interface ReviewerConfig {
  /** OpenRouter model id, e.g. "anthropic/claude-3.7-sonnet". */
  model: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * Cross-family reviewer config. Uses OpenRouter (OpenAI-compatible schema) so
 * the reviewer can be a different family than the OpenAI writer. Returns null
 * when unconfigured — the orchestrator then skips the review step rather than
 * failing (Jev still judges).
 */
export function getReviewerConfig(): ReviewerConfig | null {
  const apiKey = process.env.OPEN_ROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  // Overridable; default to a strong cross-family (Anthropic) model. Set
  // SLATE_AI_REVIEWER_MODEL to the current best id for your account.
  const model =
    process.env.SLATE_AI_REVIEWER_MODEL?.trim() || "anthropic/claude-3.7-sonnet";
  return {
    model,
    apiKey,
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
  };
}

// ---------------------------------------------------------------------------
// Judge (Jev / TypeSafe System One)
// ---------------------------------------------------------------------------

export interface JevConfig {
  apiKey: string;
  model: string;
  endpoint: string;
}

/**
 * Jev judge config. Reads JEV_API_KEY (our env name) and talks to the System
 * One HTTP API directly. Returns null when unconfigured — the orchestrator
 * then records "judge unavailable" rather than failing the draft.
 */
export function getJevConfig(): JevConfig | null {
  const apiKey = process.env.JEV_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.SLATE_AI_JUDGE_MODEL?.trim() || "jev-latest",
    endpoint: "https://api.typesafe.ai/v1/systemone",
  };
}

/** True when the full WRJ path can run end-to-end (judge is the hard dep). */
export function isWrjConfigured(): boolean {
  return getJevConfig() !== null;
}
