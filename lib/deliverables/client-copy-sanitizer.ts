/**
 * Sprint Presentation Pass 3 — Client Content Redaction Layer
 * (docs/61 § 7.C).
 *
 * Pure helpers used by the report and proposal candidate documents
 * when `viewerMode === "client-facing"`. They scrub operator
 * vocabulary embedded in the persisted snapshot narrative without
 * mutating the snapshot itself.
 *
 * Scope (conservative):
 *   - Remove or rewrite raw UUIDs (finding / opportunity / roadmap /
 *     report / snapshot / engagement ids) that S8 / S9 / earlier
 *     prompts left in narrative prose.
 *   - Strip operator-only labels that surface as headings or inline
 *     tags: EVIDENCE NOTES, GROUP B BLOCK, group b canon gate,
 *     GROUP-B (GATED), INTENTIONALLY NOT INCLUDED, no_topic_axis,
 *     no_capability_axis, pass topics, pass capabilities, snapshot
 *     purity, "Live chart SVGs are deliberately omitted".
 *   - Replace operator-attribution phrasing ("as noted in finding
 *     <uuid>", "(Finding ID: <uuid>)") with neutral client-safe
 *     attributions ("as reflected in the discovery findings", "").
 *
 * Do NOT remove legitimate client copy:
 *   - "Not a contract / not a binding quote" disclaimers and the
 *     four-denial footer pass through untouched.
 *   - Generic business prose (margins, dispatch, billing, etc.)
 *     untouched.
 *   - Sanitization is text-only. It never strips React structure.
 *
 * Operator mode never calls these helpers — operator traceability
 * stays byte-stable.
 */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const PARENTHETICAL_ID_RE =
  /\s*[\[(]?\s*(?:finding|opportunity|roadmap(?:\s+item)?|report|snapshot|engagement)\s+id\s*[:\-]\s*[0-9a-f-]{36}\s*[\])]?/gi;

// Bare label fallback: catches "Finding ID:" / "Opportunity ID –" /
// "Snapshot ID:" forms that don't have a UUID immediately after
// (e.g. when the UUID was already stripped or the operator left an
// empty label). Runs AFTER `PARENTHETICAL_ID_RE` so it doesn't
// double-match cases that include a UUID.
const BARE_ID_LABEL_RE =
  /\b(?:finding|opportunity|roadmap(?:\s+item)?|report|snapshot|engagement)\s+id\s*[:\-]?/gi;

const PROSE_ID_REFS: ReadonlyArray<{ re: RegExp; replacement: string }> = [
  // "as noted/reflected/highlighted/reported/indicated in finding <uuid>"
  {
    re: /\b(?:as\s+)?(?:noted|reflected|highlighted|reported|indicated|outlined|described|captured|recorded|documented)\s+in\s+finding\s+[0-9a-f-]{36}/gi,
    replacement: "as reflected in the discovery findings",
  },
  // "see finding <uuid>" / "per finding <uuid>" / "in finding <uuid>"
  {
    re: /\b(?:see|per|in)\s+finding\s+[0-9a-f-]{36}/gi,
    replacement: "in the discovery findings",
  },
  // "finding <uuid>" anywhere else
  {
    re: /\bfinding\s+[0-9a-f-]{36}/gi,
    replacement: "the discovery findings",
  },
  // opportunity / roadmap / report / snapshot / engagement
  {
    re: /\bopportunity\s+[0-9a-f-]{36}/gi,
    replacement: "the opportunity set",
  },
  {
    re: /\broadmap(?:\s+item)?\s+[0-9a-f-]{36}/gi,
    replacement: "the roadmap",
  },
  {
    re: /\b(?:report|snapshot|engagement)\s+[0-9a-f-]{36}/gi,
    replacement: "the engagement",
  },
];

const OPERATOR_LABEL_PATTERNS: ReadonlyArray<{
  re: RegExp;
  replacement: string;
}> = [
  // Heading-style labels that the AI sometimes emits mid-prose. We
  // strip the label itself; the surrounding sentence stays.
  { re: /\bEVIDENCE NOTES\b\s*[:\-]?/gi, replacement: "" },
  { re: /\bGROUP[- ]?B BLOCK\b\s*[:\-]?/gi, replacement: "" },
  { re: /\bgroup\s*b\s+canon\s+gate\b\s*[:\-]?/gi, replacement: "" },
  { re: /\bGROUP[- ]?B\s*\(\s*GATED\s*\)/gi, replacement: "" },
  { re: /\bINTENTIONALLY NOT INCLUDED\b\s*[:\-]?/gi, replacement: "" },
  // Slot-map / adapter mechanics
  { re: /\bno_topic_axis\b/gi, replacement: "" },
  { re: /\bno_capability_axis\b/gi, replacement: "" },
  { re: /\bpass\s+topics\b/gi, replacement: "" },
  { re: /\bpass\s+capabilities\b/gi, replacement: "" },
  // Operator-only meta phrases
  { re: /\bsnapshot purity\b/gi, replacement: "" },
  {
    re: /\bLive chart SVGs[^.]*(?:\.|$)/gi,
    replacement: "",
  },
];

/**
 * Sanitize a persisted prose blob for client-facing rendering.
 *
 *   - Replaces UUID-bearing attributions with neutral phrasing.
 *   - Strips standalone UUIDs left in the text.
 *   - Strips operator-only headings/labels embedded in prose.
 *   - Collapses the whitespace the strips leave behind.
 *
 * Returns `null` when the input is null/undefined OR when
 * sanitization reduces the body to whitespace — callers should treat
 * `null` as "do not render this block".
 *
 * Idempotent: sanitizing already-sanitized text is a no-op.
 */
export function sanitizeClientProse(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;

  let out = input;

  // Order matters: bracketed-id parentheticals before bare UUIDs, so
  // we don't leave dangling "(Finding ID: )" stubs.
  out = out.replace(PARENTHETICAL_ID_RE, "");

  for (const { re, replacement } of PROSE_ID_REFS) {
    out = out.replace(re, replacement);
  }

  // Any remaining standalone UUIDs become empty. They were not
  // attached to one of the recognized attribution phrases.
  out = out.replace(UUID_RE, "");

  // Bare "Finding ID:" / "Opportunity ID:" labels (now without a
  // UUID, since the UUID has been stripped above OR the label was
  // already orphaned in the source).
  out = out.replace(BARE_ID_LABEL_RE, "");

  for (const { re, replacement } of OPERATOR_LABEL_PATTERNS) {
    out = out.replace(re, replacement);
  }

  // Relabel a sanitized ID-ref that landed in bullet-label position.
  // `• Finding <uuid>: X` sanitizes to `• the discovery findings: X`,
  // which reads as a broken label; restore a clean category label.
  // Only fires at the start of a bullet/line so mid-sentence
  // "…the discovery findings…" prose is untouched.
  out = out
    .replace(/(^|\n)(\s*•?\s*)the discovery findings:/gi, "$1$2Finding:")
    .replace(/(^|\n)(\s*•?\s*)the opportunity set:/gi, "$1$2Opportunity:")
    .replace(/(^|\n)(\s*•?\s*)the roadmap:/gi, "$1$2Roadmap:");

  // Drop dangling relational stubs left behind when a "linked to
  // <Finding/Opportunity ID …>" target was stripped above, e.g.
  // `… Practices linked to.` → `… Practices.`. Only fires when nothing
  // meaningful follows (period / newline / end), so a real
  // "linked to the discovery findings" attribution survives.
  out = out.replace(/\s+linked\s+to\b\s*(?=[.\n]|$)/gi, "");

  // Whitespace cleanup: collapse runs of internal whitespace and tidy
  // punctuation gaps the strips can leave behind. Newlines are
  // preserved to keep paragraph structure intact.
  out = out
    // Collapse runs of horizontal whitespace (NOT newlines)
    .replace(/[^\S\n]{2,}/g, " ")
    // Fix " ." / " ," / " ;" / " :" gaps
    .replace(/\s+([.,;:])/g, "$1")
    // Collapse double bullets / orphan separators
    .replace(/•\s*•/g, "•")
    // Collapse a leftover leading dash after a bullet ("•- x" / "• - x"),
    // left when an "ID: <uuid> - text" prefix was stripped.
    .replace(/•[ \t]*-[ \t]+/g, "• ")
    // Collapse "·   ·" gaps
    .replace(/·\s+·/g, "·")
    // Trim per-line
    .split("\n")
    .map((line) => line.replace(/^[\s ]+|[\s ]+$/g, ""))
    .join("\n")
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out.length === 0 ? null : out;
}

/**
 * Sanitize an array of bullet items. Drops items that sanitize to
 * empty.
 */
export function sanitizeClientBullets(
  items: ReadonlyArray<string> | null | undefined,
): string[] {
  if (!items) return [];
  const out: string[] = [];
  for (const raw of items) {
    const cleaned = sanitizeClientProse(raw);
    if (cleaned != null) out.push(cleaned);
  }
  return out;
}

/**
 * Friendly client-safe label for a Group-A exhibit / report slot
 * identifier. Falls back to a humanized slot string if the slot is
 * unknown.
 *
 * Mirrors the existing friendly map in
 * `report-pdf-candidate-document.tsx::friendlyExhibitTitle` — kept
 * here so the proposal document can use the same vocabulary without
 * importing report internals.
 */
export function clientSafeSlotLabel(slot: string): string {
  switch (slot) {
    case "executive_summary_portfolio":
      return "Opportunity portfolio";
    case "findings_risk_priority":
      return "Risk-adjusted priority";
    case "diagnostic_capability_maturity":
      return "Capability maturity";
    case "diagnostic_stakeholder_coverage":
      return "Stakeholder coverage";
    case "roadmap_90_day_sequence":
      return "30 / 60 / 90 roadmap";
    default:
      return slot.replace(/_/g, " ").trim();
  }
}

/**
 * Friendly client-safe relabel for a report section type chip.
 * Returns `null` when the chip should be hidden entirely in client
 * mode (e.g., raw slot ids the client should not see).
 */
export function clientSafeSectionLabel(sectionType: string): string | null {
  switch (sectionType) {
    case "executive_summary":
      return "Executive summary";
    case "findings_overview":
      return "Findings overview";
    case "opportunities":
    case "opportunities_overview":
      return "Opportunities";
    case "roadmap":
    case "roadmap_overview":
      return "Roadmap";
    case "next_steps":
      return "Next steps";
    case "approach":
      return "Approach";
    default:
      // Unknown section types pass through humanized; chips that
      // look like internal mechanics (contain underscores AND digits,
      // e.g. `slot_0_intro`) get hidden.
      if (/\d/.test(sectionType) && /_/.test(sectionType)) return null;
      return sectionType.replace(/_/g, " ").trim();
  }
}

/**
 * Friendly client-safe relabel for a proposal option type chip.
 * Falls back to a humanized form.
 */
export function clientSafeOptionTypeLabel(optionType: string): string {
  return optionType.replace(/[-_]/g, " ").trim();
}

/**
 * Generic client-safe rewrite for the omitted-content body text on
 * the proposal candidate. We never expose the persisted operator
 * note in client mode — the message is fixed.
 */
export const CLIENT_SAFE_OMISSION_NOTE =
  "Not included in this version because supporting data has not been validated.";

/**
 * Friendly client-safe scope chip for the proposal omitted-content
 * appendix. Operator-only enum values fold to a generic chip.
 */
export function clientSafeOmissionScopeLabel(scope: string): string {
  switch (scope) {
    case "group_b_block":
      return "Visuals not included in this version";
    default:
      return "Not included in this version";
  }
}
