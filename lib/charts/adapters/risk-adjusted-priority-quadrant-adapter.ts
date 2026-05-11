/**
 * Risk-Adjusted Priority Quadrant — Sprint 0B adapter.
 *
 * Maps persisted `opportunities` rows into the exhibit's narrow point
 * shape, per docs/17 § Group A row 2.
 *
 * Re-uses `opportunityToRiskQuadrantPoint` from the exhibit module so
 * the bridge between persisted `Opportunity` rows and the chart's
 * `RiskAdjustedQuadrantPoint[]` shape lives in exactly one place. The
 * adapter wraps that mapping in the canonical `ChartAdapterResult`
 * envelope so the diagnostic surface (and the future report-wiring
 * sprint) can consume a uniform shape.
 *
 * Pure function. No React, no DB client, no app-route imports, no
 * I/O. Never throws on ordinary bad data — failures are surfaced as
 * `issues` and a non-`ready` status. The exhibit's 50/50 analytical
 * midline convention is preserved by not touching `lib/opportunities/
 * helpers.ts` here (those 70/60 thresholds govern the operator's
 * editing matrix, not the analytical view).
 */

import {
  opportunityToRiskQuadrantPoint,
  type RiskAdjustedPriorityQuadrantProps,
  type RiskAdjustedQuadrantPoint,
} from "@/components/charts/exhibits/risk-adjusted-priority-quadrant";
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
import type { Opportunity } from "@/lib/opportunities/types";

export interface RiskAdjustedPriorityQuadrantAdapterArgs {
  opportunities: Opportunity[];
  /** Wall-clock instant for the result. Caller-supplied; adapter is pure. */
  generatedAt: string | Date;
  /**
   * Most recent persisted row touch. Used to derive `freshness`.
   * Pass `null` when row-level timestamps are not available on the
   * TS-mapped shape — the result freshness will be `"unknown"`.
   */
  lastTouchedAt?: string | Date | null;
}

const MIN_VALID_POINTS = 2;

export function risksFromOpportunities(
  args: RiskAdjustedPriorityQuadrantAdapterArgs,
): ChartAdapterResult<RiskAdjustedPriorityQuadrantProps> {
  const { opportunities, generatedAt, lastTouchedAt } = args;
  const safeRows = Array.isArray(opportunities) ? opportunities : [];

  const sourceSummary = createAdapterSourceSummary({
    source: PERSISTED_SOURCE_LABEL["approved-opportunities"],
    rowCount: safeRows.length,
    generatedAt,
    lastTouchedAt: lastTouchedAt ?? null,
  });

  if (safeRows.length === 0) {
    return adapterInsufficientData<RiskAdjustedPriorityQuadrantProps>(
      sourceSummary,
      [
        {
          code: "no_opportunities",
          severity: "info",
          message:
            "No opportunities exist for this engagement yet. Score opportunities to populate the analytical view.",
        },
      ],
    );
  }

  const issues: ChartAdapterIssue[] = [];
  const points: RiskAdjustedQuadrantPoint[] = [];

  for (const opp of safeRows) {
    if (!isOpportunityForQuadrant(opp)) {
      issues.push({
        code: "invariant_violated",
        severity: "warning",
        message: `Opportunity ${opp.id ?? "(missing id)"} has non-finite or out-of-range score(s); row dropped.`,
        field: "businessImpactScore | complexityScore | riskScore",
      });
      continue;
    }
    points.push(opportunityToRiskQuadrantPoint(opp));
  }

  if (points.length === 0) {
    return adapterInvalidData<RiskAdjustedPriorityQuadrantProps>(sourceSummary, [
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
    return adapterInsufficientData<RiskAdjustedPriorityQuadrantProps>(
      sourceSummary,
      [
        ...issues,
        {
          code: "below_minimum",
          severity: "info",
          message: `Need at least ${MIN_VALID_POINTS} valid opportunities to render the analytical 2×2; only ${points.length} valid row${points.length === 1 ? "" : "s"} present.`,
        },
      ],
    );
  }

  const props: RiskAdjustedPriorityQuadrantProps = {
    points,
    sourceNote: persistedSourceNote(
      PERSISTED_SOURCE_LABEL["approved-opportunities"],
      points.length,
    ),
  };

  return adapterReady(props, sourceSummary, issues);
}

function isOpportunityForQuadrant(opp: Opportunity): boolean {
  if (!opp || typeof opp.id !== "string" || opp.id.length === 0) return false;
  if (!isFiniteScore(opp.businessImpactScore)) return false;
  if (!isFiniteScore(opp.complexityScore)) return false;
  if (!isFiniteScore(opp.riskScore)) return false;
  return true;
}

function isFiniteScore(value: unknown): boolean {
  if (typeof value !== "number") return false;
  if (!Number.isFinite(value)) return false;
  if (value < 0 || value > 100) return false;
  return true;
}
