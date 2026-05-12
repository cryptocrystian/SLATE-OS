import "server-only";

import type { AiProviderConfig } from "./types";

/**
 * Server-only AI provider wiring.
 *
 * No SDK dependency: the OpenAI Chat Completions API is a small enough
 * surface to call via `fetch` directly. Keeping the dependency footprint
 * minimal means a missing-API-key environment still builds without
 * tree-shaking landmines, and the browser bundle never ships any
 * provider code (the `server-only` import enforces that at build time).
 *
 * Env vars (server-only):
 *   - SLATE_AI_PROVIDER             ("openai" — default; leave unset to disable)
 *   - OPENAI_API_KEY                OpenAI API key. Absence disables synthesis.
 *   - SLATE_AI_FINDINGS_MODEL       Override for findings synthesis model.
 *   - SLATE_AI_OPPORTUNITIES_MODEL  Override for opportunity synthesis model.
 *
 * If the key is absent, `getAiProviderConfig()` returns null and callers
 * must short-circuit to a controlled `ai-not-configured` UI state.
 */

const DEFAULT_FINDINGS_MODEL = "gpt-4o-mini";

export function getAiProviderConfig(): AiProviderConfig | null {
  const provider = (process.env.SLATE_AI_PROVIDER ?? "openai")
    .trim()
    .toLowerCase();
  if (provider !== "openai") return null;
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length === 0) return null;
  const model =
    process.env.SLATE_AI_FINDINGS_MODEL?.trim() || DEFAULT_FINDINGS_MODEL;
  return { provider: "openai", model };
}

/**
 * Provider config tailored to opportunity drafting. Falls back to
 * `SLATE_AI_FINDINGS_MODEL` and finally the default model when the
 * opportunity-specific env var is unset, matching the documented
 * configuration policy in `.env.example`.
 */
export function getAiOpportunityProviderConfig(): AiProviderConfig | null {
  const base = getAiProviderConfig();
  if (!base) return null;
  const override = process.env.SLATE_AI_OPPORTUNITIES_MODEL?.trim();
  if (override && override.length > 0) {
    return { provider: base.provider, model: override };
  }
  return base;
}

/**
 * Provider config tailored to report-section drafting (Step 3). Falls
 * back to the findings/default model when no report-specific env var is
 * set. Read-only env access; safe-default-no-key behavior.
 *
 *   SLATE_AI_REPORT_SECTIONS_MODEL — optional override.
 */
export function getAiReportSectionProviderConfig(): AiProviderConfig | null {
  const base = getAiProviderConfig();
  if (!base) return null;
  const override = process.env.SLATE_AI_REPORT_SECTIONS_MODEL?.trim();
  if (override && override.length > 0) {
    return { provider: base.provider, model: override };
  }
  return base;
}

/**
 * Provider config tailored to proposal-option drafting (Step 4). Falls
 * back to the findings/default model when no proposal-specific env var
 * is set. Read-only env access; safe-default-no-key behavior.
 *
 *   SLATE_AI_PROPOSAL_OPTIONS_MODEL — optional override.
 */
export function getAiProposalOptionProviderConfig(): AiProviderConfig | null {
  const base = getAiProviderConfig();
  if (!base) return null;
  const override = process.env.SLATE_AI_PROPOSAL_OPTIONS_MODEL?.trim();
  if (override && override.length > 0) {
    return { provider: base.provider, model: override };
  }
  return base;
}

/**
 * Provider config tailored to roadmap drafting (Step 5). Falls back to
 * the findings/default model when no roadmap-specific env var is set.
 * Read-only env access; safe-default-no-key behavior.
 *
 *   SLATE_AI_ROADMAP_MODEL — optional override.
 */
export function getAiRoadmapProviderConfig(): AiProviderConfig | null {
  const base = getAiProviderConfig();
  if (!base) return null;
  const override = process.env.SLATE_AI_ROADMAP_MODEL?.trim();
  if (override && override.length > 0) {
    return { provider: base.provider, model: override };
  }
  return base;
}

export function isAiConfigured(): boolean {
  return getAiProviderConfig() !== null;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Maximum response tokens. */
  maxTokens?: number;
  /** Sampling temperature; we keep it deterministic for synthesis. */
  temperature?: number;
}

export interface ChatResponseOk {
  ok: true;
  content: string;
}

export interface ChatResponseFailure {
  ok: false;
  error:
    | "ai-not-configured"
    | "ai-request-failed"
    | "ai-response-invalid"
    | "ai-rate-limited"
    | "ai-timeout";
  /** Short error message for logs only; sanitized. */
  message?: string;
}

export type ChatResponse = ChatResponseOk | ChatResponseFailure;

/**
 * Issue a single chat-completion-style request against the configured
 * provider. Returns the raw assistant message text (caller is
 * responsible for parsing/validating). The request body is JSON-only
 * and the assistant is asked for JSON via `response_format`.
 */
export async function callChatJson(request: ChatRequest): Promise<ChatResponse> {
  const config = getAiProviderConfig();
  if (!config) return { ok: false, error: "ai-not-configured" };
  const key = process.env.OPENAI_API_KEY!;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1500,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (response.status === 429) {
      return { ok: false, error: "ai-rate-limited" };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: "ai-request-failed",
        message: `status ${response.status}`,
      };
    }
    const json = (await response.json()) as unknown;
    const content = extractChoiceContent(json);
    if (!content) {
      return { ok: false, error: "ai-response-invalid" };
    }
    return { ok: true, content };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "ai-timeout" };
    }
    return {
      ok: false,
      error: "ai-request-failed",
      message: e instanceof Error ? e.name : "unknown",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractChoiceContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || content.length === 0) return null;
  return content;
}
