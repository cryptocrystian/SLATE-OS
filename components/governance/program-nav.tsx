"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "registry", label: "Registry" },
  { slug: "policies", label: "Policies" },
  { slug: "engagements", label: "Engagements" },
  { slug: "activity", label: "Activity" },
  { slug: "settings", label: "Settings" },
] as const;

/** Program sub-navigation. Reserved G2+ surfaces (risks, controls, evidence…) are listed, not faked. */
export function ProgramNav({ programId }: { programId: string }) {
  const pathname = usePathname();
  const root = `/app/governance/programs/${programId}`;
  return (
    <nav aria-label="Program sections" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1 px-1">
        {TABS.map((t) => {
          const href = t.slug ? `${root}/${t.slug}` : root;
          const active = t.slug ? pathname === href || pathname.startsWith(`${href}/`) : pathname === root;
          return (
            <li key={t.slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition-colors",
                  active
                    ? "bg-bg-elevated text-text-primary ring-1 ring-inset ring-border-strong"
                    : "text-text-muted hover:bg-bg-elevated/60 hover:text-text-primary",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
        <li aria-hidden className="mx-1 h-4 w-px bg-border-subtle" />
        {["Risks", "Controls", "Evidence", "Decisions"].map((label) => (
          <li key={label}>
            <span
              title="Arrives in G2/G3"
              className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md px-3 text-xs text-text-disabled"
            >
              {label}
              <span className="rounded border border-border-subtle px-1 text-[9px] uppercase tracking-wider">Soon</span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
