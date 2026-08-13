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
  /**
   * Sprint S8 — structural source provenance. The model returns the
   * IDs of upstream findings / opportunities / roadmap items it
   * actually grounded the draft in. The validator drops any ID that is
   * not present in the supplied context (the upstream allowlist is the
   * authoritative source — the model cannot invent provenance). The
   * action then writes these into the three
   * `report_section_*_links` tables so the source trail is queryable
   * and surfaces in the operator UI provenance panel.
   *
   * These arrays are deduped and capped at MAX_GROUNDED_IDS each. An
   * empty array is valid (e.g. the appendix section may legitimately
   * have no per-finding link).
   */
  groundedFindingIds: string[];
  groundedOpportunityIds: string[];
  groundedRoadmapItemIds: string[];
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
// Sprint S8 — structural provenance caps.
const MAX_GROUNDED_FINDINGS = 12;
const MAX_GROUNDED_OPPORTUNITIES = 12;
const MAX_GROUNDED_ROADMAP_ITEMS = 12;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const candidate = validateCandidate(parsed, context);
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
  "You are a senior AI advisory consultant at Saipien Labs, drafting one section of a client discovery report for a human colleague to review.",
  "Write the way a McKinsey/BCG/Bain engagement lead writes: plain, direct, decision-grade prose grounded ONLY in the structured context the operator has already gathered.",
  "Drafts are operator-review-gated. They are NEVER finalized or sent to a client by this pipeline — the human operator approves, edits, or rejects.",
  "",
  "VOICE — write like a human consultant, not a content generator:",
  "- Lead with the point. The first sentence states the substantive conclusion, never a description of the document.",
  "- NEVER open `summary` or `draftPreview` with meta-language about the writing itself. Banned openers (case-insensitive, anywhere they'd start a paragraph): \"This section\", \"This report\", \"This analysis\", \"This appendix\", \"In this section\", \"The following\", \"This document\", \"Here we\".",
  "- Banned filler (case-insensitive): \"positioned to leverage\", \"leverage AI\", \"leverage technolog\", \"path forward\", \"actionable steps\", \"actionable insights\", \"aims to\", \"seeks to\", \"plays a key role\", \"plays a critical role\", \"plays a crucial role\", \"in today's\", \"ever-evolving\", \"ever-changing\", \"robust\", \"seamless\", \"holistic\", \"it is important to note\", \"it is worth noting\", \"delve\", \"underscore\", \"a testament to\", \"unlock\", \"empower\", \"synergy\", \"cutting-edge\", \"world-class\".",
  "- Vary sentence structure and length. Prefer concrete operational specifics (systems, roles, handoffs, volumes) over abstraction. No superlatives, no marketing tone.",
  "- Name real specifics from the context (system names, roles, workflow steps). Do not generalize a concrete finding into vague 'operational efficiency' language.",
  "",
  "STRUCTURE — `summary` and `draftPreview` do DIFFERENT jobs; never let them overlap:",
  "- `summary`: the single most important takeaway of THIS section, stated as a claim in 1–2 sentences. It is NOT a preview and must not describe the section. A reader who reads only summaries across all sections should get a coherent executive story.",
  "- `draftPreview`: the analysis that supports the summary. Do NOT restate the summary sentence. Do NOT re-narrate findings that belong to other sections — reference them in at most one clause and spend the space on THIS section's distinct job (stated in the SECTION CHARTER message).",
  "",
  "ANTI-REPETITION — this is one section of a multi-section report:",
  "- Every section shares the same underlying findings/opportunities/roadmap. Do NOT reproduce the full list in each section. Only the Appendix may enumerate everything; every other section synthesizes through its own charter lens.",
  "- Assume the reader has already read the earlier sections. Build on them; do not reset.",
  "",
  "Hard rules:",
  "- Return JSON only. No prose, no preamble, no markdown.",
  "- Do not invent quotes, metrics, or stakeholder language. You have not read uploaded file contents — never claim to have.",
  "- Ground every claim in the supplied `findings`, `opportunities`, `roadmap`, or `intake` arrays. If evidence is missing, say so explicitly in `assumptionsAndLimits`.",
  "- Do NOT make benchmark claims, ROI claims, savings claims, payback claims, break-even claims, or financial-return claims of any kind. These exhibits are GATED until the corresponding data canons advance (docs/14, docs/15).",
  "- If the section would naturally touch financial or benchmark topics, use safe language such as:",
  '    "Benchmark comparison is not yet available because the benchmark dataset is not validated."',
  '    "Financial modeling is gated until assumptions are validated."',
  "- If the section's `exhibitSlot` is one of the five Group-A slots, you MAY reference the exhibit as internal supporting context only — never as a final client artifact, and never as a benchmark or financial figure.",
  "- Forbidden phrases (case-insensitive): guaranteed ROI, guaranteed savings, payback, break-even, cash-flow positive, will save, will reduce cost, top quartile, above average, industry benchmark, peer benchmark, finance-approved, board-ready ROI.",
  "- Be honest about gaps. If the section lacks evidence, write a short note saying so rather than padding.",
  "- The `recommendedStatus` field MUST be `needs_review`. You do not approve your own draft.",
  "",
  "EVIDENCE NOTES — `evidenceNotes`:",
  "- Each entry is ONE clean, specific sentence tied to this section's content.",
  "- You MAY prefix with a plain kind label (\"Finding:\", \"Opportunity:\", \"Roadmap:\", \"Stakeholder:\"). NEVER include UUIDs, the literal token \"ID\", or any database identifier in the text — structural provenance goes ONLY in the grounded*Ids arrays below.",
  "- Do not paste the same five findings into every section; select the notes that actually support THIS section.",
  "",
  "ASSUMPTIONS — `assumptionsAndLimits`:",
  "- List only limits specific to THIS section's content. The standard gating caveats (financial modeling gated; benchmark not validated) are already stated once in the report's opening — include one here ONLY if this section makes a claim that directly needs it, and never both as rote boilerplate. Return an empty array if nothing section-specific applies.",
  "",
  "STRUCTURAL PROVENANCE — in addition to the prose, return three ID arrays naming the upstream artifacts the draft is grounded in:",
  "    - `groundedFindingIds`: UUIDs from the supplied `findings[].findingId` array — the findings actually referenced.",
  "    - `groundedOpportunityIds`: UUIDs from the supplied `opportunities[].opportunityId` array — the opportunities actually referenced.",
  "    - `groundedRoadmapItemIds`: UUIDs from the supplied `roadmap[].roadmapItemId` array — the roadmap items actually referenced.",
  "  Only use IDs that appear in the supplied context arrays. Do NOT invent IDs. Empty arrays are valid when a section legitimately has no upstream link (e.g. the appendix). The operator UI uses these to render the section's source-trail panel.",
].join("\n");

// ---------------------------------------------------------------------------
// Per-section charters — the distinct job each section does, so the model
// synthesizes through a unique lens instead of re-narrating the same
// findings twelve times. Keyed on `report_sections.section_type`.
// ---------------------------------------------------------------------------

const SECTION_CHARTERS: Record<string, string> = {
  executive_summary:
    "The 3–5 things a CEO must know and the single recommended next move. Synthesize the situation and the decision — do NOT enumerate every finding. This is the one section that stands alone if read in isolation.",
  business_context:
    "The client's operating situation and what is at stake: industry, size, where they are in their AI journey, and why acting now matters. Frame the 'why'. Do NOT list the findings — later sections do that.",
  systems_snapshot:
    "The current-state systems and data landscape: what tools exist, where operational data lives, and where the handoffs break. Describe the as-is architecture and its seams — not the opportunities or the fixes.",
  readiness_assessment:
    "A judgment of how ready this organization is to adopt AI: data quality, process maturity, ownership, and change capacity. Render a maturity verdict — do not rehash the friction list.",
  workflow_friction:
    "Current state and operating friction, combined. Briefly establish the as-is systems/data landscape (what tools exist, where operational data lives), then spend the section on the specific friction points and their downstream cost — where work snags, who it depends on, what it delays (billing, reporting, win rate), and what that implies about the organization's readiness to adopt AI. Concrete mechanics with named systems and roles, not generalities.",
  stakeholder_synthesis:
    "What stakeholders actually said: themes, tensions, and alignment (or misalignment) across roles, using the intake aggregates. Let human voices and their attributed observations carry it — not a findings list.",
  opportunity_portfolio:
    "The shape of the AI opportunity set and how the opportunities compare on impact, complexity, and evidence strength. Portfolio-level trade-offs; reference Figure 01. Do not re-derive each opportunity's underlying finding.",
  priority_recommendations:
    "The recommended priority ORDER and the reasoning behind it — why this sequence, what to do first, and what each recommendation depends on. Fold in the governance and risk guardrails that matter for acting responsibly (delivery risk, single points of failure, change/data risk and how to manage them) and close with the single concrete next action that moves the engagement forward. Decision rationale, not a catalog.",
  governance_risk:
    "The risks, dependencies, and governance guardrails for doing this responsibly: delivery risk, single points of failure, data/change risk, and how to manage them. A risk lens — not a restatement of findings.",
  roadmap:
    "The 30/60/90-day plan: phased initiatives, sequencing logic, owners, and success criteria. Reference Figure 03. Explain the phasing choices; do not re-list the opportunities.",
  recommended_next_step:
    "The single immediate next action that moves the engagement forward, and precisely what it unblocks. One clear ask — short and concrete.",
  appendix:
    "A compact reference index of the findings, opportunities, and roadmap items behind the report. This is the ONE section that may enumerate. Keep it terse and factual — no new narrative. Begin directly with the index itself; do NOT open with \"This appendix…\" or any sentence describing what the appendix is.",
};

function charterFor(sectionType: string): string {
  return (
    SECTION_CHARTERS[sectionType] ??
    "Synthesize the supplied context through this section's specific purpose. Do not restate content that belongs to other sections."
  );
}

const SCHEMA_INSTRUCTION = [
  'Output schema: { "section": ReportSectionDraft }',
  "where ReportSectionDraft has the shape:",
  "{",
  '  "sectionTitle": short noun-phrase headline (<= 200 chars),',
  '  "summary": the section\'s single key takeaway stated as a claim, 1-2 sentences (<= 600 chars). NOT a preview of the draft.',
  '  "draftPreview": 1-4 paragraph draft supporting the summary (<= 2400 chars). No markdown, no HTML. Does not restate the summary or re-narrate other sections.',
  '  "evidenceNotes": array of up to 8 short bullet strings specific to THIS section, each one clean sentence referencing a finding / opportunity / roadmap item / intake aggregate by NAME only — never a UUID or the token "ID",',
  '  "assumptionsAndLimits": array of up to 5 short bullet strings for limits SPECIFIC to this section (empty array if none); do not repeat the standard financial/benchmark gating as boilerplate,',
  '  "groundedFindingIds": array of UUIDs (<= 12) drawn ONLY from the supplied findings[].findingId array,',
  '  "groundedOpportunityIds": array of UUIDs (<= 12) drawn ONLY from the supplied opportunities[].opportunityId array,',
  '  "groundedRoadmapItemIds": array of UUIDs (<= 12) drawn ONLY from the supplied roadmap[].roadmapItemId array,',
  '  "recommendedStatus": "needs_review"',
  "}",
].join("\n");

function buildPromptMessages(context: ReportSectionSynthesisContext) {
  const userPayload = JSON.stringify(buildUserPayload(context), null, 2);
  const charter = charterFor(context.section.sectionType);
  const siblingTitles = context.siblingSections
    .map((s) => s.title)
    .filter(Boolean)
    .join(" · ");

  // Sequential de-duplication: sections that come BEFORE this one in the
  // report and already have a summary have "been said". The bulk drafter
  // regenerates in position order, so by the time this section runs, its
  // predecessors carry fresh summaries. Feeding them in lets the model
  // reference established facts instead of re-narrating them — the single
  // biggest lever against cross-section repetition.
  const precedingSummaries = context.siblingSections
    .filter((s) => s.position < context.section.position && s.summary)
    .sort((a, b) => a.position - b.position)
    .map((s) => `- ${s.title}: ${s.summary}`)
    .join("\n");

  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: SCHEMA_INSTRUCTION },
    {
      role: "system" as const,
      content:
        `SECTION CHARTER — the distinct job of the section you are drafting ("${context.section.title}", type: ${context.section.sectionType}):\n` +
        charter +
        (siblingTitles
          ? `\n\nThe other sections of this report (already accounted for — do NOT duplicate their job): ${siblingTitles}.`
          : ""),
    },
    ...(precedingSummaries
      ? [
          {
            role: "system" as const,
            content:
              "ALREADY ESTABLISHED — these earlier sections have already been written and the client will have read them before reaching yours:\n" +
              precedingSummaries +
              "\n\nDo NOT re-explain facts these sections already established (e.g. the systems that are fragmented, the core findings). Reference them in a clause at most, and spend your words on what THIS section's charter uniquely adds. If your section would just restate an earlier one, cut it to the new angle only.",
          },
        ]
      : []),
    {
      role: "user" as const,
      content:
        "Draft this one report section. Use ONLY the structured context provided, ground every claim in the supplied arrays, and stay strictly within this section's charter.\n\n" +
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
  context: ReportSectionSynthesisContext,
): ReportSectionDraftCandidate | null {
  // Accept both `{section: ...}` and a bare draft object.
  const obj = extractSectionObject(parsed);
  if (!obj) return null;

  const sectionTitle =
    clipString(obj.sectionTitle, TITLE_LIMIT) ??
    clipString(context.section.title, TITLE_LIMIT);
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

  // Sprint S8 — structural provenance. Only accept IDs that appear in
  // the context arrays. The upstream allowlist is authoritative; the
  // model cannot invent provenance.
  const findingAllow = new Set(context.findings.map((f) => f.findingId));
  const opportunityAllow = new Set(
    context.opportunities.map((o) => o.opportunityId),
  );
  const roadmapAllow = new Set(context.roadmap.map((r) => r.roadmapItemId));
  const groundedFindingIds = filterUuidList(
    obj.groundedFindingIds,
    findingAllow,
    MAX_GROUNDED_FINDINGS,
  );
  const groundedOpportunityIds = filterUuidList(
    obj.groundedOpportunityIds,
    opportunityAllow,
    MAX_GROUNDED_OPPORTUNITIES,
  );
  const groundedRoadmapItemIds = filterUuidList(
    obj.groundedRoadmapItemIds,
    roadmapAllow,
    MAX_GROUNDED_ROADMAP_ITEMS,
  );

  return {
    sectionTitle,
    summary,
    draftPreview,
    evidenceNotes,
    assumptionsAndLimits,
    groundedFindingIds,
    groundedOpportunityIds,
    groundedRoadmapItemIds,
  };
}

/**
 * Sprint S8 — defensive grounded-ID validator.
 *
 *   - Drops anything that isn't a syntactically valid UUID.
 *   - Drops anything that isn't in the supplied allowlist (the
 *     authoritative upstream context).
 *   - Dedupes (Set semantics).
 *   - Caps at `max` entries.
 *
 * The empty-input case returns `[]` — legitimate for sections with no
 * direct upstream link (e.g. the appendix).
 */
function filterUuidList(
  value: unknown,
  allow: ReadonlySet<string>,
  max: number,
): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= max) break;
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!UUID_RE.test(trimmed)) continue;
    if (!allow.has(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
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
