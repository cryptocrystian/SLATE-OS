"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

export interface AppShellProps {
  children: React.ReactNode;
  topBarContext?: string;
  reviewCount?: number;
}

export function AppShell({
  children,
  topBarContext,
  reviewCount,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  return (
    <div className="relative flex min-h-screen bg-bg-page text-text-primary">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-radial-glow"
      />

      <aside className="hidden w-64 shrink-0 border-r border-border-subtle lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarNav />
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-bg-page/80 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col border-r border-border-subtle bg-bg-shell shadow-elevated animate-fade-up">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarNav />
          </div>
        </div>
      ) : null}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar
          context={topBarContext}
          reviewCount={reviewCount}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main
          className={cn(
            "relative flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
