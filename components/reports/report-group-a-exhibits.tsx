import * as React from "react";
import { Card, CardBody } from "@/components/ui/card";
import { ExecutiveSummaryTwoByTwo } from "@/components/charts/exhibits/executive-summary-2x2";
import { RiskAdjustedPriorityQuadrant } from "@/components/charts/exhibits/risk-adjusted-priority-quadrant";
import { CapabilityMaturityHeatmap } from "@/components/charts/exhibits/capability-maturity-heatmap";
import { StakeholderCoverageMatrix } from "@/components/charts/exhibits/stakeholder-coverage-matrix";
import { RoadmapGanttWithDependencies } from "@/components/charts/exhibits/roadmap-gantt-with-dependencies";
import type { ChartAdapterResult } from "@/lib/charts/adapters/types";
import type { ExecutiveSummaryPortfolioProps } from "@/components/charts/exhibits/executive-summary-2x2";
import type { RiskAdjustedPriorityQuadrantProps } from "@/components/charts/exhibits/risk-adjusted-priority-quadrant";
import type { CapabilityMaturityHeatmapProps } from "@/components/charts/exhibits/capability-maturity-heatmap";
import type { StakeholderCoverageMatrixProps } from "@/components/charts/exhibits/stakeholder-coverage-matrix";
import type { RoadmapGanttWithDependenciesProps } from "@/components/charts/exhibits/roadmap-gantt-with-dependencies";

/**
 * Sprint Presentation Pass 2 — docs/61 § 7.A — Group-A live exhibit
 * rendering for the report PDF candidate.
 *
 * Mounts the canonical Group-A exhibit components (executive summary
 * 2×2, risk-adjusted priority quadrant, capability maturity heatmap,
 * stakeholder coverage matrix, 30/60/90 roadmap Gantt) from typed
 * adapter results.
 *
 * Group-B remains gated everywhere — this component does NOT import
 * any Group-B exhibit (benchmark comparison bars, AI-savings waterfall,
 * ROI bridge). The Group-A vs Group-B split is enforced by the slot
 * map (`lib/reports/slot-map.ts`) + the SQL CHECK constraint on
 * `report_sections.exhibit_slot`.
 *
 * Pure server component. SVG-safe to render server-side.
 */

export interface ReportGroupAExhibitResults {
  executiveSummary: ChartAdapterResult<ExecutiveSummaryPortfolioProps>;
  riskPriority: ChartAdapterResult<RiskAdjustedPriorityQuadrantProps>;
  capabilityMaturity: ChartAdapterResult<CapabilityMaturityHeatmapProps>;
  stakeholderCoverage: ChartAdapterResult<StakeholderCoverageMatrixProps>;
  roadmap: ChartAdapterResult<RoadmapGanttWithDependenciesProps>;
}

export interface ReportGroupAExhibitsProps {
  exhibits: ReportGroupAExhibitResults;
  viewerMode: "operator" | "client-facing";
}

type ExhibitDescriptor = {
  key: keyof ReportGroupAExhibitResults;
  title: string;
  operatorSubtitle: string;
  clientSubtitle: string;
};

const EXHIBIT_ORDER: ExhibitDescriptor[] = [
  {
    key: "executiveSummary",
    title: "Opportunity portfolio",
    operatorSubtitle:
      "Group-A · executive summary 2×2 · impact / complexity from approved opportunities",
    clientSubtitle: "Where each opportunity lands on impact and complexity",
  },
  {
    key: "riskPriority",
    title: "Risk-adjusted priority",
    operatorSubtitle:
      "Group-A · risk-priority quadrant · derived from opportunity scoring",
    clientSubtitle:
      "Recommended sequencing weighted by impact, complexity, and risk",
  },
  {
    key: "capabilityMaturity",
    title: "Capability maturity",
    operatorSubtitle:
      "Group-A · capability-maturity heatmap · derived from approved findings",
    clientSubtitle: "Current maturity by capability area, from intake evidence",
  },
  {
    key: "stakeholderCoverage",
    title: "Stakeholder coverage",
    operatorSubtitle:
      "Group-A · stakeholder coverage matrix · derived from intake responses",
    clientSubtitle: "Which voices we heard during discovery, by role and topic",
  },
  {
    key: "roadmap",
    title: "30 / 60 / 90 roadmap",
    operatorSubtitle:
      "Group-A · Gantt with dependencies · derived from ready roadmap items",
    clientSubtitle: "Implementation sequence across the next 90 days",
  },
];

export function ReportGroupAExhibits({
  exhibits,
  viewerMode,
}: ReportGroupAExhibitsProps) {
  const isClient = viewerMode === "client-facing";
  return (
    <section
      aria-label="Report visuals"
      className="flex flex-col gap-5 print:gap-4 print:break-before-page"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">
          Visuals
        </h2>
        <p className="max-w-prose text-[11px] leading-relaxed text-text-muted">
          {isClient
            ? "Visuals are rendered from your engagement's intake, opportunity, and roadmap data. Exhibits without sufficient validated data are noted but not shown."
            : "Group-A exhibits rendered live from current engagement data. Group-B (benchmark / financial) exhibits remain gated by docs/14 + docs/15 and are not imported here."}
        </p>
      </header>

      {EXHIBIT_ORDER.map((desc) => (
        <ExhibitFrame
          key={desc.key}
          desc={desc}
          result={exhibits[desc.key]}
          viewerMode={viewerMode}
        />
      ))}
    </section>
  );
}

function ExhibitFrame({
  desc,
  result,
  viewerMode,
}: {
  desc: ExhibitDescriptor;
  result: ChartAdapterResult<unknown>;
  viewerMode: "operator" | "client-facing";
}) {
  const isClient = viewerMode === "client-facing";
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
        <header className="flex flex-col gap-1">
          <h3 className="text-base font-semibold tracking-tight text-text-primary sm:text-[17px]">
            {desc.title}
          </h3>
          <p className="text-[11px] leading-relaxed text-text-muted">
            {isClient ? desc.clientSubtitle : desc.operatorSubtitle}
          </p>
        </header>

        {result.status === "ready" && result.props ? (
          <div className="overflow-x-auto">
            <ExhibitBody descKey={desc.key} props={result.props} />
          </div>
        ) : (
          <ExhibitPlaceholder result={result} viewerMode={viewerMode} />
        )}
      </CardBody>
    </Card>
  );
}

function ExhibitBody({
  descKey,
  props,
}: {
  descKey: keyof ReportGroupAExhibitResults;
  props: unknown;
}) {
  switch (descKey) {
    case "executiveSummary":
      return (
        <ExecutiveSummaryTwoByTwo
          {...(props as ExecutiveSummaryPortfolioProps)}
        />
      );
    case "riskPriority":
      return (
        <RiskAdjustedPriorityQuadrant
          {...(props as RiskAdjustedPriorityQuadrantProps)}
        />
      );
    case "capabilityMaturity":
      return (
        <CapabilityMaturityHeatmap
          {...(props as CapabilityMaturityHeatmapProps)}
        />
      );
    case "stakeholderCoverage":
      return (
        <StakeholderCoverageMatrix
          {...(props as StakeholderCoverageMatrixProps)}
        />
      );
    case "roadmap":
      return (
        <RoadmapGanttWithDependencies
          {...(props as RoadmapGanttWithDependenciesProps)}
        />
      );
    default:
      return null;
  }
}

function ExhibitPlaceholder({
  result,
  viewerMode,
}: {
  result: ChartAdapterResult<unknown>;
  viewerMode: "operator" | "client-facing";
}) {
  const isClient = viewerMode === "client-facing";
  // Client-facing copy never mentions adapter codes, axis tagging, or
  // implementation internals. Operator mode preserves the issue codes
  // for traceability — the operator needs to know whether to add data,
  // tag findings, or escalate to engineering.
  if (isClient) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-3 text-[11px] leading-relaxed text-text-muted">
        <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
          Not included in this version
        </span>
        <p>
          Not included in this version because supporting data has not
          been validated.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border border-status-warning/30 bg-status-warning/[0.05] p-3 text-[11px] leading-relaxed text-text-secondary">
      <span className="font-mono uppercase tracking-[0.14em] text-status-warning">
        Operator note · adapter status {result.status}
      </span>
      {result.issues.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {result.issues.slice(0, 3).map((issue, i) => (
            <li key={`${issue.code}-${i}`} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-warning"
              />
              <span>
                <code className="font-mono text-[10px]">{issue.code}</code> ·{" "}
                <span className="text-text-muted">{issue.message}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Adapter returned no issue details; check upstream data inputs.</p>
      )}
    </div>
  );
}
