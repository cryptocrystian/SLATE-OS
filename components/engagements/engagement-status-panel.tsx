import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Lock, Sparkles } from "lucide-react";
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
  /** Optional small element rendered to the right of the status badge. Used
   *  for subtle affordances like an "AI draft available" chip — not for
   *  primary CTAs. */
  headerAccessory?: React.ReactNode;
  /** Optional one-line note rendered between the description and the
   *  progress bar. Used for ambient guidance (e.g. AI readiness copy)
   *  that should sit below the primary description without competing
   *  with it. */
  footnote?: string | null;
  metrics?: Array<{ label: string; value: string }>;
  progress?: { value: number; total: number; label: string };
  nextAction: string;
  cta?: {
    label: string;
    /** When provided, the CTA renders as an active link. Otherwise it
     *  renders as a locked button labeled with `lockedNote`. */
    href?: string;
    lockedNote?: string;
  };
}

export function EngagementStatusPanel({
  icon,
  title,
  status,
  description,
  headerAccessory,
  footnote,
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
          <div className="flex flex-wrap items-center gap-2">
            {headerAccessory}
            <Badge tone={TONE_MAP[status.tone] ?? "neutral"} dot>
              {status.label}
            </Badge>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-text-muted">{description}</p>
        {footnote ? (
          <p className="text-[11px] leading-relaxed text-text-secondary">
            <Sparkles
              aria-hidden
              className="mr-1 inline h-3 w-3 align-text-bottom text-practice-ai"
            />
            {footnote}
          </p>
        ) : null}

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
          {cta ? renderCta(cta) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function renderCta(cta: NonNullable<EngagementStatusPanelProps["cta"]>) {
  if (cta.href) {
    return (
      <Link
        href={cta.href}
        className="group inline-flex w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-bg-elevated px-3 py-2 text-left text-xs font-medium text-text-primary transition-colors hover:border-brand-primary/60 hover:bg-bg-elevated/80"
      >
        <span className="inline-flex items-center gap-2">{cta.label}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-text-secondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text-primary" />
      </Link>
    );
  }
  const accessibleName = cta.lockedNote
    ? `${cta.label}, locked until ${cta.lockedNote}`
    : `${cta.label}, locked`;
  return (
    <button
      type="button"
      disabled
      aria-disabled
      aria-label={accessibleName}
      className={cn(
        "inline-flex w-full items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 px-3 py-2 text-left text-xs text-text-secondary",
        "cursor-not-allowed opacity-80",
      )}
    >
      <span className="inline-flex items-center gap-2">
        <Lock aria-hidden className="h-3 w-3 text-text-muted" />
        {cta.label}
      </span>
      {cta.lockedNote ? (
        <span
          aria-hidden
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted"
        >
          {cta.lockedNote}
        </span>
      ) : null}
    </button>
  );
}

