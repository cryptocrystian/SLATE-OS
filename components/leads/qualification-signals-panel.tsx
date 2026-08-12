import * as React from "react";
import { CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import type { QualificationSignal } from "@/lib/leads/types";

const TONE: Record<
  QualificationSignal["direction"],
  { icon: React.ComponentType<{ className?: string }>; text: string; bg: string; border: string; label: string }
> = {
  positive: {
    icon: CheckCircle2,
    text: "text-status-success",
    bg: "bg-status-success/10",
    border: "border-status-success/25",
    label: "Positive signal",
  },
  watch: {
    icon: AlertTriangle,
    text: "text-status-warning",
    bg: "bg-status-warning/10",
    border: "border-status-warning/25",
    label: "Watch",
  },
  negative: {
    icon: MinusCircle,
    text: "text-status-risk",
    bg: "bg-status-risk/10",
    border: "border-status-risk/25",
    label: "Concern",
  },
};

export interface QualificationSignalsPanelProps {
  signals: QualificationSignal[];
}

export function QualificationSignalsPanel({
  signals,
}: QualificationSignalsPanelProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Qualification signals
          </span>
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            Why the fit score reads the way it does
          </h2>
        </div>
        <ul className="flex flex-col gap-2.5">
          {signals.map((signal) => {
            const tone = TONE[signal.direction];
            const Icon = tone.icon;
            return (
              <li
                key={signal.id}
                className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3"
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${tone.bg} ${tone.border} ${tone.text}`}
                  aria-label={tone.label}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-text-primary">
                    {signal.label}
                  </span>
                  <span className="text-xs leading-relaxed text-text-muted">
                    {signal.detail}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
