import * as React from "react";

import { sanitizeClientProse } from "@/lib/deliverables/client-copy-sanitizer";
import {
  Reg,
  Rail,
  DocPage,
  SecNote,
  humanizeSectionType,
  formatDeliverableDate,
} from "@/components/deliverables/doc-kit";
import type {
  ReportDeliveryExhibitSnapshot,
  ReportDeliveryOmittedExhibit,
  ReportDeliverySectionSnapshot,
  ReportDeliverySnapshot,
} from "@/lib/reports/delivery-snapshot-types";

/*
THESIS: The report a client actually opens through their share link — the
same "Opportunity Brief" the operator previews internally, now at design
parity. A composed cover, a decision-journey contents rail, editorial
section prose, and exhibits presented as numbered figure plates. It refuses
the stacked-plain-cards + mono-eyebrow "app screen" look the earlier share
document shipped.
OWN-WORLD: Saipien "Register" light executive plate document (styles/
deliverable.css, .slate-doc), shared with the flagship
client-report-deliverable and the public SOW. Warm tonal ground, warm ink,
ONE two-tone mint accent, a warm-dark brand panel on the cover, hairline
plate furniture. Archivo display/body, JetBrains Mono for figure/meta labels
only. Flat + matte.
CONSTRAINT (docs/22 § Public Route Security + Content Rendering Policy):
snapshot-pure (every field from the snapshot jsonb; no live re-query), no
internal UUIDs, no operator-only framing, no reviewer notes, SVG-free
(exhibits surface as source-summary plates, never live charts). The
claim-guard scan surfaces only as the affirmative phrase; omitted exhibits
carry the client-facing framing; the mandatory four-denial footer stays.
STORY: A client opens the link to a composed cover + contents rail, reads a
crisp executive summary, moves through evidence-backed sections, studies the
figure plates, and concludes this firm is worth a six-figure engagement.
FORM: executive print document (decision-journey plate document).
*/

export interface ClientReportShareDocumentProps {
  /**
   * The full snapshot. The document treats it as the only source of
   * truth — no live data hits the public surface.
   */
  snapshot: ReportDeliverySnapshot;
  /**
   * Display title for the cover. Provided by the route so the component
   * never reads the engagement row directly.
   */
  reportTitle: string;
  /**
   * The client company name for the cover hero + rail foot. Provided by
   * the route (the client viewer already knows who they are); falls back
   * to a neutral phrase when the route cannot resolve it. No UUID.
   */
  companyName?: string;
}

export function ClientReportShareDocument({
  snapshot,
  reportTitle,
  companyName,
}: ClientReportShareDocumentProps) {
  const sections = snapshot.sectionSnapshot
    .filter((s) => s.includedInArtifact)
    .sort((a, b) => a.position - b.position);

  const execIndex = sections.findIndex(
    (s) => s.sectionType === "executive_summary",
  );
  const exec = execIndex >= 0 ? sections[execIndex] : null;
  const bodySections = sections.filter((_, i) => i !== execIndex);

  const renderedExhibits = snapshot.exhibitSnapshot.filter(
    (e) => e.renderedInArtifact,
  );
  const omissions = snapshot.omittedExhibits;

  // Decision-journey rail — the document's contents.
  const rail: string[] = [];
  if (exec) rail.push(humanizeSectionType(exec.sectionType));
  bodySections.forEach((s) => rail.push(humanizeSectionType(s.sectionType)));
  if (renderedExhibits.length > 0) rail.push("Exhibits");
  if (omissions.length > 0) rail.push("Appendix");

  const bodyBase = exec ? 1 : 0;
  let tailIndex = rail.length - 1;
  const appendixActive = omissions.length > 0 ? tailIndex-- : undefined;
  const exhibitsActive = renderedExhibits.length > 0 ? tailIndex : undefined;

  const heroName = companyName?.trim() || reportTitle;

  return (
    <div className="slate-doc" data-deliverable-export="client-report-share">
      {/* -------- Cover -------- */}
      <section className="doc-page doc-cover">
        <Reg />
        <div className="doc-spread">
          <Rail
            items={rail}
            variant="cover"
            docId="AI Opportunity Sprint"
            companyName={companyName}
          />
          <div className="doc-main">
            <h1 className="doc-h1">{heroName}</h1>
            <p className="doc-cover-sub">
              An operational diagnostic, a prioritized set of AI opportunities,
              and a 90-day implementation roadmap.
            </p>
            <div className="doc-cover-rule" />
            <dl className="doc-cover-meta">
              <div>
                <dt>Prepared for</dt>
                <dd>{heroName}</dd>
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
                <dt>Confidential</dt>
                <dd>Prepared for the leadership team</dd>
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

      {/* -------- Exhibits (source-summary plates; SVG-free) -------- */}
      {renderedExhibits.length > 0 ? (
        <DocPage rail={rail} active={exhibitsActive}>
          <div className="doc-sec-head">
            <div className="doc-sec-title">Exhibits</div>
            <div className="doc-sec-note">Supporting analysis</div>
          </div>
          <p className="doc-lede">
            Each figure below identifies the analysis prepared for your report.
            The interactive visuals are presented live in the working session
            your engagement lead schedules.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {renderedExhibits.map((exhibit, i) => (
              <ExhibitPlate
                key={exhibit.slot}
                index={i + 1}
                exhibit={exhibit}
              />
            ))}
          </div>
        </DocPage>
      ) : null}

      {/* -------- Omitted-exhibits appendix -------- */}
      {omissions.length > 0 ? (
        <DocPage rail={rail} active={appendixActive}>
          <div className="doc-sec-head">
            <div className="doc-sec-title">Intentionally not included</div>
            <div className="doc-sec-note">Appendix</div>
          </div>
          <p className="doc-lede">
            Saipien Labs deliberately excludes any exhibit that would require
            firm benchmark comparisons or financial projections from this client
            view. These remain in discussion-only materials until the underlying
            data is validated to a higher tier.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {omissions.map((omission) => (
              <OmissionPlate
                key={`${omission.slot}-${omission.issueCode}`}
                omission={omission}
              />
            ))}
          </div>
          <ShareFooter />
        </DocPage>
      ) : (
        <DocPage rail={rail}>
          <ShareFooter />
        </DocPage>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prose helpers (client-safe) — mirrors the flagship deliverable
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
// Exhibit plate — numbered figure, source-summary only (no live SVG)
// ---------------------------------------------------------------------------

function ExhibitPlate({
  index,
  exhibit,
}: {
  index: number;
  exhibit: ReportDeliveryExhibitSnapshot;
}) {
  return (
    <figure className="doc-plate" style={{ margin: 0 }}>
      <div className="doc-plate-fig">
        Figure {String(index).padStart(2, "0")}
      </div>
      <div className="doc-plate-t">{prettifyExhibitSlot(exhibit.slot)}</div>
      <div className="doc-plate-cap">
        Prepared from {exhibit.sourceSummary.source}.
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Omission plate — client-facing framing
// ---------------------------------------------------------------------------

function OmissionPlate({
  omission,
}: {
  omission: ReportDeliveryOmittedExhibit;
}) {
  return (
    <div className="doc-plate" style={{ margin: 0 }}>
      <div className="doc-plate-fig">{prettifyExhibitSlot(omission.slot)}</div>
      <p className="doc-body" style={{ marginTop: "8px" }}>
        {clientFacingOmissionNote(omission)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer — affirmative safety line + mandatory four-denial copy (docs/22)
// ---------------------------------------------------------------------------

function ShareFooter() {
  return (
    <footer className="doc-footer" style={{ marginTop: "40px" }}>
      <p>Content safety checks passed.</p>
      <p>
        This report is advisory only. It is not a statement of work, a binding
        quote, a financial guarantee, or a contract.
      </p>
      <p>
        Questions about this report? Contact the Saipien Labs team member who
        sent you this link.
      </p>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Helpers — display formatting that hides internal codes
// ---------------------------------------------------------------------------

function prettifyExhibitSlot(slot: string): string {
  if (slot === "group_b_block") return "Benchmark & financial models";
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
