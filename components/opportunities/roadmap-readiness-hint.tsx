import * as React from "react";
import { Compass, ShieldAlert, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RoadmapReadinessSignal } from "@/lib/opportunities/provenance";

/**
 * Sprint S6 — Operator-only readiness signal for the not-yet-built
 * Sprint S7 roadmap drafting surface.
 *
 * Canon: `docs/45_OPPORTUNITIES_AI_DRAFTING.md` § 7 + `docs/39` § 5.
 *
 * Read-only hint card — does NOT block S7 (S7 is not yet implemented;
 * this surface only tells the operator how close to "roadmap-ready"
 * the current opportunities set is). Renders four counts (selected /
 * deferred / rejected / draft), the selected-with-needs-validation
 * count, a Ready / Not-yet status chip, and advisory warnings.
 *
 * Boundary:
 *   - Never renders raw opportunity titles, raw source-finding text,
 *     raw stakeholder text, or CRM data. Only counts + non-PII status
 *     flags.
 *   - Rejected and deferred opportunities NEVER count toward
 *     `selected`. Only operator-selected (= approved-for-roadmap)
 *     opportunities are roadmap input.
 *   - This is a pure presentation component; logic lives in the
 *     `buildRoadmapReadinessSignal` pure helper.
 */

export interface RoadmapReadinessHintProps {
  signal: RoadmapReadinessSignal;
}

export function RoadmapReadinessHint({ signal }: RoadmapReadinessHintProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Compass className="h-4 w-4 text-status-info" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Roadmap readiness
          </span>
          <Badge tone="neutral" variant="outline">
            Operator-only
          </Badge>
          {signal.readyForS7 ? (
            <Badge tone="success" variant="outline" dot>
              <Sparkles className="mr-1 h-2.5 w-2.5" />
              Ready for roadmap drafting
            </Badge>
          ) : (
            <Badge tone="warning" variant="outline" dot>
              Not yet
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReadinessStat
            label="Selected"
            value={signal.selected}
            tone={signal.selected > 0 ? "success" : undefined}
          />
          <ReadinessStat label="Deferred" value={signal.deferred} />
          <ReadinessStat label="Rejected" value={signal.rejected} />
          <ReadinessStat
            label="Still in review"
            value={signal.draft}
            tone={signal.draft > 0 ? "warning" : undefined}
          />
        </div>

        {signal.selected > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ReadinessStat
              label="Selected · needs validation"
              value={signal.selectedNeedsValidation}
              tone={signal.selectedNeedsValidation > 0 ? "warning" : undefined}
            />
            <ReadinessStat
              label="Selected · thin evidence"
              value={signal.selectedThinEvidence}
              tone={signal.selectedThinEvidence > 0 ? "warning" : undefined}
            />
            <ReadinessStat
              label="Selected · defer-avoid"
              value={signal.selectedInDeferAvoid}
              tone={signal.selectedInDeferAvoid > 0 ? "warning" : undefined}
            />
          </div>
        ) : null}

        {signal.warnings.length > 0 ? (
          <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              <ShieldAlert className="h-3 w-3" />
              <span className="font-mono uppercase tracking-[0.16em]">
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
          Sprint S7 roadmap drafting consumes selected opportunities only —
          rejected and deferred opportunities never enter the roadmap.
          Opportunities that inherit a needs-validation flag from their
          source findings will produce roadmap items with weak provenance;
          plan scoping work into the roadmap or shore up the evidence
          first.
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
