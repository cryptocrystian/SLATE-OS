import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import type {
  ProposalDeliverySnapshot,
  ProposalOmittedContent,
  ProposalOptionSnapshot,
  ProposalPricingReviewState,
} from "@/lib/proposals/delivery-snapshot-types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P5 — client-facing proposal
 * share document.
 *
 * Renders the same `proposal_delivery_snapshots` payload as the
 * operator candidate document but stripped of every operator-only
 * surface:
 *
 *   - No internal UUIDs (engagement / proposal / snapshot / option).
 *   - No commercial-guard codes / pattern families / violation
 *     surface; the scan is shown as the affirmative phrase
 *     "Commercial safety checks passed" only.
 *   - No "operator-only", "candidate", or "not sent by SLATE"
 *     framing — those are operator-internal disclaimers, not client
 *     copy.
 *   - No `generated_by_label` initials.
 *   - No reviewer notes / activity log.
 *   - No "Draft Candidate" or void state — ineligible snapshots
 *     never reach this component because the public route's
 *     eligibility re-check rejects them.
 *   - No raw token, no token hash, no audience-label leak in plain
 *     text (the audience label is operator-internal).
 *   - No approval controls / e-signature / acceptance affirmatives.
 *   - No SOW draft content; the proposal candidate surface is a
 *     discussion artifact only.
 *   - Pricing is hidden whenever `pricing_review_state='placeholder'`;
 *     surfaces with "Estimated · subject to final approval" framing
 *     when `manually_approved` or `workflow_approved`. The placeholder
 *     value never reaches the client surface as if it were final
 *     pricing.
 *   - Implementation credit hidden until commercial approval exists
 *     (canon § Pricing / Terms Policy).
 *
 * Snapshot-pure: every field comes from the snapshot's jsonb columns;
 * no live row re-query. Same `slate-print-light` CSS-variable scope
 * the operator candidate route uses, so client print/save renders
 * against the print-safe palette.
 *
 * Mandatory disclaimers per `docs/24` § Required Disclaimers /
 * Markings — Proposal Candidate surface — are non-negotiable on every
 * render.
 *
 * Pure server component. SVG-free in this sprint.
 */

export interface ClientProposalShareDocumentProps {
  /**
   * The full snapshot. The document treats it as the only source of
   * truth — no live data hits the public surface.
   */
  snapshot: ProposalDeliverySnapshot;
  /**
   * Display title for the proposal card. Provided by the route so the
   * component never reads the engagement row directly.
   */
  proposalTitle: string;
}

export function ClientProposalShareDocument({
  snapshot,
  proposalTitle,
}: ClientProposalShareDocumentProps) {
  const includedOptions = snapshot.optionSnapshot.filter(
    (o) => o.includedInArtifact,
  );

  return (
    <div
      data-deliverable-export="client-proposal-share"
      className="flex flex-col gap-8 print:max-w-none print:gap-6"
    >
      <ProposalHeader
        proposalTitle={proposalTitle}
        generatedAt={snapshot.generatedAt}
      />
      <SafetyStrip />
      <DisclosureNotice pricingReviewState={snapshot.pricingReviewState} />
      <OptionsList
        options={includedOptions}
        pricingReviewState={snapshot.pricingReviewState}
      />
      <OmittedContentAppendix omissions={snapshot.omittedContent} />
      <ClientFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function ProposalHeader({
  proposalTitle,
  generatedAt,
}: {
  proposalTitle: string;
  generatedAt: string;
}) {
  return (
    <header className="flex flex-col gap-2 border-b border-border-subtle pb-6 print:break-after-avoid">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
        Saipien Labs · Proposal Review
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-[28px]">
        {proposalTitle}
      </h1>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
        Generated{" "}
        <span className="text-text-secondary">
          {formatDate(generatedAt)}
        </span>
      </p>
    </header>
  );
}

function SafetyStrip() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] text-text-secondary print:break-inside-avoid print:shadow-none">
      <span className="inline-flex items-center gap-2 font-mono uppercase tracking-[0.14em] text-text-muted">
        <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
        Commercial safety checks passed
      </span>
    </div>
  );
}

function DisclosureNotice({
  pricingReviewState,
}: {
  pricingReviewState: ProposalPricingReviewState;
}) {
  const pricingNote = (() => {
    switch (pricingReviewState) {
      case "manually_approved":
      case "workflow_approved":
        return "Where shown, pricing is framed as estimated and subject to final approval. The figures are not a binding quote.";
      case "placeholder":
      default:
        return "Pricing is intentionally not shown in this document. Final pricing requires written approval and will be shared separately.";
    }
  })();
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-2 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Proposal discussion draft
        </span>
        <p className="text-xs leading-relaxed text-text-secondary">
          This document is a commercial discussion artifact. It is not a
          binding quote, not a statement of work, and not a contract.
          Final scope, pricing, and timeline require written approval.
        </p>
        <p className="text-[11px] leading-relaxed text-text-muted">
          {pricingNote}
        </p>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Options list
// ---------------------------------------------------------------------------

function OptionsList({
  options,
  pricingReviewState,
}: {
  options: ProposalOptionSnapshot[];
  pricingReviewState: ProposalPricingReviewState;
}) {
  return (
    <section
      aria-label="Proposal options"
      className="flex flex-col gap-5 print:gap-4 print:break-after-page"
    >
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Options ({options.length})
        </span>
      </header>

      {options.length === 0 ? (
        <Card variant="base">
          <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
            <p className="text-sm leading-relaxed text-text-secondary">
              No options are available in this view. Contact the sender
              for an updated link.
            </p>
          </CardBody>
        </Card>
      ) : (
        options.map((option, idx) => (
          <OptionCard
            key={`${option.optionType}-${idx}`}
            option={option}
            pricingReviewState={pricingReviewState}
          />
        ))
      )}
    </section>
  );
}

function OptionCard({
  option,
  pricingReviewState,
}: {
  option: ProposalOptionSnapshot;
  pricingReviewState: ProposalPricingReviewState;
}) {
  const showPricing = pricingReviewState !== "placeholder";
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            {option.optionType.replace(/-/g, " ")}
          </span>
          {option.recommended ? (
            <Badge tone="success">Recommended</Badge>
          ) : null}
        </div>
        <h3 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">
          {option.title}
        </h3>
        {option.bestFitScenario ? (
          <p className="text-sm leading-relaxed text-text-secondary">
            {option.bestFitScenario}
          </p>
        ) : null}
        {option.scopeSummary ? (
          <SectionBlock label="Scope summary" body={option.scopeSummary} />
        ) : null}
        {option.timeline ? (
          <SectionBlock
            label="Proposed timeline"
            body={option.timeline}
            note="Proposed range only — not a delivery guarantee."
          />
        ) : null}
        {option.deliverables.length > 0 ? (
          <BulletBlock label="Deliverables" items={option.deliverables} />
        ) : null}
        {option.assumptions.length > 0 ? (
          <BulletBlock label="Assumptions" items={option.assumptions} />
        ) : null}
        {option.dependencies.length > 0 ? (
          <BulletBlock label="Dependencies" items={option.dependencies} />
        ) : null}
        {option.risks.length > 0 ? (
          <BulletBlock label="Risks" items={option.risks} />
        ) : null}
        {showPricing && option.pricingPlaceholder ? (
          <SectionBlock
            label="Estimated pricing"
            body={option.pricingPlaceholder}
            note="Estimated · subject to final approval. Not a binding quote."
          />
        ) : null}
      </CardBody>
    </Card>
  );
}

function SectionBlock({
  label,
  body,
  note,
}: {
  label: string;
  body: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
        {label}
      </span>
      <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
        {body}
      </p>
      {note ? (
        <p className="text-[11px] leading-relaxed text-text-muted">{note}</p>
      ) : null}
    </div>
  );
}

function BulletBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
        {label}
      </span>
      <ul className="flex flex-col gap-1 text-sm leading-relaxed text-text-secondary">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Omitted-content appendix — client-safe wording
// ---------------------------------------------------------------------------

function OmittedContentAppendix({
  omissions,
}: {
  omissions: ProposalOmittedContent[];
}) {
  if (omissions.length === 0) return null;

  // Filter the omissions list to client-safe entries only. The
  // canonical Group-B entry always surfaces; per-option exclusions are
  // shown in client-friendly language rather than the operator codes.
  const hasGroupB = omissions.some((o) => o.scope === "group_b_block");
  const optionExclusionCount = omissions.filter(
    (o) => o.scope !== "group_b_block",
  ).length;

  return (
    <section
      aria-label="Intentionally not included"
      className="flex flex-col gap-3 border-t border-border-subtle pt-6 print:break-before-page print:break-after-avoid"
    >
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Intentionally not included
        </span>
        <p className="max-w-prose text-xs leading-relaxed text-text-muted">
          A few topics are intentionally kept out of this proposal
          discussion so the conversation stays grounded in what is ready
          to commit to today.
        </p>
      </header>
      <div className="flex flex-col gap-2">
        {hasGroupB ? (
          <ClientOmissionRow
            title="Benchmark and modeled financial views"
            body="Benchmark comparisons and modeled financial views are intentionally kept in discussion-only materials until validated against your operating assumptions. They are out of scope for this proposal."
          />
        ) : null}
        {optionExclusionCount > 0 ? (
          <ClientOmissionRow
            title="Alternate option paths"
            body={
              optionExclusionCount === 1
                ? "One additional option path was considered but is not included in this discussion."
                : `${optionExclusionCount} additional option paths were considered but are not included in this discussion.`
            }
          />
        ) : null}
      </div>
    </section>
  );
}

function ClientOmissionRow({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] leading-relaxed text-text-secondary print:break-inside-avoid print:shadow-none">
      <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
        {title}
      </span>
      <p>{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer — mandatory disclaimer copy per docs/24
// ---------------------------------------------------------------------------

function ClientFooter() {
  return (
    <footer className="flex flex-col gap-1 border-t border-border-subtle pt-4 text-[11px] leading-relaxed text-text-muted print:break-inside-avoid">
      <p>
        This document is a commercial discussion artifact. It is not a
        binding quote. It is not a statement of work. Final scope,
        pricing, and timeline require written approval.
      </p>
      <p>
        Not a contract, not an executed SOW, not a financial guarantee,
        not acceptance of work.
      </p>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
