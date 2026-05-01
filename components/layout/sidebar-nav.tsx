"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  ClipboardCheck,
  FileText,
  Workflow,
  BookMarked,
  Settings,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: { label: string; tone: "info" | "warning" | "neutral" };
  disabled?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "Operate",
    items: [
      { label: "Overview", href: "/app", icon: LayoutDashboard },
      {
        label: "Leads",
        href: "/app/leads",
        icon: Users,
        badge: { label: "12", tone: "info" },
        disabled: true,
      },
      { label: "Accounts", href: "/app/accounts", icon: Building2, disabled: true },
    ],
  },
  {
    label: "Deliver",
    items: [
      { label: "Engagements", href: "/app/engagements", icon: Briefcase, disabled: true },
      { label: "Audits", href: "/app/audits", icon: ClipboardCheck, disabled: true },
      { label: "Proposals", href: "/app/proposals", icon: FileText, disabled: true },
      { label: "Delivery", href: "/app/delivery", icon: Workflow, disabled: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Library", href: "/app/library", icon: BookMarked, disabled: true },
      { label: "Settings", href: "/app/settings", icon: Settings, disabled: true },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col bg-bg-shell">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong bg-bg-elevated">
          <div
            aria-hidden
            className="absolute inset-0 rounded-lg bg-gradient-to-br from-brand-primary/30 via-transparent to-practice-ai/20"
          />
          <span className="relative font-mono text-sm font-semibold tracking-tight text-text-primary">
            SL
          </span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight text-text-primary">
            SLATE
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
            Saipien Labs OS
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        <ul className="flex flex-col gap-6">
          {sections.map((section) => (
            <li key={section.label}>
              <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                {section.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/app"
                      ? pathname === "/app"
                      : pathname?.startsWith(item.href);
                  const disabled = item.disabled;

                  const content = (
                    <span
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-bg-elevated text-text-primary"
                          : "text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary",
                        disabled && "cursor-not-allowed opacity-55 hover:bg-transparent hover:text-text-secondary",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-brand-primary" : "text-text-muted",
                          !disabled && !isActive && "group-hover:text-text-secondary",
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <Badge tone={item.badge.tone}>{item.badge.label}</Badge>
                      ) : null}
                      {disabled ? (
                        <Lock className="h-3 w-3 text-text-disabled" aria-label="Coming in a later sprint" />
                      ) : null}
                      {isActive ? (
                        <span
                          aria-hidden
                          className="absolute left-0 h-5 w-0.5 -translate-x-3 rounded-r bg-brand-primary"
                        />
                      ) : null}
                    </span>
                  );

                  return (
                    <li key={item.href} className="relative">
                      {disabled ? (
                        <span aria-disabled="true" tabIndex={-1}>
                          {content}
                        </span>
                      ) : (
                        <Link href={item.href}>{content}</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border-subtle px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-xs font-medium text-text-secondary">
            MR
          </div>
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-xs font-medium text-text-primary">M. Reyes</span>
            <span className="text-[11px] text-text-muted">Strategy · Saipien Labs</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
