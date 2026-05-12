/**
 * Shared banned-claim scanner for AI synthesis output.
 *
 * Steps 3 (report sections) and 4 (proposal options) both refuse to
 * persist AI-drafted text that contains gated language. The scanner
 * is intentionally generic — callers supply a `pattern set` plus the
 * candidate string fields to scan.
 *
 *   - `FINANCIAL_CLAIM_PATTERNS` — core 14-pattern list shared by
 *     both report-section and proposal-option synthesis. Matches the
 *     prohibition vocabulary in `docs/14` and `docs/15`.
 *   - `COMMERCIAL_FINALITY_PATTERNS` — additional patterns that only
 *     proposal-option drafting needs to reject (e.g. "ready for
 *     signature", "binding quote"). Step 3 does not use these.
 *
 * The patterns are documented as prohibition examples; the runtime
 * scanner rejects them in AI output. They are allowed to appear in
 * THIS file and in docs/canon files as prohibition strings.
 *
 * Pure module — no React, no DB, no I/O.
 */

export interface BannedClaimRule {
  code: string;
  pattern: RegExp;
}

/**
 * Banned financial / benchmark phrases — gated by `docs/14` (benchmark
 * data canon) and `docs/15` (financial assumptions canon) until those
 * canons advance their data tiers. AI output that triggers any of
 * these MUST be rejected before persistence.
 */
export const FINANCIAL_CLAIM_PATTERNS: ReadonlyArray<BannedClaimRule> = [
  { code: "guaranteed_roi", pattern: /\bguaranteed\s+roi\b/i },
  { code: "guaranteed_savings", pattern: /\bguaranteed\s+savings\b/i },
  { code: "payback", pattern: /\bpayback\b/i },
  { code: "break_even", pattern: /\bbreak[\s-]?even\b/i },
  { code: "cash_flow_positive", pattern: /\bcash[\s-]flow[\s-]positive\b/i },
  { code: "will_save", pattern: /\bwill\s+save\b/i },
  { code: "will_reduce_cost", pattern: /\bwill\s+reduce\s+cost\b/i },
  { code: "top_quartile", pattern: /\btop[\s-]quartile\b/i },
  { code: "above_average", pattern: /\babove\s+average\b/i },
  { code: "industry_benchmark", pattern: /\bindustry\s+benchmark(s)?\b/i },
  { code: "peer_benchmark", pattern: /\bpeer\s+benchmark(s)?\b/i },
  { code: "finance_approved", pattern: /\bfinance[\s-]approved\b/i },
  { code: "board_ready_roi", pattern: /\bboard[\s-]ready\s+roi\b/i },
  {
    code: "guaranteed_financial",
    pattern: /\bguaranteed\s+(return|savings?|payback|cost|reduction)\b/i,
  },
];

/**
 * Commercial-finality phrases — AI proposal-option drafting must not
 * imply contract-readiness, e-signature readiness, or finance approval.
 * Send / Share / SOW / e-signature workflows remain locked at the UI
 * layer; the AI side of the boundary refuses to generate copy that
 * could mislead the operator into shipping a draft prematurely.
 */
export const COMMERCIAL_FINALITY_PATTERNS: ReadonlyArray<BannedClaimRule> = [
  { code: "ready_for_signature", pattern: /\bready\s+for\s+signature\b/i },
  { code: "approved_by_finance", pattern: /\bapproved\s+by\s+finance\b/i },
  { code: "final_commercial_terms", pattern: /\bfinal\s+commercial\s+terms\b/i },
  { code: "binding_quote", pattern: /\bbinding\s+quote\b/i },
  { code: "binding_offer", pattern: /\bbinding\s+offer\b/i },
  { code: "executed_sow", pattern: /\bexecuted\s+sow\b/i },
];

/**
 * Roadmap-commitment phrases — AI roadmap-item drafting must not imply
 * delivery commitments, binding timelines, or finalized schedules. The
 * canon for roadmap drafts is that they are **proposed sequences**
 * subject to operator review and stakeholder availability.
 */
export const ROADMAP_COMMITMENT_PATTERNS: ReadonlyArray<BannedClaimRule> = [
  { code: "guaranteed_completion", pattern: /\bguaranteed\s+completion\b/i },
  { code: "binding_timeline", pattern: /\bbinding\s+timeline\b/i },
  {
    code: "final_implementation_schedule",
    pattern: /\bfinal\s+implementation\s+schedule\b/i,
  },
  {
    code: "committed_delivery_date",
    pattern: /\bcommitted\s+delivery\s+date\b/i,
  },
  {
    code: "legally_binding_timeline",
    pattern: /\blegally\s+binding\s+timeline\b/i,
  },
  {
    code: "binding_delivery_commitment",
    pattern: /\bbinding\s+delivery\s+commitment\b/i,
  },
];

export interface BannedClaimViolation {
  field: string;
  code: string;
}

/**
 * Run a fixed pattern set against a `(field, value)` map. Returns the
 * list of `{field, code}` pairs that matched. `field` values are
 * caller-defined strings — the scanner does not require any specific
 * shape so it can be reused by report-section and proposal-option
 * candidates without sharing a TS shape.
 *
 * Multi-value fields (string arrays) should be flattened by the caller
 * before being passed in; the scanner runs the patterns against each
 * supplied string independently.
 */
export function scanForBannedClaims(
  fields: Array<{ field: string; values: ReadonlyArray<string | null | undefined> }>,
  rules: ReadonlyArray<BannedClaimRule>,
): BannedClaimViolation[] {
  const violations: BannedClaimViolation[] = [];
  for (const f of fields) {
    for (const value of f.values) {
      if (typeof value !== "string" || value.length === 0) continue;
      for (const rule of rules) {
        if (rule.pattern.test(value)) {
          violations.push({ field: f.field, code: rule.code });
        }
      }
    }
  }
  return violations;
}
