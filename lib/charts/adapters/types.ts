/**
 * SLATE chart-adapter result envelope and shared helpers.
 *
 * Pure types + pure helpers — no React, no DB client, no app-route
 * imports, no I/O. Every Phase 1B Group-A adapter under
 * `lib/charts/adapters/` returns a `ChartAdapterResult<TProps>` whose
 * shape is fixed by `docs/17_PHASE_1B_REPORT_EXHIBIT_WIRING_CANON.md`.
 *
 * The canonical adapter contract is documented in:
 *   - `docs/17_PHASE_1B_REPORT_EXHIBIT_WIRING_CANON.md` (§ Adapter Contract)
 *   - `components/charts/README.md` (Adapter layer pointer)
 *
 * This module is intentionally minimal: it owns the discriminated-union
 * shape and a handful of factory helpers that keep the call sites
 * concise. It does NOT own per-exhibit logic — each adapter file is
 * responsible for its own validation, normalization, and source-note
 * composition.
 */

import type { SourceNote } from "@/lib/charts/types";

// ---------------------------------------------------------------------------
// Result envelope — see docs/17 § Adapter Contract.
// ---------------------------------------------------------------------------

export type ChartAdapterStatus =
  | "ready"
  | "insufficient_data"
  | "invalid_data"
  | "gated";

export type ChartAdapterIssueSeverity = "info" | "warning" | "error";

export interface ChartAdapterIssue {
  /** Stable, machine-readable identifier (e.g. `"no_opportunities"`). */
  code: string;
  severity: ChartAdapterIssueSeverity;
  /** Operator-readable; never displayed to the client. */
  message: string;
  /** Optional row column the issue points at. */
  field?: string;
}

export type ChartAdapterFreshness = "fresh" | "stale" | "unknown";

export interface ChartAdapterSourceSummary {
  /** Human-readable source name (e.g. `"Approved opportunities"`). */
  source: string;
  /** Observed row count. May be `0` for `insufficient_data`. */
  rowCount: number;
  /** ISO 8601 UTC timestamp. Caller supplies a clock token. */
  generatedAt: string;
  freshness: ChartAdapterFreshness;
}

/**
 * Discriminated union: `props` is present only when `status === "ready"`.
 * Callers MUST narrow on `status` before consuming `props`.
 */
export interface ChartAdapterResult<TProps> {
  status: ChartAdapterStatus;
  /** Only populated when `status === "ready"`. */
  props?: TProps;
  /** Always an array; empty when nothing to surface. */
  issues: ChartAdapterIssue[];
  sourceSummary: ChartAdapterSourceSummary;
}

// ---------------------------------------------------------------------------
// Report-section slot vocabulary — see docs/17 § Report Section Slot
// Vocabulary. Stable strings; adding a slot is a canon amendment.
// ---------------------------------------------------------------------------

export type ReportExhibitSlot =
  | "executive_summary_portfolio"
  | "findings_risk_priority"
  | "diagnostic_capability_maturity"
  | "diagnostic_stakeholder_coverage"
  | "roadmap_90_day_sequence";

// ---------------------------------------------------------------------------
// Freshness — see docs/17 § Data Freshness Rules.
// ---------------------------------------------------------------------------

/** Stale threshold default — 7 days. May tighten per-adapter in future. */
export const DEFAULT_STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Compute a freshness label from a row-touched timestamp and a wall
 * clock. The caller supplies both timestamps so the adapter stays pure
 * and deterministic at the call site (no `Date.now()` inside adapters).
 *
 * If `lastTouchedAt` is missing or unparseable, freshness is
 * `"unknown"` — the canon treats unknown as stale for client-facing
 * surfaces but allows diagnostic surfaces to render with a warning.
 */
export function deriveFreshness(
  lastTouchedAt: string | Date | null | undefined,
  generatedAt: string | Date,
  thresholdMs: number = DEFAULT_STALE_THRESHOLD_MS,
): ChartAdapterFreshness {
  if (lastTouchedAt === null || lastTouchedAt === undefined) {
    return "unknown";
  }
  const touched = toUtcMs(lastTouchedAt);
  const gen = toUtcMs(generatedAt);
  if (touched === null || gen === null) return "unknown";
  if (gen - touched <= thresholdMs) return "fresh";
  return "stale";
}

function toUtcMs(value: string | Date): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** ISO-8601 UTC normalization. Returns the input unchanged when already ISO-shaped. */
export function toIsoUtc(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toISOString();
}

/**
 * Pick the latest valid ISO-shaped timestamp from a list. Pure helper
 * used by the report page and the diagnostic page to compute the best
 * `lastTouchedAt` for an adapter input from an array of persisted
 * row timestamps (e.g. `opportunities.map(o => o.updatedAt)`).
 *
 * Behavior:
 *   - null / undefined / empty-string entries are ignored.
 *   - Unparseable strings are ignored (never throws).
 *   - Returns the latest valid ISO 8601 UTC string, or `null` if no
 *     entry parsed successfully.
 *   - No `Date.now()`; the function is pure.
 *   - Stable: same input ⇒ same output.
 *
 * Per `docs/17` § Data Freshness Rules, a `null` return causes the
 * adapter freshness envelope to fall through to `"unknown"`.
 */
export function latestIsoTimestamp(
  values: Array<string | Date | null | undefined>,
): string | null {
  let bestMs = -Infinity;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    let ms: number;
    if (v instanceof Date) {
      ms = v.getTime();
    } else if (typeof v === "string" && v.length > 0) {
      ms = Date.parse(v);
    } else {
      continue;
    }
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) bestMs = ms;
  }
  if (!Number.isFinite(bestMs)) return null;
  return new Date(bestMs).toISOString();
}

// ---------------------------------------------------------------------------
// Factory helpers — keep adapter call sites concise.
// ---------------------------------------------------------------------------

/**
 * Build a canonical `sourceSummary`. Adapters typically derive
 * `lastTouchedAt` from the most-recently-updated persisted row.
 */
export function createAdapterSourceSummary(args: {
  source: string;
  rowCount: number;
  generatedAt: string | Date;
  lastTouchedAt?: string | Date | null;
  staleThresholdMs?: number;
}): ChartAdapterSourceSummary {
  const generatedAtIso = toIsoUtc(args.generatedAt);
  const freshness = deriveFreshness(
    args.lastTouchedAt ?? null,
    args.generatedAt,
    args.staleThresholdMs,
  );
  return {
    source: args.source,
    rowCount: args.rowCount,
    generatedAt: generatedAtIso,
    freshness,
  };
}

export function adapterReady<TProps>(
  props: TProps,
  sourceSummary: ChartAdapterSourceSummary,
  issues: ChartAdapterIssue[] = [],
): ChartAdapterResult<TProps> {
  return {
    status: "ready",
    props,
    issues,
    sourceSummary,
  };
}

export function adapterInsufficientData<TProps>(
  sourceSummary: ChartAdapterSourceSummary,
  issues: ChartAdapterIssue[],
): ChartAdapterResult<TProps> {
  return {
    status: "insufficient_data",
    issues,
    sourceSummary,
  };
}

export function adapterInvalidData<TProps>(
  sourceSummary: ChartAdapterSourceSummary,
  issues: ChartAdapterIssue[],
): ChartAdapterResult<TProps> {
  return {
    status: "invalid_data",
    issues,
    sourceSummary,
  };
}

export function adapterGated<TProps>(
  sourceSummary: ChartAdapterSourceSummary,
  issues: ChartAdapterIssue[],
): ChartAdapterResult<TProps> {
  return {
    status: "gated",
    issues,
    sourceSummary,
  };
}

/**
 * Type guard for use at call sites — narrows `result.props` to `TProps`.
 */
export function isAdapterReady<TProps>(
  result: ChartAdapterResult<TProps>,
): result is ChartAdapterResult<TProps> & { status: "ready"; props: TProps } {
  return result.status === "ready" && result.props !== undefined;
}

// ---------------------------------------------------------------------------
// Source-note helpers — see docs/17 § Source-Note Rules. Adapters compose
// the exact `SourceNote` value; the caller passes it straight to
// `<ChartFrame sourceNote={...}>`.
// ---------------------------------------------------------------------------

/**
 * Compose a canon-compliant source note for a persisted, non-gated
 * Group-A source. `n` is included as the structured count; consumers
 * may render `<text> · n=<count>` or use the `n` field directly.
 */
export function persistedSourceNote(
  text: string,
  n: number,
): SourceNote {
  return { text, n };
}

export type GroupAPersistedSource =
  | "approved-opportunities"
  | "approved-findings"
  | "stakeholder-intake-responses"
  | "roadmap-items";

export const PERSISTED_SOURCE_LABEL: Record<GroupAPersistedSource, string> = {
  "approved-opportunities": "Source: Approved opportunities",
  "approved-findings": "Source: Approved findings",
  "stakeholder-intake-responses": "Source: Stakeholder intake responses",
  "roadmap-items": "Source: 30/60/90 roadmap items",
};
