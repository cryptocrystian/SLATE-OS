/**
 * Capability Maturity Heatmap — Sprint 0B adapter.
 *
 * Maps approved persisted `findings` rows into the heatmap exhibit's
 * `(capability, dimension, maturityScore)` cell shape, per docs/17
 * § Group A row 3.
 *
 *   ⚠ Schema-readiness note.
 *   The persisted `Finding` shape today carries `category` (8-value
 *   union) but does NOT carry explicit `capability` / `dimension` /
 *   `maturityScore` fields. Per the canon (§ "must prefer
 *   insufficient_data over synthesizing"), the adapter MUST NOT invent
 *   tagging from prose. When the persisted findings lack these fields,
 *   the adapter returns `insufficient_data` with code
 *   `untagged_findings` so the diagnostic surface surfaces the
 *   blocker honestly. A future schema sprint may add the tagging;
 *   that work is out of Sprint 0B scope.
 *
 *   To keep the adapter ready for that future schema, the input
 *   accepts an optional `capabilityResolver` and
 *   `dimensionResolver` — pure callbacks the caller may pass when a
 *   tagged-finding extension exists. Sprint 0B leaves these unwired;
 *   the diagnostic surface omits them and the adapter falls back to
 *   the no-tagging path.
 *
 * Pure function. No React, no DB client, no app-route imports, no I/O.
 * Never throws on ordinary bad data.
 */

import type {
  CapabilityMaturityCell,
  CapabilityMaturityHeatmapProps,
} from "@/components/charts/exhibits/capability-maturity-heatmap";
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
import type { Finding, FindingReviewStatus } from "@/lib/findings/types";

/**
 * Pure callbacks the caller may pass when a tagged-finding extension
 * exists in the future. Both return `null` when the resolver cannot
 * confidently map the finding to the requested axis — the adapter then
 * drops the row with an `untagged_findings` issue rather than guessing.
 */
export interface CapabilityMaturityAdapterResolvers {
  resolveCapability?: (finding: Finding) => string | null;
  resolveDimension?: (finding: Finding) => string | null;
  /** Returns 0–100 maturity, or null when not available. */
  resolveMaturityScore?: (finding: Finding) => number | null;
  /** Optional supporting-finding count override. Defaults to 1. */
  resolveSupportingFindingCount?: (finding: Finding) => number;
}

export interface CapabilityMaturityHeatmapAdapterArgs {
  /** All findings for the engagement — filtering is the adapter's job. */
  findings: Finding[];
  /** Row order, top to bottom. Required: the grid is driven by this list. */
  capabilities: string[];
  /** Column order, left to right. Required: the grid is driven by this list. */
  dimensions: string[];
  generatedAt: string | Date;
  lastTouchedAt?: string | Date | null;
  resolvers?: CapabilityMaturityAdapterResolvers;
}

// Approved-or-better review statuses — match the existing
// `getFindingCandidatesForEngagement` filter so the adapter and the
// engagement workspace agree on what "approved" means.
const APPROVED_REVIEW_STATUSES: ReadonlySet<FindingReviewStatus> = new Set([
  "approved",
  "report-ready",
]);

function isApprovedFinding(f: Finding): boolean {
  if (!f || typeof f.id !== "string") return false;
  return APPROVED_REVIEW_STATUSES.has(f.reviewStatus);
}

export function capabilityMaturityFromFindings(
  args: CapabilityMaturityHeatmapAdapterArgs,
): ChartAdapterResult<CapabilityMaturityHeatmapProps> {
  const {
    findings,
    capabilities,
    dimensions,
    generatedAt,
    lastTouchedAt,
    resolvers,
  } = args;
  const safeRows = Array.isArray(findings) ? findings : [];
  const approvedRows = safeRows.filter(isApprovedFinding);

  const sourceSummary = createAdapterSourceSummary({
    source: PERSISTED_SOURCE_LABEL["approved-findings"],
    rowCount: approvedRows.length,
    generatedAt,
    lastTouchedAt: lastTouchedAt ?? null,
  });

  if (approvedRows.length === 0) {
    return adapterInsufficientData<CapabilityMaturityHeatmapProps>(
      sourceSummary,
      [
        {
          code: "no_approved_findings",
          severity: "info",
          message:
            "No approved findings exist for this engagement yet. Approve findings tagged with capability and dimension to assemble the maturity heatmap.",
        },
      ],
    );
  }

  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    return adapterInsufficientData<CapabilityMaturityHeatmapProps>(
      sourceSummary,
      [
        {
          code: "no_capability_axis",
          severity: "info",
          message:
            "No capability axis supplied. Pass `capabilities` (row order) to assemble the maturity heatmap.",
          field: "capabilities",
        },
      ],
    );
  }
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    return adapterInsufficientData<CapabilityMaturityHeatmapProps>(
      sourceSummary,
      [
        {
          code: "no_dimension_axis",
          severity: "info",
          message:
            "No dimension axis supplied. Pass `dimensions` (column order) to assemble the maturity heatmap.",
          field: "dimensions",
        },
      ],
    );
  }

  // Tagging-readiness check. The canon forbids synthesizing tags from
  // prose; without all three resolvers the adapter must fall back to
  // `insufficient_data` and surface the blocker explicitly.
  if (
    !resolvers?.resolveCapability ||
    !resolvers?.resolveDimension ||
    !resolvers?.resolveMaturityScore
  ) {
    return adapterInsufficientData<CapabilityMaturityHeatmapProps>(
      sourceSummary,
      [
        {
          code: "untagged_findings",
          severity: "info",
          message:
            "Persisted findings do not yet carry capability/dimension/maturity tagging. The maturity heatmap will activate once a future schema sprint adds the tagging fields and a caller supplies the corresponding resolvers.",
          field: "capability | dimension | maturityScore",
        },
      ],
    );
  }

  const issues: ChartAdapterIssue[] = [];
  const cellAccumulator = new Map<
    string,
    {
      capability: string;
      dimension: string;
      scoreSum: number;
      scoreCount: number;
      findingCount: number;
    }
  >();
  const capabilitySet = new Set(capabilities);
  const dimensionSet = new Set(dimensions);

  for (const f of approvedRows) {
    const capability = resolvers.resolveCapability(f);
    const dimension = resolvers.resolveDimension(f);
    const maturity = resolvers.resolveMaturityScore(f);

    if (!capability || !dimension) {
      issues.push({
        code: "untagged_finding_row",
        severity: "warning",
        message: `Finding ${f.id} could not be resolved to a (capability, dimension); row dropped.`,
        field: "capability | dimension",
      });
      continue;
    }
    if (!capabilitySet.has(capability) || !dimensionSet.has(dimension)) {
      issues.push({
        code: "axis_value_outside_grid",
        severity: "info",
        message: `Finding ${f.id} resolved to (${capability}, ${dimension}) which is not in the supplied axis arrays; row dropped.`,
      });
      continue;
    }
    if (maturity === null || !isFiniteScore(maturity)) {
      issues.push({
        code: "invariant_violated",
        severity: "warning",
        message: `Finding ${f.id} has a non-finite or out-of-range maturity score; row dropped.`,
        field: "maturityScore",
      });
      continue;
    }

    const key = `${capability}|${dimension}`;
    const existing = cellAccumulator.get(key);
    const findingWeight = Math.max(
      1,
      resolvers.resolveSupportingFindingCount?.(f) ?? 1,
    );
    if (existing) {
      existing.scoreSum += maturity;
      existing.scoreCount += 1;
      existing.findingCount += findingWeight;
    } else {
      cellAccumulator.set(key, {
        capability,
        dimension,
        scoreSum: maturity,
        scoreCount: 1,
        findingCount: findingWeight,
      });
    }
  }

  if (cellAccumulator.size === 0) {
    return adapterInvalidData<CapabilityMaturityHeatmapProps>(sourceSummary, [
      ...issues,
      {
        code: "all_rows_rejected",
        severity: "error",
        message:
          "No findings could be resolved to a (capability, dimension, maturity) cell.",
      },
    ]);
  }

  const cells: CapabilityMaturityCell[] = [];
  for (const acc of cellAccumulator.values()) {
    cells.push({
      capability: acc.capability,
      dimension: acc.dimension,
      maturityScore: Math.round(acc.scoreSum / acc.scoreCount),
      supportingFindingCount: acc.findingCount,
    });
  }

  const props: CapabilityMaturityHeatmapProps = {
    cells,
    capabilities,
    dimensions,
    sourceNote: persistedSourceNote(
      PERSISTED_SOURCE_LABEL["approved-findings"],
      approvedRows.length,
    ),
  };

  return adapterReady(props, sourceSummary, issues);
}

function isFiniteScore(value: unknown): boolean {
  if (typeof value !== "number") return false;
  if (!Number.isFinite(value)) return false;
  if (value < 0 || value > 100) return false;
  return true;
}
