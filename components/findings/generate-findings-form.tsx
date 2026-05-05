"use client";

import * as React from "react";
import { AlertTriangle, Lock, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  generateDraftFindingsForEngagement,
  type GenerateFindingsResult,
} from "@/lib/findings/synthesis-actions";

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
}

export function GenerateFindingsForm({
  engagementId,
  aiConfigured,
  hasIntakeEvidence,
}: GenerateFindingsFormProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    generatedCount: number;
    skippedDuplicateCount: number;
  } | null>(null);

  function onClick() {
    if (!aiConfigured) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const response = await generateDraftFindingsForEngagement(engagementId);
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
              report-ready.
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
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-status-warning">
                Limited evidence
              </span>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                No stakeholder intake responses are attached yet. Synthesis
                will run on scorecard context only — most candidates will be
                flagged as assumptions until intake responses land.
              </p>
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
                ? `${result.generatedCount} draft finding${result.generatedCount === 1 ? "" : "s"} added.`
                : "Synthesis ran but produced no new findings."}
            </span>
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
            Synthesis runs are recorded in the activity timeline. The model
            never reads uploaded file contents.
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            leadingIcon={<Sparkles className="h-4 w-4" />}
            onClick={onClick}
            disabled={pending || !aiConfigured}
          >
            {pending ? "Synthesizing…" : "Generate draft findings"}
          </Button>
        </div>
      </CardBody>
    </Card>
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
    case "service-error":
    default:
      return "We couldn't run synthesis. Please try again.";
  }
}
