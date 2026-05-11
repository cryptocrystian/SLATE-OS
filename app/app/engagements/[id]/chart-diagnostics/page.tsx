import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CapabilityMaturityHeatmap } from "@/components/charts/exhibits/capability-maturity-heatmap";
import { RiskAdjustedPriorityQuadrant } from "@/components/charts/exhibits/risk-adjusted-priority-quadrant";
import { RoadmapGanttWithDependencies } from "@/components/charts/exhibits/roadmap-gantt-with-dependencies";
import { StakeholderCoverageMatrix } from "@/components/charts/exhibits/stakeholder-coverage-matrix";
import { ExecutiveSummaryTwoByTwo } from "@/components/charts/exhibits/executive-summary-2x2";
import { getEngagementById } from "@/lib/engagements/queries";
import { isUuid } from "@/lib/engagements/mappers";
import { getOpportunitiesForEngagementPersisted } from "@/lib/opportunities/queries";
import { getFindingsForEngagementPersisted } from "@/lib/findings/queries";
import { getIntakeRecordForEngagement } from "@/lib/intake/queries";
import { getRoadmapForEngagementPersisted } from "@/lib/roadmap/queries";
import { executiveSummaryPortfolioFromOpportunities } from "@/lib/charts/adapters/executive-summary-2x2-adapter";
import { risksFromOpportunities } from "@/lib/charts/adapters/risk-adjusted-priority-quadrant-adapter";
import { capabilityMaturityFromFindings } from "@/lib/charts/adapters/capability-maturity-heatmap-adapter";
import { stakeholderCoverageFromIntake } from "@/lib/charts/adapters/stakeholder-coverage-matrix-adapter";
import { roadmapGanttFromRoadmapItems } from "@/lib/charts/adapters/roadmap-gantt-adapter";
import {
  isAdapterReady,
  type ChartAdapterIssue,
  type ChartAdapterResult,
  type ChartAdapterStatus,
  type ReportExhibitSlot,
} from "@/lib/charts/adapters/types";

/**
 * Operator-only chart diagnostics surface — Sprint 0B.
 *
 * Read-only validation of the Phase 1B Group-A adapters against a real
 * persisted engagement. Authorized by docs/17 § Diagnostic Surface Rules:
 *
 *   - operator-only via `/app/*` auth boundary
 *   - read-only — no writes, no mutations, no AI calls
 *   - Group A only (Risk Quadrant, Maturity Heatmap, Coverage Matrix,
 *     Roadmap Gantt, Executive Summary 2×2). Group B exhibits
 *     (Benchmark, Waterfall, ROI Bridge) are explicitly omitted.
 *   - never writes report_sections, never sends client-facing output,
 *     never exports PDF
 *   - not linked from the operator nav; reachable by direct URL
 *
 * Real persisted UUID engagements only. Legacy slug fixtures render an
 * explanatory empty state rather than a chart — the canon prefers real
 * persisted data for adapter validation.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const engagement = await getEngagementById(params.id);
  if (!engagement) return { title: "Chart diagnostics not found" };
  return {
    title: `${engagement.companyName} · Chart diagnostics`,
  };
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

const FRESHNESS_LABEL = {
  fresh: "Fresh",
  stale: "Stale",
  unknown: "Unknown",
} as const;

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

export default async function ChartDiagnosticsPage({
  params,
}: {
  params: { id: string };
}) {
  const engagement = await getEngagementById(params.id);
  if (!engagement) notFound();

  const isPersisted = isUuid(engagement.id);
  const engagementHref = `/app/engagements/${engagement.id}`;

  if (!isPersisted) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow={`Engagement · ${engagement.companyName}`}
          title="Chart diagnostics."
          description="Operator-only diagnostic surface for the Phase 1B Group-A adapter layer. Read-only — does not write report sections."
          actions={
            <Link href={engagementHref}>
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back to engagement
              </Button>
            </Link>
          }
        />
        <EmptyState
          title="Diagnostics are available for persisted engagements only."
          description="This route reads Sprint 0B Group-A adapters against real persisted engagement rows. Legacy demo engagements (slug-keyed fixtures) do not flow through the persisted query helpers."
        />
      </div>
    );
  }

  // Generated-at clock token is captured ONCE here so every adapter
  // shares the same wall-clock reference. Adapters themselves remain
  // pure; they do not call Date.now().
  const generatedAt = new Date().toISOString();

  const [opportunities, findings, intake, roadmap] = await Promise.all([
    getOpportunitiesForEngagementPersisted(engagement.id),
    getFindingsForEngagementPersisted(engagement.id),
    getIntakeRecordForEngagement(engagement.id),
    getRoadmapForEngagementPersisted(engagement.id),
  ]);

  const stakeholders = intake?.stakeholders ?? [];

  // Run all five Group-A adapters with the shared clock token. Each
  // call is pure; the page just collates the envelopes.
  const executiveResult = executiveSummaryPortfolioFromOpportunities({
    opportunities,
    generatedAt,
    lastTouchedAt: null,
  });
  const riskResult = risksFromOpportunities({
    opportunities,
    generatedAt,
    lastTouchedAt: null,
  });
  // Group A row 3 — capability/dimension tagging does not exist on
  // persisted findings today. Adapter returns insufficient_data; pass
  // empty axes and no resolvers so the canon-mandated blocker surfaces.
  const maturityResult = capabilityMaturityFromFindings({
    findings,
    capabilities: [],
    dimensions: [],
    generatedAt,
    lastTouchedAt: null,
  });
  // Group A row 4 — topic taxonomy does not exist on persisted intake
  // responses today. Adapter returns insufficient_data with the topic
  // blocker; pass the role axis derived from persisted stakeholder roles
  // for documentation purposes only.
  const observedRoles = Array.from(
    new Set(stakeholders.map((s) => s.role as unknown as string)),
  );
  const coverageResult = stakeholderCoverageFromIntake({
    stakeholders,
    roles: observedRoles,
    topics: [],
    generatedAt,
    lastTouchedAt: null,
  });
  const roadmapResult = roadmapGanttFromRoadmapItems({
    items: roadmap,
    generatedAt,
    lastTouchedAt: null,
  });

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow={`Engagement · ${engagement.companyName}`}
        title="Chart diagnostics."
        description="Operator-only diagnostic surface for the Phase 1B Group-A adapter layer. Renders adapter envelopes against persisted engagement rows so the wiring can be validated before report-slot integration."
        actions={
          <Link href={engagementHref}>
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back to engagement
            </Button>
          </Link>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              Phase 1B · Sprint 0B
            </Badge>
            <span className="text-text-muted">
              Generated {formatTimestamp(generatedAt)}
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Read-only · does not write report sections
            </span>
          </>
        }
      />

      <Card variant="base">
        <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-status-warning" aria-hidden />
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Diagnostic only
              </span>
              <p className="text-sm leading-relaxed text-text-secondary">
                This surface validates the Phase 1B Group-A adapter envelopes against persisted engagement data. It does not write report sections, does not send client-facing output, and does not export PDFs. Wiring exhibits into <code className="font-mono text-text-secondary">ReportWorkspace</code> is the next sprint — Sprint 1.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-text-muted" aria-hidden />
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Group B omitted
              </span>
              <p className="text-sm leading-relaxed text-text-secondary">
                Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge remain preview-only at <code className="font-mono text-text-secondary">/app/charts-preview</code> until <code className="font-mono text-text-secondary">docs/14</code> / <code className="font-mono text-text-secondary">docs/15</code> data gates advance.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <DiagnosticPanel
        slot="findings_risk_priority"
        title="Risk-Adjusted Priority Quadrant"
        result={riskResult}
        exhibit={
          isAdapterReady(riskResult) ? (
            <RiskAdjustedPriorityQuadrant {...riskResult.props} />
          ) : null
        }
      />

      <DiagnosticPanel
        slot="executive_summary_portfolio"
        title="Executive Summary 2×2"
        result={executiveResult}
        exhibit={
          isAdapterReady(executiveResult) ? (
            <ExecutiveSummaryTwoByTwo {...executiveResult.props} />
          ) : null
        }
      />

      <DiagnosticPanel
        slot="diagnostic_capability_maturity"
        title="Capability Maturity Heatmap"
        result={maturityResult}
        exhibit={
          isAdapterReady(maturityResult) ? (
            <CapabilityMaturityHeatmap {...maturityResult.props} />
          ) : null
        }
      />

      <DiagnosticPanel
        slot="diagnostic_stakeholder_coverage"
        title="Stakeholder Coverage Matrix"
        result={coverageResult}
        exhibit={
          isAdapterReady(coverageResult) ? (
            <StakeholderCoverageMatrix {...coverageResult.props} />
          ) : null
        }
      />

      <DiagnosticPanel
        slot="roadmap_90_day_sequence"
        title="Roadmap Gantt with Dependencies"
        result={roadmapResult}
        exhibit={
          isAdapterReady(roadmapResult) ? (
            <RoadmapGanttWithDependencies {...roadmapResult.props} />
          ) : null
        }
      />
    </div>
  );
}

interface DiagnosticPanelProps<TProps> {
  slot: ReportExhibitSlot;
  title: string;
  result: ChartAdapterResult<TProps>;
  exhibit: React.ReactNode | null;
  adapterOnlyNote?: string;
}

function DiagnosticPanel<TProps>({
  slot,
  title,
  result,
  exhibit,
  adapterOnlyNote,
}: DiagnosticPanelProps<TProps>) {
  const { status, issues, sourceSummary } = result;
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Slot · {slot}
            </span>
            <Badge tone={STATUS_BADGE_TONE[status]}>
              {STATUS_LABEL[status]}
            </Badge>
            <Badge tone={FRESHNESS_TONE[sourceSummary.freshness]} variant="outline">
              {FRESHNESS_LABEL[sourceSummary.freshness]}
            </Badge>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">
            {title}
          </h2>
          <p className="text-xs leading-relaxed text-text-muted">
            <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
              Source
            </span>{" "}
            · {sourceSummary.source} · <span className="font-mono">n={sourceSummary.rowCount}</span> · generated {formatTimestamp(sourceSummary.generatedAt)}
          </p>
          {adapterOnlyNote ? (
            <p className="text-xs leading-relaxed text-text-secondary">
              {adapterOnlyNote}
            </p>
          ) : null}
        </header>

        {exhibit ? (
          <div className="-mx-1 sm:-mx-2">{exhibit}</div>
        ) : (
          <div className="rounded-md border border-dashed border-border-subtle bg-bg-elevated/40 p-5 sm:p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Adapter not ready · exhibit not rendered
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              The adapter returned <code className="font-mono">{status}</code>. Review issues below to understand the blocker. No fallback to sample data — that is forbidden by the wiring canon.
            </p>
          </div>
        )}

        {issues.length > 0 ? (
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
        ) : null}
      </CardBody>
    </Card>
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
