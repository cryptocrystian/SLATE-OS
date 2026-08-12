import * as React from "react";
import { FileText, ShieldAlert, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReportReadinessSignal } from "@/lib/roadmap/provenance";

/**
 * Sprint S7 — Operator-only readiness signal for the not-yet-built
 * Sprint S8 report-section drafting surface.
 *
 * Canon: `docs/48_ROADMAP_AI_DRAFTING.md` § 7 + `docs/39` § 5.
 *
 * Read-only hint card — does NOT block S8 (S8 is not yet implemented;
 * this surface only tells the operator how close to "report-drafting
 * ready" the current roadmap set is). Renders counts, phase coverage,
 * priority coverage, a Ready / Not-yet status chip, and advisory
 * warnings.
 *
 * Boundary:
 *   - Never renders raw roadmap-item title, raw opportunity text, raw
 *     finding text, raw stakeholder text, or CRM data. Only counts +
 *     non-PII status flags.
 *   - Rejected / deferred / planned items NEVER count toward
 *     `approved`. Only operator-approved (`status='ready'`) items
 *     feed the S8 input set.
 *   - This is a pure presentation component; logic lives in the
 *     `buildReportReadinessSignal` pure helper.
 */

export interface ReportReadinessHintProps {
  signal: ReportReadinessSignal;
}

export function ReportReadinessHint({ signal }: ReportReadinessHintProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-status-info" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Report readiness
          </span>
          <Badge tone="neutral" variant="outline">
            Operator-only
          </Badge>
          {signal.readyForS8 ? (
            <Badge tone="success" variant="outline" dot>
              <Sparkles className="mr-1 h-2.5 w-2.5" />
              Ready for report drafting
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
          <ReadinessStat label="Deferred" value={signal.deferred} />
          <ReadinessStat label="Rejected" value={signal.rejected} />
          <ReadinessStat
            label="Still in review"
            value={signal.draft}
            tone={signal.draft > 0 ? "warning" : undefined}
          />
        </div>

        {signal.approved > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            <ReadinessStat
              label="30-day"
              value={signal.approvedPhaseCoverage.first30}
              tone={signal.approvedPhaseCoverage.first30 === 0 ? "warning" : undefined}
            />
            <ReadinessStat
              label="31–60-day"
              value={signal.approvedPhaseCoverage.days3160}
            />
            <ReadinessStat
              label="61–90-day"
              value={signal.approvedPhaseCoverage.days6190}
            />
          </div>
        ) : null}

        {signal.approved > 0 ? (
          <div className="flex flex-wrap gap-2 text-[11px] text-text-muted">
            <Badge
              tone={signal.hasApprovedQuickWin ? "success" : "warning"}
              variant="outline"
            >
              {signal.hasApprovedQuickWin
                ? "Has approved quick-win"
                : "No approved quick-win"}
            </Badge>
            <Badge
              tone={signal.hasApprovedStrategicBuild ? "success" : "warning"}
              variant="outline"
            >
              {signal.hasApprovedStrategicBuild
                ? "Has approved strategic-build"
                : "No approved strategic-build"}
            </Badge>
            {signal.approvedNeedsValidation > 0 ? (
              <Badge tone="warning" variant="outline">
                {signal.approvedNeedsValidation} approved · needs validation
              </Badge>
            ) : null}
          </div>
        ) : null}

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
          Sprint S8 report-section drafting consumes roadmap items with
          status &quot;ready&quot; only. Items marked deferred, rejected,
          planned, blocked, or completed never feed report drafting. Items
          that inherit a needs-validation flag from source opportunities will
          produce report sections with weak provenance; plan scoping work
          into the report sections or shore up the evidence first.
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
