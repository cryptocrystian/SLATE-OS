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
  /**
   * Sprint S9 — structural source provenance. The model returns the
   * IDs of upstream opportunities and roadmap items it actually
   * grounded the draft in. The validator drops any ID that is not
   * present in the supplied context (the upstream allowlist is the
   * authoritative source — the model cannot invent provenance). The
   * action then writes these into the two
   * `proposal_option_*_links` tables so the source trail is
   * queryable and surfaces in operator UI.
   *
   * These arrays are deduped and capped at MAX_GROUNDED_IDS each. An
   * empty array is valid (e.g. an option may legitimately span only
   * a subset of the upstream evidence).
   *
   * NOTE — there is intentionally no `groundedReportSectionIds` field
   * because the existing proposal schema (migration 0008) has no
   * `proposal_option_report_section_links` table. Report-section
   * provenance is carried in synthesis-context counts + activity
   * metadata only. Future migration can add a structural link table
   * if/when downstream sprints need it.
   */
  groundedOpportunityIds: string[];
  groundedRoadmapItemIds: string[];
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
// Sprint S9 — structural provenance caps.
const MAX_GROUNDED_OPPORTUNITIES = 12;
const MAX_GROUNDED_ROADMAP_ITEMS = 12;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  "You are a senior AI advisory consultant at Saipien Labs, drafting one option of a client proposal for a human colleague to review.",
  "Write the way a top firm (McKinsey/BCG/Bain/Accenture) writes a proposal: plain, direct, decision-grade copy that helps a buyer choose, grounded ONLY in the structured context the operator has already gathered.",
  "Drafts are operator-review-gated. The proposal will NOT be sent to a client by this pipeline — Send / Share / Export / SOW / e-signature stay locked at the UI layer.",
  "",
  "VOICE — write like a human consultant, not a content generator:",
  "- Lead with the substance. The first sentence of `bestFitScenario` and of `scopeNarrative` states something concrete, never a description of the document or a restatement of the option's name.",
  "- NEVER open a field with meta-language. Banned openers (case-insensitive): \"This option\", \"This proposal\", \"This engagement\", \"In this option\", \"The following\".",
  "- Banned filler (case-insensitive): \"positioned to leverage\", \"leverage AI\", \"leverage technolog\", \"path forward\", \"actionable steps\", \"aims to\", \"seeks to\", \"plays a key role\", \"in today's\", \"ever-evolving\", \"robust\", \"seamless\", \"holistic\", \"it is important to note\", \"delve\", \"underscore\", \"unlock\", \"empower\", \"synergy\", \"cutting-edge\", \"world-class\", \"tailored solution\", \"bespoke\".",
  "- Vary sentence structure. Prefer concrete specifics (named workstreams, systems, roles, phase lengths) over abstraction. No superlatives, no marketing tone. This is a buying decision document, not a brochure.",
  "",
  "STRUCTURE — the fields do different jobs; never let them overlap:",
  "- `bestFitScenario`: the situation in which a buyer should choose THIS option over the others — the trigger conditions and the client profile it suits. A crisp 'choose this when…' judgment, not a summary of the scope.",
  "- `scopeNarrative`: what the engagement actually does and how it is sequenced. Concrete workstreams and approach. Do NOT restate the bestFitScenario or re-list the deliverables verbatim.",
  "- `deliverables` / `assumptions` / `dependencies` / `risks`: each a clean, specific one-line item. No IDs, no UUIDs, no boilerplate repeated across options.",
  "",
  "ANTI-REPETITION — this is one of several options the buyer compares side by side:",
  "- The options share the same underlying findings/opportunities. Each option must be visibly DIFFERENT: different depth, commitment, and outcome — not the same scope reworded. Differentiate against the other options (see the DISTINCT-FROM message when present).",
  "- Do not repeat the same scope paragraph across options. If two options would read the same, sharpen this one to its actual delta.",
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
  "- Reference linked findings / opportunities / roadmap items by title (not id) so the draft reads naturally for a human reviewer.",
  "- Be honest about gaps. If the option's evidence base is thin, write a short note in `assumptions` saying so rather than padding.",
  "- STRUCTURAL PROVENANCE. In addition to grounding the prose, you MUST return two ID arrays naming the upstream artifacts the draft is grounded in:",
  "    - `groundedOpportunityIds`: UUIDs from the supplied `opportunities[].opportunityId` array — the opportunities actually included in this option's scope.",
  "    - `groundedRoadmapItemIds`: UUIDs from the supplied `roadmap[].roadmapItemId` array — the roadmap items this option will deliver against.",
  "  Only use IDs that appear in the supplied context arrays. Do NOT invent IDs. Empty arrays are valid (e.g. a Quick-Win Build option may span only one opportunity). The operator UI uses these to render the option's source-trail panel.",
].join("\n");

// ---------------------------------------------------------------------------
// Per-option-type charters — the distinct commercial positioning of each
// tier, so the three options read as genuinely different offers instead of
// the same scope at three depths. Keyed on `proposal_options.option_type`.
// ---------------------------------------------------------------------------

const OPTION_CHARTERS: Record<string, string> = {
  "quick-win-build":
    "The smallest, fastest committed build — one or two high-confidence opportunities delivered end to end in weeks. Positioned for a buyer who wants proof and momentum before a larger commitment: low risk, tight scope, a working result. Do NOT describe it as a stepping stone in vague terms — name the concrete thing that ships.",
  "ai-workflow-system":
    "The core engagement: a coherent system across the priority opportunities, delivered in phases with the client's team involved. Positioned for a buyer ready to fix the operating friction properly, not just pilot it. Emphasize the integrated scope and the sequencing that de-risks delivery — this is the option most buyers should land on.",
  "managed-ai-partner":
    "The most comprehensive, ongoing option: build plus continued operation, iteration, and enablement over a longer horizon. Positioned for a buyer who wants Saipien to own outcomes over time, not hand off. Emphasize the operating-partner relationship and what continuous involvement unlocks that a one-time build cannot.",
};

function charterFor(optionType: string): string {
  // The DB stores option_type with underscores (quick_win_build); the
  // canonical union uses hyphens. Normalize so the lookup hits either way.
  const key = optionType.replace(/_/g, "-");
  return (
    OPTION_CHARTERS[key] ??
    "Position this option distinctly against the others on depth, commitment, and outcome. Do not restate another option's scope."
  );
}

const SCHEMA_INSTRUCTION = [
  'Output schema: { "option": ProposalOptionDraft }',
  "where ProposalOptionDraft has the shape:",
  "{",
  '  "optionTitle": short noun-phrase headline (<= 200 chars) — may refine the existing title,',
  '  "bestFitScenario": 1-3 sentence "choose this option when…" judgment (<= 600 chars). The buyer-fit trigger, NOT a scope summary.',
  '  "scopeNarrative": 2-4 paragraph scope + sequencing narrative (<= 2000 chars). No markdown, no HTML. Does not restate bestFitScenario or re-list the deliverables.',
  '  "timeline": 1-2 sentence timeline (<= 220 chars). Reference weeks / days / phases — never dollar amounts.',
  '  "deliverables": array of up to 8 short workstream / deliverable strings, specific to this option — names only, no UUIDs or "ID",',
  '  "assumptions": array of up to 8 short strings calling out gaps, gated claims, and validation steps,',
  '  "dependencies": array of up to 6 short strings,',
  '  "risks": array of up to 6 short strings,',
  '  "groundedOpportunityIds": array of UUIDs (<= 12) drawn ONLY from the supplied opportunities[].opportunityId array,',
  '  "groundedRoadmapItemIds": array of UUIDs (<= 12) drawn ONLY from the supplied roadmap[].roadmapItemId array',
  "}",
].join("\n");

function buildPromptMessages(context: ProposalOptionSynthesisContext) {
  const userPayload = JSON.stringify(buildUserPayload(context), null, 2);
  const charter = charterFor(context.option.optionType);

  // Sequential differentiation: options that come BEFORE this one and
  // already have a scope summary have "been offered". Options are drafted
  // in position order, so predecessors carry fresh scope. Feeding them in
  // lets the model sharpen THIS option against the others instead of
  // producing three rewordings of the same scope.
  const otherOptions = context.siblingOptions
    .filter((o) => o.scopeSummary)
    .sort((a, b) => a.position - b.position)
    .map((o) => `- ${o.title} (${o.optionType}): ${o.scopeSummary}`)
    .join("\n");

  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: SCHEMA_INSTRUCTION },
    {
      role: "system" as const,
      content:
        `OPTION CHARTER — the distinct commercial positioning of the option you are drafting ("${context.option.title}", type: ${context.option.optionType}):\n` +
        charter,
    },
    ...(otherOptions
      ? [
          {
            role: "system" as const,
            content:
              "DISTINCT-FROM — the other options in this proposal already have scope. Make yours visibly different in depth, commitment, and outcome; do NOT reword their scope:\n" +
              otherOptions,
          },
        ]
      : []),
    {
      role: "user" as const,
      content:
        "Draft this one proposal option. Use ONLY the structured context provided, ground every claim in the supplied arrays, and stay strictly within this option's charter.\n\n" +
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
  context: ProposalOptionSynthesisContext,
): ProposalOptionDraftCandidate | null {
  const obj = extractOptionObject(parsed);
  if (!obj) return null;

  const optionTitle =
    clipString(obj.optionTitle, TITLE_LIMIT) ??
    clipString(context.option.title, TITLE_LIMIT);
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

  // Sprint S9 — structural provenance. Only accept IDs that appear in
  // the context arrays. The upstream allowlist is authoritative; the
  // model cannot invent provenance.
  const opportunityAllow = new Set(
    context.opportunities.map((o) => o.opportunityId),
  );
  const roadmapAllow = new Set(context.roadmap.map((r) => r.roadmapItemId));
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
    optionTitle,
    bestFitScenario,
    scopeNarrative,
    timeline,
    deliverables,
    assumptions,
    dependencies,
    risks,
    groundedOpportunityIds,
    groundedRoadmapItemIds,
  };
}

/**
 * Sprint S9 — defensive grounded-ID validator.
 *
 *   - Drops anything that isn't a syntactically valid UUID.
 *   - Drops anything that isn't in the supplied allowlist (the
 *     authoritative upstream context).
 *   - Dedupes (Set semantics).
 *   - Caps at `max` entries.
 *
 * The empty-input case returns `[]` — legitimate for options that
 * legitimately span no upstream link.
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
