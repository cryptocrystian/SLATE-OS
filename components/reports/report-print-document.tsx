import * as React from "react";
import { AlertTriangle, FileText, Info } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ReportExhibitSlots } from "@/components/reports/report-exhibit-slots";
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_TONE,
  SECTION_LABEL,
  SECTION_STATUS_LABEL,
  SECTION_STATUS_TONE,
} from "@/lib/reports/helpers";
import type { ReportExhibitSlot } from "@/lib/charts/adapters/types";
import type { CapabilityMaturityHeatmapProps } from "@/components/charts/exhibits/capability-maturity-heatmap";
import type { ExecutiveSummaryPortfolioProps } from "@/components/charts/exhibits/executive-summary-2x2";
import type { RiskAdjustedPriorityQuadrantProps } from "@/components/charts/exhibits/risk-adjusted-priority-quadrant";
import type { RoadmapGanttWithDependenciesProps } from "@/components/charts/exhibits/roadmap-gantt-with-dependencies";
import type { StakeholderCoverageMatrixProps } from "@/components/charts/exhibits/stakeholder-coverage-matrix";
import type { ChartAdapterResult } from "@/lib/charts/adapters/types";
import type { Engagement } from "@/lib/engagements/types";
import type { Report } from "@/lib/reports/types";

/**
 * Internal report print preview document — Sprint 3.
 *
 * Operator-only, read-only. Renders the same report sections and the
 * same five Group-A exhibit slots that the internal report preview
 * uses, but laid out for review-quality print + browser "Save as PDF".
 *
 *   - Per `docs/17` § Report Wiring Sequence Sprint 3, this is
 *     **internal preview PDF** only. Send / Share / SOW / e-signature
 *     remain locked at the UI layer.
 *   - Group B exhibits (Benchmark Comparison Bars, AI-Savings
 *     Waterfall, ROI Bridge) are NOT imported here and NOT rendered.
 *     They remain preview-only at `/app/charts-preview` until
 *     `docs/14` / `docs/15` advance their data gates.
 *   - The renderer never writes anything. It consumes pre-computed
 *     `ChartAdapterResult` envelopes; the action of running adapters
 *     happens in the print route's server component.
 *
 * Pure server component. SVG-only chart output flows through the
 * existing `ReportExhibitSlots` component so fallback rules + Group-A
 * filter + status badges are reused without duplication.
 */

export interface ReportPrintDocumentProps {
  engagement: Engagement;
  report: Report;
  generatedAt: string;
  /** Persisted Group-A slot references in render order. */
  slots: ReportExhibitSlot[];
  executiveSummary: ChartAdapterResult<ExecutiveSummaryPortfolioProps>;
  riskPriority: ChartAdapterResult<RiskAdjustedPriorityQuadrantProps>;
  capabilityMaturity: ChartAdapterResult<CapabilityMaturityHeatmapProps>;
  stakeholderCoverage: ChartAdapterResult<StakeholderCoverageMatrixProps>;
  roadmap: ChartAdapterResult<RoadmapGanttWithDependenciesProps>;
}

const CONFIDENCE_TONE_MAP: Record<string, BadgeTone> = {
  success: "success",
  info: "info",
  warning: "warning",
  risk: "risk",
};

export function ReportPrintDocument({
  engagement,
  report,
  generatedAt,
  slots,
  executiveSummary,
  riskPriority,
  capabilityMaturity,
  stakeholderCoverage,
  roadmap,
}: ReportPrintDocumentProps) {
  return (
    <div className="flex flex-col gap-8 print:max-w-none print:gap-6">
      <OperatorPrintHint />
      <InternalBanner generatedAt={generatedAt} />

      <header className="flex flex-col gap-2 border-b border-border-subtle pb-6 print:break-after-avoid">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          AdvisoryOps · Report · Internal preview
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-[28px]">
          {report.title}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          {engagement.companyName} · {engagement.engagementType} ·{" "}
          <span className="text-text-primary">{report.status}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-text-muted">
          <span>
            <span className="font-mono uppercase tracking-[0.14em]">
              Generated
            </span>{" "}
            {formatTimestamp(generatedAt)}
          </span>
          <span aria-hidden className="text-text-disabled">
            ·
          </span>
          <span>
            <span className="font-mono uppercase tracking-[0.14em]">
              Engagement id
            </span>{" "}
            <code className="font-mono">{engagement.id}</code>
          </span>
          <span aria-hidden className="text-text-disabled">
            ·
          </span>
          <span>
            <span className="font-mono uppercase tracking-[0.14em]">
              Report id
            </span>{" "}
            <code className="font-mono">{report.id}</code>
          </span>
        </div>
      </header>

      <section
        aria-label="Report sections"
        className="flex flex-col gap-4 print:break-after-page"
      >
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">
          Sections ({report.sections.length})
        </h2>
        {report.sections.length === 0 ? (
          <EmptySectionsNotice />
        ) : (
          <div className="flex flex-col gap-3">
            {report.sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
        )}
      </section>

      <section
        aria-label="Report exhibits"
        className="flex flex-col gap-4 print:break-before-page"
      >
        <ReportExhibitSlots
          engagementId={engagement.id}
          generatedAt={generatedAt}
          slots={slots}
          executiveSummary={executiveSummary}
          riskPriority={riskPriority}
          capabilityMaturity={capabilityMaturity}
          stakeholderCoverage={stakeholderCoverage}
          roadmap={roadmap}
        />
      </section>

      <GroupBOmissionNote />

      <footer className="flex flex-col gap-1 border-t border-border-subtle pt-4 text-[11px] text-text-muted print:mt-6">
        <span className="font-mono uppercase tracking-[0.16em] text-text-muted">
          Internal preview · not client-facing
        </span>
        <p className="text-text-muted">
          Generated for operator review only. This document is not approved for client distribution. Final exports remain locked until a separate sprint authorizes client delivery, PDF storage, and signature workflows.
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal banner
// ---------------------------------------------------------------------------

function InternalBanner({ generatedAt }: { generatedAt: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-status-warning/50 bg-status-warning/10 p-3 text-status-warning print:break-after-avoid print:shadow-none">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
            Internal preview · not client-facing
          </span>
          <p className="text-xs leading-relaxed">
            This is the operator-only internal print preview. It contains the same Group-A exhibits the internal report preview shows. Benchmark and financial exhibits are intentionally omitted. Do not share with clients. Generated {formatTimestamp(generatedAt)}.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Operator print hint — on-screen only; never printed.
// ---------------------------------------------------------------------------

/**
 * Sprint 4B — small on-screen note telling the operator how to drive
 * the browser's print dialog cleanly. Hidden during actual print so
 * the printed page starts at the internal banner.
 */
function OperatorPrintHint() {
  return (
    <aside
      aria-label="Operator print hint"
      className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-[11px] leading-relaxed text-text-secondary print:hidden"
    >
      <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
        Operator hint ·
      </span>{" "}
      For best results in browser <kbd className="font-mono text-[10px]">Save as PDF</kbd>: open Ctrl-P / Cmd-P, set destination to <em>Save as PDF</em>, and disable Headers and footers under <em>More settings</em> so the SLATE banner remains the page identity.
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Section card
// ---------------------------------------------------------------------------

function SectionCard({
  section,
}: {
  section: Report["sections"][number];
}) {
  const sectionTypeLabel = SECTION_LABEL[section.sectionType] ?? section.title;
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6 print:break-inside-avoid">
        <header className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {sectionTypeLabel}
            </span>
            <Badge tone={SECTION_STATUS_TONE[section.status]}>
              {SECTION_STATUS_LABEL[section.status]}
            </Badge>
            <Badge
              tone={CONFIDENCE_TONE_MAP[CONFIDENCE_TONE[section.confidence]] ?? "neutral"}
              variant="outline"
            >
              {CONFIDENCE_LABEL[section.confidence]}
            </Badge>
            {section.aiDrafted ? (
              <Badge tone="ai" dot>
                AI-drafted
              </Badge>
            ) : null}
            {section.exhibitSlot ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                slot · {section.exhibitSlot}
              </span>
            ) : null}
          </div>
          <h3 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">
            {section.title}
          </h3>
        </header>

        {section.summary ? (
          <p className="text-sm leading-relaxed text-text-secondary">
            {section.summary}
          </p>
        ) : (
          <p className="text-sm italic leading-relaxed text-text-muted">
            No summary recorded yet.
          </p>
        )}

        {section.draftPreview ? (
          <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Draft preview
            </span>
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
              {section.draftPreview}
            </p>
          </div>
        ) : null}

        {section.evidenceNotes ? (
          <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Evidence notes
            </span>
            <p className="whitespace-pre-line text-xs leading-relaxed text-text-muted">
              {section.evidenceNotes}
            </p>
          </div>
        ) : null}

        {section.reviewerNote ? (
          <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Reviewer note
            </span>
            <p className="whitespace-pre-line text-xs leading-relaxed text-text-secondary">
              {section.reviewerNote}
            </p>
          </div>
        ) : null}

        {section.linkedFindingIds.length +
          section.linkedOpportunityIds.length +
          section.linkedRoadmapItemIds.length >
        0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3 text-[11px] text-text-muted">
            <span className="font-mono uppercase tracking-[0.14em]">
              Linked evidence
            </span>
            {section.linkedFindingIds.length > 0 ? (
              <Badge tone="info" variant="outline">
                {section.linkedFindingIds.length}{" "}
                {section.linkedFindingIds.length === 1 ? "finding" : "findings"}
              </Badge>
            ) : null}
            {section.linkedOpportunityIds.length > 0 ? (
              <Badge tone="info" variant="outline">
                {section.linkedOpportunityIds.length}{" "}
                {section.linkedOpportunityIds.length === 1
                  ? "opportunity"
                  : "opportunities"}
              </Badge>
            ) : null}
            {section.linkedRoadmapItemIds.length > 0 ? (
              <Badge tone="info" variant="outline">
                {section.linkedRoadmapItemIds.length}{" "}
                {section.linkedRoadmapItemIds.length === 1
                  ? "roadmap item"
                  : "roadmap items"}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Group B omission note
// ---------------------------------------------------------------------------

function GroupBOmissionNote() {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-2 p-5 sm:p-6 print:break-inside-avoid">
        <div className="flex items-start gap-2">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Group B omitted
            </span>
            <p className="text-xs leading-relaxed text-text-muted">
              Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge are intentionally omitted from this internal preview. They remain preview-only at{" "}
              <code className="font-mono">/app/charts-preview</code> until{" "}
              <code className="font-mono">docs/14</code> /{" "}
              <code className="font-mono">docs/15</code> advance their data gates.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty sections
// ---------------------------------------------------------------------------

function EmptySectionsNotice() {
  return (
    <div className="rounded-md border border-dashed border-border-subtle bg-bg-elevated/40 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <FileText
          className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
          aria-hidden
        />
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            No sections
          </span>
          <p className="text-sm leading-relaxed text-text-secondary">
            This report has no persisted sections yet. Initialize the report outline before opening the print preview.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
