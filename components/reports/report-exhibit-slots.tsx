import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CapabilityMaturityHeatmap,
  type CapabilityMaturityHeatmapProps,
} from "@/components/charts/exhibits/capability-maturity-heatmap";
import {
  ExecutiveSummaryTwoByTwo,
  type ExecutiveSummaryPortfolioProps,
} from "@/components/charts/exhibits/executive-summary-2x2";
import {
  RiskAdjustedPriorityQuadrant,
  type RiskAdjustedPriorityQuadrantProps,
} from "@/components/charts/exhibits/risk-adjusted-priority-quadrant";
import {
  RoadmapGanttWithDependencies,
  type RoadmapGanttWithDependenciesProps,
} from "@/components/charts/exhibits/roadmap-gantt-with-dependencies";
import {
  StakeholderCoverageMatrix,
  type StakeholderCoverageMatrixProps,
} from "@/components/charts/exhibits/stakeholder-coverage-matrix";
import {
  isAdapterReady,
  type ChartAdapterIssue,
  type ChartAdapterResult,
  type ChartAdapterStatus,
  type ReportExhibitSlot,
} from "@/lib/charts/adapters/types";
import {
  GROUP_A_REPORT_SLOTS,
  type ReportSlotDefinition,
} from "@/lib/reports/slot-map";

/**
 * Internal report exhibit slots renderer — Sprint 1.
 *
 * Operator-only, read-only. Renders the five Group-A exhibit slots
 * inside the internal report preview at `/app/engagements/[id]/report`.
 * The component is pure presentation: every adapter result is passed
 * in pre-computed by the server-rendered page. The renderer never
 * fetches, never mutates, never writes `report_sections`, never falls
 * back to sample data.
 *
 * Per `docs/17_PHASE_1B_REPORT_EXHIBIT_WIRING_CANON.md`:
 *   - Group B exhibits (Benchmark, Waterfall, ROI Bridge) are NOT
 *     imported here and NOT rendered. They stay preview-only until
 *     `docs/14` / `docs/15` advance their data gates.
 *   - Fallback states are explicit operator-facing copy with deep
 *     links to the editing surface, never sample data.
 *   - Source notes flow through the existing `<ChartFrame>` /
 *     `<ChartSourceNote>` convention via the adapter result's
 *     `props.sourceNote`.
 *
 * Pure server component. SVG output via the exhibits.
 */

export interface ReportExhibitSlotsProps {
  engagementId: string;
  /** Wall-clock token shared with the adapter calls. ISO 8601 UTC. */
  generatedAt: string;
  /** Risk-Adjusted Priority Quadrant adapter result. */
  riskPriority: ChartAdapterResult<RiskAdjustedPriorityQuadrantProps>;
  /** Executive Summary 2×2 adapter result. */
  executiveSummary: ChartAdapterResult<ExecutiveSummaryPortfolioProps>;
  /** Capability Maturity Heatmap adapter result. */
  capabilityMaturity: ChartAdapterResult<CapabilityMaturityHeatmapProps>;
  /** Stakeholder Coverage Matrix adapter result. */
  stakeholderCoverage: ChartAdapterResult<StakeholderCoverageMatrixProps>;
  /** Roadmap Gantt with Dependencies adapter result. */
  roadmap: ChartAdapterResult<RoadmapGanttWithDependenciesProps>;
}

const STATUS_BADGE_TONE: Record<ChartAdapterStatus, BadgeTone> = {
  ready: "success",
  insufficient_data: "warning",
  invalid_data: "risk",
  gated: "neutral",
};

const STATUS_LABEL: Record<ChartAdapterStatus, string> = {
  ready: "Ready",
  insufficient_data: "Insufficient data",
  invalid_data: "Invalid data",
  gated: "Gated",
};

const FRESHNESS_LABEL: Record<"fresh" | "stale" | "unknown", string> = {
  fresh: "Fresh",
  stale: "Stale",
  unknown: "Unknown",
};

const FRESHNESS_TONE: Record<"fresh" | "stale" | "unknown", BadgeTone> = {
  fresh: "info",
  stale: "warning",
  unknown: "neutral",
};

const SEVERITY_TONE: Record<ChartAdapterIssue["severity"], BadgeTone> = {
  info: "neutral",
  warning: "warning",
  error: "risk",
};

interface SlotFallbackTarget {
  href: string;
  label: string;
}

/**
 * Per-slot fallback deep link — per `docs/17` § Fallback Rules. Every
 * insufficient-data state points at the editing surface that fixes it.
 */
function fallbackTargetFor(
  slot: ReportExhibitSlot,
  engagementId: string,
): SlotFallbackTarget {
  switch (slot) {
    case "executive_summary_portfolio":
    case "findings_risk_priority":
      return {
        href: `/app/engagements/${engagementId}/opportunities`,
        label: "Open opportunities",
      };
    case "diagnostic_capability_maturity":
      return {
        href: `/app/engagements/${engagementId}/findings`,
        label: "Open findings",
      };
    case "diagnostic_stakeholder_coverage":
      return {
        href: `/app/engagements/${engagementId}/intake`,
        label: "Open intake",
      };
    case "roadmap_90_day_sequence":
      return {
        href: `/app/engagements/${engagementId}/roadmap`,
        label: "Open roadmap",
      };
  }
}

export function ReportExhibitSlots({
  engagementId,
  generatedAt,
  riskPriority,
  executiveSummary,
  capabilityMaturity,
  stakeholderCoverage,
  roadmap,
}: ReportExhibitSlotsProps) {
  // The slot table fixes render order. The renderer maps each slot id
  // to its adapter result + exhibit. Adding a slot is a canon-amend
  // event, not a silent edit here — see `lib/reports/slot-map.ts`.
  return (
    <section
      aria-label="Report exhibits — internal preview"
      className="flex flex-col gap-5"
    >
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Report exhibits · internal preview
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">
            Visual exhibits from persisted engagement data.
          </h2>
          <Badge tone="ai" dot>
            Phase 1B · Sprint 1
          </Badge>
          <Badge tone="neutral" variant="outline">
            Internal only · not client-facing
          </Badge>
        </div>
        <p className="max-w-prose text-xs leading-relaxed text-text-muted">
          Generated from persisted opportunities, findings, stakeholder intake, and roadmap rows via the Group-A adapter layer (
          <code className="font-mono">lib/charts/adapters/</code>). Slots that lack source data render a fallback card with a deep link to the editing surface — never sample data. Benchmark and financial exhibits remain preview-only at <code className="font-mono">/app/charts-preview</code> until <code className="font-mono">docs/14</code> / <code className="font-mono">docs/15</code> data gates advance. Generated {formatTimestamp(generatedAt)}.
        </p>
      </header>

      {GROUP_A_REPORT_SLOTS.map((slotDef) => (
        <ReportExhibitSlotPanel
          key={slotDef.slot}
          slotDef={slotDef}
          engagementId={engagementId}
          adapterResult={resultFor(slotDef.slot, {
            riskPriority,
            executiveSummary,
            capabilityMaturity,
            stakeholderCoverage,
            roadmap,
          })}
          exhibit={exhibitFor(slotDef.slot, {
            riskPriority,
            executiveSummary,
            capabilityMaturity,
            stakeholderCoverage,
            roadmap,
          })}
        />
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Slot dispatch — narrow per-slot to the correctly-typed adapter result.
// Keeps the discriminated union safe and avoids `as unknown` cast soup.
// ---------------------------------------------------------------------------

interface SlotResultMap {
  riskPriority: ChartAdapterResult<RiskAdjustedPriorityQuadrantProps>;
  executiveSummary: ChartAdapterResult<ExecutiveSummaryPortfolioProps>;
  capabilityMaturity: ChartAdapterResult<CapabilityMaturityHeatmapProps>;
  stakeholderCoverage: ChartAdapterResult<StakeholderCoverageMatrixProps>;
  roadmap: ChartAdapterResult<RoadmapGanttWithDependenciesProps>;
}

function resultFor(
  slot: ReportExhibitSlot,
  results: SlotResultMap,
): ChartAdapterResult<unknown> {
  switch (slot) {
    case "executive_summary_portfolio":
      return results.executiveSummary;
    case "findings_risk_priority":
      return results.riskPriority;
    case "diagnostic_capability_maturity":
      return results.capabilityMaturity;
    case "diagnostic_stakeholder_coverage":
      return results.stakeholderCoverage;
    case "roadmap_90_day_sequence":
      return results.roadmap;
  }
}

function exhibitFor(
  slot: ReportExhibitSlot,
  results: SlotResultMap,
): React.ReactNode | null {
  switch (slot) {
    case "executive_summary_portfolio":
      return isAdapterReady(results.executiveSummary) ? (
        <ExecutiveSummaryTwoByTwo {...results.executiveSummary.props} />
      ) : null;
    case "findings_risk_priority":
      return isAdapterReady(results.riskPriority) ? (
        <RiskAdjustedPriorityQuadrant {...results.riskPriority.props} />
      ) : null;
    case "diagnostic_capability_maturity":
      return isAdapterReady(results.capabilityMaturity) ? (
        <CapabilityMaturityHeatmap {...results.capabilityMaturity.props} />
      ) : null;
    case "diagnostic_stakeholder_coverage":
      return isAdapterReady(results.stakeholderCoverage) ? (
        <StakeholderCoverageMatrix {...results.stakeholderCoverage.props} />
      ) : null;
    case "roadmap_90_day_sequence":
      return isAdapterReady(results.roadmap) ? (
        <RoadmapGanttWithDependencies {...results.roadmap.props} />
      ) : null;
  }
}

// ---------------------------------------------------------------------------
// Per-slot panel
// ---------------------------------------------------------------------------

function ReportExhibitSlotPanel({
  slotDef,
  engagementId,
  adapterResult,
  exhibit,
}: {
  slotDef: ReportSlotDefinition;
  engagementId: string;
  adapterResult: ChartAdapterResult<unknown>;
  exhibit: React.ReactNode | null;
}) {
  const { status, issues, sourceSummary } = adapterResult;
  const ready = status === "ready" && exhibit !== null;
  const fallbackTarget = fallbackTargetFor(slotDef.slot, engagementId);

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Slot · {slotDef.slot}
            </span>
            <Badge tone={STATUS_BADGE_TONE[status]}>
              {STATUS_LABEL[status]}
            </Badge>
            <Badge tone={FRESHNESS_TONE[sourceSummary.freshness]} variant="outline">
              {FRESHNESS_LABEL[sourceSummary.freshness]}
            </Badge>
          </div>
          <h3 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">
            {slotDef.title}
          </h3>
          <p className="text-xs leading-relaxed text-text-muted">
            {slotDef.description}
          </p>
          <p className="text-xs leading-relaxed text-text-muted">
            <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
              Source
            </span>{" "}
            · {sourceSummary.source} ·{" "}
            <span className="font-mono">n={sourceSummary.rowCount}</span>
          </p>
        </header>

        {ready ? (
          <div className="-mx-1 sm:-mx-2">{exhibit}</div>
        ) : (
          <ReportExhibitFallbackCard
            status={status}
            target={fallbackTarget}
          />
        )}

        {issues.length > 0 ? (
          <IssueList issues={issues} />
        ) : null}
      </CardBody>
    </Card>
  );
}

function ReportExhibitFallbackCard({
  status,
  target,
}: {
  status: ChartAdapterStatus;
  target: SlotFallbackTarget;
}) {
  return (
    <div className="rounded-md border border-dashed border-border-subtle bg-bg-elevated/40 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-status-warning"
          aria-hidden
        />
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Exhibit not ready · {STATUS_LABEL[status].toLowerCase()}
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              No sample data fallback — persisted data required. Review the issues below for the specific blocker and complete the upstream step.
            </p>
          </div>
          <Link href={target.href}>
            <Button
              variant="secondary"
              size="sm"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              {target.label}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function IssueList({ issues }: { issues: ChartAdapterIssue[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
        Issues · {issues.length}
      </span>
      <ul className="flex flex-col gap-2">
        {issues.map((issue, i) => (
          <li
            key={`${issue.code}-${i}`}
            className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/30 p-3 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={SEVERITY_TONE[issue.severity]}>
                {issue.severity}
              </Badge>
              <code className="font-mono text-[11px] text-text-muted">
                {issue.code}
              </code>
              {issue.field ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-disabled">
                  field · {issue.field}
                </span>
              ) : null}
            </div>
            <p className="leading-relaxed text-text-secondary">
              {issue.message}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
