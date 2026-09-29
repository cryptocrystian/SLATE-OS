import * as React from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WrjRunSummary, WrjRunCheckSummary } from "@/lib/ai/wrj/types";

/**
 * Operator-facing WRJ verdict card.
 *
 * Surfaces the writer→reviewer→judge quality signals from the most recent
 * synthesis run: the Jev judge's per-check calibrated verdict and the
 * cross-family reviewer's notes. Advisory only — the consultant still approves
 * each finding; this tells them where to look first. Renders nothing in
 * single-model mode (there is no verdict to show).
 */

// Default (findings-oriented) labels. Stages with different check semantics
// pass `labelOverrides` (e.g. opportunities: coverage = material problems).
const CHECK_LABEL: Record<string, string> = {
  coverage: "Stakeholder coverage",
  grounding: "Grounding in evidence",
  calibration: "Confidence calibration",
  guardrail_financial: "No financial/benchmark claims",
  specificity: "Specificity to this client",
  actionability: "Actionable implementation",
  insight: "Insight",
};

function checkLabel(id: string, overrides?: Record<string, string>): string {
  return overrides?.[id] ?? CHECK_LABEL[id] ?? id.replace(/[-_]/g, " ");
}

function checkValue(c: WrjRunCheckSummary): string {
  if (typeof c.score === "number") {
    const conf = typeof c.confidence === "number" ? ` · conf ${c.confidence.toFixed(2)}` : "";
    return `${c.score.toFixed(2)}${conf}`;
  }
  if (typeof c.noul === "number") return c.noul.toFixed(2);
  return "—";
}

export function WrjVerdictCard({
  summary,
  labelOverrides,
}: {
  summary: WrjRunSummary | null;
  labelOverrides?: Record<string, string>;
}) {
  if (!summary || summary.mode !== "wrj") return null;

  const judge = summary.judge;
  const reviewer = summary.reviewer;
  const judged = judge && judge.status === "judged";
  const passed = judged ? judge!.passed : false;

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Quality review · writer · reviewer · judge
            </span>
            <h2 className="text-base font-semibold tracking-tight text-text-primary">
              Automated quality check on the latest draft
            </h2>
          </div>
          {judged ? (
            <Badge tone={passed ? "success" : "warning"}>
              {passed ? "Judge: cleared" : `Judge: ${judge!.failedCount} to review`}
            </Badge>
          ) : (
            <Badge tone="neutral">
              Judge: {judge?.status === "unavailable" ? "not configured" : "unavailable"}
            </Badge>
          )}
        </div>

        {judged && judge!.checks.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {judge!.checks.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border-t border-border-subtle pt-1.5 first:border-t-0 first:pt-0 text-xs"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      c.passed ? "bg-status-success" : "bg-status-warning"
                    }`}
                  />
                  <span className="text-text-secondary">{checkLabel(c.id, labelOverrides)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-text-muted">
                    {checkValue(c)}
                  </span>
                  <span
                    className={`text-[10px] font-medium uppercase tracking-wide ${
                      c.passed ? "text-status-success" : "text-status-warning"
                    }`}
                  >
                    {c.passed ? "pass" : "review"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-subtle pt-3 text-[11px] text-text-muted">
          <span>
            Reviewer:{" "}
            {reviewer && reviewer.status === "reviewed"
              ? reviewer.noteCount === 0
                ? "no defects flagged"
                : `${reviewer.noteCount} note${reviewer.noteCount === 1 ? "" : "s"}${reviewer.highSeverity > 0 ? ` (${reviewer.highSeverity} high)` : ""}`
              : (reviewer?.status ?? "unavailable")}
          </span>
          {reviewer?.model ? <span>· {reviewer.model}</span> : null}
          {judge?.model ? <span>· judge {judge.model}</span> : null}
          {typeof summary.revisions === "number" && summary.revisions > 0 ? (
            <span>· {summary.revisions} revision{summary.revisions === 1 ? "" : "s"}</span>
          ) : null}
        </div>

        <p className="text-[11px] leading-relaxed text-text-muted">
          Advisory. A consultant still approves each finding — this flags where to
          look first. Scores are calibrated judgments, not gates.
        </p>
      </CardBody>
    </Card>
  );
}
