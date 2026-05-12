"use client";

import * as React from "react";
import { Check, Eye, Lock, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  approveReportSection,
  markReportSectionDrafted,
  markReportSectionFinal,
  markReportSectionNeedsReview,
  type ReportActionResult,
} from "@/lib/reports/actions";
import {
  generateReportSectionDraftAction,
  type GenerateReportSectionResult,
} from "@/lib/reports/synthesis-actions";
import type { ReportSectionStatus } from "@/lib/reports/types";

export interface ReportSectionActionBarProps {
  sectionId: string;
  status: ReportSectionStatus;
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

const STATUS_LABEL: Record<ReportSectionStatus, string> = {
  "not-started": "Not Started",
  drafted: "Drafted",
  "needs-review": "Needs Review",
  approved: "Approved",
  final: "Final",
};

const STATUS_TONE: Record<
  ReportSectionStatus,
  "neutral" | "info" | "warning" | "success" | "brand"
> = {
  "not-started": "neutral",
  drafted: "info",
  "needs-review": "warning",
  approved: "success",
  final: "brand",
};

export function ReportSectionActionBar({
  sectionId,
  status,
  engagementId,
  aiAvailable,
}: ReportSectionActionBarProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  function run(runner: () => Promise<ReportActionResult>) {
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
        const result = await generateReportSectionDraftAction({
          engagementId,
          sectionId,
        });
        if (result.ok) {
          setNotice(
            `AI draft generated (${result.provider} · ${result.model}). Section moved to needs-review for operator approval.`,
          );
        } else {
          setError(translateAiError(result.error));
        }
      } catch {
        setError("AI drafting failed unexpectedly. Please try again.");
      }
    });
  }

  // AI control rules — operator-only persisted engagements with the
  // provider configured. Final sections are NOT draftable: the safe
  // default per docs/17 § Acceptance Criteria. The operator must demote
  // before regenerating.
  const showAiControl = Boolean(engagementId) && Boolean(aiAvailable);
  const aiDisabled = pending || status === "final";

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
          Section review
        </span>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<Check className="h-3.5 w-3.5" />}
          disabled={pending || status === "approved" || status === "final"}
          onClick={() => run(() => approveReportSection(sectionId))}
        >
          Approve section
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leadingIcon={<Eye className="h-3.5 w-3.5" />}
          disabled={pending || status === "needs-review"}
          onClick={() => run(() => markReportSectionNeedsReview(sectionId))}
        >
          Needs review
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<Pencil className="h-3.5 w-3.5" />}
          disabled={pending || status === "drafted"}
          onClick={() => run(() => markReportSectionDrafted(sectionId))}
        >
          Mark drafted
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<Lock className="h-3.5 w-3.5" />}
          disabled={pending || status !== "approved"}
          onClick={() => run(() => markReportSectionFinal(sectionId))}
        >
          Lock as final
        </Button>
        {showAiControl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<Sparkles className="h-3.5 w-3.5" />}
            disabled={aiDisabled}
            onClick={runAiDraft}
            title={
              status === "final"
                ? "Final sections cannot be redrafted — demote first."
                : "Generate AI draft. Output requires operator review."
            }
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
  code: Exclude<ReportActionResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "section-not-found":
      return "This section could not be found.";
    case "invalid-section":
      return "Invalid section reference.";
    case "service-error":
    default:
      return "We couldn't update the section. Please try again.";
  }
}

function translateAiError(
  code: Exclude<GenerateReportSectionResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-engagement":
    case "engagement-not-found":
      return "Engagement not found. AI drafting requires a persisted engagement.";
    case "invalid-section":
    case "section-not-found":
      return "Report section not found.";
    case "report-not-found":
      return "Initialize the report outline before generating AI drafts.";
    case "section-is-final":
      return "This section is locked as final. Demote it before regenerating.";
    case "ai-not-configured":
      return "AI is not configured for this environment.";
    case "ai-rate-limited":
      return "AI provider rate-limited the request. Try again shortly.";
    case "ai-timeout":
      return "AI request timed out. Try again.";
    case "ai-response-invalid":
      return "AI returned an invalid draft and the response was discarded.";
    case "ai-claim-violation":
      return "AI draft was rejected because it included gated benchmark or financial language.";
    case "ai-provider-failed":
      return "AI provider request failed. Try again.";
    case "service-error":
    default:
      return "AI drafting failed. Please try again.";
  }
}
