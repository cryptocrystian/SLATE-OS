import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProposalSowReadinessSignal } from "@/lib/proposals/readiness";

/**
 * Sprint S9 — operator-facing S10 (Internal SOW Draft) readiness hint.
 *
 * Server component. Zero client-bundle cost. Mounted on the engagement
 * proposal page below `<ProposalWorkspace>`.
 *
 * Contract:
 *   - The hint is advisory — never a hard gate. SOW Draft generation
 *     (S10) owns its own readiness check at the action layer
 *     (`sow-draft-eligibility.ts`).
 *   - The component never mints `/p` links.
 *   - The component never sends to client.
 *   - The component never references e-signature, SOW share tokens,
 *     pricing math, or executable contract language.
 *   - The boundary footer explicitly states this is a precondition
 *     hint, not a delivery state.
 */

export interface SowReadinessHintProps {
  signal: ProposalSowReadinessSignal;
}

export function SowReadinessHint({ signal }: SowReadinessHintProps) {
  const headlineTone = signal.readyForS10 ? "success" : "warning";
  const headlineLabel = signal.readyForS10
    ? "Ready for SOW Draft"
    : "Not yet";

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              SOW Draft readiness
            </span>
            <Badge tone={headlineTone}>
              {signal.readyForS10 ? (
                <CheckCircle2 aria-hidden className="mr-1 h-3 w-3" />
              ) : (
                <AlertTriangle aria-hidden className="mr-1 h-3 w-3" />
              )}
              {headlineLabel}
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-text-muted">
            Advisory signal showing whether the proposal is ready to feed
            Sprint S10 (Internal SOW Draft Validation). This is
            operator-internal — it does not mint any client link, send
            anything to the client, or generate the SOW itself.
          </p>
        </div>

        {/* Precondition checklist */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            S10 entry conditions
          </span>
          <div className="flex flex-wrap gap-1.5">
            <CheckChip ok={signal.hasProposal} label="Proposal initialized" />
            <CheckChip
              ok={signal.optionCount > 0}
              label={`Options: ${signal.optionCount}`}
            />
            <CheckChip
              ok={signal.hasRecommendedOption}
              label={
                signal.recommendedOptionType
                  ? `Recommended: ${signal.recommendedOptionType}`
                  : "Recommended option"
              }
            />
            <CheckChip
              ok={signal.recommendedHasProvenance}
              label="Recommended provenance"
              advisoryOnly
            />
            <CheckChip
              ok={signal.proposalApproved}
              label="Proposal approved"
            />
            <CheckChip
              ok={signal.hasApprovedSnapshot}
              label="Approved snapshot"
            />
            <CheckChip
              ok={signal.commercialGuardPassed === true}
              label="Commercial guard"
            />
            {signal.hasRequiredReportSectionsApproved !== null ? (
              <CheckChip
                ok={signal.hasRequiredReportSectionsApproved}
                label="S8 chain intact"
                advisoryOnly
              />
            ) : null}
          </div>
        </div>

        {/* Recommended-option provenance counts */}
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="Rec. opportunity links"
            value={signal.recommendedOpportunityLinkCount}
            hint="from recommended option"
            tone={
              signal.recommendedOpportunityLinkCount > 0 ? "info" : "neutral"
            }
          />
          <StatTile
            label="Rec. roadmap links"
            value={signal.recommendedRoadmapLinkCount}
            hint="from recommended option"
            tone={signal.recommendedRoadmapLinkCount > 0 ? "info" : "neutral"}
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
          SOW Draft generation itself runs in Sprint S10. This card is a
          precondition signal only — it never mints a client-facing
          proposal link, never sends anything to the client, never
          generates a SOW Draft, and never touches e-signature or
          pricing math.
        </p>
      </CardBody>
    </Card>
  );
}

interface CheckChipProps {
  ok: boolean;
  label: string;
  /** When true, a failing check is rendered as advisory (info tone), not blocker (warning). */
  advisoryOnly?: boolean;
}

function CheckChip({ ok, label, advisoryOnly = false }: CheckChipProps) {
  const tone = ok ? "success" : advisoryOnly ? "info" : "warning";
  return (
    <Badge tone={tone} variant="outline">
      {ok ? (
        <CheckCircle2 aria-hidden className="mr-1 h-3 w-3" />
      ) : (
        <AlertTriangle aria-hidden className="mr-1 h-3 w-3" />
      )}
      {label}
    </Badge>
  );
}

interface StatTileProps {
  label: string;
  value: number;
  hint: string;
  tone: "info" | "neutral";
}

function StatTile({ label, value, hint, tone }: StatTileProps) {
  const toneClass: Record<StatTileProps["tone"], string> = {
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
