import * as React from "react";
import { cn } from "@/lib/utils";

export type ScoreTone = "info" | "warning" | "neutral" | "success";

export interface ScoreCardProps {
  label: string;
  value: number;
  tone?: ScoreTone;
  description: string;
  band?: string;
}

const toneAccent: Record<ScoreTone, string> = {
  info: "from-status-info/[0.10] to-transparent",
  warning: "from-status-warning/[0.10] to-transparent",
  success: "from-status-success/[0.10] to-transparent",
  neutral: "from-white/[0.04] to-transparent",
};

const toneText: Record<ScoreTone, string> = {
  info: "text-status-info",
  warning: "text-status-warning",
  success: "text-status-success",
  neutral: "text-text-secondary",
};

const toneBar: Record<ScoreTone, string> = {
  info: "bg-status-info",
  warning: "bg-status-warning",
  success: "bg-status-success",
  neutral: "bg-text-secondary",
};

export function ScoreCard({
  label,
  value,
  tone = "neutral",
  description,
  band,
}: ScoreCardProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-card">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          toneAccent[tone],
        )}
      />
      <div className="relative flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
            {label}
          </span>
          {band ? (
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.14em]",
                toneText[tone],
              )}
            >
              {band}
            </span>
          ) : null}
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-4xl font-semibold tabular-nums",
              toneText[tone],
            )}
          >
            {value}
          </span>
          <span className="text-xs text-text-muted">/ 100</span>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]"
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className={cn("block h-full rounded-full transition-all", toneBar[tone])}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-xs leading-relaxed text-text-muted">{description}</p>
      </div>
    </div>
  );
}

export function bandFor(value: number): {
  band: string;
  tone: ScoreTone;
} {
  if (value >= 75) return { band: "High", tone: "success" };
  if (value >= 55) return { band: "Healthy", tone: "info" };
  if (value >= 40) return { band: "Mixed", tone: "warning" };
  return { band: "Foundation work needed", tone: "warning" };
}
