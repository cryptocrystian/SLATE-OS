import * as React from "react";
import { ShieldAlert, Link2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

export interface EngagementRisksPanelProps {
  risks: string[];
  dependencies: string[];
}

export function EngagementRisksPanel({
  risks,
  dependencies,
}: EngagementRisksPanelProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-status-warning">
              <ShieldAlert className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight text-text-primary">
              Risks & dependencies
            </h3>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
            Watch items that could move the engagement off plan if left unaddressed.
          </p>
        </div>

        {risks.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Risks
            </span>
            <ul className="flex flex-col gap-2.5">
              {risks.map((r, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-xs leading-relaxed text-text-secondary"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-warning"
                  />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {dependencies.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              <Link2 aria-hidden className="h-3 w-3" /> Dependencies
            </span>
            <ul className="flex flex-col gap-2.5">
              {dependencies.map((d, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-xs leading-relaxed text-text-secondary"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-info"
                  />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
