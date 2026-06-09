import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PRE_DELIVERY_REASON_DISPLAY,
  type PreDeliveryAuditResult,
} from "@/lib/engagement-readiness/pre-delivery-audit";

/**
 * Sprint S11 — operator-facing pre-delivery audit card.
 *
 * Server component. Zero client-bundle cost. Mounted near the mint
 * controls on both the report page and the proposal page.
 *
 * Contract:
 *   - Read-only — the card never mints, never sends, never voids.
 *   - The card displays the canonical readiness state + structured
 *     blocking reasons so the operator can clear them before
 *     attempting a mint.
 *   - The boundary footer explicitly states this is a precondition
 *     gate, not a delivery action.
 */

export interface PreDeliveryAuditCardProps {
  audit: PreDeliveryAuditResult;
}

export function PreDeliveryAuditCard({ audit }: PreDeliveryAuditCardProps) {
  const headlineTone =
    audit.severity === "pass"
      ? "success"
      : audit.severity === "warning"
        ? "warning"
        : "risk";
  const headlineLabel =
    audit.severity === "pass"
      ? "Audit passed"
      : audit.severity === "warning"
        ? "Audit passed with advisories"
        : "Mint blocked";

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Pre-delivery audit ·{" "}
              {audit.surface === "report" ? "/r mint" : "/p mint"}
            </span>
            <Badge tone={headlineTone}>
              {audit.severity === "pass" ? (
                <CheckCircle2 aria-hidden className="mr-1 h-3 w-3" />
              ) : (
                <AlertTriangle aria-hidden className="mr-1 h-3 w-3" />
              )}
              {headlineLabel}
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-text-muted">
            Code-side enforcement of the canonical{" "}
            <span className="font-mono text-[11px]">docs/35</span> § 5
            readiness gate. Until every blocking reason clears, the
            mint action refuses to create a share token or delivery
            snapshot.
          </p>
        </div>

        {/* Blocking reasons */}
        {audit.blockingReasons.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Blocking reasons ({audit.blockingReasons.length})
            </span>
            <ul className="flex flex-col gap-2 rounded-md border border-status-risk/30 bg-status-risk/[0.05] p-3">
              {audit.blockingReasons.map((reason, i) => {
                const display = PRE_DELIVERY_REASON_DISPLAY[reason.code];
                return (
                  <li
                    key={`${reason.code}-${i}`}
                    className="flex items-start gap-2 text-[11px] leading-relaxed text-text-secondary"
                  >
                    <AlertTriangle
                      aria-hidden
                      className="mt-0.5 h-3 w-3 shrink-0 text-status-risk"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-status-risk">
                        {display?.shortLabel ?? reason.code}
                        {typeof reason.threshold === "number" &&
                        typeof reason.observed === "number"
                          ? ` · ${reason.observed} / ${reason.threshold}`
                          : ""}
                      </span>
                      <span className="text-text-secondary">
                        {reason.message}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* Warnings (non-blocking) */}
        {audit.warnings.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Advisories ({audit.warnings.length})
            </span>
            <ul className="flex flex-col gap-1.5 rounded-md border border-status-warning/30 bg-status-warning/[0.05] p-3">
              {audit.warnings.map((reason, i) => (
                <li
                  key={`${reason.code}-${i}`}
                  className="flex items-start gap-2 text-[11px] leading-relaxed text-text-secondary"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-warning"
                  />
                  {reason.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Counts summary */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Findings (approved)" value={audit.counts.approvedFindings} />
          <Stat
            label="Opps (recommended)"
            value={audit.counts.recommendedOpportunities}
          />
          <Stat
            label="Roadmap (ready linked)"
            value={audit.counts.readyRoadmapItemsLinked}
          />
          <Stat
            label="Sections (approved)"
            value={audit.counts.approvedReportSections}
          />
          <Stat
            label={`Active ${audit.surface} tokens`}
            value={audit.counts.activeShareTokensOnSurface}
            tone={
              audit.counts.activeShareTokensOnSurface > 0 ? "risk" : "neutral"
            }
          />
          <Stat
            label={
              audit.surface === "proposal"
                ? "Snapshot guard"
                : "Snapshot exists"
            }
            value={
              audit.surface === "proposal"
                ? audit.counts.proposalCommercialGuardPassed === true
                  ? "Pass"
                  : audit.counts.proposalCommercialGuardPassed === false
                    ? "Fail"
                    : "—"
                : audit.counts.hasFreshReportSnapshot
                  ? "Yes"
                  : "No"
            }
            tone={
              audit.surface === "proposal"
                ? audit.counts.proposalCommercialGuardPassed === true
                  ? "success"
                  : "risk"
                : audit.counts.hasFreshReportSnapshot
                  ? "success"
                  : "risk"
            }
          />
        </div>

        {/* Boundary footer */}
        <p className="rounded-md border border-border-subtle bg-bg-surface/40 p-3 text-[11px] leading-relaxed text-text-muted">
          Read-only audit. The card does not mint, send, share, or void.
          The mint action calls this evaluator before any token / delivery
          snapshot is created — a failing audit refuses the mint with
          structured reasons; a passing audit preserves existing token
          security behaviour exactly.
        </p>
      </CardBody>
    </Card>
  );
}

interface StatProps {
  label: string;
  value: number | string;
  tone?: "success" | "warning" | "risk" | "info" | "neutral";
}

function Stat({ label, value, tone = "neutral" }: StatProps) {
  const toneClass: Record<NonNullable<StatProps["tone"]>, string> = {
    success: "border-status-success/30 bg-status-success/[0.06]",
    warning: "border-status-warning/30 bg-status-warning/[0.06]",
    risk: "border-status-risk/30 bg-status-risk/[0.06]",
    info: "border-status-info/30 bg-status-info/[0.06]",
    neutral: "border-border-subtle bg-bg-elevated/40",
  };
  return (
    <div
      className={`flex flex-col gap-1 rounded-md border ${toneClass[tone]} px-3 py-2`}
    >
      <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </span>
      <span className="font-mono text-base font-semibold tabular-nums text-text-primary">
        {value}
      </span>
    </div>
  );
}
