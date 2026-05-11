/**
 * Executive Summary 2×2 — Sprint 0B adapter.
 *
 * Maps persisted `opportunities` rows into the future Executive Summary
 * 2×2 props shape, per docs/17 § Group A row 1. Bubble size encodes
 * **business impact** as a safe non-financial proxy — the canon
 * explicitly forbids re-labeling this dimension as ROI / savings /
 * dollars until a financial-assumption gate advances (docs/15).
 *
 *   ⚠ Exhibit-parameterization note.
 *   `ExecutiveSummaryTwoByTwo` (proof-of-fit) currently renders an
 *   internal `SAMPLE_DATA` array and accepts no props. Sprint 1
 *   internal report-slot rendering will parameterize the exhibit and
 *   consume this adapter's `props` directly. Until then the adapter
 *   establishes the contract: shapes, validation, source note, issues.
 *
 * Pure function. No React, no DB client, no app-route imports, no I/O.
 * Never throws on ordinary bad data.
 */

import {
  adapterInsufficientData,
  adapterInvalidData,
  adapterReady,
  createAdapterSourceSummary,
  persistedSourceNote,
  PERSISTED_SOURCE_LABEL,
  type ChartAdapterIssue,
  type ChartAdapterResult,
} from "@/lib/charts/adapters/types";
import type { ChartTone, SourceNote } from "@/lib/charts/types";
import type {
  EvidenceStrength,
  Opportunity,
} from "@/lib/opportunities/types";

// ---------------------------------------------------------------------------
// Adapter output shape — the prop contract Sprint 1 will pass into the
// (future-parameterized) Executive Summary 2×2 exhibit. Kept local to
// the adapter so we do not change the proof-of-fit exhibit's source.
// ---------------------------------------------------------------------------

export interface ExecutiveSummaryPortfolioPoint {
  id: string;
  title: string;
  /** 0–100. Y-axis position. */
  impact: number;
  /** 0–100. X-axis position. */
  complexity: number;
  /**
   * Bubble-size signal. Carries business impact as a safe
   * non-financial proxy. The canon prohibits naming this dimension
   * "ROI" / "savings" / "$" until docs/15 advances.
   */
  impactSignal: number;
  /** Categorical evidence-strength color tone. */
  evidence: ChartTone;
  /** Optional dashed brand ring marker for the recommended item. */
  recommended?: boolean;
}

export interface ExecutiveSummaryPortfolioProps {
  points: ExecutiveSummaryPortfolioPoint[];
  /** Optional explicit recommended-item id. Caller may pass through from persisted "selected" flag. */
  recommendedId?: string;
  sourceNote: SourceNote;
  takeaway?: string;
}

export interface ExecutiveSummary2x2AdapterArgs {
  opportunities: Opportunity[];
  generatedAt: string | Date;
  lastTouchedAt?: string | Date | null;
}

const MIN_VALID_POINTS = 3;

// Evidence-strength → ChartTone. Mirrors the proof-of-fit exhibit's
// SAMPLE_DATA tone vocabulary (success / info / warning) so the
// parameterized version (Sprint 1) reads identically to the preview.
const EVIDENCE_TONE: Record<EvidenceStrength, ChartTone> = {
  strong: "success",
  adequate: "info",
  thin: "warning",
};

export function executiveSummaryPortfolioFromOpportunities(
  args: ExecutiveSummary2x2AdapterArgs,
): ChartAdapterResult<ExecutiveSummaryPortfolioProps> {
  const { opportunities, generatedAt, lastTouchedAt } = args;
  const safeRows = Array.isArray(opportunities) ? opportunities : [];

  const sourceSummary = createAdapterSourceSummary({
    source: PERSISTED_SOURCE_LABEL["approved-opportunities"],
    rowCount: safeRows.length,
    generatedAt,
    lastTouchedAt: lastTouchedAt ?? null,
  });

  if (safeRows.length === 0) {
    return adapterInsufficientData<ExecutiveSummaryPortfolioProps>(
      sourceSummary,
      [
        {
          code: "no_opportunities",
          severity: "info",
          message:
            "No opportunities exist for this engagement yet. Approve at least three opportunities to assemble the portfolio chart.",
        },
      ],
    );
  }

  const issues: ChartAdapterIssue[] = [];
  const points: ExecutiveSummaryPortfolioPoint[] = [];

  for (const opp of safeRows) {
    if (!isPortfolioCandidate(opp)) {
      issues.push({
        code: "invariant_violated",
        severity: "warning",
        message: `Opportunity ${opp.id ?? "(missing id)"} has non-finite or out-of-range score(s); row dropped.`,
        field: "businessImpactScore | complexityScore | evidenceStrength",
      });
      continue;
    }
    points.push({
      id: opp.id,
      title: opp.title,
      impact: opp.businessImpactScore,
      complexity: opp.complexityScore,
      impactSignal: opp.businessImpactScore,
      evidence: EVIDENCE_TONE[opp.evidenceStrength],
    });
  }

  if (points.length === 0) {
    return adapterInvalidData<ExecutiveSummaryPortfolioProps>(sourceSummary, [
      ...issues,
      {
        code: "all_rows_rejected",
        severity: "error",
        message:
          "Every opportunity failed score-range validation; no valid points to chart.",
      },
    ]);
  }

  if (points.length < MIN_VALID_POINTS) {
    return adapterInsufficientData<ExecutiveSummaryPortfolioProps>(
      sourceSummary,
      [
        ...issues,
        {
          code: "below_minimum",
          severity: "info",
          message: `Need at least ${MIN_VALID_POINTS} valid opportunities to assemble the portfolio chart; only ${points.length} valid row${points.length === 1 ? "" : "s"} present.`,
        },
      ],
    );
  }

  // Recommended-item derivation rule (deterministic): the highest-impact
  // opportunity in the "Quick Wins" quadrant (high impact + low complexity)
  // is recommended. Falls back to the single highest-impact opportunity
  // when no candidate sits in the quick-win quadrant. Never invents a
  // recommendation when impact is tied — picks the lowest-complexity
  // among tied impact, then the lexicographically-first id for stability.
  const recommendedId = pickRecommendedId(points);
  if (recommendedId) {
    for (const p of points) {
      if (p.id === recommendedId) p.recommended = true;
    }
  } else {
    issues.push({
      code: "no_recommended_candidate",
      severity: "info",
      message:
        "No opportunity sat above the impact + complexity quick-win threshold; no recommended ring rendered.",
    });
  }

  const props: ExecutiveSummaryPortfolioProps = {
    points,
    recommendedId,
    sourceNote: persistedSourceNote(
      PERSISTED_SOURCE_LABEL["approved-opportunities"],
      points.length,
    ),
  };

  return adapterReady(props, sourceSummary, issues);
}

function isPortfolioCandidate(opp: Opportunity): boolean {
  if (!opp || typeof opp.id !== "string" || opp.id.length === 0) return false;
  if (typeof opp.title !== "string" || opp.title.length === 0) return false;
  if (!isFiniteScore(opp.businessImpactScore)) return false;
  if (!isFiniteScore(opp.complexityScore)) return false;
  if (!isEvidenceStrength(opp.evidenceStrength)) return false;
  return true;
}

function isFiniteScore(value: unknown): boolean {
  if (typeof value !== "number") return false;
  if (!Number.isFinite(value)) return false;
  if (value < 0 || value > 100) return false;
  return true;
}

function isEvidenceStrength(value: unknown): value is EvidenceStrength {
  return value === "strong" || value === "adequate" || value === "thin";
}

// Quick-win definition matches the proof-of-fit's QUADRANT_THRESHOLD_X=50
// and QUADRANT_THRESHOLD_Y=60 — the exhibit's own analytical thresholds.
const QUICK_WIN_IMPACT_MIN = 60;
const QUICK_WIN_COMPLEXITY_MAX = 50;

function pickRecommendedId(
  points: ExecutiveSummaryPortfolioPoint[],
): string | undefined {
  const candidates = points.filter(
    (p) =>
      p.impact >= QUICK_WIN_IMPACT_MIN &&
      p.complexity < QUICK_WIN_COMPLEXITY_MAX,
  );
  const pool = candidates.length > 0 ? candidates : points;
  if (pool.length === 0) return undefined;
  // Sort by impact desc, then complexity asc, then id asc — deterministic.
  const sorted = [...pool].sort((a, b) => {
    if (b.impact !== a.impact) return b.impact - a.impact;
    if (a.complexity !== b.complexity) return a.complexity - b.complexity;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  // Only mark a recommendation when the chosen point actually sits in
  // the quick-win zone; otherwise the recommendation is too weak to
  // visually justify the brand ring.
  if (candidates.length === 0) return undefined;
  return sorted[0]?.id;
}
