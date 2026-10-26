import * as React from "react";
import { CheckCircle2, CircleDashed, ClipboardList, XCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { controlSummary, type ControlStatus, type RequiredControl } from "@/lib/governance/proportionality";
import { LABELS, type ControlTier } from "@/lib/governance/types";
import { ControlTierBadge } from "./badges";

const ICON: Record<ControlStatus, React.ReactNode> = {
  met: <CheckCircle2 className="h-3.5 w-3.5 text-status-success" aria-hidden />,
  missing: <XCircle className="h-3.5 w-3.5 text-status-critical" aria-hidden />,
  procedural: <ClipboardList className="h-3.5 w-3.5 text-status-info" aria-hidden />,
  pending: <CircleDashed className="h-3.5 w-3.5 text-text-disabled" aria-hidden />,
};

const STATUS_LABEL: Record<ControlStatus, string> = {
  met: "On record",
  missing: "Missing",
  procedural: "By procedure",
  pending: "Arrives in G3/G4",
};

/** GOV 02 + GOV 06: what this system's tier requires, and what the record shows. */
export function RequiredControls({ tier, controls }: { tier: ControlTier; controls: RequiredControl[] }) {
  const s = controlSummary(controls);
  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">Required controls</h3>
          <ControlTierBadge tier={tier} />
        </div>
        <p className="text-[11px] leading-relaxed text-text-muted">
          {tier === "unclassified"
            ? "Record data sensitivity, autonomy and client impact to set this system's tier (GOV 02)."
            : `${LABELS.controlTier[tier]} tier, derived from the highest of the three readings. ${s.met} on record · ${s.missing} missing · ${s.procedural} by procedure · ${s.pending} pending.`}
        </p>
        <ul className="flex flex-col gap-1.5">
          {controls.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 text-xs">
              <span className="flex items-start gap-2">
                <span className="mt-0.5">{ICON[c.status]}</span>
                <span className="flex flex-col">
                  <span className={c.status === "pending" ? "text-text-disabled" : "text-text-primary"}>
                    <span className="font-mono text-[10px] text-text-muted">{c.gov}</span> {c.label}
                  </span>
                  {c.detail ? <span className="text-[11px] text-text-muted">{c.detail}</span> : null}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-text-muted">{STATUS_LABEL[c.status]}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
