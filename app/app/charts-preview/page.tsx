import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ExecutiveSummaryTwoByTwo } from "@/components/charts/exhibits/executive-summary-2x2";
import {
  RiskAdjustedPriorityQuadrant,
  type RiskAdjustedQuadrantPoint,
} from "@/components/charts/exhibits/risk-adjusted-priority-quadrant";

export const metadata: Metadata = {
  title: "SLATE · Charts preview",
};

export const dynamic = "force-dynamic";

/**
 * Operator-only, unlinked preview surface for the SLATE chart vocabulary.
 *
 * Phase 1B preview. Renders the proof-of-fit Executive Summary 2×2 plus
 * Sprint 1's Risk-Adjusted Priority Quadrant. Both use static sample data
 * declared inside this file; no persisted reads.
 *
 * Not added to nav. Reachable only by direct URL.
 */

const RISK_QUADRANT_PREVIEW_DATA: RiskAdjustedQuadrantPoint[] = [
  // Quick wins — low complexity, high impact, low / medium risk
  {
    id: "ai-recon",
    title: "AI-assisted reconciliation",
    impact: 82,
    complexity: 38,
    risk: 22,
  },
  {
    id: "intake-auto",
    title: "Stakeholder intake automation",
    impact: 71,
    complexity: 28,
    risk: 18,
  },
  // Strategic builds — high complexity, high impact, varied risk
  {
    id: "proposal-draft",
    title: "Proposal draft acceleration",
    impact: 78,
    complexity: 65,
    risk: 44,
  },
  {
    id: "kb-retrieval",
    title: "Internal knowledge retrieval",
    impact: 64,
    complexity: 72,
    risk: 56,
  },
  // Low priority — lower impact, lower complexity
  {
    id: "renewal-triage",
    title: "Renewal triage assistant",
    impact: 46,
    complexity: 42,
    risk: 38,
  },
  {
    id: "qbr-summary",
    title: "QBR summary drafting",
    impact: 38,
    complexity: 22,
    risk: 28,
  },
  // Defer · Avoid — high complexity, lower impact, elevated/high risk
  {
    id: "contract-redline",
    title: "Contract redline screening",
    impact: 47,
    complexity: 81,
    risk: 78,
  },
  {
    id: "audit-trail",
    title: "Audit-trail dashboard",
    impact: 42,
    complexity: 88,
    risk: 86,
  },
];

export default function ChartsPreviewPage() {
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Phase 1B preview"
        title="Charts preview."
        description="Operator-only preview surface for the SLATE chart vocabulary. Unlinked from nav. Static sample data only — no persisted reads. Not wired into the report or proposal builders."
        meta={
          <>
            <Badge tone="ai" dot>
              Visx · Phase 1B preview
            </Badge>
            <span className="text-text-muted">
              Two exhibits. Visual direction review only.
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Phase 1B preview · not wired into reports
            </span>
          </>
        }
      />

      <ExecutiveSummaryTwoByTwo />

      <RiskAdjustedPriorityQuadrant
        points={RISK_QUADRANT_PREVIEW_DATA}
        sourceNote={{
          text: "Static sample preview data · Phase 1B Sprint 1",
          n: RISK_QUADRANT_PREVIEW_DATA.length,
        }}
      />

      <Card variant="base">
        <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Boundary reminder
          </span>
          <p className="text-xs leading-relaxed text-text-muted">
            This route is the Phase 1B preview surface and is intentionally
            unlinked from the operator nav. Data shown above is static sample
            data declared inside the page file. The remaining six Phase 1B
            exhibits ship in subsequent commits after each visual direction
            is reviewed.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
