"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  INTAKE_FILTERS,
  type IntakeFilterId,
  QUALITY_LABEL,
  QUALITY_TONE,
  ROLE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/intake/helpers";
import type { Stakeholder } from "@/lib/intake/types";

const STATUS_TONE_MAP: Record<string, BadgeTone> = {
  info: "info",
  warning: "warning",
  success: "success",
  neutral: "neutral",
  risk: "risk",
};

export interface StakeholderListProps {
  stakeholders: Stakeholder[];
}

export function StakeholderList({ stakeholders }: StakeholderListProps) {
  const [active, setActive] = React.useState<IntakeFilterId>("all");

  const counts = React.useMemo(() => {
    const c: Record<IntakeFilterId, number> = {
      all: stakeholders.length,
      invited: 0,
      "in-progress": 0,
      completed: 0,
      "needs-follow-up": 0,
      "not-started": 0,
    };
    for (const s of stakeholders) c[s.status] += 1;
    return c;
  }, [stakeholders]);

  const filtered = React.useMemo(() => {
    if (active === "all") return stakeholders;
    return stakeholders.filter((s) => s.status === active);
  }, [stakeholders, active]);

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Stakeholder responses
          </span>
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            {stakeholders.length} stakeholder{stakeholders.length === 1 ? "" : "s"}
          </h2>
        </div>

        <div
          role="tablist"
          aria-label="Filter stakeholders by status"
          className="flex flex-wrap gap-1.5 rounded-lg border border-border-subtle bg-bg-surface/60 p-1.5"
        >
          {INTAKE_FILTERS.map((filter) => {
            const isActive = active === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(filter.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium tracking-tight transition-colors",
                  isActive
                    ? "bg-bg-elevated text-text-primary shadow-card"
                    : "text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary",
                )}
              >
                <span>{filter.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px font-mono text-[10px] tabular-nums",
                    isActive
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "bg-white/[0.06] text-text-muted",
                  )}
                >
                  {counts[filter.id]}
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-4 text-xs text-text-muted">
            No stakeholders in this lane.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-elevated/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-semibold tracking-tight text-text-primary">
                      {s.name === "—" ? `${s.title} (TBD)` : s.name}
                    </span>
                    <p className="text-xs text-text-muted">
                      <span className="text-text-secondary">{s.title}</span>
                      <span className="mx-1.5 text-text-disabled">·</span>
                      {ROLE_LABEL[s.role]}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={STATUS_TONE_MAP[STATUS_TONE[s.status]] ?? "neutral"}
                      dot
                    >
                      {STATUS_LABEL[s.status]}
                    </Badge>
                    <Badge
                      tone={STATUS_TONE_MAP[QUALITY_TONE[s.responseQuality]] ?? "neutral"}
                      variant="outline"
                    >
                      {QUALITY_LABEL[s.responseQuality]}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>Completion</span>
                    <span className="font-mono tabular-nums">
                      {s.completionPercent}% · last activity {s.lastActivity}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                    <span
                      className="block h-full rounded-full bg-brand-primary/60"
                      style={{ width: `${s.completionPercent}%` }}
                    />
                  </div>
                </div>

                {s.summary ? (
                  <p className="text-xs leading-relaxed text-text-secondary">
                    {s.summary}
                  </p>
                ) : null}

                {(s.keySignals.length > 0 ||
                  s.openQuestions.length > 0 ||
                  s.riskFlags.length > 0) && (
                  <dl className="grid grid-cols-1 gap-2 border-t border-border-subtle pt-2 text-[11px]">
                    {s.keySignals.length > 0 ? (
                      <Block label="Key signals" items={s.keySignals} dot="bg-status-success" />
                    ) : null}
                    {s.openQuestions.length > 0 ? (
                      <Block
                        label="Open questions"
                        items={s.openQuestions}
                        dot="bg-status-info"
                      />
                    ) : null}
                    {s.riskFlags.length > 0 ? (
                      <Block label="Risk flags" items={s.riskFlags} dot="bg-status-warning" />
                    ) : null}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function Block({
  label,
  items,
  dot,
}: {
  label: string;
  items: string[];
  dot: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="uppercase tracking-[0.12em] text-text-muted">
        {label}
      </dt>
      <dd>
        <ul className="flex flex-col gap-1.5 text-text-secondary">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span aria-hidden className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", dot)} />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}
