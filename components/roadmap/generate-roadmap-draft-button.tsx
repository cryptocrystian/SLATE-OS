"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateRoadmapDraftAction,
  type GenerateRoadmapDraftResult,
} from "@/lib/roadmap/synthesis-actions";

/**
 * Engagement-level "Generate AI roadmap draft" trigger — AI Synthesis
 * Step 5.
 *
 * Renders only on persisted UUID engagements when `aiAvailable` is true
 * (the page already gates on `isAiConfigured()` server-side). The
 * action appends a small set of planned roadmap items; existing items
 * are never modified, deleted, reordered, or finalized.
 */
export interface GenerateRoadmapDraftButtonProps {
  engagementId: string;
}

export function GenerateRoadmapDraftButton({
  engagementId,
}: GenerateRoadmapDraftButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  function run() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await generateRoadmapDraftAction({ engagementId });
        if (result.ok) {
          const itemLabel = result.generatedCount === 1 ? "item" : "items";
          const dupNote =
            result.skippedDuplicateCount > 0
              ? ` ${result.skippedDuplicateCount} duplicate${result.skippedDuplicateCount === 1 ? "" : "s"} skipped.`
              : "";
          setNotice(
            `AI drafted ${result.generatedCount} planned roadmap ${itemLabel} (${result.provider} · ${result.model}). Existing items were not modified.${dupNote} All new items are status=planned and require operator review.`,
          );
        } else {
          setError(translateAiError(result.error));
        }
      } catch {
        setError("AI roadmap drafting failed unexpectedly. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
          AI roadmap draft
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<Sparkles className="h-3.5 w-3.5" />}
          disabled={pending}
          onClick={run}
          title="Generate planned roadmap items from approved findings and selected opportunities. Existing items are preserved."
        >
          Generate AI roadmap draft
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-text-muted">
        Appends planned items only. Existing items, their status, and their links are preserved verbatim. All new items require operator review before any client-facing action.
      </p>
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

function translateAiError(
  code: Exclude<GenerateRoadmapDraftResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-engagement":
    case "engagement-not-found":
      return "Engagement not found. AI drafting requires a persisted engagement.";
    case "ai-not-configured":
      return "AI is not configured for this environment.";
    case "ai-rate-limited":
      return "AI provider rate-limited the request. Try again shortly.";
    case "ai-timeout":
      return "AI request timed out. Try again.";
    case "ai-response-invalid":
      return "AI returned no valid roadmap items and the response was discarded.";
    case "ai-claim-violation":
      return "AI draft was rejected because it included gated benchmark, financial, commercial-finality, or delivery-commitment language.";
    case "ai-provider-failed":
      return "AI provider request failed. Try again.";
    case "service-error":
    default:
      return "AI drafting failed. Please try again.";
  }
}
