/**
 * Sprint Presentation Pass 2-Fix — server-safe viewerMode helper.
 *
 * Co-located with `viewer-mode-toggle.tsx` (the client component) but
 * compiled WITHOUT the `"use client"` directive so server components can
 * import + call this helper directly.
 *
 * Why this split:
 *   Pass 2 originally shipped `viewerModeFromSearchParam` alongside
 *   `ViewerModeToggle` in the same `"use client"` module. The App Router
 *   compiler converts ALL exports of a `"use client"` module into client
 *   references when imported from a server component — including pure
 *   functions. The two candidate pages then crashed at SSR with
 *   `TypeError: (0 , O.g) is not a function` (digest 2113504269) when
 *   they tried to call the helper. Moving the helper into a non-client
 *   module is the canonical Next.js App Router fix.
 *
 * Strict scope:
 *   - No I/O, no React, no client-only API.
 *   - Pure function; safe to import into server components AND client
 *     components.
 */

export type ViewerMode = "operator" | "client-facing";

/**
 * Derive the viewer mode from the page's `searchParams` prop value.
 *
 * Semantics:
 *   - `"client"` or `"client-facing"` → `"client-facing"`
 *   - anything else (incl. `undefined`, an empty string, an array, or
 *     an unknown literal) → `"operator"`
 *
 * Accepts the raw `searchParams.mode` shape Next.js passes
 * (`string | string[] | undefined`). Arrays read the first entry.
 */
export function viewerModeFromSearchParam(
  raw: string | string[] | undefined,
): ViewerMode {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "client" || v === "client-facing") return "client-facing";
  return "operator";
}
