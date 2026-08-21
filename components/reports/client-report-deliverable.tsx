import * as React from "react";

import type { Engagement } from "@/lib/engagements/types";
import type { ReportDeliverySnapshot } from "@/lib/reports/delivery-snapshot-types";
import { sanitizeClientProse } from "@/lib/deliverables/client-copy-sanitizer";
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
import {
  Reg,
  Rail,
  DocPage,
  SecNote,
  humanizeSectionType,
  formatDeliverableDate,
} from "@/components/deliverables/doc-kit";

/*
THESIS: A client-facing AI Opportunity Sprint report that reads as top-firm
strategy-consulting output — "The Opportunity Brief": a decision-journey document
with a real cover, a persistent contents rail, editorial section prose, and data
exhibits presented as numbered figure plates. It refuses the stacked-identical-cards
+ mono-eyebrow "app screen" arrangement the incumbent shipped.
OWN-WORLD: Saipien "Register" light executive plate document (styles/
deliverable.css, .slate-doc). Warm tonal ground (#EFEDE7), warm ink, ONE
two-tone mint accent, a committed warm-dark brand panel on the cover, hairline
plate furniture (rules, corner registration ticks, numbered figures). Archivo
display/body, JetBrains Mono for figure/meta labels only. Flat + matte — no
glow/gradient. Brand skin is swappable via --doc-* tokens; no brand literal here.
STORY: A client executive opens to a composed cover + contents rail, reads a crisp
executive summary, moves through evidence-backed sections, and studies first-class
figure exhibits — and concludes this firm is worth a six-figure engagement.
FIRST VIEWPORT: Full cover — decision-journey rail on the left, the client company
name set large as the hero on the right, engagement lockup, and a prepared-for /
prepared-by / date / status meta row.
FORM: executive print document (decision-journey plate document). Roll seed f8d282d4.
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

  // Decision-journey rail — the document's contents.
  const rail: string[] = [];
  if (exec) rail.push(humanizeSectionType(exec.sectionType));
  bodySections.forEach((s) => rail.push(humanizeSectionType(s.sectionType)));
  if (readyExhibits.length > 0) rail.push("Exhibits");

  const bodyBase = exec ? 1 : 0;
  const exhibitsActive = rail.length - 1;

  return (
    <div className="slate-doc" data-deliverable-export="client-report">
      {/* -------- Cover -------- */}
      <section className="doc-page doc-cover">
        <Reg />
        <div className="doc-spread">
          <Rail
            items={rail}
            variant="cover"
            docId={engagement.engagementType}
            companyName={engagement.companyName}
          />
          <div className="doc-main">
            <h1 className="doc-h1">{engagement.companyName}</h1>
            <p className="doc-cover-sub">
              An operational diagnostic, a prioritized set of AI opportunities,
              and a 90-day implementation roadmap.
            </p>
            <div className="doc-cover-rule" />
            <dl className="doc-cover-meta">
              <div>
                <dt>Prepared for</dt>
                <dd>{engagement.companyName}</dd>
              </div>
              <div>
                <dt>Prepared by</dt>
                <dd>Saipien Labs</dd>
              </div>
              <div>
                <dt>Issued</dt>
                <dd>{formatDeliverableDate(snapshot.generatedAt)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Draft for review</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* -------- Executive summary -------- */}
      {exec ? (
        <DocPage rail={rail} active={0}>
          <div className="doc-sec-head">
            <div className="doc-sec-title">{exec.title}</div>
            <SecNote sectionType={exec.sectionType} title={exec.title} />
          </div>
          {renderLede(exec.summary)}
          {renderBody(exec.draftPreview)}
          <p className="doc-body" style={{ marginTop: "16px", color: "var(--doc-ink-3)" }}>
            Prepared for the leadership team at {engagement.companyName}. The
            findings, opportunities, and roadmap that follow are drawn from
            stakeholder discovery and reviewed by a Saipien Labs consultant
            before release.
          </p>
        </DocPage>
      ) : null}

      {/* -------- Body sections -------- */}
      {bodySections.map((section, j) => (
        <DocPage key={section.sectionId} rail={rail} active={bodyBase + j}>
          <div className="doc-sec-head">
            <div className="doc-sec-title">{section.title}</div>
            <SecNote sectionType={section.sectionType} title={section.title} />
          </div>
          {renderLede(section.summary, j === 0)}
          {renderBody(section.draftPreview)}
          <BasisPlate note={section.evidenceNotes} />
        </DocPage>
      ))}

      {/* -------- Exhibits -------- */}
      {readyExhibits.length > 0 ? (
        <DocPage rail={rail} active={exhibitsActive}>
          <div className="doc-sec-head">
            <div className="doc-sec-title">Exhibits</div>
            <div className="doc-sec-note">Supporting analysis</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
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
          <DeliverableFooter companyName={engagement.companyName} />
        </DocPage>
      ) : (
        <DocPage rail={rail}>
          <DeliverableFooter companyName={engagement.companyName} />
        </DocPage>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prose helpers (client-safe)
// ---------------------------------------------------------------------------

function renderLede(raw: string | null | undefined, force = true) {
  const t = sanitizeClientProse(raw);
  if (!t) return null;
  if (force) return <p className="doc-lede">{t}</p>;
  return (
    <div className="doc-body">
      <p>{t}</p>
    </div>
  );
}

function renderBody(raw: string | null | undefined) {
  const t = sanitizeClientProse(raw);
  if (!t) return null;
  return (
    <div className="doc-body">
      {t.split(/\n{2,}/).map((para, i) => (
        <p key={i} style={{ whiteSpace: "pre-line" }}>
          {para}
        </p>
      ))}
    </div>
  );
}

function BasisPlate({ note }: { note: string | null | undefined }) {
  const t = sanitizeClientProse(note);
  if (!t) return null;
  return (
    <div className="doc-plate" style={{ marginTop: "28px" }}>
      <div className="doc-plate-fig">Basis for recommendations</div>
      <p
        className="doc-body"
        style={{ marginTop: "8px", whiteSpace: "pre-line" }}
      >
        {t}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Figure plate (exhibit) — hero exhibits as numbered plates
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
    <figure className="doc-plate" style={{ margin: 0 }}>
      <div className="doc-plate-fig">Figure {String(index).padStart(2, "0")}</div>
      <div className="doc-plate-t">{title}</div>
      <div className="doc-plate-cap">{caption}</div>
      <div style={{ overflowX: "auto", marginTop: "8px" }}>{children}</div>
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
// Footer
// ---------------------------------------------------------------------------

function DeliverableFooter({ companyName }: { companyName: string }) {
  return (
    <footer className="doc-footer" style={{ marginTop: "40px" }}>
      <p>
        This report is advisory. It is not a statement of work, a binding quote,
        a financial guarantee, or a contract. Figures reflect directional
        analysis validated during discovery and are refined during scoping.
      </p>
      <p>Saipien Labs · Confidential · Prepared for {companyName}.</p>
    </footer>
  );
}

