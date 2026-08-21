import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  Scale,
  ShieldCheck,
  Slash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import type {
  ProposalCommercialGuardResult,
  ProposalDeliverySnapshot,
  ProposalOmittedContent,
  ProposalOptionSnapshot,
  ProposalPricingReviewState,
} from "@/lib/proposals/delivery-snapshot-types";
import type { SowDraftFields } from "@/lib/proposals/commercial-guard";
import { deliverableSerif } from "@/lib/deliverable-fonts";

/** Serif display face for headings — matches the report/proposal house style. */
// Saipien "Register" display voice (Archivo). The SOW shares the client
// deliverable house style; on the public `/s` surface the whole document
// is additionally wrapped in `.slate-doc` for the warm/mint Register skin.
const SERIF = "[font-family:var(--font-archivo)]";

/**
 * Phase 1B SOW Draft Sprint P6-C — operator-internal SOW Draft
 * document renderer.
 *
 * Renders a `proposal_delivery_snapshots` row whose `delivery_surface`
 * is `sow_draft_candidate` as a print-ready artifact.
 *
 * Two modes (see the `mode` prop): the default `"operator"` surface at
 * `/app/.../proposal/sow/[snapshotId]` and, as of Sprint P7-B (canon
 * `docs/28` + `docs/65`), the client-facing `"public"` surface at
 * `/s/[token]`. The public mode strips ALL operator-workflow chrome —
 * operator banners/hints, approval-state metadata, guard internals,
 * "for audit and operator review" notes, the intentionally-not-included
 * appendix, and any internal state names / canon refs / code
 * identifiers — while keeping the DRAFT marking, the canon-required
 * public disclaimer, the legal-boundary notice, and the mandatory
 * footer. It remains a draft — never an executed contract.
 *
 * Snapshot purity:
 *   - Renders ONLY from `option_snapshot` /
 *     `source_context_snapshot.sowDraft` / `commercial_guard_result` /
 *     `omitted_content` jsonb. No live re-query of the source
 *     Proposal Candidate, no live re-query of the proposal options.
 *   - Pricing is hidden whenever `pricing_review_state='placeholder'`;
 *     the canon-derived pricing notice (built by
 *     `sow-draft-eligibility` / `sow-draft-actions`) replaces it.
 *   - Commercial-guard codes / pattern families / banned-phrase
 *     surface NEVER reach the rendered HTML. The strip shows only the
 *     affirmative "Content safety checks passed" or a sanitized
 *     violation count.
 *   - Mandatory legal-boundary notice + SOW-specific footer from
 *     `docs/26` § Required Markings / Disclaimers — non-negotiable
 *     on every render.
 *   - ZERO internal UUIDs in the artifact body, ZERO guard pattern
 *     codes, ZERO e-sign / sign / accept / agree controls, ZERO final
 *     pricing while pricing_review_state is `placeholder`.
 *
 * Pure server component.
 */

export interface SowDraftDocumentProps {
  /** Client / company display name (e.g. `engagement.companyName`). */
  companyName: string;
  /** Engagement type label (e.g. `engagement.engagementType`). */
  engagementType: string;
  snapshot: ProposalDeliverySnapshot;
  /**
   * "operator" (default) renders the operator-internal draft at
   * `/app/.../proposal/sow/[snapshotId]` with the "NOT SENT BY SLATE"
   * banners + operator metadata.
   *
   * "public" renders the client-facing `/s/[token]` surface (Sprint
   * P7-B): the operator-only banners + operator metadata are stripped,
   * the canon-required public disclaimer (`docs/28` § 4) is added at the
   * top with "not authorisation to begin work", the safety strip shows
   * an affirmative-only line, and the DRAFT watermark + legal-boundary
   * notice + mandatory footer stay. It remains a draft — never an
   * executed contract.
   */
  mode?: "operator" | "public";
}

/**
 * `source_context_snapshot` is the proposal-side type plus a
 * `sowDraft` jsonb extension. The mapper preserves unknown keys; we
 * narrow here via a structural check so the renderer can read the SOW
 * fields without changing the base proposal type.
 */
function readSowDraftFromSnapshot(
  snapshot: ProposalDeliverySnapshot,
): SowDraftFields | null {
  const raw = (
    snapshot.sourceContextSnapshot as unknown as {
      sowDraft?: SowDraftFields | null;
    }
  )?.sowDraft;
  return raw ?? null;
}

export function SowDraftDocument({
  companyName,
  engagementType,
  snapshot,
  mode = "operator",
}: SowDraftDocumentProps) {
  const isPublic = mode === "public";
  const includedOptions = snapshot.optionSnapshot.filter(
    (o) => o.includedInArtifact,
  );
  const isVoided = snapshot.status === "voided";
  const isApproved = snapshot.approvalState === "approved";
  const sowDraft = readSowDraftFromSnapshot(snapshot);

  return (
    <div
      data-deliverable-export="sow-draft"
      className={`${deliverableSerif.variable} ${isPublic ? "slate-doc" : ""} mx-auto flex w-full max-w-[52rem] flex-col gap-8 text-text-primary print:max-w-none print:gap-6`}
    >
      {isPublic ? <PublicSowDisclaimer /> : <OperatorSowHint />}
      {isVoided ? <VoidedBanner snapshot={snapshot} /> : null}
      {isPublic ? null : (
        <SowBanner snapshot={snapshot} isApproved={isApproved} />
      )}
      <IdentityHeader
        companyName={companyName}
        engagementType={engagementType}
        snapshot={snapshot}
        isPublic={isPublic}
      />
      {/* Operator-only. The commercial-guard affirmation is internal QA
          signal; on the client `/s` surface it reads as process noise and
          adds nothing the recipient can act on (docs/26 § 176, amended to
          scope the strip operator-only). Guard internals never leak either
          way — share eligibility already requires a passed guard. */}
      {isPublic ? null : (
        <SafetyStrip guard={snapshot.commercialGuardResult} />
      )}
      {/* The operator draft watermark restates draft/not-executed status
          for internal review. On the public surface that message is
          already carried, verbatim per docs/28 § 4, by the header banner
          + body note + closing footer, so the extra callout would only
          duplicate canon copy — it is operator-only. */}
      {!isPublic && snapshot.draftWatermark ? <DraftSowWatermark /> : null}
      <SowDisclosureNotice
        approvalState={snapshot.approvalState}
        pricingReviewState={snapshot.pricingReviewState}
        sowDraft={sowDraft}
        isPublic={isPublic}
      />
      <LegalBoundaryNotice sowDraft={sowDraft} isPublic={isPublic} />
      <SowScopeSection sowDraft={sowDraft} isPublic={isPublic} />
      <SowResponsibilitiesSection sowDraft={sowDraft} />
      <SowOpenQuestionsSection sowDraft={sowDraft} />
      <OptionsList
        options={includedOptions}
        pricingReviewState={snapshot.pricingReviewState}
        isPublic={isPublic}
      />
      {isPublic ? null : (
        <OmittedContentAppendix omissions={snapshot.omittedContent} />
      )}
      <SowFooter isPublic={isPublic} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Operator hint (on-screen only)
// ---------------------------------------------------------------------------

function OperatorSowHint() {
  return (
    <aside
      aria-label="Operator SOW print hint"
      className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-[11px] leading-relaxed text-text-secondary print:hidden"
    >
      <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
        Operator-only SOW Draft ·
      </span>{" "}
      NOT SENT BY SLATE · No client delivery. This is an internal SOW
      Draft snapshot. SLATE does not deliver this artifact to a client.
      Use Ctrl-P / Cmd-P to save a PDF for your own review; disable
      Headers and footers so the SLATE banner remains the page identity.
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Voided banner
// ---------------------------------------------------------------------------

function VoidedBanner({ snapshot }: { snapshot: ProposalDeliverySnapshot }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-status-critical/50 bg-status-critical/10 p-3 text-status-critical print:break-after-avoid print:shadow-none">
      <div className="flex items-start gap-2">
        <Slash className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
            SOW Draft voided · do not use
          </span>
          <p className="text-xs leading-relaxed">
            This SOW Draft was voided
            {snapshot.voidedAt
              ? ` on ${formatTimestamp(snapshot.voidedAt)}`
              : ""}
            {snapshot.voidReason ? `: ${snapshot.voidReason}` : "."} The
            content below is preserved for the audit trail only. Generate
            a fresh SOW Draft from the Past SOW Drafts panel if a new
            scope or pricing conversation is required.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner / identity
// ---------------------------------------------------------------------------

function SowBanner({
  snapshot,
  isApproved,
}: {
  snapshot: ProposalDeliverySnapshot;
  isApproved: boolean;
}) {
  const tone = isApproved ? "success" : "warning";
  const Icon = isApproved ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className={`flex flex-col gap-1 rounded-md border p-3 print:break-after-avoid print:shadow-none ${
        tone === "success"
          ? "border-status-success/50 bg-status-success/10 text-status-success"
          : "border-status-warning/50 bg-status-warning/10 text-status-warning"
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
            Operator-only SOW Draft ·{" "}
            {isApproved ? "operator-approved" : "operator review only"} ·
            not sent by SLATE
          </span>
          <p className="text-xs leading-relaxed">
            Generated {formatTimestamp(snapshot.generatedAt)} for operator
            planning. SLATE does not deliver this artifact to a client.
            This draft is not a contract, not an executed SOW, and not
            authorization to begin work. Final scope, pricing, timeline,
            and terms require written approval and execution by
            authorized parties.
          </p>
        </div>
      </div>
    </div>
  );
}

function IdentityHeader({
  companyName,
  engagementType,
  snapshot,
  isPublic = false,
}: {
  companyName: string;
  engagementType: string;
  snapshot: ProposalDeliverySnapshot;
  isPublic?: boolean;
}) {
  return (
    <header className="flex flex-col gap-6 pb-2 print:break-after-avoid">
      <div className="flex items-center justify-between border-t-2 border-brand-primary pt-4">
        <span className="text-[0.9rem] font-semibold tracking-[0.02em] text-text-primary">
          Saipien&nbsp;Labs
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
          Draft SOW · Not Executed
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <h1
          className={`${SERIF} text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.02em] text-text-primary sm:text-[3.25rem]`}
        >
          {companyName}
        </h1>
        <div className="flex flex-col gap-3">
          <div className="h-px w-16 bg-brand-primary" aria-hidden />
          <p className="text-[0.8rem] font-medium uppercase tracking-[0.2em] text-text-secondary">
            Statement of Work · Draft · {engagementType}
          </p>
          <p className="max-w-xl text-sm leading-relaxed text-text-muted">
            {isPublic
              ? "For review and planning only. Not binding until reviewed, approved, and executed by authorised parties."
              : "For internal review and planning only. Not binding until reviewed, approved, and executed by authorized parties."}
          </p>
        </div>
      </div>

      {isPublic ? (
        // Client surface: show only the issue date. Approval / pricing
        // review / option-count are operator-internal signals.
        <dl className="grid grid-cols-2 gap-x-10 gap-y-4 border-t border-border-subtle pt-6 sm:grid-cols-4">
          <HeaderFact label="Prepared for" value={companyName} />
          <HeaderFact label="Prepared by" value="Saipien Labs" />
          <HeaderFact label="Issued" value={formatTimestamp(snapshot.generatedAt)} />
        </dl>
      ) : (
        <dl className="grid grid-cols-2 gap-x-10 gap-y-4 border-t border-border-subtle pt-6 sm:grid-cols-4">
          <HeaderFact label="Generated" value={formatTimestamp(snapshot.generatedAt)} />
          <HeaderFact label="Approval" value={snapshot.approvalState} />
          <HeaderFact label="Pricing review" value={snapshot.pricingReviewState} />
          <HeaderFact
            label="Options"
            value={`${snapshot.selectedOptionIds.length} included`}
          />
        </dl>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Public-only disclaimer — canon-required at the TOP of /s/[token]
// (docs/28 § 4). "not authorisation to begin work" appears before any
// scope detail; the final line disclaims any execution / signature step.
// ---------------------------------------------------------------------------

function PublicSowDisclaimer() {
  // docs/28 § 4 — canonical, hard-verbatim public copy. The header banner
  // (§ 4 "Header / banner") puts "not authorisation to begin work" before
  // any scope detail; the paragraph is the § 4 "Additional public-only
  // disclaimer" (execution/signature boundary). The § 4 "Body note" is
  // rendered once, below the H1, by SowDisclosureNotice — it is not
  // repeated here.
  return (
    <div className="flex flex-col gap-1 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-status-warning print:break-after-avoid print:shadow-none">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
        Draft SOW · not executed · not authorisation to begin work
      </span>
      <p className="text-xs leading-relaxed">
        This document is for review by the named recipient. SLATE provides
        no execution or signature workflow on this page. Any approval,
        signature, or commencement of work happens through your separate
        contract process.
      </p>
    </div>
  );
}

function HeaderFact({ label, value }: { label: string; value: string }) {
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
// Section rule — hairline + label, matches the report/proposal deliverables
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

// Operator-only (see the call site). Never exposes guard internals to a
// client — but the whole strip is scoped out of the public render, so
// this always renders the operator form.
function SafetyStrip({
  guard,
}: {
  guard: ProposalCommercialGuardResult;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] text-text-secondary print:break-inside-avoid print:shadow-none">
      <span className="inline-flex items-center gap-2 font-mono uppercase tracking-[0.14em] text-text-muted">
        <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
        SOW content safety checks
      </span>
      {guard.passed ? (
        <Badge tone="success">Passed</Badge>
      ) : (
        <Badge tone="risk">
          {guard.violations.length} violation
          {guard.violations.length === 1 ? "" : "s"} — fix before approving
        </Badge>
      )}
      <span className="text-text-muted">
        Scanned {guard.scannedFieldCount} fields against {guard.patternCount}{" "}
        patterns
      </span>
    </div>
  );
}

// Operator-only. On the public `/s` surface the draft/not-executed
// message is carried verbatim by the docs/28 § 4 header banner + body
// note + closing footer, so this callout is not rendered there (it would
// only duplicate canon copy).
function DraftSowWatermark() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-status-warning print:break-inside-avoid print:shadow-none">
      <FileSignature className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
          Draft SOW · operator review pending
        </span>
        <p className="text-xs leading-relaxed">
          This SOW Draft has not yet been operator-approved. Review the
          scope, deliverables, assumptions, and timeline below before
          using the draft in any commercial discussion. Pricing and
          legal terms remain intentionally omitted.
        </p>
      </div>
    </div>
  );
}

function SowDisclosureNotice({
  approvalState,
  pricingReviewState,
  sowDraft,
  isPublic = false,
}: {
  approvalState: ProposalDeliverySnapshot["approvalState"];
  pricingReviewState: ProposalPricingReviewState;
  sowDraft: SowDraftFields | null;
  isPublic?: boolean;
}) {
  const fallbackPricingNote = (() => {
    switch (pricingReviewState) {
      case "manually_approved":
      case "workflow_approved":
        return "Estimated · subject to final approval. Not a binding quote.";
      case "placeholder":
      default:
        return "Pricing is pending manual review and is intentionally omitted from this draft.";
    }
  })();
  const pricingNote = sowDraft?.pricingNotice ?? fallbackPricingNote;
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-2 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
        {/* The "Draft SOW · not executed" label repeats the top header
            banner; on the public surface it is dropped so the label
            appears once. */}
        {isPublic ? null : (
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Draft SOW · not executed
          </span>
        )}
        <p className="text-xs leading-relaxed text-text-secondary">
          {isPublic
            ? // docs/28 § 4 "Body note (canon-required first paragraph
              // below the H1)" — hard-verbatim.
              "This draft is for review and planning only. It is not a contract, not an executed SOW, and not authorisation to begin work. Final scope, pricing, timeline, and terms require written approval and execution by authorised parties."
            : "This document is a draft Statement of Work for internal review and planning. It is not a contract, not an executed SOW, not a binding quote, and not authorization to begin work. Final scope, pricing, timeline, and terms require written approval and execution by authorized parties."}
        </p>
        <p className="text-[11px] leading-relaxed text-text-muted">
          {/* Approval state is an operator-internal signal — never surfaced
              on the client `/s` render. */}
          {isPublic ? pricingNote : `Approval state · ${approvalState}. ${pricingNote}`}
        </p>
      </CardBody>
    </Card>
  );
}

function LegalBoundaryNotice({
  sowDraft,
  isPublic = false,
}: {
  sowDraft: SowDraftFields | null;
  isPublic?: boolean;
}) {
  // Public surface: docs/28 § 4 "Legal-boundary notice" is hard-verbatim
  // and always rendered — it wins over any snapshot override so the client
  // copy is exactly the canonical string.
  //
  // Operator surface: fallback wording mirrors `LEGAL_BOUNDARY_NOTICE` in
  // `lib/proposals/sow-draft-eligibility.ts` — kept inline (rather than
  // imported) so this component remains a pure server component with
  // no cross-module string coupling. Updated alongside the canon source
  // of truth when the wording changes.
  const note = isPublic
    ? "Legal terms (governing law, indemnification, liability, warranty, termination) are intentionally omitted from this draft. They will be provided separately during the execution review process."
    : sowDraft?.legalBoundaryNotice ??
      "Legal terms are intentionally omitted from this draft. Any legal terms will be provided separately during execution review.";
  return (
    <div className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] leading-relaxed text-text-secondary print:break-inside-avoid print:shadow-none">
      <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
          Legal boundary
        </span>
        <p>{note}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SOW-specific sections
// ---------------------------------------------------------------------------

function SowScopeSection({
  sowDraft,
  isPublic = false,
}: {
  sowDraft: SowDraftFields | null;
  isPublic?: boolean;
}) {
  if (!sowDraft) return null;
  return (
    <section
      aria-label="SOW scope and deliverables"
      className="flex flex-col gap-5 print:gap-4"
    >
      <SectionRule label="Scope &amp; deliverables" />
      <Card variant="base">
        <CardBody className="flex flex-col gap-3 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
          {sowDraft.scopeStatement ? (
            <SectionBlock
              label="Scope statement"
              body={sowDraft.scopeStatement}
              note={
                isPublic
                  ? undefined
                  : "Promoted from the source Proposal Candidate's recommended option. Operator may edit in a future SOW editor."
              }
            />
          ) : (
            <PlaceholderBlock
              label="Scope statement"
              hint="No scope statement captured. Add a scope summary to the source proposal option before regenerating."
            />
          )}
          {sowDraft.proposedTimeline ? (
            <SectionBlock
              label="Proposed timeline"
              body={sowDraft.proposedTimeline}
              note="Proposed range only — not a delivery guarantee."
            />
          ) : null}
          {sowDraft.deliverables && sowDraft.deliverables.length > 0 ? (
            <BulletBlock
              label="Deliverables"
              items={[...sowDraft.deliverables]}
            />
          ) : (
            <PlaceholderBlock
              label="Deliverables"
              hint="No deliverables captured. Add deliverables to the included proposal option(s) before regenerating."
            />
          )}
          {sowDraft.assumptions && sowDraft.assumptions.length > 0 ? (
            <BulletBlock
              label="Assumptions"
              items={[...sowDraft.assumptions]}
            />
          ) : null}
          {sowDraft.dependencies && sowDraft.dependencies.length > 0 ? (
            <BulletBlock
              label="Dependencies"
              items={[...sowDraft.dependencies]}
            />
          ) : null}
          {sowDraft.exclusions && sowDraft.exclusions.length > 0 ? (
            <BulletBlock label="Exclusions" items={[...sowDraft.exclusions]} />
          ) : (
            <PlaceholderBlock
              label="Exclusions"
              hint="No exclusions captured. Operator can list explicit out-of-scope items via a future SOW editor."
            />
          )}
        </CardBody>
      </Card>
    </section>
  );
}

function SowResponsibilitiesSection({
  sowDraft,
}: {
  sowDraft: SowDraftFields | null;
}) {
  if (!sowDraft) return null;
  const client = sowDraft.responsibilities?.client ?? [];
  const operator = sowDraft.responsibilities?.operator ?? [];
  if (client.length === 0 && operator.length === 0) {
    return (
      <section
        aria-label="SOW responsibilities"
        className="flex flex-col gap-3"
      >
        <SectionRule label="Responsibilities" />
        <Card variant="base">
          <CardBody className="flex flex-col gap-2 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
            <PlaceholderBlock
              label="Client / operator responsibilities"
              hint="No responsibilities captured yet. Operator can split work between client and operator via a future SOW editor."
            />
          </CardBody>
        </Card>
      </section>
    );
  }
  return (
    <section aria-label="SOW responsibilities" className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Responsibilities (draft)
        </span>
      </header>
      <Card variant="base">
        <CardBody className="grid grid-cols-1 gap-4 p-5 sm:p-6 md:grid-cols-2 print:break-inside-avoid print:shadow-none">
          {client.length > 0 ? (
            <BulletBlock label="Client responsibilities" items={[...client]} />
          ) : (
            <PlaceholderBlock
              label="Client responsibilities"
              hint="No client responsibilities captured."
            />
          )}
          {operator.length > 0 ? (
            <BulletBlock label="Operator responsibilities" items={[...operator]} />
          ) : (
            <PlaceholderBlock
              label="Operator responsibilities"
              hint="No operator responsibilities captured."
            />
          )}
        </CardBody>
      </Card>
    </section>
  );
}

function SowOpenQuestionsSection({
  sowDraft,
}: {
  sowDraft: SowDraftFields | null;
}) {
  if (!sowDraft || !sowDraft.openQuestions || sowDraft.openQuestions.length === 0) {
    return null;
  }
  return (
    <section aria-label="SOW open questions" className="flex flex-col gap-3">
      <SectionRule label="Open questions" />
      <Card variant="base">
        <CardBody className="flex flex-col gap-2 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
          <BulletBlock
            label="Unresolved scope / pricing / dependency items"
            items={[...sowDraft.openQuestions]}
          />
        </CardBody>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Options list (per-option detail preserved for audit + readability)
// ---------------------------------------------------------------------------

function OptionsList({
  options,
  pricingReviewState,
  isPublic = false,
}: {
  options: ProposalOptionSnapshot[];
  pricingReviewState: ProposalPricingReviewState;
  isPublic?: boolean;
}) {
  return (
    <section
      aria-label="Included option detail"
      className="flex flex-col gap-5 print:gap-4 print:break-after-page"
    >
      <header className="flex flex-col gap-2">
        <SectionRule label={`Included option detail (${options.length})`} />
        <p className="max-w-prose text-[11px] leading-relaxed text-text-muted">
          {isPublic
            ? "Scope, deliverables, assumptions, dependencies, and risks for the included option(s)."
            : "Per-option content carried forward from the source Proposal Candidate snapshot. The SOW Draft scope above is the consolidated view; this section preserves the per-option breakdown for audit and operator review."}
        </p>
      </header>

      {options.length === 0 ? (
        <Card variant="base">
          <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              No included options
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              No options are marked as included on this SOW Draft. Either
              every option was excluded by the SOW eligibility evaluator
              or the operator passed an empty selection. Regenerate the
              SOW Draft after selecting at least one approved Proposal
              Candidate option.
            </p>
          </CardBody>
        </Card>
      ) : (
        options.map((option) => (
          <OptionCard
            key={option.optionId}
            option={option}
            pricingReviewState={pricingReviewState}
            isPublic={isPublic}
          />
        ))
      )}
    </section>
  );
}

function OptionCard({
  option,
  pricingReviewState,
  isPublic = false,
}: {
  option: ProposalOptionSnapshot;
  pricingReviewState: ProposalPricingReviewState;
  isPublic?: boolean;
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
        <h3
          className={`${SERIF} text-[1.25rem] font-semibold leading-tight tracking-[-0.01em] text-text-primary`}
        >
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
            label="Estimated timeline"
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
        ) : (
          <div className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-3 text-[11px] leading-relaxed text-text-muted">
            <span className="font-mono uppercase tracking-[0.14em]">
              Pricing
            </span>{" "}
            {isPublic ? (
              <>
                · intentionally omitted from this draft. Final pricing is
                provided separately during commercial review.
              </>
            ) : (
              <>
                · intentionally omitted from this draft. Pricing review
                state is{" "}
                <code className="font-mono">{pricingReviewState}</code>;
                final pricing requires a commercial-approval workflow.
              </>
            )}
          </div>
        )}
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

function PlaceholderBlock({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
        {label}
      </span>
      <p className="text-[11px] leading-relaxed text-text-muted">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Omitted-content appendix
// ---------------------------------------------------------------------------

function OmittedContentAppendix({
  omissions,
}: {
  omissions: ProposalOmittedContent[];
}) {
  if (omissions.length === 0) return null;
  return (
    <section
      aria-label="Intentionally not included"
      className="flex flex-col gap-3 border-t border-border-subtle pt-6 print:break-before-page print:break-after-avoid"
    >
      <header className="flex flex-col gap-2">
        <SectionRule label={`Intentionally not included (${omissions.length})`} />
        <p className="max-w-prose text-xs leading-relaxed text-text-muted">
          Group-B (benchmark / financial) is always omitted from every
          SOW Draft until the relevant data canons advance. Per-option
          omissions list the reason the option was set aside for this
          SOW Draft.
        </p>
      </header>
      <div className="flex flex-col gap-2">
        {omissions.map((omission) => (
          <div
            key={`${omission.scope}-${omission.issueCode}`}
            className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] leading-relaxed text-text-secondary print:break-inside-avoid print:shadow-none"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
                {omission.scope === "group_b_block"
                  ? "Group-B (gated)"
                  : "Option excluded"}
              </span>
              <Badge tone="neutral" variant="outline">
                {omission.reason.replace(/_/g, " ")}
              </Badge>
            </div>
            <p>{omission.operatorFacingNote}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Mandatory SOW footer — per docs/26 § Required Markings / Disclaimers
// ---------------------------------------------------------------------------

function SowFooter({ isPublic = false }: { isPublic?: boolean }) {
  // The closing footer is canon-mandated on both surfaces, but each
  // surface has its own governing canon and spelling:
  //   - Public `/s`: docs/28 § 4 "Closing footer" — hard-verbatim,
  //     British ("authorisation" / "authorised"), single statement.
  //   - Operator: docs/26 § Required Markings mandatory footer — American
  //     ("authorization" / "authorized").
  // Keeping them per-surface is what makes each render internally
  // consistent; a single shared string would violate one canon or the
  // other (this was the British-top / American-footer mismatch on `/s`).
  if (isPublic) {
    return (
      <footer className="flex flex-col gap-1 border-t border-border-subtle pt-4 text-[11px] leading-relaxed text-text-muted print:break-inside-avoid">
        <p>
          Not a contract. Not an executed SOW. Not a binding quote. Not
          authorisation to begin work. Final scope, pricing, timeline, and
          terms require written approval and execution by authorised
          parties.
        </p>
      </footer>
    );
  }
  return (
    <footer className="flex flex-col gap-1 border-t border-border-subtle pt-4 text-[11px] leading-relaxed text-text-muted print:break-inside-avoid">
      <p>
        Not a contract. Not an executed SOW. Not a binding quote. Not
        authorization to begin work.
      </p>
      <p>
        Final scope, pricing, timeline, and terms require written
        approval and execution by authorized parties.
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
