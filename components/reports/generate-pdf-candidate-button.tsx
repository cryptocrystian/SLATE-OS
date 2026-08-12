"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, FileText, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ReportExhibitSlot } from "@/lib/charts/adapters/types";
import {
  generateReportPdfCandidateAction,
  type GenerateReportPdfCandidateResult,
} from "@/lib/reports/pdf-candidate-actions";

export interface GeneratePdfCandidateButtonProps {
  engagementId: string;
}

/**
 * Phase 1B Sprint 4C-B — operator-only client trigger for the report
 * PDF candidate snapshot.
 *
 * Replaces the previous `LockedActionButton label="Export Report"` for
 * persisted UUID engagements only. Sibling locked controls
 * (`Send to Client` on /proposal, `Prepare SOW Draft`,
 * `Prepare Client Review`, `Prepare Report` on /roadmap) are
 * unchanged.
 *
 * The button:
 *   - calls `generateReportPdfCandidateAction` via React transition
 *   - surfaces inline success notice + a link to the candidate route
 *   - surfaces inline error notice with the readiness blockers /
 *     stale-acceptance hint / claim-guard violations
 *   - never sends anything to a client
 *   - never produces a PDF binary
 */
export function GeneratePdfCandidateButton({
  engagementId,
}: GeneratePdfCandidateButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] =
    React.useState<GenerateReportPdfCandidateResult | null>(null);
  // Sprint 4C-D — stale-acceptance retry UX. When the server returns
  // `stale-acceptance-required`, the inline failure notice surfaces a
  // checkbox per stale slot; ticking + retrying calls the action again
  // with `acceptedStaleSlots[]`. Acceptance is always explicit; the
  // checkbox state resets when the operator clicks Generate again from
  // scratch.
  const [acceptedStaleSlots, setAcceptedStaleSlots] = React.useState<
    Set<ReportExhibitSlot>
  >(new Set());

  function run(slots?: ReportExhibitSlot[]) {
    setResult(null);
    startTransition(async () => {
      try {
        const r = await generateReportPdfCandidateAction({
          engagementId,
          acceptedStaleSlots: slots ?? [],
        });
        setResult(r);
        // On success or terminal failure, drop the stale-acceptance
        // selection so a subsequent generation starts clean.
        if (r.ok || r.error !== "stale-acceptance-required") {
          setAcceptedStaleSlots(new Set());
        }
      } catch {
        setResult({ ok: false, error: "service-error" });
        setAcceptedStaleSlots(new Set());
      }
    });
  }

  function onGenerateClick() {
    setAcceptedStaleSlots(new Set());
    run([]);
  }

  function onToggleSlot(slot: ReportExhibitSlot, next: boolean) {
    setAcceptedStaleSlots((prev) => {
      const updated = new Set(prev);
      if (next) updated.add(slot);
      else updated.delete(slot);
      return updated;
    });
  }

  function onRetryWithAcceptance() {
    run(Array.from(acceptedStaleSlots));
  }

  const needsStaleAcceptance =
    !!result && !result.ok && result.error === "stale-acceptance-required";
  const staleSlots = needsStaleAcceptance
    ? (result.staleSlots ?? [])
    : ([] as ReportExhibitSlot[]);
  const allStaleAccepted =
    staleSlots.length > 0 && staleSlots.every((s) => acceptedStaleSlots.has(s));

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="primary"
        size="md"
        leadingIcon={<FileText className="h-4 w-4" />}
        disabled={pending}
        onClick={onGenerateClick}
      >
        {pending ? "Generating…" : "Generate PDF Candidate"}
      </Button>

      {result?.ok ? (
        <SuccessNotice
          engagementId={engagementId}
          snapshotId={result.snapshotId}
          draftWatermark={result.draftWatermark}
          includedSectionCount={result.includedSectionCount}
          includedExhibitCount={result.includedExhibitCount}
        />
      ) : null}

      {needsStaleAcceptance ? (
        <StaleAcceptancePrompt
          staleSlots={staleSlots}
          accepted={acceptedStaleSlots}
          onToggle={onToggleSlot}
          onRetry={onRetryWithAcceptance}
          allAccepted={allStaleAccepted}
          pending={pending}
        />
      ) : result && !result.ok ? (
        <FailureNotice result={result} />
      ) : null}
    </div>
  );
}

function StaleAcceptancePrompt({
  staleSlots,
  accepted,
  onToggle,
  onRetry,
  allAccepted,
  pending,
}: {
  staleSlots: ReportExhibitSlot[];
  accepted: Set<ReportExhibitSlot>;
  onToggle: (slot: ReportExhibitSlot, next: boolean) => void;
  onRetry: () => void;
  allAccepted: boolean;
  pending: boolean;
}) {
  return (
    <div className="flex max-w-md flex-col gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-[11px] leading-relaxed text-status-warning">
      <span className="uppercase tracking-[0.16em]">
        Stale source data needs acceptance
      </span>
      <p className="text-text-secondary">
        One or more Group-A slots returned stale source data (older than
        the 7-day freshness window). Tick each slot to acknowledge the
        staleness; the candidate artifact will carry a visible
        &ldquo;Source data may be stale — accepted by operator&rdquo;
        marker for each accepted slot.
      </p>
      <ul className="flex flex-col gap-1.5">
        {staleSlots.map((slot) => (
          <li key={slot}>
            <label className="flex items-start gap-2 text-text-secondary">
              <input
                type="checkbox"
                checked={accepted.has(slot)}
                onChange={(e) => onToggle(slot, e.target.checked)}
                disabled={pending}
                className="mt-0.5"
              />
              <code className="text-[10px] uppercase tracking-[0.12em]">
                {slot}
              </code>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<FileText className="h-3.5 w-3.5" />}
          disabled={pending || !allAccepted}
          onClick={onRetry}
        >
          {pending
            ? "Generating…"
            : allAccepted
              ? "Retry with accepted slots"
              : "Accept all to retry"}
        </Button>
      </div>
    </div>
  );
}

function SuccessNotice({
  engagementId,
  snapshotId,
  draftWatermark,
  includedSectionCount,
  includedExhibitCount,
}: {
  engagementId: string;
  snapshotId: string;
  draftWatermark: boolean;
  includedSectionCount: number;
  includedExhibitCount: number;
}) {
  const href = `/app/engagements/${engagementId}/report/pdf-candidate/${snapshotId}`;
  return (
    <div className="flex max-w-md flex-col gap-2 rounded-md border border-status-success/40 bg-status-success/10 p-3 text-[11px] leading-relaxed text-status-success">
      <span className="text-[11px] uppercase tracking-[0.16em]">
        Candidate snapshot ready
      </span>
      <p className="text-text-secondary">
        Operator-only candidate generated.{" "}
        {includedSectionCount} sections + {includedExhibitCount} exhibit{" "}
        {includedExhibitCount === 1 ? "slot" : "slots"} included.{" "}
        {draftWatermark
          ? "Draft Candidate watermark applied. "
          : ""}
        SLATE does not send this artifact to a client.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href} target="_blank" rel="noopener noreferrer">
          <Button
            variant="secondary"
            size="sm"
            trailingIcon={<ExternalLink className="h-3.5 w-3.5" />}
          >
            Open candidate
          </Button>
        </Link>
        {draftWatermark ? (
          <Badge tone="warning" variant="outline">
            Draft watermark
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function FailureNotice({
  result,
}: {
  result: Exclude<GenerateReportPdfCandidateResult, { ok: true }>;
}) {
  return (
    <div className="flex max-w-md flex-col gap-2 rounded-md border border-status-risk/40 bg-status-risk/10 p-3 text-[11px] leading-relaxed text-status-risk">
      <div className="flex items-center gap-2">
        <ShieldAlert aria-hidden className="h-3.5 w-3.5" />
        <span className="uppercase tracking-[0.16em]">
          {translateError(result.error)}
        </span>
      </div>
      {result.error === "claim-guard-violation" && result.violations ? (
        <ul className="flex flex-col gap-1 text-text-secondary">
          {result.violations.slice(0, 6).map((v, i) => (
            <li key={`${v.field}-${v.code}-${i}`} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-risk"
              />
              <span>
                <code className="font-mono text-[10px]">{v.code}</code>{" "}
                · <span className="text-text-muted">{v.field}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {result.error === "stale-acceptance-required" && result.staleSlots ? (
        <p className="text-text-secondary">
          Stale slots: {result.staleSlots.join(", ")}. Explicit stale
          acceptance UX lands in a future sprint; refresh the source
          rows or wait for an updated freshness window.
        </p>
      ) : null}
      {result.error === "readiness-blocked" && result.blockers ? (
        <ul className="flex flex-col gap-1 text-text-secondary">
          {result.blockers
            .filter((b) => b.severity === "error")
            .slice(0, 6)
            .map((b, i) => (
              <li key={`${b.code}-${i}`} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-risk"
                />
                <span>{b.message}</span>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<GenerateReportPdfCandidateResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Session expired";
    case "invalid-engagement":
      return "Invalid engagement";
    case "engagement-not-found":
      return "Engagement not found";
    case "report-not-found":
      return "Initialize the report outline first";
    case "readiness-blocked":
      return "R2 readiness blocked";
    case "stale-acceptance-required":
      return "Stale source data needs acceptance";
    case "claim-guard-violation":
      return "Claim guard rejected the candidate";
    case "service-error":
    default:
      return "Generation failed";
  }
}
