import * as React from "react";
import { cn } from "@/lib/utils";

export type ScoreTone = "info" | "warning" | "neutral" | "success";

export type ScoreDimension = "ai" | "friction" | "systems" | "fit";

export interface ScoreCardProps {
  label: string;
  value: number;
  dimension?: ScoreDimension;
  /** Override the auto-derived band/tone if needed. */
  tone?: ScoreTone;
  band?: string;
  description: string;
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

interface DimensionBand {
  threshold: number;
  band: string;
  tone: ScoreTone;
}

const DIMENSION_BANDS: Record<ScoreDimension, DimensionBand[]> = {
  ai: [
    { threshold: 75, band: "Strong", tone: "success" },
    { threshold: 55, band: "Healthy", tone: "info" },
    { threshold: 40, band: "Mixed", tone: "warning" },
    { threshold: 0, band: "Early", tone: "warning" },
  ],
  systems: [
    { threshold: 75, band: "Mature", tone: "success" },
    { threshold: 55, band: "Workable", tone: "info" },
    { threshold: 40, band: "Mixed", tone: "warning" },
    { threshold: 0, band: "Foundation work needed", tone: "warning" },
  ],
  // High friction is the diagnostic finding — leverage potential — but it is
  // not "good." Friction bands stay info/warning-toned regardless of value
  // so the color never reads as "everything is fine here."
  friction: [
    { threshold: 75, band: "High pain · high leverage", tone: "info" },
    { threshold: 55, band: "Meaningful friction", tone: "info" },
    { threshold: 40, band: "Moderate friction", tone: "neutral" },
    { threshold: 0, band: "Mild friction", tone: "neutral" },
  ],
  // Internal Fit Score bands track Saipien Labs' qualification thresholds.
  fit: [
    { threshold: 80, band: "Prime Candidate", tone: "success" },
    { threshold: 65, band: "Good Candidate", tone: "info" },
    { threshold: 50, band: "Nurture", tone: "warning" },
    { threshold: 0, band: "Disqualify · Education Path", tone: "warning" },
  ],
};

export function bandFor(
  dimension: ScoreDimension,
  value: number,
): { band: string; tone: ScoreTone } {
  const bands = DIMENSION_BANDS[dimension];
  for (const entry of bands) {
    if (value >= entry.threshold) {
      return { band: entry.band, tone: entry.tone };
    }
  }
  return { band: bands[bands.length - 1].band, tone: bands[bands.length - 1].tone };
}

export function ScoreCard({
  label,
  value,
  dimension,
  tone,
  band,
  description,
}: ScoreCardProps) {
  const derived = dimension ? bandFor(dimension, value) : null;
  const resolvedTone: ScoreTone = tone ?? derived?.tone ?? "neutral";
  const resolvedBand = band ?? derived?.band;
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-card">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          toneAccent[resolvedTone],
        )}
      />
      <div className="relative flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
            {label}
          </span>
          {resolvedBand ? (
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.14em]",
                toneText[resolvedTone],
              )}
            >
              {resolvedBand}
            </span>
          ) : null}
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-4xl font-semibold tabular-nums",
              toneText[resolvedTone],
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
            className={cn("block h-full rounded-full transition-all", toneBar[resolvedTone])}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-xs leading-relaxed text-text-muted">{description}</p>
      </div>
    </div>
  );
}
