import "server-only";

import {
  COMMERCIAL_FINALITY_PATTERNS,
  FINANCIAL_CLAIM_PATTERNS,
  scanForBannedClaims as scanForBannedClaimsShared,
  type BannedClaimRule,
  type BannedClaimViolation as SharedBannedClaimViolation,
} from "./claim-guard";
import {
  callChatJson,
  getAiProposalOptionProviderConfig,
} from "./provider";
import type { ProposalOptionSynthesisContext } from "./proposal-option-context";
import type { AiProviderConfig } from "./types";

/**
 * Proposal-option synthesis pipeline — AI Synthesis Step 4.
 *
 *   1. Format the structured context (engagement + account + target
 *      proposal option + sibling options + approved findings +
 *      scored/selected opportunities + roadmap items + operator-
 *      reviewed report sections) into a deterministic JSON prompt.
 *   2. Call the configured provider with `response_format: json_object`.
 *   3. Validate the response with strict allowlists AND the combined
 *      banned-claim scanner (financial / benchmark patterns from
 *      Step 3 + commercial-finality patterns specific to Step 4).
 *   4. Return a typed draft for the action to persist into the
 *      proposal option's scalar columns + string arrays. Pricing,
 *      option_type, recommendation, position, link rows are NEVER
 *      touched by Step 4.
 *
 * The validator never trusts the model to change the recommendation
 * state — the calling action ignores any model-set recommendation.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ProposalOptionDraftCandidate {
  /** Polished option title — may refine the existing one. */
  optionTitle: string;
  /** "Best fit when…" framing, persisted into `best_fit_scenario`. */
  bestFitScenario: string;
  /** Scope + approach narrative, persisted into `scope_summary`. */
  scopeNarrative: string;
  /** Operator-readable timeline, persisted into `timeline`. */
  timeline: string;
  /** Persisted into `deliverables[]`. */
  deliverables: string[];
  /** Persisted into `assumptions[]`. */
  assumptions: string[];
  /** Persisted into `dependencies[]`. */
  dependencies: string[];
  /** Persisted into `risks[]`. */
  risks: string[];
}

export interface ProposalOptionSynthesisOk {
  ok: true;
  candidate: ProposalOptionDraftCandidate;
  providerMeta: {
    provider: AiProviderConfig["provider"];
    model: string;
  };
}

export type ProposalOptionSynthesisError =
  | "ai-not-configured"
  | "ai-request-failed"
  | "ai-response-invalid"
  | "ai-rate-limited"
  | "ai-timeout"
  | "ai-claim-violation";

export interface ProposalOptionSynthesisFailure {
  ok: false;
  error: ProposalOptionSynthesisError;
  /** Short, sanitized error detail for logs only. */
  message?: string;
}

export type ProposalOptionSynthesisResult =
  | ProposalOptionSynthesisOk
  | ProposalOptionSynthesisFailure;

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

const TITLE_LIMIT = 200;
const BEST_FIT_LIMIT = 600;
const SCOPE_NARRATIVE_LIMIT = 2000;
const TIMELINE_LIMIT = 220;
const ARRAY_ITEM_LIMIT = 200;
const MAX_DELIVERABLES = 8;
const MAX_ASSUMPTIONS = 8;
const MAX_DEPENDENCIES = 6;
const MAX_RISKS = 6;

// ---------------------------------------------------------------------------
// Banned-claim scanner — financial + commercial-finality patterns.
// ---------------------------------------------------------------------------

const COMBINED_PATTERNS: ReadonlyArray<BannedClaimRule> = [
  ...FINANCIAL_CLAIM_PATTERNS,
  ...COMMERCIAL_FINALITY_PATTERNS,
];

export interface BannedClaimViolation {
  field: keyof ProposalOptionDraftCandidate;
  code: string;
}

export function scanForBannedClaims(
  candidate: ProposalOptionDraftCandidate,
): BannedClaimViolation[] {
  const shared = scanForBannedClaimsShared(
    [
      { field: "optionTitle", values: [candidate.optionTitle] },
      { field: "bestFitScenario", values: [candidate.bestFitScenario] },
      { field: "scopeNarrative", values: [candidate.scopeNarrative] },
      { field: "timeline", values: [candidate.timeline] },
      { field: "deliverables", values: candidate.deliverables },
      { field: "assumptions", values: candidate.assumptions },
      { field: "dependencies", values: candidate.dependencies },
      { field: "risks", values: candidate.risks },
    ],
    COMBINED_PATTERNS,
  );
  return shared.map<BannedClaimViolation>(
    (v: SharedBannedClaimViolation) => ({
      field: v.field as keyof ProposalOptionDraftCandidate,
      code: v.code,
    }),
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function synthesizeProposalOptionDraft(
  context: ProposalOptionSynthesisContext,
): Promise<ProposalOptionSynthesisResult> {
  const config = getAiProposalOptionProviderConfig();
  if (!config) return { ok: false, error: "ai-not-configured" };

  const messages = buildPromptMessages(context);
  const response = await callChatJson({
    messages,
    temperature: 0.2,
    maxTokens: 2400,
  });
  if (!response.ok) {
    return {
      ok: false,
      error: response.error,
      message: response.message,
    };
  }

  const parsed = safeParseJson(response.content);
  if (!parsed) {
    return { ok: false, error: "ai-response-invalid", message: "non-json" };
  }

  const candidate = validateCandidate(parsed, context.option.title);
  if (!candidate) {
    return {
      ok: false,
      error: "ai-response-invalid",
      message: "missing-required-fields",
    };
  }

  const violations = scanForBannedClaims(candidate);
  if (violations.length > 0) {
    return {
      ok: false,
      error: "ai-claim-violation",
      message: violations.map((v) => `${v.field}:${v.code}`).join(","),
    };
  }

  return {
    ok: true,
    candidate,
    providerMeta: { provider: config.provider, model: config.model },
  };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = [
  "You are SLATE, a senior AI advisory analyst drafting one proposal option for a human consultant to review.",
  "You produce conservative, executive-readable option copy grounded ONLY in the structured context the operator has already gathered.",
  "Drafts are operator-review-gated. The proposal will NOT be sent to a client by this pipeline — Send / Share / Export / SOW / e-signature stay locked at the UI layer.",
  "",
  "Hard rules:",
  "- Return JSON only. No prose, no preamble, no markdown.",
  "- Do not invent quotes, metrics, dollar figures, or stakeholder language. You have not read uploaded file contents — never claim to have.",
  "- Ground every claim in the supplied `findings`, `opportunities`, `roadmap`, `reportSections`, or the existing option metadata.",
  "- DO NOT propose pricing changes. Pricing lives in `option.pricingPlaceholder` (read-only). Never include dollar amounts, rate cards, or pricing math in your output.",
  "- DO NOT propose changing the option type (`option.optionType`), its position, or its recommendation flag. Those are operator-set commercial levers.",
  "- DO NOT propose changing the proposal's commercial-lever copy (credit eligibility, credit amount, credit window, credit notes). Those values are surfaced only as context.",
  "- DO NOT make ROI, savings, payback, break-even, cash-flow-positive, finance-approved, or guaranteed-financial claims of any kind. These are GATED until the docs/14 / docs/15 canons advance.",
  "- DO NOT use commercial-finality language: 'ready for signature', 'approved by finance', 'final commercial terms', 'binding quote', 'binding offer', 'executed SOW'. The proposal is a planning draft.",
  "- Forbidden phrases (case-insensitive): guaranteed ROI, guaranteed savings, payback, break-even, cash-flow positive, will save, will reduce cost, top quartile, above average, industry benchmark, peer benchmark, finance-approved, board-ready ROI, ready for signature, approved by finance, final commercial terms, binding quote.",
  "- Use safe planning language where appropriate: 'planning estimate', 'modeled implementation path', 'commercial option', 'subject to validation', 'requires operator review', 'pricing and final scope to be confirmed'.",
  "- Use a consultant register: plain-language, decision-grade, no superlatives, no marketing tone.",
  "- Reference linked findings / opportunities / roadmap items by title (not id) so the draft reads naturally for a human reviewer.",
  "- Be honest about gaps. If the option's evidence base is thin, write a short note in `assumptions` saying so rather than padding.",
].join("\n");

const SCHEMA_INSTRUCTION = [
  'Output schema: { "option": ProposalOptionDraft }',
  "where ProposalOptionDraft has the shape:",
  "{",
  '  "optionTitle": short noun-phrase headline (<= 200 chars) — may refine the existing title,',
  '  "bestFitScenario": 1-3 sentence "Best fit when…" framing (<= 600 chars),',
  '  "scopeNarrative": 2-6 paragraph scope + implementation narrative (<= 2000 chars). No markdown. No HTML.',
  '  "timeline": 1-2 sentence timeline (<= 220 chars). Reference weeks / days / phases — never dollar amounts.',
  '  "deliverables": array of up to 8 short workstream / deliverable strings,',
  '  "assumptions": array of up to 8 short strings calling out gaps, gated claims, and validation steps,',
  '  "dependencies": array of up to 6 short strings,',
  '  "risks": array of up to 6 short strings',
  "}",
].join("\n");

function buildPromptMessages(context: ProposalOptionSynthesisContext) {
  const userPayload = JSON.stringify(buildUserPayload(context), null, 2);
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: SCHEMA_INSTRUCTION },
    {
      role: "user" as const,
      content:
        "Draft a single proposal option for the following engagement. Use ONLY the structured context provided. Ground every claim in the supplied arrays.\n\n" +
        userPayload,
    },
  ];
}

function buildUserPayload(context: ProposalOptionSynthesisContext) {
  return {
    engagement: context.engagement,
    account: context.account,
    proposal: context.proposal,
    targetOption: context.option,
    siblingOptions: context.siblingOptions,
    findings: context.findings,
    opportunities: context.opportunities,
    roadmap: context.roadmap,
    reportSections: context.reportSections,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function validateCandidate(
  parsed: unknown,
  fallbackTitle: string,
): ProposalOptionDraftCandidate | null {
  const obj = extractOptionObject(parsed);
  if (!obj) return null;

  const optionTitle =
    clipString(obj.optionTitle, TITLE_LIMIT) ??
    clipString(fallbackTitle, TITLE_LIMIT);
  const bestFitScenario = clipString(obj.bestFitScenario, BEST_FIT_LIMIT);
  const scopeNarrative = clipString(obj.scopeNarrative, SCOPE_NARRATIVE_LIMIT);
  const timeline = clipString(obj.timeline, TIMELINE_LIMIT);
  if (!optionTitle || !bestFitScenario || !scopeNarrative || !timeline) {
    return null;
  }

  // Reject any HTML in the long-form fields.
  if (
    /<\s*[a-zA-Z]/.test(bestFitScenario) ||
    /<\s*[a-zA-Z]/.test(scopeNarrative) ||
    /<\s*[a-zA-Z]/.test(timeline)
  ) {
    return null;
  }

  const deliverables = clipStringArray(
    obj.deliverables,
    ARRAY_ITEM_LIMIT,
    MAX_DELIVERABLES,
  );
  const assumptions = clipStringArray(
    obj.assumptions,
    ARRAY_ITEM_LIMIT,
    MAX_ASSUMPTIONS,
  );
  const dependencies = clipStringArray(
    obj.dependencies,
    ARRAY_ITEM_LIMIT,
    MAX_DEPENDENCIES,
  );
  const risks = clipStringArray(obj.risks, ARRAY_ITEM_LIMIT, MAX_RISKS);

  return {
    optionTitle,
    bestFitScenario,
    scopeNarrative,
    timeline,
    deliverables,
    assumptions,
    dependencies,
    risks,
  };
}

function extractOptionObject(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  if (root.option && typeof root.option === "object") {
    return root.option as Record<string, unknown>;
  }
  if (root.draft && typeof root.draft === "object") {
    return root.draft as Record<string, unknown>;
  }
  return root;
}

function clipStringArray(
  value: unknown,
  itemMax: number,
  arrayMax: number,
): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= arrayMax) break;
    const clipped = clipString(item, itemMax);
    if (clipped) out.push(clipped);
  }
  return out;
}

function clipString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export const PROPOSAL_OPTION_SYNTHESIS_BOUNDS = {
  TITLE_LIMIT,
  BEST_FIT_LIMIT,
  SCOPE_NARRATIVE_LIMIT,
  TIMELINE_LIMIT,
  ARRAY_ITEM_LIMIT,
  MAX_DELIVERABLES,
  MAX_ASSUMPTIONS,
  MAX_DEPENDENCIES,
  MAX_RISKS,
};
