"use client";

import { FilterTabs } from "@/components/ui/filter-tabs";
import { LEAD_FILTERS } from "@/lib/leads/helpers";
import type { LeadStatus } from "@/lib/leads/types";

export type LeadFilterId = "all" | LeadStatus;

export interface LeadFilterTabsProps {
  active: LeadFilterId;
  counts: Record<LeadFilterId, number>;
  onChange: (id: LeadFilterId) => void;
}

export function LeadFilterTabs({
  active,
  counts,
  onChange,
}: LeadFilterTabsProps) {
  return (
    <FilterTabs
      ariaLabel="Filter leads by status"
      activeId={active}
      onChange={(id) => onChange(id as LeadFilterId)}
      tabs={LEAD_FILTERS.map((filter) => ({
        id: filter.id,
        label: filter.label,
        count: counts[filter.id as LeadFilterId] ?? 0,
      }))}
    />
  );
}
