"use client";

import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterTabs } from "@/components/ui/filter-tabs";
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
      <FilterTabs
        ariaLabel="Filter engagements by stage"
        activeId={active}
        onChange={(id) => setActive(id as EngagementFilterId)}
        tabs={ENGAGEMENT_FILTERS.map((filter) => ({
          id: filter.id,
          label: filter.label,
          count: counts[filter.id],
        }))}
      />

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
