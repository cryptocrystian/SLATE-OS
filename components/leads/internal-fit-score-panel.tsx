import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fitCategoryFor } from "@/lib/leads/helpers";
import type { Lead } from "@/lib/leads/types";

export interface InternalFitScorePanelProps {
  lead: Lead;
}

const TONE: Record<
  "prime" | "good" | "nurture" | "disqualify",
  { text: string; bar: string; ring: string }
> = {
  prime: {
    text: "text-status-success",
    bar: "bg-status-success",
    ring: "ring-status-success/30",
  },
  good: {
    text: "text-status-info",
    bar: "bg-status-info",
    ring: "ring-status-info/30",
  },
  nurture: {
    text: "text-status-warning",
    bar: "bg-status-warning",
    ring: "ring-status-warning/30",
  },
  disqualify: {
    text: "text-status-risk",
    bar: "bg-status-risk",
    ring: "ring-status-risk/30",
  },
};

export function InternalFitScorePanel({ lead }: InternalFitScorePanelProps) {
  const category = fitCategoryFor(lead.internalFitScore);
  const tone = TONE[category.id];

  return (
    <Card variant="elevated">
      <CardBody className="flex flex-col gap-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-text-muted">
              <Lock aria-hidden className="h-3 w-3" />
              Internal qualification · never shown to prospect
            </span>
            <h2 className="text-base font-semibold tracking-tight text-text-primary">
              Internal Saipien Fit Score
            </h2>
          </div>
          <Badge tone="brand" variant="outline">
            Operator view
          </Badge>
        </div>

        <div
          className={cn(
            "flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-surface p-5",
          )}
        >
          <div className="flex items-baseline gap-3">
            <span
              className={cn(
                "font-mono text-5xl font-semibold tabular-nums",
                tone.text,
              )}
            >
              {lead.internalFitScore}
            </span>
            <span className="text-sm text-text-muted">/ 100</span>
            <span className={cn("ml-2 text-sm font-semibold", tone.text)}>
              {category.label}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <span
              className={cn("block h-full rounded-full", tone.bar)}
              style={{ width: `${lead.internalFitScore}%` }}
            />
          </div>
          <p className="text-xs leading-relaxed text-text-muted">
            {category.description}
          </p>
        </div>

        <div>
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Signals behind the fit score
          </span>
          <ul className="mt-3 flex flex-col gap-3">
            {lead.fitDimensions.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-surface/60 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-text-secondary">
                    {d.label}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                    {d.value}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <span
                    className="block h-full rounded-full bg-brand-primary/70"
                    style={{ width: `${d.value}%` }}
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-text-muted">
                  {d.note}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
