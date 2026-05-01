"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
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
    <div
      role="tablist"
      aria-label="Filter leads by status"
      className="flex flex-wrap gap-1.5 rounded-lg border border-border-subtle bg-bg-surface/60 p-1.5"
    >
      {LEAD_FILTERS.map((filter) => {
        const isActive = active === filter.id;
        const count = counts[filter.id] ?? 0;
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(filter.id)}
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
  );
}
