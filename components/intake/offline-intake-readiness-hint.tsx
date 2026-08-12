import * as React from "react";
import { ListChecks } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OfflineIntakeReadinessSummary } from "@/lib/intake/offline-queries";

/**
 * Sprint I3 — Operator-only readiness hint for offline intake.
 *
 * Canon: docs/35 § 5 + docs/37 § 5. Shows offline stakeholder counts,
 * ready-response counts, and the reminder that findings synthesis is
 * gated behind operator promotion. Never surfaced to the client.
 *
 * Server component — receives the pre-aggregated summary as a prop.
 */

export interface OfflineIntakeReadinessHintProps {
  summary: OfflineIntakeReadinessSummary;
}

export function OfflineIntakeReadinessHint({
  summary,
}: OfflineIntakeReadinessHintProps) {
  const {
    offlineSessionCount,
    sessionsWithReadyResponse,
    draftResponseCount,
    readyResponseCount,
    documentCount,
  } = summary;

  const totalResponses =
    draftResponseCount + readyResponseCount + summary.supersededResponseCount;

  const isEmpty =
    offlineSessionCount === 0 && totalResponses === 0 && documentCount === 0;

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ListChecks className="h-4 w-4 text-status-info" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Offline intake readiness
          </span>
          <Badge tone="neutral" variant="outline">
            Operator-only
          </Badge>
        </div>

        {isEmpty ? (
          <p className="text-xs leading-relaxed text-text-muted">
            No offline intake yet. Stage a stakeholder whose intake happened
            outside SLATE (meeting, transcript, email thread, document review)
            to capture their perspective for findings synthesis.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ReadinessStat
              label="Offline stakeholders"
              value={offlineSessionCount}
            />
            <ReadinessStat
              label="Sessions with ready response"
              value={sessionsWithReadyResponse}
              tone={
                sessionsWithReadyResponse > 0 ? "success" : undefined
              }
            />
            <ReadinessStat
              label="Drafts pending review"
              value={draftResponseCount}
              tone={draftResponseCount > 0 ? "warning" : undefined}
            />
            <ReadinessStat
              label="Ready responses"
              value={readyResponseCount}
              tone={readyResponseCount > 0 ? "success" : undefined}
            />
            <ReadinessStat
              label="Documents available"
              value={documentCount}
            />
            <ReadinessStat
              label="Superseded"
              value={summary.supersededResponseCount}
            />
            <ReadinessStat label="Voided" value={summary.voidedResponseCount} />
          </div>
        )}

        <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-[11px] leading-relaxed text-text-secondary">
          <p>
            <span className="font-medium text-text-primary">
              Synthesis gate:
            </span>{" "}
            AI findings synthesis only consumes responses marked{" "}
            <em>ready for synthesis</em>. Drafts and voided responses are
            skipped. Documents feed synthesis context but are never shown on
            client-facing routes.
          </p>
          <p>
            <span className="font-medium text-text-primary">
              Client-visible:
            </span>{" "}
            Offline rows never appear on the client report or proposal until
            you explicitly clear them through the docs/35 § 5 readiness gate.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

interface ReadinessStatProps {
  label: string;
  value: number;
  tone?: "success" | "warning";
}

function ReadinessStat({ label, value, tone }: ReadinessStatProps) {
  const valueClass =
    tone === "success"
      ? "text-status-success"
      : tone === "warning"
        ? "text-status-warning"
        : "text-text-primary";
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
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
