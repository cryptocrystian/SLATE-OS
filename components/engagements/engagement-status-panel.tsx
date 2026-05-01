import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { PanelStatusBadge } from "@/lib/engagements/types";

const TONE_MAP: Record<string, BadgeTone> = {
  info: "info",
  warning: "warning",
  success: "success",
  neutral: "neutral",
  risk: "risk",
  brand: "brand",
};

export interface EngagementStatusPanelProps {
  icon: React.ReactNode;
  title: string;
  status: PanelStatusBadge;
  description: string;
  metrics?: Array<{ label: string; value: string }>;
  progress?: { value: number; total: number; label: string };
  nextAction: string;
  cta?: {
    label: string;
    href?: string;
    lockedNote?: string;
  };
}

export function EngagementStatusPanel({
  icon,
  title,
  status,
  description,
  metrics,
  progress,
  nextAction,
  cta,
}: EngagementStatusPanelProps) {
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.value / progress.total) * 100)
      : 0;

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-practice-ai">
              {icon}
            </span>
            <h3 className="text-base font-semibold tracking-tight text-text-primary">
              {title}
            </h3>
          </div>
          <Badge tone={TONE_MAP[status.tone] ?? "neutral"} dot>
            {status.label}
          </Badge>
        </div>

        <p className="text-xs leading-relaxed text-text-muted">{description}</p>

        {progress ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-text-muted">{progress.label}</span>
              <span className="font-mono tabular-nums text-text-secondary">
                {progress.value} / {progress.total} · {pct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <span
                className="block h-full rounded-full bg-brand-primary/70 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}

        {metrics && metrics.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border-subtle pt-3 text-[11px]">
            {metrics.map((m) => (
              <div key={m.label} className="flex flex-col gap-0.5">
                <dt className="uppercase tracking-[0.12em] text-text-muted">
                  {m.label}
                </dt>
                <dd className="text-text-secondary">{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
          <div className="text-xs leading-relaxed">
            <span className="text-text-muted">Next action: </span>
            <span className="text-text-secondary">{nextAction}</span>
          </div>
          {cta ? (
            <button
              type="button"
              disabled
              aria-disabled
              className={cn(
                "inline-flex w-full items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 px-3 py-2 text-left text-xs text-text-secondary",
                "cursor-not-allowed opacity-80",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <Lock className="h-3 w-3 text-text-muted" />
                {cta.label}
              </span>
              {cta.lockedNote ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                  {cta.lockedNote}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
