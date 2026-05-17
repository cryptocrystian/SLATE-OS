/**
 * Phase 1B Proposal/SOW Delivery Sprint P2 — export-time commercial
 * guard for the proposal delivery candidate.
 *
 * Pure function. Reuses `lib/ai/claim-guard.ts`'s shared 26-pattern
 * scanner (financial 14 + commercial-finality 6 + roadmap-commitment 6)
 * and adds the 18 proposal-finality patterns canonized in
 * `docs/24` § Commercial Claim Guard. The scan runs at export time
 * because operator edits between AI synthesis and export bypass the
 * synthesis-time scan.
 *
 * Per `docs/24` § Commercial Claim Guard — scan inputs:
 *   - per option: title, bestFitScenario, scopeSummary, timeline
 *   - per option arrays: every entry of deliverables, assumptions,
 *     dependencies, risks
 *   - per option: pricingPlaceholder (always, even if hidden in the
 *     client render — operator edits can land banned phrases there)
 *   - proposal-level: implementation-credit copy (creditAmountPlaceholder,
 *     creditWindow, creditNotes)
 *   - optional SOW-only: sowDraftText, footerText (Sprint P6 scope —
 *     supplied via the optional `extras` arg so the same module backs
 *     both surfaces)
 *
 * Excluded by default (canon § Commercial Claim Guard, item 3):
 *   - reviewer notes
 *   - raw AI prompt / response bodies
 *   - uploaded file content
 *   - signed-URL paths
 *
 * Pure module — no React, no DB, no I/O.
 */

import {
  COMMERCIAL_FINALITY_PATTERNS,
  FINANCIAL_CLAIM_PATTERNS,
  ROADMAP_COMMITMENT_PATTERNS,
  scanForBannedClaims,
  type BannedClaimRule,
} from "@/lib/ai/claim-guard";
import type {
  ProposalCommercialGuardResult,
  ProposalOptionSnapshot,
  ProposalSourceContextSnapshot,
} from "./delivery-snapshot-types";

const COMMERCIAL_GUARD_VERSION = "commercial-guard.v1";

type ProposalGuardFamily =
  | "financial"
  | "commercial-finality"
  | "roadmap-commitment"
  | "proposal-finality"
  | "sow-draft-finality";

/**
 * Proposal/SOW-specific patterns added by `docs/24` § Commercial Claim
 * Guard. These extend (do NOT replace) the three families from
 * `lib/ai/claim-guard.ts`.
 *
 * The patterns are prohibition strings; they may appear here and in
 * docs/canon files as prohibition examples. The runtime scanner
 * rejects them in operator-editable proposal content.
 *
 * Word-boundary anchored where the pattern is a single distinct phrase;
 * a few date-bearing phrases (`work will begin on <date>`,
 * `effective date <date>`) are matched with a permissive trailing date
 * heuristic so the scanner does not need to parse calendars.
 */
export const PROPOSAL_FINALITY_PATTERNS: ReadonlyArray<BannedClaimRule> = [
  { code: "fixed_price", pattern: /\bfixed\s+price\b/i },
  { code: "final_terms", pattern: /\bfinal\s+terms\b/i },
  { code: "contract_accepted", pattern: /\bcontract\s+accepted\b/i },
  { code: "client_has_agreed", pattern: /\bclient\s+has\s+agreed\b/i },
  {
    code: "work_will_begin_on_date",
    // Matches `work will begin on May 1`, `work will begin on 2026-05-15`,
    // and `work will begin on Monday`. Catches any phrase whose dated tail
    // implies a guaranteed start.
    pattern:
      /\bwork\s+will\s+begin\s+on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  },
  { code: "payment_due", pattern: /\bpayment\s+due\b/i },
  { code: "auto_renewal", pattern: /\bauto[\s-]renewal\b/i },
  { code: "cancellation_terms", pattern: /\bcancellation\s+terms\b/i },
  { code: "cancellation_policy", pattern: /\bcancellation\s+policy\b/i },
  { code: "please_sign", pattern: /\bplease\s+sign\b/i },
  { code: "sign_here", pattern: /\bsign\s+here\b/i },
  { code: "signature_required", pattern: /\bsignature\s+required\b/i },
  { code: "legally_binding", pattern: /\blegally\s+binding\b/i },
  {
    code: "guaranteed_delivery_date",
    pattern: /\bguaranteed\s+delivery\s+date\b/i,
  },
  {
    code: "guaranteed_implementation_timeline",
    pattern: /\bguaranteed\s+implementation\s+timeline\b/i,
  },
  { code: "i_authorize", pattern: /\bI\s+authorize\b/i },
  { code: "by_accepting", pattern: /\bby\s+accepting\b/i },
  { code: "by_signing", pattern: /\bby\s+signing\b/i },
  // Contextual: `effective date` is only a violation when it appears
  // alongside binding-effect language. The combined phrase preserves
  // the docs/24 intent without flagging neutral-context uses like
  // "the workshop's effective date".
  {
    code: "effective_date_binding",
    pattern:
      /\beffective\s+date\b[^.\n]{0,80}\b(agreement|contract|binding|executed)\b/i,
  },
];

/**
 * Phase 1B SOW Draft Sprint P6-B — SOW-specific finality patterns added
 * by `docs/26` § SOW Commercial Guard. These extend (do NOT replace)
 * the four families above. The SOW Draft surface scans the combined
 * 70-pattern set (44 proposal + 26 SOW); the Proposal Candidate surface
 * continues to scan only the 44-pattern base set so existing proposal
 * generation behaviour is byte-identical.
 *
 * The patterns are prohibition strings — they may appear in this file
 * and in canon docs as prohibition examples; the runtime scanner
 * rejects them in operator-editable SOW Draft content.
 *
 * `net 30 / net-30 / due upon receipt` is implemented as a single
 * alternation pattern to keep the matcher count aligned with the
 * canon's 26-distinct-phrase enumeration.
 */
export const SOW_DRAFT_FINALITY_PATTERNS: ReadonlyArray<BannedClaimRule> = [
  { code: "binding_agreement", pattern: /\bbinding\s+agreement\b/i },
  { code: "executed_agreement", pattern: /\bexecuted\s+agreement\b/i },
  { code: "signature_block", pattern: /\bsignature\s+block\b/i },
  { code: "sign_below", pattern: /\bsign\s+below\b/i },
  { code: "accepted_by", pattern: /\baccepted\s+by\b/i },
  {
    code: "authorized_representative",
    pattern: /\bauthorized\s+representative\b/i,
  },
  { code: "payment_due", pattern: /\bpayment\s+due\b/i },
  { code: "invoice_due", pattern: /\binvoice\s+due\b/i },
  {
    // Single alternation covers "net 30", "net-30", and "due upon
    // receipt" per the canon's 26-phrase enumeration. `net\s*\d{1,3}`
    // also catches `net 45`, `net60`, etc. — same family.
    code: "payment_terms_explicit",
    pattern: /\bnet[\s-]?\d{1,3}\b|\bdue\s+upon\s+receipt\b/i,
  },
  {
    code: "start_date_guaranteed",
    pattern: /\bstart\s+date\s+guaranteed\b/i,
  },
  { code: "delivery_guaranteed", pattern: /\bdelivery\s+guaranteed\b/i },
  { code: "sla_guaranteed", pattern: /\bSLA\s+guaranteed\b/i },
  { code: "liquidated_damages", pattern: /\bliquidated\s+damages\b/i },
  {
    code: "termination_for_convenience",
    pattern: /\btermination\s+for\s+convenience\b/i,
  },
  { code: "governing_law", pattern: /\bgoverning\s+law\b/i },
  { code: "indemnification", pattern: /\bindemnification\b/i },
  {
    code: "limitation_of_liability",
    pattern: /\blimitation\s+of\s+liability\b/i,
  },
  { code: "warranty", pattern: /\bwarranty\b/i },
  { code: "auto_renewal", pattern: /\bauto[\s-]renewal\b/i },
  { code: "cancellation_fee", pattern: /\bcancellation\s+fee\b/i },
  {
    code: "change_order_accepted",
    pattern: /\bchange\s+order\s+accepted\b/i,
  },
  // `legally binding` is also in PROPOSAL_FINALITY_PATTERNS. The canon
  // (`docs/26` § SOW Commercial Guard) explicitly allows the re-check
  // for the SOW surface — operators editing this phrase into SOW
  // Draft content deserve to see it flagged with the SOW-finality
  // family attribution so the violation message reads as
  // SOW-specific. The duplicate keeps the canon's 70-total-pattern
  // count exact and produces two violations (one per family) for the
  // same phrase, which is the intended behaviour.
  { code: "legally_binding_sow", pattern: /\blegally\s+binding\b/i },
  { code: "statement_is_binding", pattern: /\bstatement\s+is\s+binding\b/i },
  {
    code: "this_sow_is_effective",
    pattern: /\bthis\s+SOW\s+is\s+effective\b/i,
  },
  { code: "work_shall_commence", pattern: /\bwork\s+shall\s+commence\b/i },
  { code: "client_hereby_agrees", pattern: /\bclient\s+hereby\s+agrees\b/i },
];

const RULE_FAMILY = new Map<
  ReadonlyArray<BannedClaimRule>,
  ProposalGuardFamily
>([
  [FINANCIAL_CLAIM_PATTERNS, "financial"],
  [COMMERCIAL_FINALITY_PATTERNS, "commercial-finality"],
  [ROADMAP_COMMITMENT_PATTERNS, "roadmap-commitment"],
  [PROPOSAL_FINALITY_PATTERNS, "proposal-finality"],
  [SOW_DRAFT_FINALITY_PATTERNS, "sow-draft-finality"],
]);

const COMBINED_RULES: ReadonlyArray<BannedClaimRule> = [
  ...FINANCIAL_CLAIM_PATTERNS,
  ...COMMERCIAL_FINALITY_PATTERNS,
  ...ROADMAP_COMMITMENT_PATTERNS,
  ...PROPOSAL_FINALITY_PATTERNS,
];

/**
 * SOW Draft surface scans the proposal base + the SOW finality family.
 * The proposal-candidate surface continues to scan only the base set,
 * so this constant exists explicitly rather than reusing `COMBINED_RULES`
 * with an `if`.
 */
const COMBINED_RULES_WITH_SOW: ReadonlyArray<BannedClaimRule> = [
  ...COMBINED_RULES,
  ...SOW_DRAFT_FINALITY_PATTERNS,
];

function familyForCode(code: string): ProposalGuardFamily {
  for (const [rules, family] of RULE_FAMILY.entries()) {
    if (rules.some((r) => r.code === code)) return family;
  }
  // Defensive default; every shipped code is in one of the four families.
  return "proposal-finality";
}

export interface RunProposalCommercialGuardInput {
  /**
   * Options that will be included in the snapshot's client-bound
   * surface. The caller should pre-filter to `includedInArtifact = true`
   * before passing them in (so we don't waste cycles scanning fields
   * the renderer won't surface).
   */
  optionSnapshot: ReadonlyArray<ProposalOptionSnapshot>;
  /**
   * Proposal-level source context. Only the implementation-credit
   * fields are scanned; the report-snapshot / opportunity-id / roadmap-id
   * references are operator-audit-only and never enter the client
   * surface.
   */
  sourceContextSnapshot: ProposalSourceContextSnapshot;
  /**
   * Sprint P6 SOW-Draft hook. When the SOW renderer ships, the action
   * will pass the operator-authored SOW draft text and footer text
   * through here. Pure Proposal Candidate snapshots leave these
   * undefined.
   */
  extras?: {
    sowDraftText?: string | null;
    footerText?: string | null;
  };
}

export function runProposalCommercialGuard(
  input: RunProposalCommercialGuardInput,
): ProposalCommercialGuardResult {
  const start = Date.now();

  const fields: Array<{
    field: string;
    values: ReadonlyArray<string | null | undefined>;
  }> = [];

  // Per included option — title / bestFitScenario / scopeSummary /
  // timeline as scalars; deliverables / assumptions / dependencies /
  // risks as arrays flattened into the values list; pricingPlaceholder
  // always.
  for (const option of input.optionSnapshot) {
    if (!option.includedInArtifact) continue;
    fields.push({
      field: `option[${option.optionId}].title`,
      values: [option.title],
    });
    fields.push({
      field: `option[${option.optionId}].bestFitScenario`,
      values: [option.bestFitScenario],
    });
    fields.push({
      field: `option[${option.optionId}].scopeSummary`,
      values: [option.scopeSummary],
    });
    fields.push({
      field: `option[${option.optionId}].timeline`,
      values: [option.timeline],
    });
    fields.push({
      field: `option[${option.optionId}].deliverables`,
      values: option.deliverables,
    });
    fields.push({
      field: `option[${option.optionId}].assumptions`,
      values: option.assumptions,
    });
    fields.push({
      field: `option[${option.optionId}].dependencies`,
      values: option.dependencies,
    });
    fields.push({
      field: `option[${option.optionId}].risks`,
      values: option.risks,
    });
    fields.push({
      field: `option[${option.optionId}].pricingPlaceholder`,
      values: [option.pricingPlaceholder],
    });
  }

  // Proposal-level commercial-lever copy.
  const credit = input.sourceContextSnapshot.implementationCredit;
  fields.push({
    field: "proposal.implementationCredit.creditAmountPlaceholder",
    values: [credit.creditAmountPlaceholder],
  });
  fields.push({
    field: "proposal.implementationCredit.creditWindow",
    values: [credit.creditWindow],
  });
  fields.push({
    field: "proposal.implementationCredit.creditNotes",
    values: [credit.creditNotes],
  });

  // Sprint P6 SOW-Draft hook. Pure Proposal Candidate flows leave
  // these undefined; the scanner skips empty strings.
  if (input.extras?.sowDraftText) {
    fields.push({
      field: "sow.draftText",
      values: [input.extras.sowDraftText],
    });
  }
  if (input.extras?.footerText) {
    fields.push({
      field: "sow.footerText",
      values: [input.extras.footerText],
    });
  }

  const violations = scanForBannedClaims(fields, COMBINED_RULES);
  const scanDurationMs = Date.now() - start;

  return {
    scannedFields: fields.map((f) => f.field),
    scannedFieldCount: fields.length,
    patternsApplied: [
      "financial",
      "commercial-finality",
      "roadmap-commitment",
      "proposal-finality",
    ],
    patternCount: COMBINED_RULES.length,
    violations: violations.map((v) => ({
      field: v.field,
      code: v.code,
      patternFamily: familyForCode(v.code),
    })),
    passed: violations.length === 0,
    scanDurationMs,
    version: COMMERCIAL_GUARD_VERSION,
  };
}

// ---------------------------------------------------------------------------
// SOW Draft commercial guard — Sprint P6-B
// ---------------------------------------------------------------------------

export interface SowDraftFields {
  /** Promoted from option.scopeSummary at SOW generation; operator may edit. */
  scopeStatement?: string | null;
  /** Promoted from option.deliverables. */
  deliverables?: ReadonlyArray<string>;
  /** SOW-specific; operator-authored at generation. */
  exclusions?: ReadonlyArray<string>;
  /** Promoted from option.assumptions. */
  assumptions?: ReadonlyArray<string>;
  /** Promoted from option.dependencies. */
  dependencies?: ReadonlyArray<string>;
  /** Promoted from option.timeline, framed as "Proposed". */
  proposedTimeline?: string | null;
  /** SOW-specific structured shape. */
  responsibilities?: {
    client?: ReadonlyArray<string>;
    operator?: ReadonlyArray<string>;
  };
  /** SOW-specific; unresolved scope / pricing / dependency items. */
  openQuestions?: ReadonlyArray<string>;
  /** Canon-derived per pricing_review_state; operator may edit. */
  pricingNotice?: string | null;
  /** Canon-derived; operator may edit. */
  legalBoundaryNotice?: string | null;
}

export interface RunSowDraftCommercialGuardInput
  extends RunProposalCommercialGuardInput {
  /**
   * SOW Draft content captured at generation time. Sprint P6-B's
   * `generateSowDraftCandidateAction` builds this from the source
   * Proposal Candidate snapshot's option_snapshot + SOW-specific
   * fields. The guard scans these fields in addition to the base
   * proposal scan-field surface.
   */
  sowDraft: SowDraftFields;
}

/**
 * Phase 1B SOW Draft Sprint P6-B — SOW Draft commercial guard wrapper.
 *
 * Delegates to the existing `runProposalCommercialGuard` field-build
 * loop (so the proposal-side scan-field surface is byte-identical) and
 * then adds the SOW-specific fields + scans the **combined 70-pattern
 * set** (44 proposal base + 26 SOW-finality) per `docs/26` § SOW
 * Commercial Guard.
 *
 * Existing `runProposalCommercialGuard` for the proposal-candidate
 * surface is UNCHANGED — its `patternsApplied` still reports the four
 * base families and its `patternCount` remains 44. Only callers that
 * invoke this wrapper get the SOW pattern family applied.
 *
 * Pure function. Same `commercial-guard.v1` version stamp because the
 * shape of the result is shared.
 */
export function runSowDraftCommercialGuard(
  input: RunSowDraftCommercialGuardInput,
): ProposalCommercialGuardResult {
  const start = Date.now();

  // Build the SAME base field set the proposal-side guard would build.
  // We duplicate the loop here (rather than calling
  // `runProposalCommercialGuard` and merging results) because we want a
  // single combined scan over the union of base + SOW fields, with
  // distinct family attribution per match. Calling the proposal helper
  // would scan twice and double-count violations.
  const fields: Array<{
    field: string;
    values: ReadonlyArray<string | null | undefined>;
  }> = [];

  for (const option of input.optionSnapshot) {
    if (!option.includedInArtifact) continue;
    fields.push({
      field: `option[${option.optionId}].title`,
      values: [option.title],
    });
    fields.push({
      field: `option[${option.optionId}].bestFitScenario`,
      values: [option.bestFitScenario],
    });
    fields.push({
      field: `option[${option.optionId}].scopeSummary`,
      values: [option.scopeSummary],
    });
    fields.push({
      field: `option[${option.optionId}].timeline`,
      values: [option.timeline],
    });
    fields.push({
      field: `option[${option.optionId}].deliverables`,
      values: option.deliverables,
    });
    fields.push({
      field: `option[${option.optionId}].assumptions`,
      values: option.assumptions,
    });
    fields.push({
      field: `option[${option.optionId}].dependencies`,
      values: option.dependencies,
    });
    fields.push({
      field: `option[${option.optionId}].risks`,
      values: option.risks,
    });
    fields.push({
      field: `option[${option.optionId}].pricingPlaceholder`,
      values: [option.pricingPlaceholder],
    });
  }

  const credit = input.sourceContextSnapshot.implementationCredit;
  fields.push({
    field: "proposal.implementationCredit.creditAmountPlaceholder",
    values: [credit.creditAmountPlaceholder],
  });
  fields.push({
    field: "proposal.implementationCredit.creditWindow",
    values: [credit.creditWindow],
  });
  fields.push({
    field: "proposal.implementationCredit.creditNotes",
    values: [credit.creditNotes],
  });

  // SOW-specific fields — operator-editable surface per `docs/26`
  // § SOW Commercial Guard scan field list.
  const sow = input.sowDraft;
  if (sow.scopeStatement) {
    fields.push({
      field: "sow.scopeStatement",
      values: [sow.scopeStatement],
    });
  }
  if (sow.deliverables && sow.deliverables.length > 0) {
    fields.push({
      field: "sow.deliverables",
      values: sow.deliverables,
    });
  }
  if (sow.exclusions && sow.exclusions.length > 0) {
    fields.push({
      field: "sow.exclusions",
      values: sow.exclusions,
    });
  }
  if (sow.assumptions && sow.assumptions.length > 0) {
    fields.push({
      field: "sow.assumptions",
      values: sow.assumptions,
    });
  }
  if (sow.dependencies && sow.dependencies.length > 0) {
    fields.push({
      field: "sow.dependencies",
      values: sow.dependencies,
    });
  }
  if (sow.proposedTimeline) {
    fields.push({
      field: "sow.proposedTimeline",
      values: [sow.proposedTimeline],
    });
  }
  if (sow.responsibilities?.client && sow.responsibilities.client.length > 0) {
    fields.push({
      field: "sow.responsibilities.client",
      values: sow.responsibilities.client,
    });
  }
  if (
    sow.responsibilities?.operator &&
    sow.responsibilities.operator.length > 0
  ) {
    fields.push({
      field: "sow.responsibilities.operator",
      values: sow.responsibilities.operator,
    });
  }
  if (sow.openQuestions && sow.openQuestions.length > 0) {
    fields.push({
      field: "sow.openQuestions",
      values: sow.openQuestions,
    });
  }
  if (sow.pricingNotice) {
    fields.push({
      field: "sow.pricingNotice",
      values: [sow.pricingNotice],
    });
  }
  if (sow.legalBoundaryNotice) {
    fields.push({
      field: "sow.legalBoundaryNotice",
      values: [sow.legalBoundaryNotice],
    });
  }

  // Sprint P4's `extras` hook still applies — operator-authored SOW
  // draft text + footer text are scanned alongside the structured
  // fields above for defense-in-depth.
  if (input.extras?.sowDraftText) {
    fields.push({
      field: "sow.draftText",
      values: [input.extras.sowDraftText],
    });
  }
  if (input.extras?.footerText) {
    fields.push({
      field: "sow.footerText",
      values: [input.extras.footerText],
    });
  }

  const violations = scanForBannedClaims(fields, COMBINED_RULES_WITH_SOW);
  const scanDurationMs = Date.now() - start;

  return {
    scannedFields: fields.map((f) => f.field),
    scannedFieldCount: fields.length,
    patternsApplied: [
      "financial",
      "commercial-finality",
      "roadmap-commitment",
      "proposal-finality",
      "sow-draft-finality",
    ],
    patternCount: COMBINED_RULES_WITH_SOW.length,
    violations: violations.map((v) => ({
      field: v.field,
      code: v.code,
      patternFamily: familyForCode(v.code),
    })),
    passed: violations.length === 0,
    scanDurationMs,
    version: COMMERCIAL_GUARD_VERSION,
  };
}
