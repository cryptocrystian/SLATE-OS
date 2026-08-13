import * as React from "react";

import type { Engagement } from "@/lib/engagements/types";
import type { ReportDeliverySnapshot } from "@/lib/reports/delivery-snapshot-types";
import {
  sanitizeClientProse,
} from "@/lib/deliverables/client-copy-sanitizer";
import { deliverableSerif } from "@/lib/deliverable-fonts";

/** Serif display face for deliverable headings (see lib/deliverable-fonts). */
const SERIF = "[font-family:var(--font-deliverable-serif)]";
import type { ReportGroupAExhibitResults } from "@/components/reports/report-group-a-exhibits";
import { ExecutiveSummaryTwoByTwo } from "@/components/charts/exhibits/executive-summary-2x2";
import { RiskAdjustedPriorityQuadrant } from "@/components/charts/exhibits/risk-adjusted-priority-quadrant";
import { CapabilityMaturityHeatmap } from "@/components/charts/exhibits/capability-maturity-heatmap";
import { StakeholderCoverageMatrix } from "@/components/charts/exhibits/stakeholder-coverage-matrix";
import { RoadmapGanttWithDependencies } from "@/components/charts/exhibits/roadmap-gantt-with-dependencies";
import type { ExecutiveSummaryPortfolioProps } from "@/components/charts/exhibits/executive-summary-2x2";
import type { RiskAdjustedPriorityQuadrantProps } from "@/components/charts/exhibits/risk-adjusted-priority-quadrant";
import type { CapabilityMaturityHeatmapProps } from "@/components/charts/exhibits/capability-maturity-heatmap";
import type { StakeholderCoverageMatrixProps } from "@/components/charts/exhibits/stakeholder-coverage-matrix";
import type { RoadmapGanttWithDependenciesProps } from "@/components/charts/exhibits/roadmap-gantt-with-dependencies";

/*
THESIS: A client-facing AI Opportunity Sprint report that reads as top-firm
strategy-consulting output — a real cover, an executive opening, editorial
section prose, and data exhibits presented as numbered figures. It refuses the
stacked-identical-cards + mono-eyebrow "app screen" arrangement the incumbent shipped.
OWN-WORLD: Light executive document. White ground, slate ink, one confident
indigo accent (--color-brand-primary) as hairline rules and figure numerals.
Generous measure (~66ch), strong sans hierarchy, mono reserved for figure/meta labels.
STORY: A client executive opens to a composed cover, reads a crisp executive
summary, moves through evidence-backed sections, and studies five first-class
exhibits — and concludes this firm is worth a six-figure engagement.
FIRST VIEWPORT: Full cover — Saipien Labs wordmark under a brand rule, the client
company name set large as the hero, the report lockup + engagement line beneath,
and a prepared-for / prepared-by / date / confidential footer row.
FORM: executive print document.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
*/

export interface ClientReportDeliverableProps {
  engagement: Engagement;
  snapshot: ReportDeliverySnapshot;
  liveExhibits: ReportGroupAExhibitResults;
}

const EXHIBIT_META: {
  key: keyof ReportGroupAExhibitResults;
  title: string;
  caption: string;
}[] = [
  {
    key: "executiveSummary",
    title: "Opportunity portfolio",
    caption: "Where each opportunity lands on impact and complexity.",
  },
  {
    key: "riskPriority",
    title: "Risk-adjusted priority",
    caption:
      "Recommended sequencing, weighted by impact, complexity, and risk.",
  },
  {
    key: "capabilityMaturity",
    title: "Capability maturity",
    caption: "Current maturity by capability area, drawn from intake evidence.",
  },
  {
    key: "stakeholderCoverage",
    title: "Stakeholder coverage",
    caption: "Whose perspective informed discovery, by role and topic.",
  },
  {
    key: "roadmap",
    title: "30 / 60 / 90 roadmap",
    caption: "The recommended implementation sequence across the first 90 days.",
  },
];

export function ClientReportDeliverable({
  engagement,
  snapshot,
  liveExhibits,
}: ClientReportDeliverableProps) {
  const sections = snapshot.sectionSnapshot
    .filter((s) => s.includedInArtifact)
    .sort((a, b) => a.position - b.position);

  const execIndex = sections.findIndex(
    (s) => s.sectionType === "executive_summary",
  );
  const exec = execIndex >= 0 ? sections[execIndex] : null;
  const bodySections = sections.filter((_, i) => i !== execIndex);

  const readyExhibits = EXHIBIT_META.map((meta) => ({
    meta,
    result: liveExhibits[meta.key],
  })).filter((e) => e.result.status === "ready" && e.result.props);

  return (
    <article
      data-deliverable-export="client-report"
      className={`${deliverableSerif.variable} mx-auto w-full max-w-[52rem] text-text-primary`}
    >
      <Cover engagement={engagement} generatedAt={snapshot.generatedAt} />

      {exec ? <ExecutiveOpening section={exec} engagement={engagement} /> : null}

      {bodySections.length > 0 ? (
        <div className="mt-14 flex flex-col gap-12 print:mt-10 print:gap-10">
          {bodySections.map((section) => (
            <ReportSection key={section.sectionId} section={section} />
          ))}
        </div>
      ) : null}

      {readyExhibits.length > 0 ? (
        <section
          aria-label="Exhibits"
          className="mt-16 print:mt-12 print:break-before-page"
        >
          <SectionRule label="Exhibits" />
          <div className="mt-8 flex flex-col gap-10 print:gap-8">
            {readyExhibits.map((e, i) => (
              <FigurePlate
                key={e.meta.key}
                index={i + 1}
                title={e.meta.title}
                caption={e.meta.caption}
              >
                <ExhibitBody
                  descKey={e.meta.key}
                  props={e.result.props as unknown}
                />
              </FigurePlate>
            ))}
          </div>
        </section>
      ) : null}

      <DeliverableFooter companyName={engagement.companyName} />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function Cover({
  engagement,
  generatedAt,
}: {
  engagement: Engagement;
  generatedAt: string;
}) {
  return (
    <header className="flex min-h-[34rem] flex-col justify-between gap-16 pb-16 print:min-h-0 print:break-after-page">
      <div className="flex items-center justify-between border-t-2 border-brand-primary pt-4">
        <span className="text-[0.9rem] font-semibold tracking-[0.02em] text-text-primary">
          Saipien&nbsp;Labs
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
          Confidential
        </span>
      </div>

      <div className="flex flex-col gap-7">
        <h1
          className={`${SERIF} text-[3.25rem] font-semibold leading-[0.98] tracking-[-0.02em] text-text-primary sm:text-[4.25rem]`}
        >
          {engagement.companyName}
        </h1>
        <div className="flex flex-col gap-4">
          <div className="h-px w-16 bg-brand-primary" aria-hidden />
          <p className="text-[0.8rem] font-medium uppercase tracking-[0.2em] text-text-secondary">
            AI Opportunity Sprint · Discovery &amp; Opportunity Report
          </p>
          <p className="max-w-xl text-base leading-relaxed text-text-muted">
            An operational diagnostic of {engagement.companyName}, a prioritized
            set of AI opportunities, and a 90-day implementation roadmap.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-10 gap-y-4 border-t border-border-subtle pt-6 sm:grid-cols-4">
        <CoverFact label="Prepared for" value={engagement.companyName} />
        <CoverFact label="Engagement" value={engagement.engagementType} />
        <CoverFact label="Prepared by" value="Saipien Labs" />
        <CoverFact label="Issued" value={formatDate(generatedAt)} />
      </dl>
    </header>
  );
}

function CoverFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
        {label}
      </dt>
      <dd className="text-sm font-medium text-text-primary">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Executive opening
// ---------------------------------------------------------------------------

function ExecutiveOpening({
  section,
  engagement,
}: {
  section: ReportDeliverySnapshot["sectionSnapshot"][number];
  engagement: Engagement;
}) {
  const summary = sanitizeClientProse(section.summary);
  const detail = sanitizeClientProse(section.draftPreview);
  return (
    <section aria-label="Executive summary" className="mt-4">
      <SectionRule label="Executive summary" />
      <h2
        className={`${SERIF} mt-6 text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.02em] text-text-primary`}
      >
        {section.title}
      </h2>
      {summary ? (
        <p className="mt-5 max-w-[42rem] text-xl font-normal leading-[1.5] text-text-primary">
          {summary}
        </p>
      ) : null}
      {detail ? (
        <div className="mt-5 max-w-[38rem] whitespace-pre-line text-[0.975rem] leading-[1.75] text-text-secondary">
          {detail}
        </div>
      ) : null}
      <p className="mt-6 max-w-[38rem] text-sm leading-relaxed text-text-muted">
        Prepared for the leadership team at {engagement.companyName}. The
        findings, opportunities, and roadmap that follow are drawn from
        stakeholder discovery and reviewed by a Saipien Labs consultant before
        release.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Body section
// ---------------------------------------------------------------------------

function ReportSection({
  section,
}: {
  section: ReportDeliverySnapshot["sectionSnapshot"][number];
}) {
  const summary = sanitizeClientProse(section.summary);
  const detail = sanitizeClientProse(section.draftPreview);
  const evidence = sanitizeClientProse(section.evidenceNotes);
  return (
    <section className="print:break-inside-avoid-page">
      <h3
        className={`${SERIF} text-[1.55rem] font-semibold leading-[1.12] tracking-[-0.015em] text-text-primary`}
      >
        {section.title}
      </h3>
      {summary ? (
        <p className="mt-3 max-w-[42rem] text-[1.05rem] font-medium leading-[1.55] text-text-primary">
          {summary}
        </p>
      ) : null}
      {detail ? (
        <div className="mt-3 max-w-[38rem] whitespace-pre-line text-[0.975rem] leading-[1.75] text-text-secondary">
          {detail}
        </div>
      ) : null}
      {evidence ? (
        <div className="mt-5 max-w-[38rem] border-l border-brand-primary/40 pl-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            Supporting evidence
          </p>
          <p className="mt-1.5 whitespace-pre-line text-[0.85rem] leading-relaxed text-text-muted">
            {evidence}
          </p>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

function FigurePlate({
  index,
  title,
  caption,
  children,
}: {
  index: number;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-4 print:break-inside-avoid">
      <figcaption className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] font-medium tabular-nums tracking-[0.1em] text-brand-primary">
            Figure&nbsp;{String(index).padStart(2, "0")}
          </span>
          <h4
            className={`${SERIF} text-[1.1rem] font-semibold tracking-tight text-text-primary`}
          >
            {title}
          </h4>
        </div>
        <p className="max-w-[40rem] text-[0.85rem] leading-relaxed text-text-muted">
          {caption}
        </p>
      </figcaption>
      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-card sm:p-6 print:shadow-none">
        {children}
      </div>
    </figure>
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
          bare
        />
      );
    case "riskPriority":
      return (
        <RiskAdjustedPriorityQuadrant
          {...(props as RiskAdjustedPriorityQuadrantProps)}
          bare
        />
      );
    case "capabilityMaturity":
      return (
        <CapabilityMaturityHeatmap
          {...(props as CapabilityMaturityHeatmapProps)}
          bare
        />
      );
    case "stakeholderCoverage":
      return (
        <StakeholderCoverageMatrix
          {...(props as StakeholderCoverageMatrixProps)}
          bare
        />
      );
    case "roadmap":
      return (
        <RoadmapGanttWithDependencies
          {...(props as RoadmapGanttWithDependenciesProps)}
          bare
        />
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px w-8 bg-brand-primary" aria-hidden />
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-primary">
        {label}
      </span>
    </div>
  );
}

function DeliverableFooter({ companyName }: { companyName: string }) {
  return (
    <footer className="mt-16 border-t border-border-subtle pt-6 print:mt-12 print:break-inside-avoid">
      <p className="max-w-[42rem] text-[0.8rem] leading-relaxed text-text-muted">
        This report is advisory. It is not a statement of work, a binding quote,
        a financial guarantee, or a contract. Figures reflect directional
        analysis validated during discovery and are refined during scoping.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span className="text-sm font-semibold tracking-[0.02em] text-text-primary">
          Saipien&nbsp;Labs
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Confidential · Prepared for {companyName}
        </span>
      </div>
    </footer>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
