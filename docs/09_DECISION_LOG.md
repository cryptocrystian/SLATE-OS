# SLATE Decision Log

A running log of significant product, architecture, and design decisions. Each entry should record the decision, context, and any tradeoffs.

---

## 2026-05-01 — Sprint 1 stack: Next.js 14 + React 18 + Tailwind v3

**Decision.** Use Next.js 14.2 (App Router), React 18, TypeScript strict mode, and Tailwind CSS v3 for the SLATE codebase.

**Context.** The kickoff prompt suggested Next.js App Router, TypeScript, Tailwind CSS, and shadcn-style primitives. Next 14 + React 18 are the most stable combination today and avoid React 19 / Tailwind v4 instability for a long-lived product foundation.

**Tradeoffs.** Will eventually need to upgrade to Next 15 + React 19 + Tailwind v4. Migration cost is acceptable given the foundation is small.

---

## 2026-05-01 — Design tokens via CSS variables

**Decision.** Implement design tokens as CSS custom properties in `styles/globals.css` and bind them to Tailwind theme keys in `tailwind.config.ts`.

**Context.** Canon (`docs/05_SLATE_IMPLEMENTATION_ARTIFACTS.md`) specifies CSS-variable token names. CSS variables make theming, dark/light variants, and runtime token overrides trivial.

**Tradeoffs.** Slightly more setup than pure Tailwind theme values, but lets tokens be referenced anywhere — including non-Tailwind contexts like Framer Motion, charts, or future MDX content.

---

## 2026-05-01 — Single dark theme, no light mode in MVP

**Decision.** Ship dark-mode only for MVP. No light theme toggle.

**Context.** UX Canon (`docs/04_SLATE_UX_UI_CANON.md`) explicitly defines SLATE as dark-mode native and aligned with the Saipien Labs website's dark palette. Adding a light theme would dilute brand alignment and double design effort.

**Tradeoffs.** Some users prefer light UIs. Acceptable: the audience is Saipien Labs operators, not the broad public.

---

## 2026-05-01 — Practice accents reserved for AI Systems for now

**Decision.** Tokens for `--color-practice-dev` (Custom Development) and `--color-practice-studio` (Venture Studio) are defined but only AI Systems accents are visually surfaced in Sprint 1 UI.

**Context.** MVP focus is GrowthOps + AdvisoryOps under the AI Systems practice. Showing dev/studio accents now would imply functionality that does not yet exist.

**Tradeoffs.** None significant. Tokens are defined and ready for Sprints 4–7.

---

## 2026-05-01 — Mock data lives in `lib/mock-data.ts`

**Decision.** All mock data centralized in `lib/mock-data.ts` with typed interfaces (`Engagement`, `ReviewItem`, `ActivityEvent`, etc.).

**Context.** Per kickoff guidance, MVP runs on mock data. Centralizing it keeps the swap to a real data layer mechanical: replace the import, keep the types.

**Tradeoffs.** None. Types are exported and reusable.

---

## 2026-05-01 — Sidebar shows future routes as locked, not hidden

**Decision.** Sidebar lists Leads, Accounts, Engagements, Audits, Proposals, Delivery, Library, Settings. Routes not yet built render with a lock icon and are not navigable.

**Context.** Canon (`docs/03_SLATE_INFORMATION_ARCHITECTURE.md`) defines the full primary nav. Hiding items would distort the product mental model. Disabling them communicates the IA without faking functionality.

**Tradeoffs.** Slightly noisier sidebar than a "build only what's wired" approach. Acceptable because the goal is to communicate SLATE's structure on day one.

---

## 2026-05-01 — Root `/` redirects to `/app`

**Decision.** `app/page.tsx` redirects to `/app` for now.

**Context.** Sprint 1 only ships `/app`. A marketing landing or scorecard entry point arrives in Sprint 2 (`/scorecard`).

**Tradeoffs.** Will be replaced when public surfaces land.
