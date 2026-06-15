import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  ShieldCheck,
  Slash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import type { Engagement } from "@/lib/engagements/types";
import type {
  ProposalCommercialGuardResult,
  ProposalDeliverySnapshot,
  ProposalOmittedContent,
  ProposalOptionSnapshot,
  ProposalPricingReviewState,
} from "@/lib/proposals/delivery-snapshot-types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P3 — operator-internal proposal
 * candidate document.
 *
 * Renders a `proposal_delivery_snapshots` row as a print-ready
 * artifact for operator review. This is the operator-only surface;
 * the public client-proposal-share document lands in Sprint P5 and
 * lives in a separate component (`client-proposal-share-document.tsx`).
 *
 * Snapshot purity:
 *   - Renders ONLY from `option_snapshot` / `source_context_snapshot`
 *     / `commercial_guard_result` / `omitted_content` jsonb. No live
 *     proposal-option re-query.
 *   - Reviewer notes excluded by default per canon § Commercial Claim
 *     Guard item 3.
 *   - Pricing is hidden whenever `pricing_review_state='placeholder'`;
 *     shown with "Estimated · subject to final approval" framing when
 *     manually_approved / workflow_approved.
 *   - Commercial-guard codes / pattern families / banned-phrase
 *     surface NEVER reach the rendered HTML. The strip shows only the
 *     affirmative "Content safety checks passed" or a sanitized
 *     violation count ("N violation(s) — fix before approving").
 *   - Mandatory four-denial footer from `docs/24` § Required
 *     Disclaimers / Markings — non-negotiable on every render.
 *
 * Pure server component. SVG-free in this sprint; the artifact is
 * text + cards.
 */

export interface ProposalCandidateDocumentProps {
  engagement: Engagement;
  snapshot: ProposalDeliverySnapshot;
  viewerMode?: "operator" | "client-facing";
}

export function ProposalCandidateDocument({
  engagement,
  snapshot,
  viewerMode = "operator",
}: ProposalCandidateDocumentProps) {
  const includedOptions = snapshot.optionSnapshot.filter(
    (o) => o.includedInArtifact,
  );
  const isVoided = snapshot.status === "voided";
  const isApproved = snapshot.approvalState === "approved";
  const isClient = viewerMode === "client-facing";

  return (
    <div
      data-deliverable-export="proposal-candidate"
      className="flex flex-col gap-8 print:max-w-none print:gap-6"
    >
      <OperatorCandidateHint />
      {isVoided ? <VoidedBanner snapshot={snapshot} /> : null}
      <CandidateBanner
        snapshot={snapshot}
        isApproved={isApproved}
        viewerMode={viewerMode}
      />
      <IdentityHeader
        engagement={engagement}
        snapshot={snapshot}
        viewerMode={viewerMode}
      />
      {!isClient ? <SafetyStrip guard={snapshot.commercialGuardResult} /> : null}
      {snapshot.draftWatermark ? <DraftCandidateWatermark /> : null}
      <ProposalDisclosureNotice
        approvalState={snapshot.approvalState}
        pricingReviewState={snapshot.pricingReviewState}
        viewerMode={viewerMode}
      />
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
      This is an internal proposal candidate snapshot. SLATE does not
      send this artifact to a client. To save a PDF for your own
      review: open Ctrl-P / Cmd-P, set destination to{" "}
      <em>Save as PDF</em>, and disable Headers and footers so the SLATE
      banner remains the page identity.
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
            Proposal candidate voided · do not deliver
          </span>
          <p className="text-xs leading-relaxed">
            This proposal candidate was voided
            {snapshot.voidedAt
              ? ` on ${formatTimestamp(snapshot.voidedAt)}`
              : ""}
            {snapshot.voidReason ? `: ${snapshot.voidReason}` : "."} The
            content below is preserved for the audit trail only. Generate
            a fresh candidate from the proposal page if a new commercial
            discussion is required.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner / identity
// ---------------------------------------------------------------------------

function CandidateBanner({
  snapshot,
  isApproved,
  viewerMode,
}: {
  snapshot: ProposalDeliverySnapshot;
  isApproved: boolean;
  viewerMode: "operator" | "client-facing";
}) {
  if (viewerMode === "client-facing") {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-text-secondary print:break-after-avoid print:shadow-none">
        <div className="flex items-start gap-2">
          <FileSignature
            className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
            aria-hidden
          />
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Proposal · Draft for review
            </span>
            <p className="text-xs leading-relaxed">
              Prepared {formatTimestamp(snapshot.generatedAt)} for
              discussion. Final scope, timing, and pricing will be
              confirmed in writing. Not a binding quote.
            </p>
          </div>
        </div>
      </div>
    );
  }
  const surfaceLabel = (() => {
    switch (snapshot.deliverySurface) {
      case "sow_draft_candidate":
        return "SOW Draft candidate";
      case "internal_candidate":
        return "Internal proposal candidate";
      case "client_proposal_candidate":
      default:
        return "Client-safe proposal candidate";
    }
  })();
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
            {surfaceLabel} ·{" "}
            {isApproved ? "operator-approved" : "operator review only"} ·
            not sent by SLATE
          </span>
          <p className="text-xs leading-relaxed">
            Generated {formatTimestamp(snapshot.generatedAt)} for operator
            review. SLATE does not deliver this artifact to a client. The
            operator is responsible for distribution through their own
            channel once Prepare Client Review unlocks in a future sprint.
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
  snapshot: ProposalDeliverySnapshot;
  viewerMode: "operator" | "client-facing";
}) {
  const isClient = viewerMode === "client-facing";
  return (
    <header className="flex flex-col gap-2 border-b border-border-subtle pb-6 print:break-after-avoid">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
        {isClient
          ? "Proposal · Discussion draft"
          : "AdvisoryOps · Proposal · Operator-internal candidate"}
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-[28px]">
        {engagement.companyName} · {engagement.engagementType} · Proposal
        discussion draft
      </h1>
      {!isClient ? (
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          <span className="text-text-primary">
            Proposal status at generation:{" "}
          </span>
          {snapshot.proposalStatusAtGeneration}
        </p>
      ) : null}
      <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[11px] font-mono uppercase tracking-[0.14em] text-text-muted">
        <span>
          Prepared{" "}
          <span className="text-text-secondary">
            {formatTimestamp(snapshot.generatedAt)}
          </span>
        </span>
        {!isClient ? (
          <>
            <span>
              Approval{" "}
              <span className="text-text-secondary">
                {snapshot.approvalState}
              </span>
            </span>
            <span>
              Pricing review{" "}
              <span className="text-text-secondary">
                {snapshot.pricingReviewState}
              </span>
            </span>
            <span>
              Options{" "}
              <span className="text-text-secondary">
                {snapshot.selectedOptionIds.length} included
              </span>
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
        ) : (
          <span>
            Options{" "}
            <span className="text-text-secondary">
              {snapshot.selectedOptionIds.length} included
            </span>
          </span>
        )}
      </p>
    </header>
  );
}

function SafetyStrip({ guard }: { guard: ProposalCommercialGuardResult }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] text-text-secondary print:break-inside-avoid print:shadow-none">
      <span className="inline-flex items-center gap-2 font-mono uppercase tracking-[0.14em] text-text-muted">
        <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
        Content safety checks
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

function DraftCandidateWatermark() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-status-warning print:break-inside-avoid print:shadow-none">
      <FileSignature className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
          Draft candidate · operator review pending
        </span>
        <p className="text-xs leading-relaxed">
          This candidate has not yet been approved by the operator.
          Approve the candidate from the Past Proposal Candidates panel
          once the included options are commercially aligned.
        </p>
      </div>
    </div>
  );
}

function ProposalDisclosureNotice({
  approvalState,
  pricingReviewState,
  viewerMode,
}: {
  approvalState: ProposalDeliverySnapshot["approvalState"];
  pricingReviewState: ProposalPricingReviewState;
  viewerMode: "operator" | "client-facing";
}) {
  const isClient = viewerMode === "client-facing";
  const pricingNote = (() => {
    switch (pricingReviewState) {
      case "manually_approved":
        return "Pricing has been manually approved by the operator. The client surface frames any price as estimated · subject to final approval.";
      case "workflow_approved":
        return "Pricing has been approved through the commercial workflow. The client surface frames any price as estimated · subject to final approval.";
      case "placeholder":
      default:
        return "Pricing is placeholder. The client surface will hide pricing entirely until a commercial-approval workflow advances this state.";
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
        {!isClient ? (
          <p className="text-[11px] leading-relaxed text-text-muted">
            Approval state · {approvalState}. {pricingNote}
          </p>
        ) : null}
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
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              No included options
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              This snapshot has no options marked for inclusion. Either
              every option was excluded by the eligibility evaluator or
              the operator passed an empty selection. Regenerate after
              marking one option recommended or selecting at least one
              option explicitly.
            </p>
          </CardBody>
        </Card>
      ) : (
        options.map((option) => (
          <OptionCard
            key={option.optionId}
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
            · hidden — pricing review state is{" "}
            <code className="font-mono">{pricingReviewState}</code>. Final
            pricing requires a commercial-approval workflow before it can
            be surfaced.
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
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Intentionally not included ({omissions.length})
        </span>
        <p className="max-w-prose text-xs leading-relaxed text-text-muted">
          Group-B (benchmark / financial) is always omitted from every
          proposal artifact until the relevant data canons advance.
          Per-option omissions list the reason the option was set aside
          for this candidate.
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
// Footer — mandatory four-denial copy per docs/24
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
