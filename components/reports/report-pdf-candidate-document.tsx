import * as React from "react";
import {
  AlertTriangle,
  Clock,
  FileWarning,
  ShieldCheck,
  Slash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import type { Engagement } from "@/lib/engagements/types";
import type {
  ReportDeliveryExhibitSnapshot,
  ReportDeliveryOmittedExhibit,
  ReportDeliverySectionSnapshot,
  ReportDeliverySnapshot,
} from "@/lib/reports/delivery-snapshot-types";
import {
  clientSafeSectionLabel,
  sanitizeClientProse,
} from "@/lib/deliverables/client-copy-sanitizer";
import {
  ReportGroupAExhibits,
  type ReportGroupAExhibitResults,
} from "./report-group-a-exhibits";

/**
 * Sprint Presentation Pass 2 — docs/61 § 7.B viewerMode + § 7.A
 * live Group-A visuals + § 7.F technical-copy cleanup.
 *
 * `viewerMode`:
 *   - `"operator"` (default) — preserves all operator-only metadata
 *     (UUIDs, claim-guard scan counts, generated-by, snapshot id, the
 *     candidate banner, the on-screen operator hint). This is the
 *     pre-Pass-2 behavior, byte-stable.
 *   - `"client-facing"` — hides every operator-only metadata surface so
 *     the operator can drive Save-as-PDF for client handoff. Keeps
 *     every guardrail (boundary footer, watermark, voided banner,
 *     stale-acceptance note when present, omitted-exhibits appendix
 *     copy reframed for non-technical audience).
 *
 * `liveExhibits`:
 *   - Optional. When provided, the Group-A live exhibit SVGs render in
 *     a new "Visuals" section between the SectionsList and the
 *     ExhibitSlotsList. Group-B exhibits are not imported and not
 *     rendered (slot map `lib/reports/slot-map.ts` enforces the split).
 *   - When omitted, the original snapshot-pure exhibit slot card list
 *     is preserved unchanged.
 */

/**
 * Phase 1B Sprint 4C-B — operator-only report PDF candidate document.
 *
 * Renders a `report_delivery_snapshots` row as a print-ready artifact.
 * Designed to be the on-screen content the operator drives through the
 * browser's native Save-as-PDF. Wrapped by the print route in the
 * Sprint 4B `.slate-print-light` CSS-variable scope so the document
 * renders against the print-safe palette.
 *
 * Snapshot purity:
 *   - Renders ONLY from snapshot JSON. Does not re-query live rows.
 *   - For Group-A "ready" slots, lists the slot identity + source
 *     summary + freshness. Does not re-render the live SVG exhibit
 *     against the current data (per docs/20 Task 6 note: "Prefer
 *     snapshot purity over perfect live chart rendering").
 *   - The omitted-exhibits appendix renders verbatim from the
 *     snapshot, including the canonical Group-B omission entry.
 *
 * Pure server component. SVG-free in this sprint; the artifact is
 * text + cards.
 */

export interface ReportPdfCandidateDocumentProps {
  engagement: Engagement;
  snapshot: ReportDeliverySnapshot;
  viewerMode?: "operator" | "client-facing";
  liveExhibits?: ReportGroupAExhibitResults;
}

export function ReportPdfCandidateDocument({
  engagement,
  snapshot,
  viewerMode = "operator",
  liveExhibits,
}: ReportPdfCandidateDocumentProps) {
  const includedSections = snapshot.sectionSnapshot.filter(
    (s) => s.includedInArtifact,
  );
  const renderedExhibits = snapshot.exhibitSnapshot.filter(
    (e) => e.renderedInArtifact,
  );
  const isVoided = snapshot.status === "voided";
  const acceptedStaleSlots =
    snapshot.sourceSummarySnapshot.acceptedStaleSlots ?? [];
  const isClient = viewerMode === "client-facing";

  return (
    <div
      data-deliverable-export="report-candidate"
      className="flex flex-col gap-8 print:max-w-none print:gap-6"
    >
      <OperatorCandidateHint />
      {isVoided ? <VoidedBanner snapshot={snapshot} /> : null}
      <CandidateBanner snapshot={snapshot} viewerMode={viewerMode} />
      <IdentityHeader
        engagement={engagement}
        snapshot={snapshot}
        viewerMode={viewerMode}
      />
      {!isClient ? <ClaimGuardStrip snapshot={snapshot} /> : null}
      {!isClient && acceptedStaleSlots.length > 0 ? (
        <StaleAcceptanceNote acceptedStaleSlots={acceptedStaleSlots} />
      ) : null}
      {snapshot.draftWatermark ? <DraftCandidateWatermark /> : null}
      <SectionsList sections={includedSections} viewerMode={viewerMode} />
      {liveExhibits ? (
        <ReportGroupAExhibits
          exhibits={liveExhibits}
          viewerMode={viewerMode}
        />
      ) : (
        <ExhibitSlotsList exhibits={renderedExhibits} viewerMode={viewerMode} />
      )}
      <OmittedExhibitsAppendix
        omissions={snapshot.omittedExhibits}
        viewerMode={viewerMode}
      />
      <FooterBanner snapshot={snapshot} viewerMode={viewerMode} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voided banner — Sprint 4C-D
// ---------------------------------------------------------------------------

function VoidedBanner({ snapshot }: { snapshot: ReportDeliverySnapshot }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-status-critical/50 bg-status-critical/10 p-3 text-status-critical print:break-after-avoid print:shadow-none">
      <div className="flex items-start gap-2">
        <Slash className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
            Snapshot voided · do not deliver
          </span>
          <p className="text-xs leading-relaxed">
            This candidate snapshot was voided
            {snapshot.voidedAt
              ? ` on ${formatTimestamp(snapshot.voidedAt)}`
              : ""}
            {snapshot.voidReason ? `: ${snapshot.voidReason}` : "."} The
            content below is preserved for the audit trail only.
            Regenerate from the report page to produce a fresh candidate.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stale-acceptance note — Sprint 4C-D
// ---------------------------------------------------------------------------

function StaleAcceptanceNote({
  acceptedStaleSlots,
}: {
  acceptedStaleSlots: ReadonlyArray<string>;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-status-warning print:break-inside-avoid print:shadow-none">
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
            Source data may be stale — accepted by operator
          </span>
          <p className="text-xs leading-relaxed">
            The operator generated this candidate while one or more
            Group-A source slots were older than the 7-day freshness
            window. The slot identities below were explicitly
            acknowledged at generation time:
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {acceptedStaleSlots.map((slot) => (
              <li
                key={slot}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-status-warning"
              >
                · {slot}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Operator hint (on-screen only)
// ---------------------------------------------------------------------------

function OperatorCandidateHint() {
  return (
    <aside
      aria-label="Operator print hint"
      className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-[11px] leading-relaxed text-text-secondary print:hidden"
    >
      <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
        Operator hint ·
      </span>{" "}
      This is a metadata-only candidate snapshot. To save a PDF: open
      Ctrl-P / Cmd-P, set destination to <em>Save as PDF</em>, and
      disable Headers and footers so the SLATE banner remains the page
      identity. SLATE does not send this artifact to a client.
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Banner / identity
// ---------------------------------------------------------------------------

function CandidateBanner({
  snapshot,
  viewerMode,
}: {
  snapshot: ReportDeliverySnapshot;
  viewerMode: "operator" | "client-facing";
}) {
  // Client-facing mode replaces the operator-only banner with a softer
  // "Discovery report · Draft for review" framing. Operator-only mode
  // preserves the pre-Pass-2 wording verbatim (audit trail + boundary
  // language unchanged).
  if (viewerMode === "client-facing") {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-text-secondary print:break-after-avoid print:shadow-none">
        <div className="flex items-start gap-2">
          <FileWarning
            className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
            aria-hidden
          />
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Discovery report · Draft for review
            </span>
            <p className="text-xs leading-relaxed">
              Prepared {formatTimestamp(snapshot.generatedAt)} for
              discussion. This draft is provided for review; final scope,
              timing, and pricing will be confirmed in writing.
            </p>
          </div>
        </div>
      </div>
    );
  }
  const label =
    snapshot.deliverySurface === "client_pdf_candidate"
      ? "Client-safe PDF candidate"
      : "Internal candidate";
  return (
    <div className="flex flex-col gap-1 rounded-md border border-status-warning/50 bg-status-warning/10 p-3 text-status-warning print:break-after-avoid print:shadow-none">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
            {label} · operator review only · not sent by SLATE
          </span>
          <p className="text-xs leading-relaxed">
            Generated {formatTimestamp(snapshot.generatedAt)} for operator
            review. SLATE does not deliver this artifact to a client.
            The operator is responsible for distribution through their
            own channel.
          </p>
        </div>
      </div>
    </div>
  );
}

function IdentityHeader({
  engagement,
  snapshot,
  viewerMode,
}: {
  engagement: Engagement;
  snapshot: ReportDeliverySnapshot;
  viewerMode: "operator" | "client-facing";
}) {
  const isClient = viewerMode === "client-facing";
  return (
    <header className="flex flex-col gap-2 border-b border-border-subtle pb-6 print:break-after-avoid">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
        {isClient
          ? "Discovery report"
          : "AdvisoryOps · Report · Client-safe PDF candidate"}
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-[28px]">
        {engagement.companyName} · {engagement.engagementType} · Report
      </h1>
      {!isClient ? (
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          <span className="text-text-primary">
            Report status at generation:{" "}
          </span>
          {snapshot.reportStatusAtGeneration}
        </p>
      ) : null}
      <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[11px] font-mono uppercase tracking-[0.14em] text-text-muted">
        <span>
          Generated{" "}
          <span className="text-text-secondary">
            {formatTimestamp(snapshot.generatedAt)}
          </span>
        </span>
        {/*
          Client-facing mode strips internal UUIDs + generated-by
          metadata. Operator mode preserves them verbatim for audit
          traceability.
        */}
        {!isClient ? (
          <>
            <span>
              Engagement ID{" "}
              <span className="text-text-secondary">
                {snapshot.engagementId}
              </span>
            </span>
            <span>
              Report ID{" "}
              <span className="text-text-secondary">{snapshot.reportId}</span>
            </span>
            <span>
              Snapshot ID{" "}
              <span className="text-text-secondary">{snapshot.id}</span>
            </span>
            {snapshot.generatedByLabel ? (
              <span>
                Generated by{" "}
                <span className="text-text-secondary">
                  {snapshot.generatedByLabel}
                </span>
              </span>
            ) : null}
          </>
        ) : null}
      </p>
    </header>
  );
}

function ClaimGuardStrip({ snapshot }: { snapshot: ReportDeliverySnapshot }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] text-text-secondary print:break-inside-avoid print:shadow-none">
      <span className="inline-flex items-center gap-2 font-mono uppercase tracking-[0.14em] text-text-muted">
        <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
        Claim guard
      </span>
      <Badge tone={snapshot.claimGuardResult.passed ? "success" : "risk"}>
        {snapshot.claimGuardResult.passed
          ? "Passed"
          : `${snapshot.claimGuardResult.violations.length} violation(s)`}
      </Badge>
      <span className="text-text-muted">
        Scanned {snapshot.claimGuardResult.scannedFieldCount} fields against{" "}
        {snapshot.claimGuardResult.patternCount} patterns ·{" "}
        {snapshot.claimGuardResult.patternsApplied.join(" + ")}
      </span>
    </div>
  );
}

function DraftCandidateWatermark() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-status-risk/40 bg-status-risk/10 p-3 text-status-risk print:break-inside-avoid print:shadow-none">
      <FileWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
          Draft candidate · requires operator approval
        </span>
        <p className="text-xs leading-relaxed">
          This candidate includes sections in needs-review or drafted
          state. Do not deliver to a client until the operator promotes
          them to approved / final and regenerates a non-watermarked
          candidate.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections list
// ---------------------------------------------------------------------------

function SectionsList({
  sections,
  viewerMode,
}: {
  sections: ReportDeliverySectionSnapshot[];
  viewerMode: "operator" | "client-facing";
}) {
  const isClient = viewerMode === "client-facing";
  return (
    <section
      aria-label="Report sections"
      className="flex flex-col gap-5 print:gap-4 print:break-after-page"
    >
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          {isClient ? `Sections (${sections.length})` : `Sections (${sections.length})`}
        </span>
      </header>

      {sections.length === 0 ? (
        <Card variant="base">
          <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              No included sections
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              {isClient
                ? "This draft has no sections marked for inclusion. The discussion can resume once content is in place."
                : "This snapshot has no sections marked for inclusion. Either every section was excluded (e.g., all not-started) or the report was empty at generation time. Regenerate after promoting sections to needs-review or approved."}
            </p>
          </CardBody>
        </Card>
      ) : (
        sections.map((section) => (
          <SectionCard
            key={section.sectionId}
            section={section}
            viewerMode={viewerMode}
          />
        ))
      )}
    </section>
  );
}

function SectionCard({
  section,
  viewerMode,
}: {
  section: ReportDeliverySectionSnapshot;
  viewerMode: "operator" | "client-facing";
}) {
  const isClient = viewerMode === "client-facing";

  // Persisted narrative carries operator vocabulary from S8 drafting
  // (raw finding-UUIDs, EVIDENCE NOTES / GROUP B BLOCK labels, etc.).
  // In client mode we run a conservative text-only sanitization pass.
  // Operator mode renders verbatim — audit traceability stays intact.
  const summary = isClient ? sanitizeClientProse(section.summary) : section.summary ?? null;
  const draftPreview = isClient
    ? sanitizeClientProse(section.draftPreview)
    : section.draftPreview ?? null;
  const evidenceNotes = isClient
    ? sanitizeClientProse(section.evidenceNotes)
    : section.evidenceNotes ?? null;

  const clientSectionLabel = isClient ? clientSafeSectionLabel(section.sectionType) : null;

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
        {!isClient ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {section.sectionType}
            </span>
            <Badge tone={statusTone(section.status)}>{statusLabel(section.status)}</Badge>
            {section.aiDrafted ? <Badge tone="ai" dot>AI-drafted</Badge> : null}
            {section.exhibitSlot ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Slot · {section.exhibitSlot}
              </span>
            ) : null}
          </div>
        ) : clientSectionLabel ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {clientSectionLabel}
            </span>
          </div>
        ) : null}
        <h3 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">
          {section.title}
        </h3>
        {summary ? (
          <p className="text-sm leading-relaxed text-text-secondary">
            {summary}
          </p>
        ) : null}
        {draftPreview ? (
          <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
            {!isClient ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Draft preview
              </span>
            ) : null}
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
              {draftPreview}
            </p>
          </div>
        ) : null}
        {evidenceNotes ? (
          <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {isClient ? "Basis for recommendations" : "Evidence notes"}
            </span>
            <p className="whitespace-pre-line text-[11px] leading-relaxed text-text-secondary">
              {evidenceNotes}
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exhibit slot list
// ---------------------------------------------------------------------------

function ExhibitSlotsList({
  exhibits,
  viewerMode,
}: {
  exhibits: ReportDeliveryExhibitSnapshot[];
  viewerMode: "operator" | "client-facing";
}) {
  if (exhibits.length === 0) return null;
  const isClient = viewerMode === "client-facing";
  return (
    <section
      aria-label="Report exhibits"
      className="flex flex-col gap-4 print:break-before-page print:break-after-avoid"
    >
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          {isClient ? "Supporting summaries" : "Report exhibits · included in candidate"}
        </span>
        <p className="max-w-prose text-xs leading-relaxed text-text-muted">
          {isClient
            ? "Supporting summaries for each visual section. Pass live rendering on the candidate page to render the corresponding visuals."
            : "Source-summary identity for each Group-A exhibit slot at generation time. Live visuals render when the candidate page loads with live-exhibit data; this list is the snapshot-only fallback."}
        </p>
      </header>
      {exhibits.map((exhibit) => (
        <ExhibitCard
          key={exhibit.slot}
          exhibit={exhibit}
          viewerMode={viewerMode}
        />
      ))}
    </section>
  );
}

function ExhibitCard({
  exhibit,
  viewerMode,
}: {
  exhibit: ReportDeliveryExhibitSnapshot;
  viewerMode: "operator" | "client-facing";
}) {
  const isClient = viewerMode === "client-facing";
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-2 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            {isClient ? friendlyExhibitTitle(exhibit.slot) : `Slot · ${exhibit.slot}`}
          </span>
          {!isClient ? (
            <>
              <Badge tone="success">{exhibit.adapterStatus}</Badge>
              <Badge
                tone={freshnessTone(exhibit.sourceSummary.freshness)}
                variant="outline"
              >
                {exhibit.sourceSummary.freshness}
              </Badge>
            </>
          ) : null}
        </div>
        {!isClient ? (
          <p className="text-[11px] leading-relaxed text-text-muted">
            <span className="font-mono uppercase tracking-[0.14em]">Source</span>{" "}
            · {exhibit.sourceSummary.source} ·{" "}
            <span className="font-mono">n={exhibit.sourceSummary.rowCount}</span>{" "}
            · generated {formatTimestamp(exhibit.sourceSummary.generatedAt)}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function friendlyExhibitTitle(slot: string): string {
  switch (slot) {
    case "executive_summary_portfolio":
      return "Opportunity portfolio";
    case "findings_risk_priority":
      return "Risk-adjusted priority";
    case "diagnostic_capability_maturity":
      return "Capability maturity";
    case "diagnostic_stakeholder_coverage":
      return "Stakeholder coverage";
    case "roadmap_90_day_sequence":
      return "30 / 60 / 90 roadmap";
    case "group_b_block":
      return "Visuals not included";
    default:
      return slot.replace(/_/g, " ");
  }
}

// ---------------------------------------------------------------------------
// Omitted exhibits appendix
// ---------------------------------------------------------------------------

function OmittedExhibitsAppendix({
  omissions,
  viewerMode,
}: {
  omissions: ReportDeliveryOmittedExhibit[];
  viewerMode: "operator" | "client-facing";
}) {
  if (omissions.length === 0) return null;
  const isClient = viewerMode === "client-facing";
  return (
    <section
      aria-label="Omitted exhibits"
      className="flex flex-col gap-3 border-t border-border-subtle pt-6 print:break-before-page print:break-after-avoid"
    >
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          {isClient
            ? `Visuals not included in this version (${omissions.length})`
            : `Omitted exhibits (${omissions.length})`}
        </span>
        <p className="max-w-prose text-xs leading-relaxed text-text-muted">
          {isClient
            ? "Some visuals are not included in this version because supporting data has not been validated. Final scope, sequencing, and any quantitative claim will be confirmed in writing."
            : "Slots intentionally excluded from this candidate. Group-B (benchmark / financial) is always omitted under the current docs/14 / docs/15 data gates. Group-A omissions list the adapter reason."}
        </p>
      </header>
      <div className="flex flex-col gap-2">
        {omissions.map((omission) => (
          <div
            key={`${omission.slot}-${omission.issueCode}`}
            className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] leading-relaxed text-text-secondary print:break-inside-avoid print:shadow-none"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
                {isClient ? friendlyExhibitTitle(omission.slot) : omission.slot}
              </span>
              {!isClient ? (
                <>
                  <Badge tone={omissionTone(omission.reason)} variant="outline">
                    {omission.reason}
                  </Badge>
                  <code className="font-mono text-[10px] text-text-muted">
                    {omission.issueCode}
                  </code>
                </>
              ) : null}
            </div>
            <p>
              {isClient
                ? "Not included in this version because supporting data has not been validated."
                : omission.operatorFacingNote}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function FooterBanner({
  snapshot,
  viewerMode,
}: {
  snapshot: ReportDeliverySnapshot;
  viewerMode: "operator" | "client-facing";
}) {
  if (viewerMode === "client-facing") {
    return (
      <footer className="flex flex-col gap-1 border-t border-border-subtle pt-4 text-[11px] leading-relaxed text-text-muted print:break-inside-avoid">
        <p>
          Discovery draft for review. Final scope, sequencing, and
          pricing will be confirmed in writing. Not a contract.
        </p>
      </footer>
    );
  }
  return (
    <footer className="flex flex-col gap-1 border-t border-border-subtle pt-4 text-[11px] leading-relaxed text-text-muted print:break-inside-avoid">
      <span className="font-mono uppercase tracking-[0.16em]">
        Internal preview · not client-facing
      </span>
      <p>
        Generated for operator review only. This document is not
        approved for client distribution. Final exports remain locked
        until a separate sprint authorizes client delivery, PDF storage,
        and signature workflows. Snapshot {snapshot.id}.
      </p>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(
  status: string,
): "success" | "info" | "warning" | "neutral" {
  switch (status) {
    case "final":
    case "approved":
      return "success";
    case "needs-review":
    case "drafted":
      return "warning";
    case "not-started":
      return "neutral";
    default:
      return "info";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "needs-review":
      return "Needs review";
    case "not-started":
      return "Not started";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function freshnessTone(
  f: "fresh" | "stale" | "unknown",
): "success" | "warning" | "neutral" {
  switch (f) {
    case "fresh":
      return "success";
    case "stale":
      return "warning";
    case "unknown":
      return "neutral";
  }
}

function omissionTone(
  reason: ReportDeliveryOmittedExhibit["reason"],
): "warning" | "risk" | "neutral" {
  switch (reason) {
    case "insufficient_data":
    case "stale_rejected":
      return "warning";
    case "invalid_data":
      return "risk";
    case "gated":
    default:
      return "neutral";
  }
}
