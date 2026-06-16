"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

/**
 * Sprint Presentation Pass 2 — docs/61 § 7.B — viewerMode toggle for
 * the report PDF candidate + proposal candidate pages.
 *
 * Two-button radio that flips the URL search param `?mode=client`
 * (default state is implicit `operator`). The candidate page reads the
 * param server-side via the helper in `./viewer-mode.ts` and passes it
 * to the document component.
 *
 * `print:hidden` keeps the toggle out of exported PDFs. Operator drives
 * the toggle on-screen, then runs Ctrl-P / Cmd-P; the selected mode is
 * baked into the page render before printing.
 *
 * Sprint Pass 2-Fix: this module is `"use client"` and exports ONLY
 * `ViewerModeToggle`. The pure helper `viewerModeFromSearchParam` lives
 * in `./viewer-mode.ts` so server components can import + call it
 * directly. (Exports of a `"use client"` module become client references
 * across the server/client boundary, which made the helper uncallable
 * from server pages — runtime digest 2113504269.)
 *
 * State semantics:
 *   - `?mode=client` or `?mode=client-facing` → `client-facing`
 *   - anything else (or absent) → `operator`
 */

export interface ViewerModeToggleProps {
  /** Optional accessible label override. */
  label?: string;
}

export function ViewerModeToggle({ label }: ViewerModeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentMode = readMode(searchParams.get("mode"));

  function setMode(next: "operator" | "client-facing") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "client-facing") {
      params.set("mode", "client");
    } else {
      params.delete("mode");
    }
    const search = params.toString();
    const href = search ? `${pathname}?${search}` : pathname;
    router.push(href, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label={label ?? "Viewer mode"}
      className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-1 text-[11px] print:hidden"
    >
      <span className="ml-2 font-mono uppercase tracking-[0.14em] text-text-muted">
        Viewer
      </span>
      <button
        type="button"
        aria-pressed={currentMode === "operator"}
        onClick={() => setMode("operator")}
        className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors ${
          currentMode === "operator"
            ? "bg-bg-elevated text-text-primary"
            : "text-text-muted hover:text-text-primary"
        }`}
      >
        <Eye aria-hidden className="h-3 w-3" />
        Operator detail
      </button>
      <button
        type="button"
        aria-pressed={currentMode === "client-facing"}
        onClick={() => setMode("client-facing")}
        className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors ${
          currentMode === "client-facing"
            ? "bg-bg-elevated text-text-primary"
            : "text-text-muted hover:text-text-primary"
        }`}
      >
        <EyeOff aria-hidden className="h-3 w-3" />
        Client-facing
      </button>
    </div>
  );
}

function readMode(raw: string | null): "operator" | "client-facing" {
  if (raw === "client" || raw === "client-facing") return "client-facing";
  return "operator";
}
