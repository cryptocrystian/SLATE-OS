"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FilterTab {
  id: string;
  label: string;
  count?: number;
}

export interface FilterTabsProps {
  tabs: FilterTab[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Accessible filter tablist (Phase 1 / docs/63 W3).
 *
 * Implements the WAI-ARIA tabs pattern with automatic activation:
 * roving tabindex (only the active tab is in the Tab order) plus
 * ArrowLeft/Right/Up/Down + Home/End to move between and activate tabs.
 * Reserved for status / lane filters where selecting a tab filters a list.
 */
export function FilterTabs({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  className,
}: FilterTabsProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeId),
  );

  function activate(index: number) {
    const i = (index + tabs.length) % tabs.length;
    onChange(tabs[i].id);
    refs.current[i]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        activate(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        activate(index - 1);
        break;
      case "Home":
        e.preventDefault();
        activate(0);
        break;
      case "End":
        e.preventDefault();
        activate(tabs.length - 1);
        break;
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-wrap gap-1.5 rounded-lg border border-border-subtle bg-bg-surface/60 p-1.5",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium tracking-tight transition-colors",
              isActive
                ? "bg-bg-elevated text-text-primary shadow-card"
                : "text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary",
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px font-mono text-[10px] tabular-nums",
                  isActive
                    ? "bg-brand-primary/15 text-brand-primary"
                    : "bg-bg-elevated text-text-muted",
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
