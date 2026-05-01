"use client";

import * as React from "react";
import { LeadFilterTabs, type LeadFilterId } from "./lead-filter-tabs";
import { LeadListItem } from "./lead-list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import type { Lead } from "@/lib/leads/types";

export interface LeadListProps {
  leads: Lead[];
}

export function LeadList({ leads }: LeadListProps) {
  const [active, setActive] = React.useState<LeadFilterId>("all");

  const counts = React.useMemo(() => {
    const c: Record<LeadFilterId, number> = {
      all: leads.length,
      new: 0,
      "needs-review": 0,
      "high-fit": 0,
      "diagnostic-requested": 0,
      nurture: 0,
      disqualified: 0,
      converted: 0,
    };
    for (const lead of leads) {
      c[lead.status] += 1;
    }
    return c;
  }, [leads]);

  const filtered = React.useMemo(() => {
    if (active === "all") return leads;
    return leads.filter((l) => l.status === active);
  }, [leads, active]);

  return (
    <div className="flex flex-col gap-5">
      <LeadFilterTabs active={active} counts={counts} onChange={setActive} />
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-4 w-4" />}
          title="Nothing in this lane right now"
          description="When a scorecard moves into this status, it will land here. Try another filter or clear the filter."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((lead) => (
            <li key={lead.id}>
              <LeadListItem lead={lead} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
