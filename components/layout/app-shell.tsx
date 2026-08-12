"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNav, type SidebarIdentity } from "./sidebar-nav";
import { TopBar } from "./top-bar";

export interface AppShellProps {
  children: React.ReactNode;
  topBarContext?: string;
  reviewCount?: number;
  identity?: SidebarIdentity;
}

export function AppShell({
  children,
  topBarContext,
  reviewCount,
  identity,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  // Drawer a11y (Phase 1 / docs/63 W3): scroll lock, initial focus, focus
  // restore, Escape-to-close, and a Tab focus trap.
  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const FOCUSABLE =
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const list = Array.from(nodes).filter((el) => el.offsetParent !== null);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      restoreFocusRef.current?.focus?.();
    };
  }, [mobileNavOpen]);

  return (
    <div className="relative flex min-h-screen bg-bg-page text-text-primary">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-radial-glow print:hidden"
      />

      <aside className="hidden w-64 shrink-0 border-r border-border-subtle lg:block print:hidden">
        <div className="sticky top-0 h-screen">
          <SidebarNav identity={identity} />
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-bg-page/80 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col border-r border-border-subtle bg-bg-shell shadow-elevated motion-safe:animate-fade-up"
          >
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarNav identity={identity} />
          </div>
        </div>
      ) : null}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="print:hidden">
          <TopBar
            context={topBarContext}
            reviewCount={reviewCount}
            onMenuClick={() => setMobileNavOpen(true)}
          />
        </div>
        <main
          className={cn(
            "relative flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10",
            "print:p-0",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
