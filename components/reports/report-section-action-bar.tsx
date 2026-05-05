"use client";

import * as React from "react";
import { Check, Eye, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  approveReportSection,
  markReportSectionDrafted,
  markReportSectionFinal,
  markReportSectionNeedsReview,
  type ReportActionResult,
} from "@/lib/reports/actions";
import type { ReportSectionStatus } from "@/lib/reports/types";

export interface ReportSectionActionBarProps {
  sectionId: string;
  status: ReportSectionStatus;
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
}: ReportSectionActionBarProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function run(runner: () => Promise<ReportActionResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await runner();
        if (!result.ok) setError(translateError(result.error));
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

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
      </div>
      {error ? (
        <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
          {error}
        </p>
      ) : null}
      {pending ? (
        <p className="text-[11px] text-text-muted">Saving…</p>
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
