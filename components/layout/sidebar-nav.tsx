"use client";

import * as React from "react";
import Image from "next/image";
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
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/lib/auth/actions";

export interface SidebarIdentity {
  initials: string;
  displayName: string;
  subtitle: string;
  /** When false, identity tile renders a placeholder and no sign-out button. */
  authenticated: boolean;
}

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
      { label: "Leads", href: "/app/leads", icon: Users },
      { label: "Accounts", href: "/app/accounts", icon: Building2, disabled: true },
    ],
  },
  {
    label: "Deliver",
    items: [
      { label: "Engagements", href: "/app/engagements", icon: Briefcase },
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

export interface SidebarNavProps {
  identity?: SidebarIdentity;
}

export function SidebarNav({ identity }: SidebarNavProps = {}) {
  const pathname = usePathname();
  const tile: SidebarIdentity = identity ?? {
    initials: "··",
    displayName: "Operator",
    subtitle: "Saipien Labs",
    authenticated: false,
  };

  return (
    <aside className="flex h-full w-full flex-col bg-bg-shell">
      <div className="flex flex-col gap-2 px-5 pt-6 pb-5">
        <Image
          src="/brand/slate-logo-white.png"
          alt="SLATE"
          width={720}
          height={155}
          priority
          className="h-7 w-auto"
        />
        <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
          Saipien Labs OS
        </span>
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
                        <span className="rounded border border-border-subtle px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-text-disabled">
                          Soon
                        </span>
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
          <div
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated text-xs font-medium uppercase text-text-secondary"
          >
            {tile.initials}
          </div>
          <div className="flex flex-1 flex-col leading-tight min-w-0">
            <span className="truncate text-xs font-medium text-text-primary">
              {tile.displayName}
            </span>
            <span className="truncate text-[11px] text-text-muted">
              {tile.subtitle}
            </span>
          </div>
          {tile.authenticated ? (
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated/60 text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
