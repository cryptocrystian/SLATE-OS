"use client";

import * as React from "react";
import { Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  markProposalOptionRecommended,
  type ProposalActionResult,
} from "@/lib/proposals/actions";
import {
  generateProposalOptionDraftAction,
  type GenerateProposalOptionResult,
} from "@/lib/proposals/synthesis-actions";

export interface ProposalOptionActionBarProps {
  optionId: string;
  recommended: boolean;
  /**
   * Persisted UUID engagement id. Required for AI drafting; if absent
   * (legacy slug demo engagement), the AI control is hidden so mock
   * paths never trigger an LLM call.
   */
  engagementId?: string;
  /**
   * Whether the server has confirmed `OPENAI_API_KEY` is configured.
   * The AI control is hidden when false so operators don't see a
   * trigger they cannot run.
   */
  aiAvailable?: boolean;
}

export function ProposalOptionActionBar({
  optionId,
  recommended,
  engagementId,
  aiAvailable,
}: ProposalOptionActionBarProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  function run(runner: () => Promise<ProposalActionResult>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await runner();
        if (!result.ok) setError(translateError(result.error));
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function runAiDraft() {
    if (!engagementId) {
      setError("AI drafting is only available for persisted engagements.");
      return;
    }
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await generateProposalOptionDraftAction({
          engagementId,
          optionId,
        });
        if (result.ok) {
          setNotice(
            `AI draft generated (${result.provider} · ${result.model}). Pricing, recommendation, and option type were preserved. Operator review required before any client-facing action.`,
          );
        } else {
          setError(translateAiError(result.error));
        }
      } catch {
        setError("AI drafting failed unexpectedly. Please try again.");
      }
    });
  }

  // AI control surfaces only when (a) the engagement is a persisted
  // UUID and (b) the server has confirmed OPENAI_API_KEY is configured.
  // Mock paths and unconfigured environments hide it entirely.
  const showAiControl = Boolean(engagementId) && Boolean(aiAvailable);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
          Recommendation
        </span>
        <Badge tone={recommended ? "success" : "neutral"} dot>
          {recommended ? "Recommended" : "Not recommended"}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<Star className="h-3.5 w-3.5" />}
          disabled={pending || recommended}
          onClick={() => run(() => markProposalOptionRecommended(optionId))}
        >
          Mark recommended
        </Button>
        {showAiControl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<Sparkles className="h-3.5 w-3.5" />}
            disabled={pending}
            onClick={runAiDraft}
            title="Generate AI draft. Pricing, recommendation, and option type are preserved. Operator review required."
          >
            Generate AI draft
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-status-success/40 bg-status-success/10 p-2 text-[11px] text-status-success">
          {notice}
        </p>
      ) : null}
      {pending ? (
        <p className="text-[11px] text-text-muted">Working…</p>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<ProposalActionResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "option-not-found":
      return "This option could not be found.";
    case "invalid-option":
      return "Invalid option reference.";
    case "service-error":
    default:
      return "We couldn't update the option. Please try again.";
  }
}

function translateAiError(
  code: Exclude<GenerateProposalOptionResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-engagement":
    case "engagement-not-found":
      return "Engagement not found. AI drafting requires a persisted engagement.";
    case "invalid-option":
    case "option-not-found":
      return "Proposal option not found.";
    case "proposal-not-found":
      return "Initialize the proposal before generating AI drafts.";
    case "ai-not-configured":
      return "AI is not configured for this environment.";
    case "ai-rate-limited":
      return "AI provider rate-limited the request. Try again shortly.";
    case "ai-timeout":
      return "AI request timed out. Try again.";
    case "ai-response-invalid":
      return "AI returned an invalid draft and the response was discarded.";
    case "ai-claim-violation":
      return "AI draft was rejected because it included gated benchmark, financial, or commercial-finality language.";
    case "ai-provider-failed":
      return "AI provider request failed. Try again.";
    case "service-error":
    default:
      return "AI drafting failed. Please try again.";
  }
}
