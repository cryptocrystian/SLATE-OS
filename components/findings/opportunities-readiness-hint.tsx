import * as React from "react";
import { ListChecks, ShieldAlert, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OpportunitiesReadinessSignal } from "@/lib/findings/provenance";

/**
 * Sprint S5 — Operator-only readiness signal for the not-yet-built
 * Sprint S6 opportunities drafting surface.
 *
 * Canon: `docs/44_FINDINGS_APPROVAL_POLISH.md` § 5 + `docs/39` § 5.
 *
 * Read-only hint card — does NOT block S6 (S6 is not yet implemented;
 * this surface only tells the operator how close to "drafting-ready"
 * the current findings set is). Renders four counts (approved /
 * rejected / draft / approved-needs-validation), a Ready / Not-yet
 * status chip, and the helper's advisory warnings.
 *
 * Boundary:
 *   - Never renders raw stakeholder text, raw rejection reasons, or
 *     CRM data. Only counts + non-PII status flags.
 *   - This is a pure presentation component; logic lives in the
 *     `buildOpportunitiesReadinessSignal` pure helper.
 */

export interface OpportunitiesReadinessHintProps {
  signal: OpportunitiesReadinessSignal;
}

export function OpportunitiesReadinessHint({
  signal,
}: OpportunitiesReadinessHintProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ListChecks className="h-4 w-4 text-status-info" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Opportunities readiness
          </span>
          <Badge tone="neutral" variant="outline">
            Operator-only
          </Badge>
          {signal.readyForS6 ? (
            <Badge tone="success" variant="outline" dot>
              <Sparkles className="mr-1 h-2.5 w-2.5" />
              Ready for opportunities drafting
            </Badge>
          ) : (
            <Badge tone="warning" variant="outline" dot>
              Not yet
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReadinessStat
            label="Approved"
            value={signal.approved}
            tone={signal.approved > 0 ? "success" : undefined}
          />
          <ReadinessStat
            label="Rejected"
            value={signal.rejected}
          />
          <ReadinessStat
            label="Still in review"
            value={signal.draft}
            tone={signal.draft > 0 ? "warning" : undefined}
          />
          <ReadinessStat
            label="Approved · needs validation"
            value={signal.approvedNeedsValidation}
            tone={signal.approvedNeedsValidation > 0 ? "warning" : undefined}
          />
        </div>

        {signal.warnings.length > 0 ? (
          <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              <ShieldAlert className="h-3 w-3" />
              <span className="uppercase tracking-[0.16em]">
                Advisories
              </span>
            </div>
            <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-text-secondary">
              {signal.warnings.slice(0, 4).map((w, i) => (
                <li key={i}>· {w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-[11px] leading-relaxed text-text-muted">
          Sprint S6 opportunities drafting consumes approved findings. Findings
          that carry a needs-validation flag will inherit weak provenance —
          either corroborate them with stakeholder evidence first, or treat
          the resulting opportunities as needing operator scoping work.
        </p>
      </CardBody>
    </Card>
  );
}

function ReadinessStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  const valueClass =
    tone === "success"
      ? "text-status-success"
      : tone === "warning"
        ? "text-status-warning"
        : "text-text-primary";
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
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
