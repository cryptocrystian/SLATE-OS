import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ExecutiveSummaryTwoByTwo } from "@/components/charts/exhibits/executive-summary-2x2";
import {
  RiskAdjustedPriorityQuadrant,
  type RiskAdjustedQuadrantPoint,
} from "@/components/charts/exhibits/risk-adjusted-priority-quadrant";
import {
  CapabilityMaturityHeatmap,
  type CapabilityMaturityCell,
} from "@/components/charts/exhibits/capability-maturity-heatmap";
import {
  StakeholderCoverageMatrix,
  type StakeholderCoverageCell,
} from "@/components/charts/exhibits/stakeholder-coverage-matrix";
import {
  RoadmapGanttWithDependencies,
  type RoadmapGanttItem,
} from "@/components/charts/exhibits/roadmap-gantt-with-dependencies";

export const metadata: Metadata = {
  title: "SLATE · Charts preview",
};

export const dynamic = "force-dynamic";

/**
 * Operator-only, unlinked preview surface for the SLATE chart vocabulary.
 *
 * Phase 1B preview. Renders five exhibits in sequence:
 *   - proof-of-fit Executive Summary 2×2
 *   - Sprint 1 Risk-Adjusted Priority Quadrant
 *   - Sprint 2 Capability Maturity Heatmap
 *   - Sprint 3 Stakeholder Coverage Matrix
 *   - Sprint 4 Roadmap Gantt with Dependencies
 *
 * All use static sample data declared inside this file; no persisted reads.
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

// Capability Maturity Heatmap preview data — 5 capabilities × 5 dimensions.
// Designed to span all four maturity bands so reviewers see the full color
// vocabulary at once. Capability names are kept short to fit the row label
// column.
const HEATMAP_PREVIEW_CAPABILITIES = [
  "Client Intake",
  "Proposal Gen",
  "Reporting",
  "Customer Support",
  "Internal KB",
];

const HEATMAP_PREVIEW_DIMENSIONS = [
  "AI Readiness",
  "Workflow",
  "Systems",
  "Data",
  "Governance",
];

const HEATMAP_PREVIEW_CELLS: CapabilityMaturityCell[] = [
  // Client Intake
  { capability: "Client Intake", dimension: "AI Readiness", maturityScore: 72, supportingFindingCount: 3 },
  { capability: "Client Intake", dimension: "Workflow", maturityScore: 58, supportingFindingCount: 2 },
  { capability: "Client Intake", dimension: "Systems", maturityScore: 64, supportingFindingCount: 4 },
  { capability: "Client Intake", dimension: "Data", maturityScore: 48, supportingFindingCount: 2 },
  { capability: "Client Intake", dimension: "Governance", maturityScore: 38, supportingFindingCount: 1 },
  // Proposal Gen
  { capability: "Proposal Gen", dimension: "AI Readiness", maturityScore: 65, supportingFindingCount: 2 },
  { capability: "Proposal Gen", dimension: "Workflow", maturityScore: 70, supportingFindingCount: 3 },
  { capability: "Proposal Gen", dimension: "Systems", maturityScore: 62, supportingFindingCount: 2 },
  { capability: "Proposal Gen", dimension: "Data", maturityScore: 55, supportingFindingCount: 2 },
  { capability: "Proposal Gen", dimension: "Governance", maturityScore: 42, supportingFindingCount: 1 },
  // Reporting
  { capability: "Reporting", dimension: "AI Readiness", maturityScore: 82, supportingFindingCount: 5 },
  { capability: "Reporting", dimension: "Workflow", maturityScore: 75, supportingFindingCount: 4 },
  { capability: "Reporting", dimension: "Systems", maturityScore: 78, supportingFindingCount: 3 },
  { capability: "Reporting", dimension: "Data", maturityScore: 80, supportingFindingCount: 4 },
  { capability: "Reporting", dimension: "Governance", maturityScore: 60, supportingFindingCount: 2 },
  // Customer Support
  { capability: "Customer Support", dimension: "AI Readiness", maturityScore: 45, supportingFindingCount: 2 },
  { capability: "Customer Support", dimension: "Workflow", maturityScore: 38, supportingFindingCount: 1 },
  { capability: "Customer Support", dimension: "Systems", maturityScore: 50, supportingFindingCount: 2 },
  { capability: "Customer Support", dimension: "Data", maturityScore: 35, supportingFindingCount: 1 },
  { capability: "Customer Support", dimension: "Governance", maturityScore: 28, supportingFindingCount: 1 },
  // Internal KB
  { capability: "Internal KB", dimension: "AI Readiness", maturityScore: 55, supportingFindingCount: 2 },
  { capability: "Internal KB", dimension: "Workflow", maturityScore: 48, supportingFindingCount: 1 },
  { capability: "Internal KB", dimension: "Systems", maturityScore: 60, supportingFindingCount: 3 },
  { capability: "Internal KB", dimension: "Data", maturityScore: 52, supportingFindingCount: 2 },
  { capability: "Internal KB", dimension: "Governance", maturityScore: 40, supportingFindingCount: 1 },
];

const HEATMAP_PREVIEW_SESSION_COUNT = 8;

// Stakeholder Coverage Matrix preview data — 5 roles × 5 topics. Designed
// to span all four evidence-strength tones (missing / thin / adequate /
// strong) so reviewers see the full vocabulary, including how "missing"
// renders as a recessive cell (low fill opacity, em-dash glyph) distinct
// from a low-strength cell.
const COVERAGE_PREVIEW_ROLES = [
  "CEO / Owner",
  "Operations Lead",
  "Sales Lead",
  "Engineering Lead",
  "Customer Success",
];

const COVERAGE_PREVIEW_TOPICS = [
  "Workflows",
  "Systems",
  "Data",
  "Adoption",
  "Risk",
];

const COVERAGE_PREVIEW_CELLS: StakeholderCoverageCell[] = [
  // CEO / Owner
  { role: "CEO / Owner", topic: "Workflows", strength: "adequate", responseCount: 1 },
  { role: "CEO / Owner", topic: "Systems", strength: "thin", responseCount: 1 },
  { role: "CEO / Owner", topic: "Data", strength: "missing", responseCount: 0 },
  { role: "CEO / Owner", topic: "Adoption", strength: "adequate", responseCount: 1 },
  { role: "CEO / Owner", topic: "Risk", strength: "strong", responseCount: 2 },
  // Operations Lead
  { role: "Operations Lead", topic: "Workflows", strength: "strong", responseCount: 3 },
  { role: "Operations Lead", topic: "Systems", strength: "strong", responseCount: 3 },
  { role: "Operations Lead", topic: "Data", strength: "adequate", responseCount: 2 },
  { role: "Operations Lead", topic: "Adoption", strength: "thin", responseCount: 1 },
  { role: "Operations Lead", topic: "Risk", strength: "thin", responseCount: 1 },
  // Sales Lead
  { role: "Sales Lead", topic: "Workflows", strength: "adequate", responseCount: 2 },
  { role: "Sales Lead", topic: "Systems", strength: "thin", responseCount: 1 },
  { role: "Sales Lead", topic: "Data", strength: "missing", responseCount: 0 },
  { role: "Sales Lead", topic: "Adoption", strength: "strong", responseCount: 2 },
  { role: "Sales Lead", topic: "Risk", strength: "missing", responseCount: 0 },
  // Engineering Lead
  { role: "Engineering Lead", topic: "Workflows", strength: "thin", responseCount: 1 },
  { role: "Engineering Lead", topic: "Systems", strength: "strong", responseCount: 3 },
  { role: "Engineering Lead", topic: "Data", strength: "strong", responseCount: 3 },
  { role: "Engineering Lead", topic: "Adoption", strength: "thin", responseCount: 1 },
  { role: "Engineering Lead", topic: "Risk", strength: "adequate", responseCount: 2 },
  // Customer Success
  { role: "Customer Success", topic: "Workflows", strength: "adequate", responseCount: 2 },
  { role: "Customer Success", topic: "Systems", strength: "adequate", responseCount: 2 },
  { role: "Customer Success", topic: "Data", strength: "thin", responseCount: 1 },
  { role: "Customer Success", topic: "Adoption", strength: "strong", responseCount: 2 },
  { role: "Customer Success", topic: "Risk", strength: "missing", responseCount: 0 },
];

const COVERAGE_PREVIEW_SESSION_COUNT = 5;

// Roadmap Gantt with Dependencies preview data — 7 initiatives spanning the
// 90-day window with a mix of statuses (planned / in_progress / blocked /
// complete) and 6 forward-in-time dependency edges so reviewers see the
// arrowhead routing in action. Today is set to day 30, placing items
// 1–3 in the realised half and 4–7 in the upcoming half.
const ROADMAP_PREVIEW_ITEMS: RoadmapGanttItem[] = [
  {
    id: "intake",
    title: "Stakeholder intake completion",
    phase: "days_0_30",
    startOffset: 0,
    durationDays: 15,
    dependencyIds: [],
    status: "complete",
  },
  {
    id: "ai-recon",
    title: "AI assistant pilot · reconciliation",
    phase: "days_0_30",
    startOffset: 15,
    durationDays: 30,
    dependencyIds: ["intake"],
    status: "in_progress",
    ownerPlaceholder: "Saipien Labs strategist",
  },
  {
    id: "kb-ingest",
    title: "Knowledge base ingestion",
    phase: "days_31_60",
    startOffset: 20,
    durationDays: 30,
    dependencyIds: ["intake"],
    status: "planned",
  },
  {
    id: "proposal-tpl",
    title: "Proposal draft template",
    phase: "days_31_60",
    startOffset: 45,
    durationDays: 20,
    dependencyIds: ["ai-recon"],
    status: "planned",
  },
  {
    id: "support-pilot",
    title: "Customer support assistant pilot",
    phase: "days_61_90",
    startOffset: 55,
    durationDays: 30,
    dependencyIds: ["kb-ingest"],
    status: "blocked",
  },
  {
    id: "reporting",
    title: "Reporting integration",
    phase: "days_61_90",
    startOffset: 60,
    durationDays: 30,
    dependencyIds: ["kb-ingest"],
    status: "planned",
  },
  {
    id: "governance",
    title: "Governance + change-mgmt rollout",
    phase: "days_61_90",
    startOffset: 75,
    durationDays: 15,
    dependencyIds: ["proposal-tpl"],
    status: "planned",
  },
];

const ROADMAP_PREVIEW_TODAY_OFFSET = 30;

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
              Five exhibits. Visual direction review only.
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

      <CapabilityMaturityHeatmap
        cells={HEATMAP_PREVIEW_CELLS}
        capabilities={HEATMAP_PREVIEW_CAPABILITIES}
        dimensions={HEATMAP_PREVIEW_DIMENSIONS}
        sourceNote={{
          text: "Static sample preview data · Phase 1B Sprint 2",
          n: HEATMAP_PREVIEW_SESSION_COUNT,
        }}
      />

      <StakeholderCoverageMatrix
        cells={COVERAGE_PREVIEW_CELLS}
        roles={COVERAGE_PREVIEW_ROLES}
        topics={COVERAGE_PREVIEW_TOPICS}
        sourceNote={{
          text: "Static sample preview data · Phase 1B Sprint 3",
          n: COVERAGE_PREVIEW_SESSION_COUNT,
        }}
      />

      <RoadmapGanttWithDependencies
        items={ROADMAP_PREVIEW_ITEMS}
        todayOffset={ROADMAP_PREVIEW_TODAY_OFFSET}
        sourceNote={{
          text: "Static sample preview data · Phase 1B Sprint 4",
          n: ROADMAP_PREVIEW_ITEMS.length,
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
            data declared inside the page file. The remaining three Phase 1B
            exhibits ship in subsequent commits after each visual direction
            is reviewed.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
