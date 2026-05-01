"use client";

import * as React from "react";
import { Search, Inbox, Command, BellDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface TopBarProps {
  context?: string;
  reviewCount?: number;
  onMenuClick?: () => void;
  className?: string;
}

export function TopBar({
  context = "Command Center",
  reviewCount = 5,
  onMenuClick,
  className,
}: TopBarProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border-subtle bg-bg-shell/85 px-4 backdrop-blur-md sm:px-6",
        className,
      )}
    >
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary transition-colors hover:text-text-primary lg:hidden"
        aria-label="Toggle navigation"
      >
        <span className="flex flex-col gap-1">
          <span className="block h-px w-4 bg-current" />
          <span className="block h-px w-4 bg-current" />
          <span className="block h-px w-4 bg-current" />
        </span>
      </button>

      <div className="hidden items-center gap-2 text-xs text-text-muted lg:flex">
        <span className="font-mono uppercase tracking-[0.14em]">SLATE</span>
        <span aria-hidden className="text-text-disabled">/</span>
        <span className="text-text-secondary">{context}</span>
      </div>

      <div className="flex flex-1 justify-center px-2">
        <button
          type="button"
          className="group flex h-9 w-full max-w-md items-center gap-2.5 rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-left text-sm text-text-muted transition-colors hover:border-border-strong hover:bg-bg-elevated"
          aria-label="Open command menu"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">
            Search accounts, engagements, findings…
          </span>
          <span className="hidden items-center gap-1 rounded border border-border-subtle bg-bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted sm:inline-flex">
            <Command className="h-3 w-3" />K
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="group relative inline-flex h-9 items-center gap-2 rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          aria-label={`Review queue, ${reviewCount} items`}
        >
          <Inbox className="h-4 w-4" />
          <span className="hidden sm:inline">Review queue</span>
          <Badge tone="info" className="ml-0.5">
            {reviewCount}
          </Badge>
        </button>

        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated/60 text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          aria-label="Notifications"
        >
          <BellDot className="h-4 w-4" />
          <span
            aria-hidden
            className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-status-info"
          />
        </button>
      </div>
    </div>
  );
}
