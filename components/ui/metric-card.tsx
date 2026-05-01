import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { MetricTone } from "@/lib/mock-data";

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
  tone?: MetricTone;
}

const toneAccent: Record<MetricTone, string> = {
  neutral: "from-white/[0.04] to-transparent",
  info: "from-status-info/[0.10] to-transparent",
  success: "from-status-success/[0.10] to-transparent",
  warning: "from-status-warning/[0.10] to-transparent",
  risk: "from-status-risk/[0.10] to-transparent",
};

const toneText: Record<MetricTone, string> = {
  neutral: "text-text-muted",
  info: "text-status-info",
  success: "text-status-success",
  warning: "text-status-warning",
  risk: "text-status-risk",
};

export function MetricCard({
  label,
  value,
  delta,
  hint,
  tone = "neutral",
  className,
  ...props
}: MetricCardProps) {
  return (
    <Card
      variant="base"
      className={cn(
        "relative overflow-hidden",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          toneAccent[tone],
        )}
      />
      <div className="relative flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
            {label}
          </span>
          {delta ? (
            <span
              className={cn(
                "text-[11px] font-medium tracking-tight",
                toneText[tone],
              )}
            >
              {delta}
            </span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold tracking-tight text-text-primary tabular-nums">
            {value}
          </span>
        </div>
        {hint ? (
          <p className="text-xs text-text-muted leading-relaxed">{hint}</p>
        ) : null}
      </div>
    </Card>
  );
}
