import "server-only";

import {
  COMMERCIAL_FINALITY_PATTERNS,
  FINANCIAL_CLAIM_PATTERNS,
  ROADMAP_COMMITMENT_PATTERNS,
  scanForBannedClaims as scanForBannedClaimsShared,
  type BannedClaimRule,
  type BannedClaimViolation as SharedBannedClaimViolation,
} from "./claim-guard";
import {
  callChatJson,
  getAiRoadmapProviderConfig,
} from "./provider";
import type { RoadmapSynthesisContext } from "./roadmap-context";
import type { AiProviderConfig } from "./types";

/**
 * Roadmap synthesis pipeline — AI Synthesis Step 5.
 *
 *   1. Format the structured context (engagement + account + approved
 *      findings + scored/selected opportunities + existing roadmap +
 *      operator-touched report sections + proposal options) into a
 *      deterministic JSON prompt.
 *   2. Call the configured provider with `response_format: json_object`.
 *   3. Validate the response with strict allowlists AND a combined
 *      banned-claim scanner (financial + commercial-finality +
 *      roadmap-commitment patterns).
 *   4. Return a typed list of planned roadmap items for the action to
 *      insert. **The validator drops any item whose title matches an
 *      existing roadmap item — Step 5 is append-only and never
 *      proposes duplicates.**
 *   5. Return one or more typed candidates; the action inserts them
 *      as `status='planned'` with `position` appended after the
 *      current last item in each phase. Existing items are NEVER
 *      modified or deleted.
 */

// ---------------------------------------------------------------------------
// Public types — DB-aligned enums so the action can persist verbatim.
// ---------------------------------------------------------------------------

export type RoadmapDraftDbPhase = "first_30" | "days_31_60" | "days_61_90";
export type RoadmapDraftDbPriority =
  | "quick_win"
  | "strategic_build"
  | "low_priority"
  | "defer"
  | "avoid";

export interface RoadmapDraftCandidate {
  title: string;
  phase: RoadmapDraftDbPhase;
  priority: RoadmapDraftDbPriority;
  objective: string;
  keyActions: string[];
  dependencies: string[];
  successCriteria: string[];
  risks: string[];
  linkedOpportunityId: string | null;
}

export interface RoadmapSynthesisOk {
  ok: true;
  candidates: RoadmapDraftCandidate[];
  assumptionsAndLimits: string[];
  providerMeta: {
    provider: AiProviderConfig["provider"];
    model: string;
  };
}

export type RoadmapSynthesisError =
  | "ai-not-configured"
  | "ai-request-failed"
  | "ai-response-invalid"
  | "ai-rate-limited"
  | "ai-timeout"
  | "ai-claim-violation";

export interface RoadmapSynthesisFailure {
  ok: false;
  error: RoadmapSynthesisError;
  message?: string;
}

export type RoadmapSynthesisResult = RoadmapSynthesisOk | RoadmapSynthesisFailure;

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

const MIN_ITEMS = 2;
const MAX_ITEMS = 6;

const TITLE_LIMIT = 200;
const OBJECTIVE_LIMIT = 600;
const ARRAY_ITEM_LIMIT = 200;
const MAX_KEY_ACTIONS = 6;
const MAX_DEPENDENCIES = 6;
const MAX_SUCCESS_CRITERIA = 6;
const MAX_RISKS = 6;
const MAX_ASSUMPTIONS = 5;

const VALID_PHASES: ReadonlySet<RoadmapDraftDbPhase> = new Set([
  "first_30",
  "days_31_60",
  "days_61_90",
]);
const VALID_PRIORITIES: ReadonlySet<RoadmapDraftDbPriority> = new Set([
  "quick_win",
  "strategic_build",
  "low_priority",
  "defer",
  "avoid",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Banned-claim scanner — financial + commercial-finality + roadmap-commit.
// ---------------------------------------------------------------------------

const COMBINED_PATTERNS: ReadonlyArray<BannedClaimRule> = [
  ...FINANCIAL_CLAIM_PATTERNS,
  ...COMMERCIAL_FINALITY_PATTERNS,
  ...ROADMAP_COMMITMENT_PATTERNS,
];

export interface BannedClaimViolation {
  field: string;
  code: string;
}

export function scanForBannedClaims(
  candidates: RoadmapDraftCandidate[],
  assumptionsAndLimits: string[],
): BannedClaimViolation[] {
  const fields: Array<{
    field: string;
    values: ReadonlyArray<string | null | undefined>;
  }> = [];
  candidates.forEach((c, i) => {
    fields.push({ field: `items[${i}].title`, values: [c.title] });
    fields.push({ field: `items[${i}].objective`, values: [c.objective] });
    fields.push({ field: `items[${i}].keyActions`, values: c.keyActions });
    fields.push({ field: `items[${i}].dependencies`, values: c.dependencies });
    fields.push({
      field: `items[${i}].successCriteria`,
      values: c.successCriteria,
    });
    fields.push({ field: `items[${i}].risks`, values: c.risks });
  });
  fields.push({ field: "assumptionsAndLimits", values: assumptionsAndLimits });

  const shared = scanForBannedClaimsShared(fields, COMBINED_PATTERNS);
  return shared.map<BannedClaimViolation>((v: SharedBannedClaimViolation) => ({
    field: v.field,
    code: v.code,
  }));
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function synthesizeRoadmapDraft(
  context: RoadmapSynthesisContext,
): Promise<RoadmapSynthesisResult> {
  const config = getAiRoadmapProviderConfig();
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

  const eligibleOpportunityIds = new Set(
    context.opportunities.map((o) => o.opportunityId),
  );
  // Existing-title dedup keys so the synthesizer can't duplicate
  // operator-sequenced work. Case + whitespace normalized.
  const existingTitleKeys = new Set(
    context.existingRoadmap.map((r) => normalizeTitle(r.title)),
  );

  const candidates = validateCandidates(
    parsed,
    eligibleOpportunityIds,
    existingTitleKeys,
  );
  const assumptionsAndLimits = validateAssumptions(parsed);

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "ai-response-invalid",
      message: "no-valid-candidates",
    };
  }

  const violations = scanForBannedClaims(candidates, assumptionsAndLimits);
  if (violations.length > 0) {
    return {
      ok: false,
      error: "ai-claim-violation",
      message: violations.map((v) => `${v.field}:${v.code}`).join(","),
    };
  }

  return {
    ok: true,
    candidates,
    assumptionsAndLimits,
    providerMeta: { provider: config.provider, model: config.model },
  };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = [
  "You are SLATE, a senior AI advisory analyst proposing draft roadmap items for a human consultant to review.",
  "You produce a small, actionable set of planned roadmap items derived ONLY from consultant-approved findings, selected opportunities, existing roadmap items, operator-touched report sections, and proposal-option context.",
  "Drafts are operator-review-gated. Items will not be sent to a client, completed, or finalized by this pipeline.",
  "",
  "Hard rules:",
  "- Return JSON only. No prose, no preamble, no markdown.",
  "- Do not invent quotes, dollar figures, stakeholder language, or facts not present in the supplied context.",
  "- Do not duplicate the title of any item already present in `existingRoadmap`. Reference them as context only.",
  "- Every linkedOpportunityId you set MUST be a UUID present in the supplied `opportunities` array. Use null when you cannot honestly link to one.",
  "- Use a consultant register: plain-language, decision-grade, no superlatives, no marketing tone.",
  "- Prefer concrete planned workstreams over vague aspirations.",
  "- DO NOT make ROI, savings, payback, break-even, cash-flow-positive, finance-approved, or guaranteed-financial claims of any kind. These are GATED until the docs/14 / docs/15 canons advance.",
  "- DO NOT make delivery commitments: 'guaranteed completion', 'binding timeline', 'final implementation schedule', 'committed delivery date', 'legally binding timeline', 'binding delivery commitment'. Roadmap items are PROPOSED SEQUENCES, not commitments.",
  "- DO NOT use commercial-finality language: 'ready for signature', 'approved by finance', 'final commercial terms', 'binding quote', 'binding offer', 'executed SOW'.",
  "- Forbidden phrases (case-insensitive): guaranteed ROI, guaranteed savings, payback, break-even, cash-flow positive, will save, will reduce cost, top quartile, above average, industry benchmark, peer benchmark, finance-approved, board-ready ROI, ready for signature, approved by finance, final commercial terms, binding quote, guaranteed completion, binding timeline, final implementation schedule, committed delivery date, legally binding timeline, binding delivery commitment.",
  "- Use safe planning language where appropriate: 'proposed sequence', 'planned workstream', 'operator-review draft', 'subject to validation', 'depends on access and stakeholder availability', 'target phase', 'recommended sequencing', 'draft milestone'.",
  `- Output between ${MIN_ITEMS} and ${MAX_ITEMS} roadmap items.`,
  "- Sequence items honestly: only put work in `first_30` that is grounded in already-selected opportunities; reserve `days_31_60` and `days_61_90` for follow-on workstreams that the existing evidence supports.",
].join("\n");

const SCHEMA_INSTRUCTION = [
  'Output schema: { "items": RoadmapDraft[], "assumptionsAndLimits": string[] }',
  "where each RoadmapDraft has the shape:",
  "{",
  '  "title": short noun-phrase headline (<= 200 chars),',
  '  "phase": one of ["first_30","days_31_60","days_61_90"],',
  '  "priority": one of ["quick_win","strategic_build","low_priority","defer","avoid"],',
  '  "objective": 1-3 sentence operator-facing objective (<= 600 chars). No markdown. No HTML.',
  '  "keyActions": array of up to 6 short strings,',
  '  "dependencies": array of up to 6 short strings,',
  '  "successCriteria": array of up to 6 short strings,',
  '  "risks": array of up to 6 short strings,',
  '  "linkedOpportunityId": UUID from the supplied `opportunities` array, or null',
  "}",
  'and assumptionsAndLimits is an array of up to 5 short strings calling out gaps, gated claims, and validation steps.',
].join("\n");

function buildPromptMessages(context: RoadmapSynthesisContext) {
  const userPayload = JSON.stringify(buildUserPayload(context), null, 2);
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: SCHEMA_INSTRUCTION },
    {
      role: "user" as const,
      content:
        "Draft a small set of planned roadmap items for the following engagement. Use ONLY the structured context provided. Do not duplicate existing roadmap items.\n\n" +
        userPayload,
    },
  ];
}

function buildUserPayload(context: RoadmapSynthesisContext) {
  return {
    engagement: context.engagement,
    account: context.account,
    findings: context.findings,
    opportunities: context.opportunities,
    existingRoadmap: context.existingRoadmap,
    reportSections: context.reportSections,
    proposalOptions: context.proposalOptions,
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

function validateCandidates(
  parsed: unknown,
  eligibleOpportunityIds: ReadonlySet<string>,
  existingTitleKeys: ReadonlySet<string>,
): RoadmapDraftCandidate[] {
  const items = extractItemsArray(parsed);
  if (!items) return [];
  const out: RoadmapDraftCandidate[] = [];
  const seenTitles = new Set<string>();
  for (const raw of items) {
    if (out.length >= MAX_ITEMS) break;
    const candidate = validateCandidate(raw, eligibleOpportunityIds);
    if (!candidate) continue;
    const titleKey = normalizeTitle(candidate.title);
    if (titleKey.length === 0) continue;
    if (existingTitleKeys.has(titleKey)) continue;
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);
    out.push(candidate);
  }
  return out;
}

function extractItemsArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.roadmap)) return obj.roadmap;
    if (Array.isArray(obj.roadmapItems)) return obj.roadmapItems;
  }
  return null;
}

function validateCandidate(
  raw: unknown,
  eligibleOpportunityIds: ReadonlySet<string>,
): RoadmapDraftCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const title = clipString(obj.title, TITLE_LIMIT);
  if (!title) return null;

  const objective = clipString(obj.objective, OBJECTIVE_LIMIT);
  if (!objective) return null;

  // Reject HTML in the long-form field.
  if (/<\s*[a-zA-Z]/.test(objective)) return null;

  const phase =
    typeof obj.phase === "string" && VALID_PHASES.has(obj.phase as RoadmapDraftDbPhase)
      ? (obj.phase as RoadmapDraftDbPhase)
      : null;
  if (!phase) return null;

  const priority =
    typeof obj.priority === "string" &&
    VALID_PRIORITIES.has(obj.priority as RoadmapDraftDbPriority)
      ? (obj.priority as RoadmapDraftDbPriority)
      : null;
  if (!priority) return null;

  const linkedOpportunityId = validateLinkedOpportunityId(
    obj.linkedOpportunityId,
    eligibleOpportunityIds,
  );

  return {
    title,
    phase,
    priority,
    objective,
    keyActions: clipStringArray(obj.keyActions, ARRAY_ITEM_LIMIT, MAX_KEY_ACTIONS),
    dependencies: clipStringArray(
      obj.dependencies,
      ARRAY_ITEM_LIMIT,
      MAX_DEPENDENCIES,
    ),
    successCriteria: clipStringArray(
      obj.successCriteria,
      ARRAY_ITEM_LIMIT,
      MAX_SUCCESS_CRITERIA,
    ),
    risks: clipStringArray(obj.risks, ARRAY_ITEM_LIMIT, MAX_RISKS),
    linkedOpportunityId,
  };
}

function validateLinkedOpportunityId(
  raw: unknown,
  eligibleOpportunityIds: ReadonlySet<string>,
): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!UUID_RE.test(trimmed)) return null;
  return eligibleOpportunityIds.has(trimmed) ? trimmed : null;
}

function validateAssumptions(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  return clipStringArray(
    obj.assumptionsAndLimits ?? obj.assumptions,
    ARRAY_ITEM_LIMIT,
    MAX_ASSUMPTIONS,
  );
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

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

export const ROADMAP_SYNTHESIS_BOUNDS = {
  MIN_ITEMS,
  MAX_ITEMS,
  TITLE_LIMIT,
  OBJECTIVE_LIMIT,
  ARRAY_ITEM_LIMIT,
  MAX_KEY_ACTIONS,
  MAX_DEPENDENCIES,
  MAX_SUCCESS_CRITERIA,
  MAX_RISKS,
  MAX_ASSUMPTIONS,
};
