import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PROPOSAL_REQUIRED_SECTIONS,
  type ProposalReadinessSignal,
} from "@/lib/reports/readiness";
import type { ReportSectionType } from "@/lib/reports/types";

/**
 * Sprint S8 — operator-facing proposal-readiness hint.
 *
 * Server component. Zero client-bundle cost. Mounted on the engagement
 * report page below `<ReportWorkspace>`.
 *
 * Contract:
 *   - The hint is advisory — never a hard gate. Proposal drafting (S9)
 *     owns its own readiness check at the action layer.
 *   - The component never mints `/r` or `/p` links.
 *   - The component never sends to client.
 *   - The component never references SOW, e-signature, or pricing.
 *   - The boundary footer explicitly states this is a precondition
 *     hint, not a delivery state.
 */

export interface ProposalReadinessHintProps {
  signal: ProposalReadinessSignal;
}

const REQUIRED_LABEL: Record<ReportSectionType, string> = {
  "executive-summary": "Executive Summary",
  "business-context": "Business Context",
  "systems-snapshot": "Systems Snapshot",
  "readiness-assessment": "Readiness Assessment",
  "workflow-friction": "Workflow Friction",
  "stakeholder-synthesis": "Stakeholder Synthesis",
  "opportunity-portfolio": "Opportunity Portfolio",
  "priority-recommendations": "Priority Recommendations",
  "governance-risk": "Risk & Governance",
  roadmap: "30/60/90 Roadmap",
  "recommended-next-step": "Recommended Next Step",
  appendix: "Appendix",
};

export function ProposalReadinessHint({ signal }: ProposalReadinessHintProps) {
  const headlineTone = signal.readyForS9 ? "success" : "warning";
  const headlineLabel = signal.readyForS9
    ? "Ready for proposal drafting"
    : "Not yet";

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Proposal readiness
            </span>
            <Badge tone={headlineTone}>
              {signal.readyForS9 ? (
                <CheckCircle2 aria-hidden className="mr-1 h-3 w-3" />
              ) : (
                <AlertTriangle aria-hidden className="mr-1 h-3 w-3" />
              )}
              {headlineLabel}
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-text-muted">
            Advisory signal showing whether the report has approved enough
            sections to feed proposal drafting. This is
            operator-internal — it does not mint a client link or send
            anything to the client.
          </p>
        </div>

        {/* Primary status tiles */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label="Approved"
            value={signal.operatorBlessed}
            hint={`approved + final · need ≥${signal.hasMinimumApproved ? signal.operatorBlessed : 5}`}
            tone={signal.hasMinimumApproved ? "success" : "warning"}
          />
          <StatTile
            label="Needs Review"
            value={signal.needsReview}
            hint="awaiting operator decision"
            tone={signal.needsReview > 0 ? "warning" : "neutral"}
          />
          <StatTile
            label="Drafted"
            value={signal.drafted}
            hint="ready for review"
            tone="info"
          />
          <StatTile
            label="Not Started"
            value={signal.notStarted}
            hint="no draft yet"
            tone="neutral"
          />
        </div>

        {/* Required-section coverage */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Required sections for proposal
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PROPOSAL_REQUIRED_SECTIONS.map((key) => {
              const isApproved = signal.requiredApproval[key];
              return (
                <Badge
                  key={key}
                  tone={isApproved ? "success" : "warning"}
                  variant="outline"
                >
                  {isApproved ? (
                    <CheckCircle2 aria-hidden className="mr-1 h-3 w-3" />
                  ) : null}
                  {REQUIRED_LABEL[key]}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Provenance coverage */}
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="Approved · linked"
            value={signal.approvedSectionsWithProvenance}
            hint="sections with upstream source links"
            tone="info"
          />
          <StatTile
            label="Approved · no links"
            value={signal.approvedSectionsMissingProvenance}
            hint="approved without provenance links"
            tone={
              signal.approvedSectionsMissingProvenance > 0
                ? "warning"
                : "neutral"
            }
          />
        </div>

        {/* Advisory list */}
        {signal.advisories.length > 0 ? (
          <ul className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
            {signal.advisories.map((advisory, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[11px] leading-relaxed text-text-secondary"
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-warning"
                />
                {advisory}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Boundary footer */}
        <p className="rounded-md border border-border-subtle bg-bg-surface/40 p-3 text-[11px] leading-relaxed text-text-muted">
          Proposal drafting is a separate step. This card is a
          precondition signal only — it never mints a client-facing
          report or proposal link, never sends anything to the client,
          and never touches pricing, SOW language, or e-signature flows.
        </p>
      </CardBody>
    </Card>
  );
}

interface StatTileProps {
  label: string;
  value: number;
  hint: string;
  tone: "success" | "warning" | "info" | "neutral";
}

function StatTile({ label, value, hint, tone }: StatTileProps) {
  const toneClass: Record<StatTileProps["tone"], string> = {
    success: "border-status-success/30 bg-status-success/[0.06]",
    warning: "border-status-warning/30 bg-status-warning/[0.06]",
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
      <span className="font-mono text-lg font-semibold tabular-nums text-text-primary">
        {value}
      </span>
      <span className="text-[10px] leading-tight text-text-muted">{hint}</span>
    </div>
  );
}
