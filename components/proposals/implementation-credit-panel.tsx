import * as React from "react";
import { Coins } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ImplementationCredit } from "@/lib/proposals/types";

export interface ImplementationCreditPanelProps {
  credit: ImplementationCredit;
}

export function ImplementationCreditPanel({
  credit,
}: ImplementationCreditPanelProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-status-success">
              <Coins className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight text-text-primary">
              Implementation credit
            </h3>
          </div>
          <Badge tone={credit.creditEligible ? "success" : "neutral"} dot>
            {credit.creditEligible ? "Eligible" : "Not eligible"}
          </Badge>
        </div>

        <p className="text-xs leading-relaxed text-text-muted">
          If the client proceeds into implementation within the agreed window,
          a portion of the AI Opportunity Sprint fee may be credited toward
          the implementation SOW. Represented as a commercial lever for the
          conversation, not an automatic discount or a legally binding term.
        </p>

        <dl className="grid grid-cols-1 gap-y-2 text-xs">
          <Row label="Credit amount" value={credit.creditAmountPlaceholder} />
          <Row label="Credit window" value={credit.creditWindow} />
        </dl>

        <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-text-muted">
          {credit.creditNotes}
        </p>
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2 last:border-b-0 last:pb-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium text-text-secondary">{value}</dd>
    </div>
  );
}
