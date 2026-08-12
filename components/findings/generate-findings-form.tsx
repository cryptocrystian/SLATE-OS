"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Lock, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  generateDraftFindingsForEngagement,
  type GenerateFindingsResult,
} from "@/lib/findings/synthesis-actions";

export interface FindingsEvidenceSummary {
  totalReadyEvidence: number;
  byLaneCounts: {
    live_link: number;
    transcript: number;
    offline_operator: number;
  };
  crmStatus:
    | "linked"
    | "not-linked"
    | "fetch-failed"
    | "not-configured";
  crmBrand: string | null;
  coveredRequiredRoles: number;
  missingRequiredRoles: string[];
  readinessReady: boolean;
  readinessReasons: string[];
  warnings: string[];
  excludedByTestLabel: number;
}

export interface GenerateFindingsFormProps {
  engagementId: string;
  /** True when the server detected an AI provider key on render. When
   *  false the action button is replaced with a controlled, calm
   *  "AI synthesis is not configured" message. */
  aiConfigured: boolean;
  /** True when there is at least one stakeholder intake response or
   *  document attached. Controls the supporting-copy warning when
   *  evidence is thin. */
  hasIntakeEvidence: boolean;
  /** Sprint S4 — server-resolved evidence bundle summary. Renders the
   *  lane-attribution + readiness-gate panel above the Generate button.
   *  Null when the engagement is in mock fixture mode. */
  evidenceSummary: FindingsEvidenceSummary | null;
}

export function GenerateFindingsForm({
  engagementId,
  aiConfigured,
  hasIntakeEvidence,
  evidenceSummary,
}: GenerateFindingsFormProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [showOverride, setShowOverride] = React.useState(false);
  const [result, setResult] = React.useState<{
    generatedCount: number;
    skippedDuplicateCount: number;
    overrideApplied: boolean;
  } | null>(null);
  const [readinessBlockReasons, setReadinessBlockReasons] = React.useState<
    string[] | null
  >(null);

  const gateRequiresOverride =
    Boolean(evidenceSummary && !evidenceSummary.readinessReady);
  const overrideValid =
    overrideReason.trim().length >= 10 && overrideReason.trim().length <= 500;
  const canGenerate =
    aiConfigured && (!gateRequiresOverride || (showOverride && overrideValid));

  function onClick() {
    if (!canGenerate) return;
    setError(null);
    setReadinessBlockReasons(null);
    setResult(null);
    startTransition(async () => {
      try {
        const response = await generateDraftFindingsForEngagement(
          engagementId,
          gateRequiresOverride
            ? { overrideReason: overrideReason.trim() }
            : {},
        );
        if (response.ok) {
          setResult({
            generatedCount: response.generatedCount,
            skippedDuplicateCount: response.skippedDuplicateCount,
            overrideApplied: response.overrideApplied ?? false,
          });
        } else {
          if (response.error === "intake-readiness-not-met") {
            setReadinessBlockReasons(response.readinessReasons ?? []);
            setShowOverride(true);
          } else {
            setError(translateError(response.error));
          }
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              AI synthesis · findings draft
            </span>
            <h2 className="text-base font-semibold tracking-tight text-text-primary">
              Generate draft findings
            </h2>
            <p className="max-w-prose text-xs leading-relaxed text-text-muted">
              Uses scorecard context, stakeholder intake responses, and document
              metadata. Uploaded files are not parsed yet — only their titles,
              types, and summaries reach the model. Drafts land as{" "}
              <span className="font-medium text-text-secondary">
                Needs Review
              </span>{" "}
              and require operator approval before they can become
              report-ready. Best results come after at least one stakeholder
              completes intake.
            </p>
          </div>
          <Badge tone="ai" variant="outline">
            <Sparkles className="mr-1 h-3 w-3" />
            Draft only · operator review required
          </Badge>
        </div>

        {!aiConfigured ? (
          <div className="flex items-start gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
            <Lock
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-primary">
                AI synthesis is not configured for this environment.
              </span>
              <p className="text-[11px] leading-relaxed text-text-muted">
                Add the provider key server-side (<code className="font-mono">
                  OPENAI_API_KEY
                </code>{" "}
                in <code className="font-mono">.env.local</code>) to enable
                draft generation. Manual finding entry remains available below.
              </p>
            </div>
          </div>
        ) : !hasIntakeEvidence ? (
          <div className="flex items-start gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
            <AlertTriangle
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-status-warning"
            />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-status-warning">
                Limited evidence
              </span>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                No stakeholder intake responses are attached yet. You can
                generate scorecard-only draft findings, but they will be
                assumption-heavy. For a stronger AI pass, capture stakeholder
                input first.
              </p>
              <Link
                href={`/app/engagements/${engagementId}/intake`}
                className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border-strong bg-bg-elevated px-2.5 py-1 text-[11px] font-medium text-text-primary transition-colors hover:border-brand-primary/60 hover:bg-bg-elevated/80"
              >
                Manage intake first
                <ArrowUpRight aria-hidden className="h-3 w-3 text-text-secondary" />
              </Link>
            </div>
          </div>
        ) : null}

        {/* Sprint S4 — Evidence lane panel + readiness gate state. */}
        {evidenceSummary ? (
          <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Synthesis evidence
              </span>
              {evidenceSummary.readinessReady ? (
                <Badge tone="success" variant="outline" dot>
                  Ready
                </Badge>
              ) : (
                <Badge tone="warning" variant="outline" dot>
                  Below readiness threshold
                </Badge>
              )}
              {evidenceSummary.crmStatus === "linked" ? (
                <Badge tone="info" variant="outline">
                  CRM: {evidenceSummary.crmBrand ?? "Linked"}
                </Badge>
              ) : (
                <Badge tone="neutral" variant="outline">
                  CRM: not linked
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <EvidenceStat
                label="Live-link (primary)"
                value={evidenceSummary.byLaneCounts.live_link}
                tone="success"
              />
              <EvidenceStat
                label="Transcript (secondary)"
                value={evidenceSummary.byLaneCounts.transcript}
                tone="info"
              />
              <EvidenceStat
                label="Offline (tertiary)"
                value={evidenceSummary.byLaneCounts.offline_operator}
                tone="neutral"
              />
              <EvidenceStat
                label="Required roles covered"
                value={`${evidenceSummary.coveredRequiredRoles}/6`}
                tone={
                  evidenceSummary.coveredRequiredRoles >= 3
                    ? "success"
                    : "warning"
                }
              />
            </div>
            {evidenceSummary.excludedByTestLabel > 0 ? (
              <p className="text-[11px] text-text-muted">
                {evidenceSummary.excludedByTestLabel} test-labeled response
                {evidenceSummary.excludedByTestLabel === 1 ? "" : "s"} excluded
                from synthesis (audit fixture data).
              </p>
            ) : null}
            {evidenceSummary.warnings.length > 0 ? (
              <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-text-secondary">
                {evidenceSummary.warnings.slice(0, 5).map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-text-muted">·</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {!evidenceSummary.readinessReady &&
            evidenceSummary.readinessReasons.length > 0 ? (
              <div className="flex flex-col gap-1 rounded-md border border-status-warning/40 bg-status-warning/10 p-2">
                <span className="text-[11px] font-medium text-status-warning">
                  Readiness gate blockers
                </span>
                <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-text-secondary">
                  {evidenceSummary.readinessReasons
                    .slice(0, 5)
                    .map((r, i) => (
                      <li key={i}>· {r}</li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Sprint S4 — Operator override input. Surfaced only when the
            gate blocks synthesis. The reason is audit-logged in the
            activity event metadata. */}
        {gateRequiresOverride && (showOverride || readinessBlockReasons) ? (
          <div className="flex flex-col gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3">
            <span className="text-[11px] font-medium text-status-warning">
              Operator override — required to bypass the readiness gate
            </span>
            <p className="text-[11px] leading-relaxed text-text-secondary">
              Synthesis is blocked because the intake readiness gate is not
              met. You may still run synthesis if you supply an audit-logged
              reason (10–500 chars). The reason is persisted in the activity
              timeline and the synthesis run&apos;s input summary.
            </p>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="E.g. 'Approved by partner — running synthesis on partial coverage to test prompt; will re-run when frontline + IT responses land.'"
              className="w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            />
            <p className="text-[10px] leading-relaxed text-text-muted">
              {overrideReason.trim().length}/500 · minimum 10 chars
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-xs text-status-critical">
            {error}
          </p>
        ) : null}
        {result ? (
          <div className="flex flex-col gap-1 rounded-md border border-status-success/40 bg-status-success/10 p-3">
            <span className="text-xs font-medium text-status-success">
              {result.generatedCount > 0
                ? `${result.generatedCount} draft finding${result.generatedCount === 1 ? "" : "s"} added.`
                : "Synthesis ran but produced no new findings."}
            </span>
            {result.overrideApplied ? (
              <span className="text-[11px] leading-relaxed text-status-warning">
                Operator override applied. Reason persisted in activity
                timeline.
              </span>
            ) : null}
            {result.skippedDuplicateCount > 0 ? (
              <span className="text-[11px] leading-relaxed text-text-secondary">
                Skipped {result.skippedDuplicateCount} candidate
                {result.skippedDuplicateCount === 1 ? "" : "s"} matching an
                existing statement.
              </span>
            ) : null}
            {result.generatedCount > 0 ? (
              <span className="text-[11px] leading-relaxed text-text-muted">
                New findings appear below in <span className="font-medium">Needs Review</span>. Approve, edit, or reject each one before marking it report-ready.
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <p className="text-[11px] leading-relaxed text-text-muted">
            Draft findings require operator approval before they become
            report-ready. Synthesis runs are recorded in the activity
            timeline. The model never reads uploaded file contents.
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            leadingIcon={<Sparkles className="h-4 w-4" />}
            onClick={onClick}
            disabled={pending || !canGenerate}
          >
            {pending
              ? "Synthesizing…"
              : gateRequiresOverride && showOverride
                ? "Generate with operator override"
                : "Generate draft findings"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function EvidenceStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "success" | "info" | "warning" | "neutral";
}) {
  const valueClass =
    tone === "success"
      ? "text-status-success"
      : tone === "info"
        ? "text-status-info"
        : tone === "warning"
          ? "text-status-warning"
          : "text-text-primary";
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-page/40 p-2">
      <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
        {label}
      </span>
      <span
        className={`font-mono text-lg font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function translateError(
  code: Exclude<GenerateFindingsResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "ai-not-configured":
      return "AI synthesis is not configured for this environment.";
    case "ai-rate-limited":
      return "AI provider rate-limit reached. Wait a minute and try again.";
    case "ai-timeout":
      return "The AI provider took too long to respond. Try again.";
    case "ai-response-invalid":
      return "The AI response could not be validated. No findings were saved.";
    case "ai-provider-failed":
      return "The AI provider returned an error. No findings were saved.";
    case "engagement-not-found":
    case "invalid-engagement":
      return "This engagement could not be found. Refresh the page and try again.";
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "intake-readiness-not-met":
      return "Intake readiness gate is not met. Supply an audit-logged override reason below to proceed.";
    case "override-reason-invalid":
      return "Override reason must be between 10 and 500 characters.";
    case "service-error":
    default:
      return "We couldn't run synthesis. Please try again.";
  }
}
