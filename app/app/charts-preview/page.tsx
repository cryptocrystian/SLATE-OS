import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import {
  ExecutiveSummaryTwoByTwo,
  type ExecutiveSummaryPortfolioPoint,
} from "@/components/charts/exhibits/executive-summary-2x2";
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
import {
  BenchmarkComparisonBars,
  type BenchmarkComparisonDataset,
} from "@/components/charts/exhibits/benchmark-comparison-bars";
import {
  AISavingsWaterfall,
  type FinancialAssumptionSet,
  type SavingsWaterfallContribution,
} from "@/components/charts/exhibits/ai-savings-waterfall";
import {
  RoiBridge,
  type FinancialAssumptionSet as RoiAssumptionSet,
  type RoiBridgePoint,
} from "@/components/charts/exhibits/roi-bridge";

export const metadata: Metadata = {
  title: "SLATE · Charts preview",
};

export const dynamic = "force-dynamic";

/**
 * Operator-only, unlinked preview surface for the SLATE chart vocabulary.
 *
 * Phase 1B preview. Renders eight exhibits in sequence:
 *   - proof-of-fit Executive Summary 2×2
 *   - Sprint 1 Risk-Adjusted Priority Quadrant
 *   - Sprint 2 Capability Maturity Heatmap
 *   - Sprint 3 Stakeholder Coverage Matrix
 *   - Sprint 4 Roadmap Gantt with Dependencies
 *   - Sprint 5 Benchmark Comparison Bars (Gate 0 — illustrative only)
 *   - Sprint 6 AI-Savings Waterfall (Gate 0 — illustrative only)
 *   - Sprint 7 ROI Bridge (Gate 0 — illustrative only)
 *
 * All use static sample data declared inside this file; no persisted reads.
 * Sprint 5's data is `status: "illustrative"` per the Benchmark Data Canon
 * (`docs/14_*`). Sprints 6 and 7 are `status: "illustrative"` per the
 * Financial Assumptions Canon (`docs/15_*`). None of these may be wired
 * into reports, proposals, or the public scorecard until the corresponding
 * data tier exists.
 *
 * Not added to nav. Reachable only by direct URL.
 */

// Proof-of-fit Executive Summary 2×2 — illustrative sample only.
//
// Lifted out of the exhibit in Sprint 1 (the exhibit is now prop-driven
// so adapter output flows in cleanly). The numeric values match the
// proof-of-fit's original sample byte-for-byte; the field name moved
// from `roi` → `impactSignal` to match the canon-safe non-financial
// vocabulary (see docs/15). The preview overrides the bubble-size
// legend label below to keep the proof-of-fit's original "annual ROI"
// wording inside this clearly-illustrative context only.
const EXECUTIVE_SUMMARY_PREVIEW_POINTS: ExecutiveSummaryPortfolioPoint[] = [
  {
    id: "ai-recon",
    title: "AI-assisted reconciliation",
    impact: 82,
    complexity: 38,
    impactSignal: 240_000,
    evidence: "success",
    recommended: true,
  },
  {
    id: "intake-auto",
    title: "Stakeholder intake automation",
    impact: 71,
    complexity: 28,
    impactSignal: 110_000,
    evidence: "info",
  },
  {
    id: "proposal-draft",
    title: "Proposal draft acceleration",
    impact: 78,
    complexity: 65,
    impactSignal: 320_000,
    evidence: "info",
  },
  {
    id: "kb-retrieval",
    title: "Internal knowledge retrieval",
    impact: 64,
    complexity: 72,
    impactSignal: 180_000,
    evidence: "warning",
  },
  {
    id: "renewal-triage",
    title: "Renewal triage assistant",
    impact: 56,
    complexity: 42,
    impactSignal: 90_000,
    evidence: "info",
  },
  {
    id: "contract-redline",
    title: "Contract redline screening",
    impact: 47,
    complexity: 81,
    impactSignal: 70_000,
    evidence: "warning",
  },
  {
    id: "qbr-summary",
    title: "QBR summary drafting",
    impact: 38,
    complexity: 22,
    impactSignal: 30_000,
    evidence: "warning",
  },
];

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

// Benchmark Comparison Bars preview dataset — ILLUSTRATIVE ONLY.
//
// Per `docs/14_PHASE_1B_BENCHMARK_DATA_CANON.md` Gate 0:
//   - status MUST be "illustrative"
//   - the rendered source note MUST read exactly
//     "Illustrative sample data · not a benchmark"
//   - n / vintage / methodology MUST NOT appear in the rendered chrome
//   - this dataset MUST NOT be wired into reports, proposals, or the
//     public scorecard
//
// The values below are crafted to span the full 0–100 range so the
// percentile band layout can be reviewed visually. They do NOT
// represent any real population or benchmark, and any reuse of these
// numbers outside the preview route is forbidden by the canon.
const BENCHMARK_PREVIEW_DATASET: BenchmarkComparisonDataset = {
  label: "Illustrative preview dataset",
  methodology: "",
  vintage: "",
  sampleSize: 0,
  status: "illustrative",
  points: [
    {
      dimension: "AI readiness",
      clientScore: 64,
      p25: 32,
      p50: 48,
      p75: 65,
      sampleSize: 0,
      vintage: "",
      benchmarkLabel: "Illustrative sample · not a benchmark",
    },
    {
      dimension: "Workflow friction",
      clientScore: 72,
      p25: 35,
      p50: 52,
      p75: 70,
      sampleSize: 0,
      vintage: "",
      benchmarkLabel: "Illustrative sample · not a benchmark",
    },
    {
      dimension: "Systems readiness",
      clientScore: 58,
      p25: 40,
      p50: 55,
      p75: 70,
      sampleSize: 0,
      vintage: "",
      benchmarkLabel: "Illustrative sample · not a benchmark",
    },
    {
      dimension: "Data readiness",
      clientScore: 51,
      p25: 35,
      p50: 50,
      p75: 65,
      sampleSize: 0,
      vintage: "",
      benchmarkLabel: "Illustrative sample · not a benchmark",
    },
    {
      dimension: "Governance maturity",
      clientScore: 47,
      p25: 38,
      p50: 52,
      p75: 68,
      sampleSize: 0,
      vintage: "",
      benchmarkLabel: "Illustrative sample · not a benchmark",
    },
    {
      dimension: "Adoption capacity",
      clientScore: 62,
      p25: 42,
      p50: 56,
      p75: 72,
      sampleSize: 0,
      vintage: "",
      benchmarkLabel: "Illustrative sample · not a benchmark",
    },
  ],
};

// AI-Savings Waterfall preview dataset — ILLUSTRATIVE ONLY.
//
// Per `docs/15_PHASE_1B_FINANCIAL_ASSUMPTIONS_CANON.md` Gate 0:
//   - assumptionSet.status MUST be "illustrative"
//   - the rendered source note MUST read exactly
//     "Source: Illustrative sample data · not a financial model"
//   - confidence / owner / lastReviewedAt MUST NOT appear in the
//     rendered chrome
//   - this dataset MUST NOT be wired into reports, proposals, or the
//     public scorecard
//   - the takeaway MUST NOT use "guaranteed savings" / "ROI" /
//     "payback" / "annual savings" framing
//
// The values below are crafted to make the visual structure
// inspectable. They do NOT represent any real client baseline,
// real savings, or any approved financial model. Reuse outside the
// preview route is forbidden by the canon.
const ILLUSTRATIVE_FINANCIAL_ASSUMPTIONS: FinancialAssumptionSet = {
  id: "illustrative-preview",
  label: "Illustrative preview assumption set",
  status: "illustrative",
  confidence: "low",
  currency: "USD",
  currentBaselineCost: 1_200_000,
  currentBaselineHours: 0,
  hourlyCostAssumption: 0,
  implementationCost: 90_000,
  recurringCostMonthly: 5_000,
  expectedAutomationRate: 0,
  expectedAdoptionRate: 0,
  riskAdjustmentFactor: 0,
  timeToValueDays: 0,
  assumptionOwner: "",
  lastReviewedAt: "",
};

// ROI Bridge preview dataset — ILLUSTRATIVE ONLY.
//
// Per `docs/15_PHASE_1B_FINANCIAL_ASSUMPTIONS_CANON.md` Gate 0:
//   - assumptionSet.status MUST be "illustrative"
//   - the rendered source note MUST read exactly
//     "Source: Illustrative sample data · not a financial model"
//   - confidence / owner / lastReviewedAt MUST NOT appear in the
//     rendered chrome
//   - this dataset MUST NOT be wired into reports, proposals, or the
//     public scorecard
//   - the takeaway MUST NOT use "guaranteed ROI" / "payback in X
//     months" / "break-even" / "cash-flow positive by" / "will
//     return X%" / "board-ready ROI" framing
//
// Sensitivity bands (low / expected / high) are explicitly different
// for every period — no collapsed band — so the cone-of-uncertainty
// stays visible and the canon's invariant holds. The values below are
// crafted for visual review only and do NOT represent any real client
// return, real payback, or any approved financial model. Reuse outside
// the preview route is forbidden by the canon.
const ILLUSTRATIVE_ROI_ASSUMPTIONS: RoiAssumptionSet = {
  id: "illustrative-roi-preview",
  label: "Illustrative ROI preview assumption set",
  status: "illustrative",
  confidence: "low",
  currency: "USD",
  currentBaselineCost: 1_200_000,
  currentBaselineHours: 0,
  hourlyCostAssumption: 0,
  implementationCost: 90_000,
  recurringCostMonthly: 5_000,
  expectedAutomationRate: 0,
  expectedAdoptionRate: 0,
  riskAdjustmentFactor: 0,
  timeToValueDays: 0,
  assumptionOwner: "",
  lastReviewedAt: "",
};

const ILLUSTRATIVE_ROI_POINTS: RoiBridgePoint[] = [
  {
    period: "Y1",
    expectedValue: 60,
    lowEstimate: 30,
    highEstimate: 90,
    confidence: "low",
  },
  {
    period: "Y2",
    expectedValue: 140,
    lowEstimate: 80,
    highEstimate: 220,
    confidence: "low",
  },
  {
    period: "Y3",
    expectedValue: 220,
    lowEstimate: 140,
    highEstimate: 320,
    confidence: "low",
  },
];

const ILLUSTRATIVE_FINANCIAL_CONTRIBUTIONS: SavingsWaterfallContribution[] = [
  {
    label: "Gross efficiency",
    deltaValue: 560_000,
    sign: "savings",
    confidence: "low",
    sourceAssumption: "illustrative-preview",
  },
  {
    label: "Adoption haircut",
    deltaValue: 90_000,
    sign: "cost",
    confidence: "low",
    sourceAssumption: "illustrative-preview",
  },
  {
    label: "Risk adjustment",
    deltaValue: 60_000,
    sign: "cost",
    confidence: "low",
    sourceAssumption: "illustrative-preview",
  },
  {
    label: "Implementation",
    deltaValue: 90_000,
    sign: "cost",
    confidence: "low",
    sourceAssumption: "illustrative-preview",
  },
  {
    label: "Recurring (annualized)",
    deltaValue: 60_000,
    sign: "cost",
    confidence: "low",
    sourceAssumption: "illustrative-preview",
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
              Eight exhibits. Visual direction review only.
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Phase 1B preview · not wired into reports
            </span>
          </>
        }
      />

      <ExecutiveSummaryTwoByTwo
        points={EXECUTIVE_SUMMARY_PREVIEW_POINTS}
        sourceNote={{
          text: "Static sample data · Phase 1B proof-of-fit",
          n: EXECUTIVE_SUMMARY_PREVIEW_POINTS.length,
        }}
        bubbleSizeLabel="annual ROI"
      />

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

      {/* Sprint 5 — illustrative only. The exhibit's defaultBenchmarkSourceNote
          derives the canonical "Illustrative sample data · not a benchmark"
          string from dataset.status, so we do not pass `sourceNote` here. */}
      <BenchmarkComparisonBars dataset={BENCHMARK_PREVIEW_DATASET} />

      {/* Sprint 6 — illustrative only. The exhibit's defaultFinancialSourceNote
          derives the canonical "Source: Illustrative sample data · not a
          financial model" string from assumptionSet.status, so we do not
          pass `sourceNote` here. */}
      <AISavingsWaterfall
        assumptionSet={ILLUSTRATIVE_FINANCIAL_ASSUMPTIONS}
        contributions={ILLUSTRATIVE_FINANCIAL_CONTRIBUTIONS}
      />

      {/* Sprint 7 — illustrative only. The exhibit's defaultRoiBridgeSourceNote
          derives the canonical "Source: Illustrative sample data · not a
          financial model" string from assumptionSet.status, so we do not
          pass `sourceNote` here. The dataset's low/expected/high values
          differ at every period to keep the cone-of-uncertainty visible
          and to satisfy the canon's no-collapsed-band invariant. */}
      <RoiBridge
        assumptionSet={ILLUSTRATIVE_ROI_ASSUMPTIONS}
        points={ILLUSTRATIVE_ROI_POINTS}
      />

      <Card variant="base">
        <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Boundary reminder
          </span>
          <p className="text-xs leading-relaxed text-text-muted">
            This route is the Phase 1B preview surface and is intentionally
            unlinked from the operator nav. Data shown above is static sample
            data declared inside the page file. The Phase 1B preview library
            is now complete (eight of eight exhibits). The next sprint moves
            the library out of preview-only territory by wiring exhibits into
            real persisted reports.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
