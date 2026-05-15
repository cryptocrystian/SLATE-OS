import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import type {
  ReportDeliveryExhibitSnapshot,
  ReportDeliveryOmittedExhibit,
  ReportDeliverySectionSnapshot,
  ReportDeliverySnapshot,
} from "@/lib/reports/delivery-snapshot-types";

/**
 * Phase 1B Sprint 4D-C — client-facing report share document.
 *
 * Renders the same `report_delivery_snapshots` payload as the operator
 * candidate document but stripped of every operator-only surface:
 *
 *   - No internal UUIDs (engagement / report / snapshot ids).
 *   - No claim-guard codes / pattern families / violation surface; the
 *     scan is shown as the affirmative phrase "Content safety checks
 *     passed" only.
 *   - No "operator-only", "candidate", or "not sent by SLATE"
 *     framing — those are operator-internal disclaimers, not client
 *     copy.
 *   - No reviewer notes / activity log / generated-by id.
 *   - No "Draft Candidate" or void state — ineligible snapshots never
 *     reach this component because the public route's eligibility
 *     re-check rejects them.
 *   - No raw token, no token hash, no audience-label leak in plain
 *     text (the audience label is operator-internal and surfaces only
 *     as a generic recipient framing).
 *
 * Snapshot-pure: every field comes from the snapshot's jsonb columns;
 * no live row re-query. Same `slate-print-light` CSS-variable scope
 * the operator candidate route uses, so client print/save renders
 * against the print-safe palette.
 *
 * Pure server component. SVG-free in this sprint — exhibits surface as
 * source-summary cards only per `docs/22` § Content Rendering Policy.
 */

export interface ClientReportShareDocumentProps {
  /**
   * The full snapshot. The document treats it as the only source of
   * truth — no live data hits the public surface.
   */
  snapshot: ReportDeliverySnapshot;
  /**
   * Display title for the report card. Provided by the route so the
   * component never reads the engagement row directly.
   */
  reportTitle: string;
}

export function ClientReportShareDocument({
  snapshot,
  reportTitle,
}: ClientReportShareDocumentProps) {
  const includedSections = snapshot.sectionSnapshot.filter(
    (s) => s.includedInArtifact,
  );
  const renderedExhibits = snapshot.exhibitSnapshot.filter(
    (e) => e.renderedInArtifact,
  );

  return (
    <div className="flex flex-col gap-8 print:max-w-none print:gap-6">
      <IdentityHeader
        reportTitle={reportTitle}
        generatedAt={snapshot.generatedAt}
      />
      <SafetyStrip />
      <SectionsList sections={includedSections} />
      <ExhibitSlotsList exhibits={renderedExhibits} />
      <OmittedExhibitsAppendix omissions={snapshot.omittedExhibits} />
      <ClientFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Identity header — no UUIDs, no operator label
// ---------------------------------------------------------------------------

function IdentityHeader({
  reportTitle,
  generatedAt,
}: {
  reportTitle: string;
  generatedAt: string;
}) {
  return (
    <header className="flex flex-col gap-2 border-b border-border-subtle pb-6 print:break-after-avoid">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
        Saipien Labs · Client Report
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-[28px]">
        {reportTitle}
      </h1>
      <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-text-muted">
        Generated{" "}
        <span className="text-text-secondary">
          {formatTimestamp(generatedAt)}
        </span>
      </p>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Safety strip — affirmative only
// ---------------------------------------------------------------------------

function SafetyStrip() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] text-text-secondary print:break-inside-avoid print:shadow-none">
      <span className="inline-flex items-center gap-2 font-mono uppercase tracking-[0.14em] text-text-muted">
        <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
        Content safety checks passed
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections — sanitized version of the operator card
// ---------------------------------------------------------------------------

function SectionsList({
  sections,
}: {
  sections: ReportDeliverySectionSnapshot[];
}) {
  return (
    <section
      aria-label="Report sections"
      className="flex flex-col gap-5 print:gap-4 print:break-after-page"
    >
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Sections ({sections.length})
        </span>
      </header>

      {sections.length === 0 ? (
        <Card variant="base">
          <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              No sections published
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              This report does not yet have any client-ready sections.
              Contact the sender for an updated link.
            </p>
          </CardBody>
        </Card>
      ) : (
        sections.map((section) => (
          <SectionCard key={section.sectionId} section={section} />
        ))
      )}
    </section>
  );
}

function SectionCard({
  section,
}: {
  section: ReportDeliverySectionSnapshot;
}) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
        <h3 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">
          {section.title}
        </h3>
        {section.summary ? (
          <p className="text-sm leading-relaxed text-text-secondary">
            {section.summary}
          </p>
        ) : null}
        {section.draftPreview ? (
          <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Detail
            </span>
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
              {section.draftPreview}
            </p>
          </div>
        ) : null}
        {section.evidenceNotes ? (
          <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Supporting notes
            </span>
            <p className="whitespace-pre-line text-[11px] leading-relaxed text-text-secondary">
              {section.evidenceNotes}
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exhibits — source-summary cards only (no live SVG)
// ---------------------------------------------------------------------------

function ExhibitSlotsList({
  exhibits,
}: {
  exhibits: ReportDeliveryExhibitSnapshot[];
}) {
  if (exhibits.length === 0) return null;
  return (
    <section
      aria-label="Report exhibits"
      className="flex flex-col gap-4 print:break-before-page print:break-after-avoid"
    >
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Visual exhibits
        </span>
        <p className="max-w-prose text-xs leading-relaxed text-text-muted">
          Each card identifies the data source that produced the
          corresponding visual exhibit in your prepared report. Visual
          renderings are intentionally summarised here; please use the
          live discussion materials your engagement lead shares for the
          interactive views.
        </p>
      </header>
      {exhibits.map((exhibit) => (
        <ExhibitCard key={exhibit.slot} exhibit={exhibit} />
      ))}
    </section>
  );
}

function ExhibitCard({ exhibit }: { exhibit: ReportDeliveryExhibitSnapshot }) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-2 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            {prettifyExhibitSlot(exhibit.slot)}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-text-muted">
          <span className="font-mono uppercase tracking-[0.14em]">Source</span>{" "}
          · {exhibit.sourceSummary.source}
        </p>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Omitted exhibits — client-friendly framing
// ---------------------------------------------------------------------------

function OmittedExhibitsAppendix({
  omissions,
}: {
  omissions: ReportDeliveryOmittedExhibit[];
}) {
  if (omissions.length === 0) return null;
  return (
    <section
      aria-label="Omitted exhibits"
      className="flex flex-col gap-3 border-t border-border-subtle pt-6 print:break-before-page print:break-after-avoid"
    >
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Intentionally not included
        </span>
        <p className="max-w-prose text-xs leading-relaxed text-text-muted">
          Saipien Labs deliberately excludes any exhibit that would
          require firm benchmark comparisons or financial projections
          from this client view. These views remain in discussion-only
          materials until the underlying data is validated to a higher
          tier.
        </p>
      </header>
      <div className="flex flex-col gap-2">
        {omissions.map((omission) => (
          <OmissionCard
            key={`${omission.slot}-${omission.issueCode}`}
            omission={omission}
          />
        ))}
      </div>
    </section>
  );
}

function OmissionCard({
  omission,
}: {
  omission: ReportDeliveryOmittedExhibit;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] leading-relaxed text-text-secondary print:break-inside-avoid print:shadow-none">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
          {prettifyExhibitSlot(omission.slot)}
        </span>
        <Badge tone="neutral" variant="outline">
          Discussion-only
        </Badge>
      </div>
      <p>{clientFacingOmissionNote(omission)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer — mandatory four-denial copy per docs/22
// ---------------------------------------------------------------------------

function ClientFooter() {
  return (
    <footer className="flex flex-col gap-1 border-t border-border-subtle pt-4 text-[11px] leading-relaxed text-text-muted print:break-inside-avoid">
      <p>
        This report is advisory only. It is not a SOW, not a binding
        quote, not a financial guarantee, and not a contract.
      </p>
      <p>
        Questions about the contents of this report? Contact the
        Saipien Labs team member who sent you this link.
      </p>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Helpers — display formatting that hides internal codes
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function prettifyExhibitSlot(slot: string): string {
  if (slot === "group_b_block") return "Benchmark & financial models";
  // Turn `executive_summary_portfolio` → `Executive Summary Portfolio`.
  return slot
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function clientFacingOmissionNote(
  omission: ReportDeliveryOmittedExhibit,
): string {
  if (omission.slot === "group_b_block") {
    return "Benchmark comparison and modeled financial views are intentionally kept in discussion-only materials until validated against your operating assumptions.";
  }
  switch (omission.reason) {
    case "insufficient_data":
    case "invalid_data":
      return "Saipien Labs has set this view aside until enough underlying data is captured to present a confident view.";
    case "stale_rejected":
      return "Saipien Labs has set this view aside while the source data is refreshed.";
    case "gated":
    default:
      return "Saipien Labs has kept this view in discussion-only materials for the current report.";
  }
}
