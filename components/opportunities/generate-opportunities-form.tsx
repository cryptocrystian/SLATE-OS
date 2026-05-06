"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Lock, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  generateDraftOpportunitiesForEngagement,
  type GenerateOpportunitiesResult,
} from "@/lib/opportunities/synthesis-actions";

export interface GenerateOpportunitiesFormProps {
  engagementId: string;
  /** True when the server detected an AI provider key on render. */
  aiConfigured: boolean;
  /** True when at least one approved or report-ready finding exists.
   *  When false the form renders controlled guidance and disables the
   *  CTA so we never invoke the provider on empty evidence. */
  hasApprovedFindings: boolean;
}

export function GenerateOpportunitiesForm({
  engagementId,
  aiConfigured,
  hasApprovedFindings,
}: GenerateOpportunitiesFormProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    generatedCount: number;
    skippedDuplicateCount: number;
  } | null>(null);

  const cannotGenerate = !aiConfigured || !hasApprovedFindings;

  function onClick() {
    if (cannotGenerate) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const response =
          await generateDraftOpportunitiesForEngagement(engagementId);
        if (response.ok) {
          setResult({
            generatedCount: response.generatedCount,
            skippedDuplicateCount: response.skippedDuplicateCount,
          });
        } else {
          setError(translateError(response.error));
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
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              AI synthesis · opportunity draft
            </span>
            <h2 className="text-base font-semibold tracking-tight text-text-primary">
              Generate draft opportunities
            </h2>
            <p className="max-w-prose text-xs leading-relaxed text-text-muted">
              Uses approved and report-ready findings as evidence. Drafts must
              still be selected, deferred, or rejected by an operator before
              they enter the roadmap. Quadrant and priority are derived
              server-side from the model&rsquo;s scores — high risk overrides
              quadrant placement.
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
                AI opportunity drafting is not configured for this environment.
              </span>
              <p className="text-[11px] leading-relaxed text-text-muted">
                Add the provider key server-side (
                <code className="font-mono">OPENAI_API_KEY</code> in{" "}
                <code className="font-mono">.env.local</code>) to enable draft
                generation. Manual opportunity creation remains available below.
              </p>
            </div>
          </div>
        ) : !hasApprovedFindings ? (
          <div className="flex items-start gap-3 rounded-md border border-status-warning/30 bg-status-warning/10 p-3">
            <AlertTriangle
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-status-warning"
            />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-status-warning">
                No approved findings yet
              </span>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Approve or mark findings report-ready before drafting
                opportunities. AI opportunity drafts use only consultant-reviewed
                findings as evidence.
              </p>
              <Link
                href={`/app/engagements/${engagementId}/findings`}
                className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border-strong bg-bg-elevated px-2.5 py-1 text-[11px] font-medium text-text-primary transition-colors hover:border-brand-primary/60 hover:bg-bg-elevated/80"
              >
                Open findings workspace
                <ArrowUpRight aria-hidden className="h-3 w-3 text-text-secondary" />
              </Link>
            </div>
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
                ? `${result.generatedCount} draft opportunit${result.generatedCount === 1 ? "y" : "ies"} added.`
                : "Synthesis ran but produced no new opportunities."}
            </span>
            {result.skippedDuplicateCount > 0 ? (
              <span className="text-[11px] leading-relaxed text-text-secondary">
                Skipped {result.skippedDuplicateCount} candidate
                {result.skippedDuplicateCount === 1 ? "" : "s"} matching an
                existing opportunity title.
              </span>
            ) : null}
            {result.generatedCount > 0 ? (
              <span className="text-[11px] leading-relaxed text-text-muted">
                New opportunities appear below in{" "}
                <span className="font-medium">Draft</span>. Select, defer, or
                reject each one before it enters the roadmap.
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <p className="text-[11px] leading-relaxed text-text-muted">
            Synthesis runs are recorded in the activity timeline. The model
            never reads uploaded file contents.
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            leadingIcon={<Sparkles className="h-4 w-4" />}
            onClick={onClick}
            disabled={pending || cannotGenerate}
          >
            {pending ? "Synthesizing…" : "Generate draft opportunities"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function translateError(
  code: Exclude<GenerateOpportunitiesResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "ai-not-configured":
      return "AI opportunity drafting is not configured for this environment.";
    case "no-approved-findings":
      return "Approve or mark findings report-ready before drafting opportunities.";
    case "ai-rate-limited":
      return "AI provider rate-limit reached. Wait a minute and try again.";
    case "ai-timeout":
      return "The AI provider took too long to respond. Try again.";
    case "ai-response-invalid":
      return "The AI response could not be validated. No opportunities were saved.";
    case "ai-provider-failed":
      return "The AI provider returned an error. No opportunities were saved.";
    case "engagement-not-found":
    case "invalid-engagement":
      return "This engagement could not be found. Refresh the page and try again.";
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "service-error":
    default:
      return "We couldn't run synthesis. Please try again.";
  }
}
