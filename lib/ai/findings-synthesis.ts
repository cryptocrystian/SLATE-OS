import "server-only";

import {
  callChatJson,
  getAiProviderConfig,
} from "./provider";
import type { FindingsSynthesisContext } from "./findings-context";
import type {
  DraftFindingCandidate,
  DraftFindingCategory,
  DraftFindingConfidence,
  DraftFindingSourceRef,
  DraftFindingSourceStrength,
  DraftFindingSourceType,
  ProviderInvocationResult,
} from "./types";

/**
 * Findings synthesis pipeline:
 *   1. Format the structured context into a tight, deterministic prompt.
 *   2. Call the configured provider, asking for JSON only.
 *   3. Validate the response with explicit allowlists; drop malformed
 *      candidates rather than coercing them.
 *
 * The validator is intentionally strict — every guard is enforced
 * before persistence so the DB never receives a raw model object.
 */

const MIN_FINDINGS = 3;
const MAX_FINDINGS = 7;

const VALID_CATEGORIES: ReadonlySet<DraftFindingCategory> = new Set([
  "workflow_friction",
  "systems_gap",
  "data_readiness",
  "adoption_risk",
  "governance_risk",
  "revenue_opportunity",
  "back_office_efficiency",
  "customer_experience",
]);

const VALID_CONFIDENCES: ReadonlySet<DraftFindingConfidence> = new Set([
  "high",
  "medium",
  "low",
  "needs_evidence",
]);

const VALID_SOURCE_TYPES: ReadonlySet<DraftFindingSourceType> = new Set([
  "stakeholder_response",
  "input_asset",
  "scorecard_answer",
  "consultant_note",
]);

const VALID_STRENGTHS: ReadonlySet<DraftFindingSourceStrength> = new Set([
  "strong",
  "adequate",
  "thin",
  "missing",
]);

const STATEMENT_LIMIT = 240;
const SUMMARY_LIMIT = 600;
const EVIDENCE_LIMIT = 600;
const IMPACT_LIMIT = 320;
const ASSUMPTION_LIMIT = 320;
const SOURCE_LABEL_LIMIT = 160;
const SOURCE_ROLE_LIMIT = 80;
const EXCERPT_LIMIT = 360;

/**
 * Public entry point: produce validated draft finding candidates.
 *
 * Returns a controlled error envelope when the provider is not
 * configured, the call fails, or the response cannot be validated.
 * Caller (the server action) is responsible for translating these
 * envelopes into UI-safe messages.
 */
export async function synthesizeDraftFindings(
  context: FindingsSynthesisContext,
): Promise<ProviderInvocationResult> {
  const config = getAiProviderConfig();
  if (!config) return { ok: false, error: "ai-not-configured" };

  const messages = buildPromptMessages(context);
  const response = await callChatJson({
    messages,
    temperature: 0.2,
    maxTokens: 1800,
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
  const candidates = validateCandidates(parsed);
  if (candidates.length === 0) {
    return { ok: false, error: "ai-response-invalid", message: "no-valid-candidates" };
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
  "You are SLATE, a senior AI advisory analyst preparing draft findings for a human consultant to review.",
  "You produce concise, evidence-backed observations about an organization's operational and AI readiness based ONLY on structured context the operator has already gathered.",
  "Findings will not be published to the client until a human consultant explicitly approves them.",
  "",
  "Hard rules:",
  "- Return JSON only. No prose, no preamble, no markdown.",
  "- Do not invent stakeholder quotes. Only quote text that appears verbatim in the supplied context.",
  "- Treat input assets as METADATA ONLY. You have not read the underlying file content; never claim to have.",
  "- Avoid duplicating any existing finding's statement or category combination.",
  "- Use professional consultant register. No marketing tone, no superlatives.",
  "- Mark a finding with assumptionFlag=true and supply assumptionNote whenever evidence is thin or absent.",
  "- Every finding must either have at least one sourceRef OR be marked assumptionFlag=true.",
  "- Source refs strength: 'strong' = multiple corroborating responses; 'adequate' = single clear response; 'thin' = inferred from context; 'missing' = no direct evidence.",
  `- Output between ${MIN_FINDINGS} and ${MAX_FINDINGS} findings.`,
].join("\n");

const SCHEMA_INSTRUCTION = [
  'Output schema: { "findings": DraftFinding[] }',
  "where each DraftFinding has the shape:",
  "{",
  '  "category": one of ["workflow_friction","systems_gap","data_readiness","adoption_risk","governance_risk","revenue_opportunity","back_office_efficiency","customer_experience"],',
  '  "statement": short single-sentence headline (<= 240 chars),',
  '  "summary": 1-3 sentence summary,',
  '  "evidenceSummary": 1-3 sentence reading of the supporting evidence,',
  '  "confidence": one of ["high","medium","low","needs_evidence"],',
  '  "suggestedImpact": optional 1-sentence impact note,',
  '  "assumptionFlag": boolean,',
  '  "assumptionNote": optional note required when assumptionFlag=true,',
  '  "sourceRefs": array of { "sourceType": one of ["stakeholder_response","input_asset","scorecard_answer","consultant_note"], "sourceId": optional uuid string, "sourceLabel": short label, "sourceRole": optional role string, "excerpt": optional <=360 char excerpt, "strength": one of ["strong","adequate","thin","missing"] }',
  "}",
].join("\n");

function buildPromptMessages(context: FindingsSynthesisContext) {
  const userPayload = JSON.stringify(buildUserPayload(context), null, 2);
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: SCHEMA_INSTRUCTION },
    {
      role: "user" as const,
      content:
        "Draft findings for the following engagement. Use ONLY the structured context provided.\n\n" +
        userPayload,
    },
  ];
}

function buildUserPayload(context: FindingsSynthesisContext) {
  return {
    engagement: context.engagement,
    account: context.account,
    scorecard: context.scorecard,
    intake: context.intake,
    inputAssets: context.inputAssets,
    existingFindings: context.existingFindings,
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

function validateCandidates(parsed: unknown): DraftFindingCandidate[] {
  const findingsArray = extractFindingsArray(parsed);
  if (!findingsArray) return [];
  const out: DraftFindingCandidate[] = [];
  for (const raw of findingsArray) {
    if (out.length >= MAX_FINDINGS) break;
    const candidate = validateCandidate(raw);
    if (candidate) out.push(candidate);
  }
  return out;
}

function extractFindingsArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.findings)) return obj.findings;
    if (Array.isArray(obj.draftFindings)) return obj.draftFindings;
    if (Array.isArray(obj.candidates)) return obj.candidates;
  }
  return null;
}

function validateCandidate(raw: unknown): DraftFindingCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const statement = clipString(obj.statement, STATEMENT_LIMIT);
  if (!statement) return null;

  const category = isString(obj.category) && VALID_CATEGORIES.has(obj.category as DraftFindingCategory)
    ? (obj.category as DraftFindingCategory)
    : null;
  if (!category) return null;

  const confidence = isString(obj.confidence) && VALID_CONFIDENCES.has(obj.confidence as DraftFindingConfidence)
    ? (obj.confidence as DraftFindingConfidence)
    : "needs_evidence";

  const summary = clipString(obj.summary, SUMMARY_LIMIT) ?? "";
  const evidenceSummary = clipString(obj.evidenceSummary, EVIDENCE_LIMIT) ?? "";
  const suggestedImpact = clipString(obj.suggestedImpact, IMPACT_LIMIT) ?? undefined;

  const assumptionFlag = obj.assumptionFlag === true;
  const assumptionNote = assumptionFlag
    ? clipString(obj.assumptionNote, ASSUMPTION_LIMIT) ?? undefined
    : undefined;

  const sourceRefs = validateSourceRefs(obj.sourceRefs);

  // Boundary rule: every finding must either have evidence or carry an
  // explicit assumption flag.
  if (sourceRefs.length === 0 && !assumptionFlag) return null;

  return {
    category,
    statement,
    summary,
    evidenceSummary,
    confidence,
    suggestedImpact,
    assumptionFlag,
    assumptionNote,
    sourceRefs,
  };
}

function validateSourceRefs(raw: unknown): DraftFindingSourceRef[] {
  if (!Array.isArray(raw)) return [];
  const out: DraftFindingSourceRef[] = [];
  for (const candidate of raw) {
    if (out.length >= 6) break;
    if (!candidate || typeof candidate !== "object") continue;
    const c = candidate as Record<string, unknown>;
    const sourceType =
      isString(c.sourceType) && VALID_SOURCE_TYPES.has(c.sourceType as DraftFindingSourceType)
        ? (c.sourceType as DraftFindingSourceType)
        : null;
    if (!sourceType) continue;
    const sourceLabel = clipString(c.sourceLabel, SOURCE_LABEL_LIMIT);
    if (!sourceLabel) continue;
    const strength =
      isString(c.strength) && VALID_STRENGTHS.has(c.strength as DraftFindingSourceStrength)
        ? (c.strength as DraftFindingSourceStrength)
        : "adequate";
    out.push({
      sourceType,
      sourceId: isString(c.sourceId) && UUID_RE.test(c.sourceId) ? c.sourceId : undefined,
      sourceLabel,
      sourceRole: clipString(c.sourceRole, SOURCE_ROLE_LIMIT) ?? undefined,
      excerpt: clipString(c.excerpt, EXCERPT_LIMIT) ?? undefined,
      strength,
    });
  }
  return out;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export const FINDINGS_SYNTHESIS_BOUNDS = {
  MIN_FINDINGS,
  MAX_FINDINGS,
};
