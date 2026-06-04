import "server-only";

import {
  callChatJson,
  getAiOpportunityProviderConfig,
} from "./provider";
import type { OpportunitySynthesisContext } from "./opportunities-context";
import type {
  DraftOpportunityCandidate,
  DraftOpportunityEvidenceStrength,
  OpportunityProviderInvocationResult,
} from "./types";

/**
 * Opportunity synthesis pipeline.
 *
 *   1. Format the structured opportunity context (which is itself
 *      built ONLY from approved/report-ready findings) into a tight,
 *      deterministic prompt.
 *   2. Call the configured provider, asking for JSON only.
 *   3. Validate the response with explicit allowlists; drop malformed
 *      candidates rather than coercing them.
 *
 * The validator never trusts model-provided priority/quadrant — only
 * raw 0–100 scores travel through. The server action is responsible
 * for derivation (impact + complexity + risk → quadrant + priority).
 */

const MIN_OPPORTUNITIES = 2;
const MAX_OPPORTUNITIES = 6;

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  "Sales / Revenue Operations",
  "Client Intake / Onboarding",
  "Proposal / Document Generation",
  "Customer Support / Triage",
  "Internal Knowledge / Retrieval",
  "Reporting / Analytics",
  "Back-office Automation",
  "Systems Integration",
  "Governance / Risk Controls",
]);

const VALID_EVIDENCE: ReadonlySet<DraftOpportunityEvidenceStrength> = new Set([
  "strong",
  "adequate",
  "thin",
]);

const TITLE_LIMIT = 160;
const DESCRIPTION_LIMIT = 800;
const SOURCE_SUMMARY_LIMIT = 600;
const RECOMMENDED_ACTION_LIMIT = 400;
const IMPLEMENTATION_LIMIT = 500;
const ARRAY_ITEM_LIMIT = 200;
const MAX_ARRAY_ITEMS = 6;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function synthesizeDraftOpportunities(
  context: OpportunitySynthesisContext,
): Promise<OpportunityProviderInvocationResult> {
  const config = getAiOpportunityProviderConfig();
  if (!config) return { ok: false, error: "ai-not-configured" };

  const messages = buildPromptMessages(context);
  const response = await callChatJson({
    messages,
    temperature: 0.2,
    maxTokens: 2200,
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

  const eligibleFindingIds = new Set(context.findings.map((f) => f.findingId));
  const candidates = validateCandidates(parsed, eligibleFindingIds);
  if (candidates.length === 0) {
    return {
      ok: false,
      error: "ai-response-invalid",
      message: "no-valid-candidates",
    };
  }
  return {
    ok: true,
    candidates,
    providerMeta: { provider: config.provider, model: config.model },
  };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = [
  "You are SLATE, a senior AI advisory analyst proposing draft opportunities for a human consultant to review.",
  "You produce a small, actionable set of opportunities derived ONLY from consultant-approved findings and the structured context the operator has already gathered.",
  "Opportunities are drafts. They will not become roadmap items, reports, or proposals until the human operator selects them.",
  "",
  "Hard rules:",
  "- Return JSON only. No prose, no preamble, no markdown.",
  "- Do not invent quotes. You have not read uploaded file contents — never claim to have.",
  "- Every opportunity must link to AT LEAST ONE finding by its findingId from the supplied `findings` array. Do not link to anything else.",
  "- Do not duplicate the title or scope of any opportunity already present in `existingOpportunities`.",
  "- Use a consultant register: plain-language, decision-grade, no superlatives, no marketing tone.",
  "- Prefer concrete implementation shapes over vague aspirations.",
  "- Score each axis 0–100 (integer). Higher complexity = harder to implement. Higher risk = more delivery / adoption / governance risk.",
  "- Do NOT output priority, quadrant, or a recommended-action verb beyond what is requested below — the server derives priority and quadrant from your scores.",
  `- Output between ${MIN_OPPORTUNITIES} and ${MAX_OPPORTUNITIES} opportunities.`,
  "",
  "Provenance-aware evidence rule (Sprint S6):",
  "- Each finding carries a `needsValidation` boolean and an `assumptionFlag` boolean projected from its persisted source-refs by the upstream provenance helper.",
  "- When an opportunity links ONLY to findings where `needsValidation = true` (or `assumptionFlag = true`), set `evidenceStrength = 'thin'`, raise `riskScore` to reflect delivery uncertainty, and use conservative implementation-shape language (\"investigate\", \"validate\", \"scope\") instead of imperative commitment (\"build\", \"ship\", \"automate\").",
  "- When an opportunity mixes some `needsValidation = true` source findings with stronger ones, default `evidenceStrength` to `'adequate'` at most; do not assert `'strong'`.",
  "- Only assert `evidenceStrength = 'strong'` when ALL linked source findings have `needsValidation = false`.",
  "- The operator UI inherits the needs-validation flag from your linked findings; conservative wording is the right register when that flag will be visible.",
].join("\n");

const SCHEMA_INSTRUCTION = [
  'Output schema: { "opportunities": DraftOpportunity[] }',
  "where each DraftOpportunity has the shape:",
  "{",
  '  "title": short noun-phrase headline (<= 160 chars),',
  '  "category": one of [',
  '    "Sales / Revenue Operations",',
  '    "Client Intake / Onboarding",',
  '    "Proposal / Document Generation",',
  '    "Customer Support / Triage",',
  '    "Internal Knowledge / Retrieval",',
  '    "Reporting / Analytics",',
  '    "Back-office Automation",',
  '    "Systems Integration",',
  '    "Governance / Risk Controls"',
  '  ],',
  '  "description": 2-4 sentence operator-facing description,',
  '  "linkedFindingIds": array of 1-5 finding UUIDs taken verbatim from the provided `findings` list,',
  '  "businessImpactScore": integer 0-100,',
  '  "complexityScore": integer 0-100,',
  '  "riskScore": integer 0-100,',
  '  "timeToValueScore": integer 0-100,',
  '  "adoptionLikelihoodScore": integer 0-100,',
  '  "strategicValueScore": integer 0-100,',
  '  "evidenceStrength": one of ["strong","adequate","thin"],',
  '  "sourceSummary": 1-3 sentence explanation grounded in the linked findings,',
  '  "recommendedAction": 1-2 sentence next step,',
  '  "implementationShape": 1-3 sentence high-level implementation concept,',
  '  "dependencies": array of up to 6 short strings,',
  '  "risks": array of up to 6 short strings,',
  '  "successSignals": array of up to 6 short strings',
  "}",
].join("\n");

function buildPromptMessages(context: OpportunitySynthesisContext) {
  const userPayload = JSON.stringify(buildUserPayload(context), null, 2);
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: SCHEMA_INSTRUCTION },
    {
      role: "user" as const,
      content:
        "Draft opportunities for the following engagement. Use ONLY the structured context provided. Every opportunity must link to one or more findings from the `findings` array.\n\n" +
        userPayload,
    },
  ];
}

function buildUserPayload(context: OpportunitySynthesisContext) {
  return {
    engagement: context.engagement,
    account: context.account,
    scorecard: context.scorecard,
    findings: context.findings,
    inputAssets: context.inputAssets,
    existingOpportunities: context.existingOpportunities,
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
  eligibleFindingIds: ReadonlySet<string>,
): DraftOpportunityCandidate[] {
  const opportunitiesArray = extractOpportunitiesArray(parsed);
  if (!opportunitiesArray) return [];
  const out: DraftOpportunityCandidate[] = [];
  const seenTitles = new Set<string>();
  for (const raw of opportunitiesArray) {
    if (out.length >= MAX_OPPORTUNITIES) break;
    const candidate = validateCandidate(raw, eligibleFindingIds);
    if (!candidate) continue;
    const titleKey = normalizeTitle(candidate.title);
    if (titleKey.length === 0 || seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);
    out.push(candidate);
  }
  return out;
}

function extractOpportunitiesArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.opportunities)) return obj.opportunities;
    if (Array.isArray(obj.draftOpportunities)) return obj.draftOpportunities;
    if (Array.isArray(obj.candidates)) return obj.candidates;
  }
  return null;
}

function validateCandidate(
  raw: unknown,
  eligibleFindingIds: ReadonlySet<string>,
): DraftOpportunityCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const title = clipString(obj.title, TITLE_LIMIT);
  if (!title) return null;

  const category =
    typeof obj.category === "string" && VALID_CATEGORIES.has(obj.category)
      ? obj.category
      : null;
  if (!category) return null;

  const linkedFindingIds = collectLinkedFindingIds(
    obj.linkedFindingIds,
    eligibleFindingIds,
  );
  if (linkedFindingIds.length === 0) return null;

  const description = clipString(obj.description, DESCRIPTION_LIMIT) ?? "";
  const sourceSummary =
    clipString(obj.sourceSummary, SOURCE_SUMMARY_LIMIT) ?? "";
  const recommendedAction =
    clipString(obj.recommendedAction, RECOMMENDED_ACTION_LIMIT) ?? "";
  const implementationShape =
    clipString(obj.implementationShape, IMPLEMENTATION_LIMIT) ?? "";

  const evidenceStrength = isString(obj.evidenceStrength)
    ? (obj.evidenceStrength as DraftOpportunityEvidenceStrength)
    : "adequate";
  const evidenceFinal: DraftOpportunityEvidenceStrength =
    VALID_EVIDENCE.has(evidenceStrength) ? evidenceStrength : "adequate";

  return {
    title,
    category,
    description,
    linkedFindingIds,
    businessImpactScore: clampScore(obj.businessImpactScore),
    complexityScore: clampScore(obj.complexityScore),
    riskScore: clampScore(obj.riskScore),
    timeToValueScore: clampScore(obj.timeToValueScore),
    adoptionLikelihoodScore: clampScore(obj.adoptionLikelihoodScore),
    strategicValueScore: clampScore(obj.strategicValueScore),
    evidenceStrength: evidenceFinal,
    sourceSummary,
    recommendedAction,
    implementationShape,
    dependencies: clipStringArray(obj.dependencies),
    risks: clipStringArray(obj.risks),
    successSignals: clipStringArray(obj.successSignals),
  };
}

function collectLinkedFindingIds(
  raw: unknown,
  eligibleFindingIds: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!UUID_RE.test(trimmed)) continue;
    if (!eligibleFindingIds.has(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= 5) break;
  }
  return out;
}

function clampScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clipStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= MAX_ARRAY_ITEMS) break;
    const clipped = clipString(item, ARRAY_ITEM_LIMIT);
    if (clipped) out.push(clipped);
  }
  return out;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
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

export const OPPORTUNITY_SYNTHESIS_BOUNDS = {
  MIN_OPPORTUNITIES,
  MAX_OPPORTUNITIES,
};
