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
  | "proposal-finality";

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

const RULE_FAMILY = new Map<
  ReadonlyArray<BannedClaimRule>,
  ProposalGuardFamily
>([
  [FINANCIAL_CLAIM_PATTERNS, "financial"],
  [COMMERCIAL_FINALITY_PATTERNS, "commercial-finality"],
  [ROADMAP_COMMITMENT_PATTERNS, "roadmap-commitment"],
  [PROPOSAL_FINALITY_PATTERNS, "proposal-finality"],
]);

const COMBINED_RULES: ReadonlyArray<BannedClaimRule> = [
  ...FINANCIAL_CLAIM_PATTERNS,
  ...COMMERCIAL_FINALITY_PATTERNS,
  ...ROADMAP_COMMITMENT_PATTERNS,
  ...PROPOSAL_FINALITY_PATTERNS,
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
