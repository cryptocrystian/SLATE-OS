"use client";

import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { EngagementListItem } from "./engagement-list-item";
import {
  ENGAGEMENT_FILTERS,
  type EngagementFilterId,
} from "@/lib/engagements/helpers";
import type { Engagement } from "@/lib/engagements/types";

export interface EngagementListProps {
  engagements: Engagement[];
}

export function EngagementList({ engagements }: EngagementListProps) {
  const [active, setActive] = React.useState<EngagementFilterId>("all");

  const counts: Record<EngagementFilterId, number> = React.useMemo(() => {
    const c: Record<EngagementFilterId, number> = {
      all: engagements.length,
      setup: 0,
      intake: 0,
      synthesis: 0,
      scoring: 0,
      report: 0,
      proposal: 0,
      completed: 0,
    };
    for (const e of engagements) {
      c[e.currentStage] += 1;
      if (e.status === "completed") c.completed += 1;
    }
    return c;
  }, [engagements]);

  const filtered = React.useMemo(() => {
    if (active === "all") return engagements;
    if (active === "completed")
      return engagements.filter((e) => e.status === "completed");
    return engagements.filter((e) => e.currentStage === active);
  }, [engagements, active]);

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Filter engagements by stage"
        className="flex flex-wrap gap-1.5 rounded-lg border border-border-subtle bg-bg-surface/60 p-1.5"
      >
        {ENGAGEMENT_FILTERS.map((filter) => {
          const isActive = active === filter.id;
          const count = counts[filter.id];
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
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-4 w-4" />}
          title="Nothing in this stage right now"
          description="When an engagement reaches this stage, it will land here. Try another filter or clear it."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((e) => (
            <li key={e.id}>
              <EngagementListItem engagement={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
