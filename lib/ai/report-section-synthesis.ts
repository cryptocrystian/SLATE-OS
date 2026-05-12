import "server-only";

import {
  FINANCIAL_CLAIM_PATTERNS,
  scanForBannedClaims as scanForBannedClaimsShared,
  type BannedClaimViolation as SharedBannedClaimViolation,
} from "./claim-guard";
import {
  callChatJson,
  getAiReportSectionProviderConfig,
} from "./provider";
import type { ReportSectionSynthesisContext } from "./report-section-context";
import type { AiProviderConfig } from "./types";

/**
 * Report-section synthesis pipeline — AI Synthesis Step 3.
 *
 *   1. Format the structured context (engagement + section + approved
 *      findings + scored/selected opportunities + roadmap items +
 *      stakeholder intake aggregates + the section's persisted
 *      `exhibit_slot`) into a deterministic JSON prompt.
 *   2. Call the configured provider with `response_format: json_object`.
 *   3. Validate the response with strict allowlists AND a banned-claim
 *      scanner that rejects benchmark / ROI / savings / payback /
 *      break-even / "guaranteed" / "above average" / "top quartile"
 *      language. Per `docs/14` / `docs/15` / `docs/17`, these claims
 *      are gated until the corresponding data canons advance — the AI
 *      synthesis path MUST NOT introduce them in any draft.
 *   4. Return a typed draft for the action to persist into the section's
 *      scalar columns (`summary`, `draft_preview`, `evidence_notes`).
 *
 * The validator never trusts the model to set the section status —
 * the calling action always demotes the section to `needs_review` per
 * `docs/17` § Acceptance Criteria.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReportSectionDraftCandidate {
  /** Polished title — may match the existing section.title or refine it. */
  sectionTitle: string;
  /** Executive-readable summary, persisted into `report_sections.summary`. */
  summary: string;
  /** Longer draft, persisted into `report_sections.draft_preview`. */
  draftPreview: string;
  /**
   * Per-bullet evidence notes — joined and persisted into
   * `report_sections.evidence_notes`. Each entry should reference
   * persisted findings / opportunities / roadmap items / intake
   * aggregates, never invented content.
   */
  evidenceNotes: string[];
  /**
   * Assumptions & limits — surfaced into evidence_notes (prefixed) so
   * the operator sees the model's caveats in the same field.
   */
  assumptionsAndLimits: string[];
}

export interface ReportSectionSynthesisOk {
  ok: true;
  candidate: ReportSectionDraftCandidate;
  providerMeta: {
    provider: AiProviderConfig["provider"];
    model: string;
  };
}

export type ReportSectionSynthesisError =
  | "ai-not-configured"
  | "ai-request-failed"
  | "ai-response-invalid"
  | "ai-rate-limited"
  | "ai-timeout"
  | "ai-claim-violation";

export interface ReportSectionSynthesisFailure {
  ok: false;
  error: ReportSectionSynthesisError;
  /** Short, sanitized error detail for logs only. */
  message?: string;
}

export type ReportSectionSynthesisResult =
  | ReportSectionSynthesisOk
  | ReportSectionSynthesisFailure;

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

const TITLE_LIMIT = 200;
const SUMMARY_LIMIT = 600;
const DRAFT_PREVIEW_LIMIT = 2400;
const NOTE_LIMIT = 320;
const MAX_EVIDENCE_NOTES = 8;
const MAX_ASSUMPTIONS = 5;

// ---------------------------------------------------------------------------
// Banned-claim scanner — per docs/14 / docs/15 / docs/17.
// Step 3 uses the shared FINANCIAL_CLAIM_PATTERNS from
// `lib/ai/claim-guard.ts`. Matching is case-insensitive against the
// candidate string fields. Listed phrases are the canon's prohibition
// list; they MUST NOT appear in persisted AI draft output. (They are
// allowed to appear in `claim-guard.ts` and canon docs as prohibition
// strings.)
// ---------------------------------------------------------------------------

export interface BannedClaimViolation {
  field: keyof ReportSectionDraftCandidate;
  code: string;
}

export function scanForBannedClaims(
  candidate: ReportSectionDraftCandidate,
): BannedClaimViolation[] {
  const shared = scanForBannedClaimsShared(
    [
      { field: "sectionTitle", values: [candidate.sectionTitle] },
      { field: "summary", values: [candidate.summary] },
      { field: "draftPreview", values: [candidate.draftPreview] },
      { field: "evidenceNotes", values: candidate.evidenceNotes },
      { field: "assumptionsAndLimits", values: candidate.assumptionsAndLimits },
    ],
    FINANCIAL_CLAIM_PATTERNS,
  );
  return shared.map<BannedClaimViolation>(
    (v: SharedBannedClaimViolation) => ({
      field: v.field as keyof ReportSectionDraftCandidate,
      code: v.code,
    }),
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function synthesizeReportSectionDraft(
  context: ReportSectionSynthesisContext,
): Promise<ReportSectionSynthesisResult> {
  const config = getAiReportSectionProviderConfig();
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

  const candidate = validateCandidate(parsed, context.section.title);
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
  "You are SLATE, a senior AI advisory analyst drafting one report section for a human consultant to review.",
  "You produce a conservative, executive-readable draft grounded ONLY in the structured context the operator has already gathered.",
  "Drafts are operator-review-gated. They are NEVER finalized or sent to a client by this pipeline — the human operator approves, edits, or rejects.",
  "",
  "Hard rules:",
  "- Return JSON only. No prose, no preamble, no markdown.",
  "- Do not invent quotes, metrics, or stakeholder language. You have not read uploaded file contents — never claim to have.",
  "- Ground every claim in the supplied `findings`, `opportunities`, `roadmap`, or `intake` arrays. If evidence is missing, say so explicitly in `assumptionsAndLimits`.",
  "- Do NOT make benchmark claims, ROI claims, savings claims, payback claims, break-even claims, or financial-return claims of any kind. These exhibits are GATED until the corresponding data canons advance (docs/14, docs/15).",
  "- If the section would naturally touch financial or benchmark topics, use safe language such as:",
  '    "Benchmark comparison is not yet available because the benchmark dataset is not validated."',
  '    "Financial modeling is gated until assumptions are validated."',
  '    "This section intentionally avoids ROI or savings claims."',
  "- If the section's `exhibitSlot` is one of the five Group-A slots, you MAY reference the exhibit as internal supporting context only — never as a final client artifact, and never as a benchmark or financial figure.",
  "- Forbidden phrases (case-insensitive): guaranteed ROI, guaranteed savings, payback, break-even, cash-flow positive, will save, will reduce cost, top quartile, above average, industry benchmark, peer benchmark, finance-approved, board-ready ROI.",
  "- Use a consultant register: plain-language, decision-grade, no superlatives, no marketing tone.",
  "- Be honest about gaps. If the section lacks evidence, write a short note saying so rather than padding.",
  "- The `recommendedStatus` field MUST be `needs_review`. You do not approve your own draft.",
].join("\n");

const SCHEMA_INSTRUCTION = [
  'Output schema: { "section": ReportSectionDraft }',
  "where ReportSectionDraft has the shape:",
  "{",
  '  "sectionTitle": short noun-phrase headline (<= 200 chars),',
  '  "summary": 1-3 sentence executive summary (<= 600 chars),',
  '  "draftPreview": 1-6 paragraph operator-facing draft (<= 2400 chars). No markdown, no HTML.',
  '  "evidenceNotes": array of up to 8 short bullet strings, each referencing a finding / opportunity / roadmap item / intake aggregate by name or id,',
  '  "assumptionsAndLimits": array of up to 5 short bullet strings calling out missing data, gated claims, and required validation steps,',
  '  "recommendedStatus": "needs_review"',
  "}",
].join("\n");

function buildPromptMessages(context: ReportSectionSynthesisContext) {
  const userPayload = JSON.stringify(buildUserPayload(context), null, 2);
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: SCHEMA_INSTRUCTION },
    {
      role: "user" as const,
      content:
        "Draft a single report section for the following engagement. Use ONLY the structured context provided. Ground every claim in the supplied arrays.\n\n" +
        userPayload,
    },
  ];
}

function buildUserPayload(context: ReportSectionSynthesisContext) {
  return {
    engagement: context.engagement,
    account: context.account,
    targetSection: context.section,
    siblingSections: context.siblingSections,
    findings: context.findings,
    opportunities: context.opportunities,
    roadmap: context.roadmap,
    intake: context.intake,
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
): ReportSectionDraftCandidate | null {
  // Accept both `{section: ...}` and a bare draft object.
  const obj = extractSectionObject(parsed);
  if (!obj) return null;

  const sectionTitle =
    clipString(obj.sectionTitle, TITLE_LIMIT) ??
    clipString(fallbackTitle, TITLE_LIMIT);
  const summary = clipString(obj.summary, SUMMARY_LIMIT);
  const draftPreview = clipString(obj.draftPreview, DRAFT_PREVIEW_LIMIT);
  if (!sectionTitle || !summary || !draftPreview) return null;

  // Reject any HTML — `<` followed by a letter is enough of a signal.
  if (/<\s*[a-zA-Z]/.test(summary) || /<\s*[a-zA-Z]/.test(draftPreview)) {
    return null;
  }

  const evidenceNotes = clipStringArray(
    obj.evidenceNotes,
    NOTE_LIMIT,
    MAX_EVIDENCE_NOTES,
  );
  const assumptionsAndLimits = clipStringArray(
    obj.assumptionsAndLimits,
    NOTE_LIMIT,
    MAX_ASSUMPTIONS,
  );

  return {
    sectionTitle,
    summary,
    draftPreview,
    evidenceNotes,
    assumptionsAndLimits,
  };
}

function extractSectionObject(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  if (root.section && typeof root.section === "object") {
    return root.section as Record<string, unknown>;
  }
  if (root.sections && typeof root.sections === "object" && !Array.isArray(root.sections)) {
    return root.sections as Record<string, unknown>;
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

export const REPORT_SECTION_SYNTHESIS_BOUNDS = {
  TITLE_LIMIT,
  SUMMARY_LIMIT,
  DRAFT_PREVIEW_LIMIT,
  NOTE_LIMIT,
  MAX_EVIDENCE_NOTES,
  MAX_ASSUMPTIONS,
};
