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

## 2026-05-01 — Opportunity scoring uses seeded directional scoring tied to approved findings

**Decision.** `/app/engagements/[id]/opportunities` renders seeded `Opportunity` records (in `lib/opportunities/mock-opportunities.ts`) that reference approved-or-report-ready finding IDs from `lib/findings/`. All scores are 0–100 directional values. Quadrant placement (Quick Wins / Strategic Builds / Low Priority / Defer · Avoid) is computed from impact (≥70 high) and complexity (≥60 high) thresholds and stored on the opportunity for stable presentation.

**Context.** Sprint 6 explicitly excludes real scoring persistence and AI-generated scoring. The point is to show the prioritization workspace operators will use, with evidence traceability intact from finding → opportunity → roadmap → eventual report. Engagements with no approved findings render an empty state pointing back to the findings workspace.

**Tradeoffs.** Scoring is illustrative, not real. Acceptable for MVP — the surface is wired so adding real scoring later is a data-layer swap.

---

## 2026-05-01 — Roadmap planning uses seeded 30/60/90-day items tied to opportunities

**Decision.** `/app/engagements/[id]/roadmap` renders seeded `RoadmapItem` records bound to opportunity IDs. Phases are `first-30 / days-31-60 / days-61-90`. Each item carries objective, key actions, dependencies, success criteria, risks, owner placeholder, and readiness note.

**Context.** Reuses the same evidence-traceability narrative — every roadmap item links back to its opportunity, and from there to the supporting findings and stakeholder/document evidence. No drag/drop persistence is built; sequencing is encoded directly in the seed file.

**Tradeoffs.** Roadmap state is fixed in mock data. When real persistence lands, the data layer swap is mechanical; the visual surface stays the same.

---

## 2026-05-01 — Recommended-action routing extracted to a shared helper

**Decision.** `lib/engagements/recommended-action.ts` exports `recommendedActionRoute(engagement, currentPath?)` returning `{ href?, lockedNote?, selfReference? }`. All five engagement-related pages (detail / intake / findings / opportunities / roadmap) consume it. When the resolved destination matches the current page, the recommended-action card renders as "Current workspace · You are here" without a clickable CTA.

**Context.** Sprint 5's audit flagged that the recommended-action card looped to the current page on `/intake` and `/findings`. Promoting routing into one place removes the bug surface and gives every future page (Sprint 7's `/report` and `/proposal`) a single point of configuration.

**Tradeoffs.** Slightly more indirection; eliminates a real correctness bug.

---

## 2026-05-01 — Stakeholder intake and findings review use seeded mock evidence

**Decision.** `/app/engagements/[id]/intake` and `/app/engagements/[id]/findings` render seeded stakeholder, document, and finding records. There is no real intake delivery, document upload, or AI synthesis. Every review action (Approve / Edit / Reject / Regenerate / Add note) is mock and clearly labeled.

**Context.** Sprint 5 explicitly excludes backend persistence, real stakeholder forms, and real AI calls. The point of the sprint is to make discovery-to-insight legible inside SLATE so a strategist can immediately see who has responded, what evidence exists, and which findings need approval. Real data flows when persistence and AI synthesis are introduced.

**Tradeoffs.** Reviewer interactions don't persist between sessions. Acceptable for MVP; the surfaces are wired to swap in real data later without component-level changes.

---

## 2026-05-01 — Findings carry typed source references back to evidence

**Decision.** Every `Finding` carries a `sourceRefs[]` of typed evidence: `stakeholder-response`, `uploaded-document`, `scorecard-answer`, or `consultant-note`, each with source name, optional role, excerpt, and strength label. The findings workspace's `EvidencePanel` renders this list verbatim and every finding can be traced to its evidence on screen.

**Context.** Canon (`04_SLATE_UX_UI_CANON.md`) treats evidence as central to trust: "Insights should connect back to source material whenever possible." The product also requires that AI-drafted findings never feel final. Pairing the finding with its evidence — and labeling the AI authorship — keeps the human reviewer in the loop and the audit trail honest.

**Tradeoffs.** Slight authoring cost when seeding mock findings. Worth it: this is the reusable pattern for the report builder and proposal builder in Sprint 7.

---

## 2026-05-01 — Engagement workspaces use seeded mock AI Opportunity Sprints

**Decision.** `/app/engagements` and `/app/engagements/[id]` render five seeded mock engagements from `lib/engagements/mock-engagements.ts`. Two engagements are explicitly linked to Sprint 3 leads (`atlas-manufacturing` and `helio-health`); the lead detail page's "Start AI Opportunity Sprint" button now opens the seeded engagement when one exists. Three additional engagements (Meridian Advisors, Quanta Operations, Caldera Capital Group) cover Synthesis, Report, and Proposal stages so the full flow is reviewable.

**Context.** Sprint 4 explicitly excludes backend, auth, real engagement creation, and stakeholder intake. The point of the sprint is to make the post-qualification command center visible and reviewable. Real persistence and engagement creation arrive later.

**Tradeoffs.** The lead → engagement transition is illustrated, not lived. Acceptable for MVP. Status panel CTAs are locked with explicit "Sprint 5 / 6 / 7" labels so the operator understands what activates each module.

---

## 2026-05-01 — BuildOps stays documentation-only

**Decision.** No BuildOps app functionality is built during the GrowthOps + AdvisoryOps MVP. No `/app/builds` route, no BuildOps navigation item, no sprint manager, no agent session UI, no repo context manager, no QA workspace, no deployment visibility, no related backend.

**Context.** BuildOps is being authored as future-facing canon in parallel. The active MVP must remain focused on the AI Workflow Scorecard → Lead Qualification → AI Opportunity Sprint → Audit Report → Proposal path. Implementing BuildOps surfaces now would dilute the MVP and risk early architectural decisions before the canon is stable.

**Tradeoffs.** The product roadmap is visible only through the locked sidebar items and the canon docs. BuildOps surfaces ship in their own dedicated sprint sequence after AdvisoryOps reaches feature completeness.

---

## 2026-05-01 — Lead dashboard uses seeded mock leads until backend lands

**Decision.** `/app/leads` and `/app/leads/[id]` render six seeded mock leads from `lib/leads/mock-leads.ts`. There is no live handoff from `/scorecard/results` (localStorage) into the lead inbox.

**Context.** Sprint 3's scope explicitly excludes backend, auth, and persistence. The point of the sprint is to make the public-to-internal qualification surface visible and reviewable, not to wire submission. Attempting to inject a localStorage-derived "Latest scorecard" lead would either require server-side persistence (out of scope) or a client-only patch that would conflict with the static prerender of `/app/leads`. The boundary is communicated in the page's meta row and in a "Mock — not wired" badge on lead actions.

**Tradeoffs.** The public-to-internal handoff is illustrated, not lived. Acceptable for MVP; replace with a real submission API in the same sprint that introduces persistence.

---

## 2026-05-01 — Per-dimension score banding on `ScoreCard`

**Decision.** `bandFor()` is now `bandFor(dimension, value)` and returns dimension-specific band copy and tone. Friction in particular never reads as `success`/green: high friction surfaces as info-toned `High pain · high leverage`.

**Context.** Sprint 2 audit flagged that the shared `High / Healthy / Mixed / Foundation work needed` banding made high friction look like a positive state, when it is actually the lead diagnostic finding. AI Readiness uses `Strong / Healthy / Mixed / Early`. Systems Readiness uses `Mature / Workable / Mixed / Foundation work needed`. Internal Fit Score uses `Prime / Good / Nurture / Disqualify` thresholds matching the canon.

**Tradeoffs.** Slightly more configuration in one file; eliminates a real semantic bug.

---

## 2026-05-01 — Internal Saipien Fit Score is operator-only and visually marked as such

**Decision.** Internal Fit Score appears only in `/app/leads*`. Wherever it appears, it is wrapped in a `FitScoreBadge` or `InternalFitScorePanel` that carries a `Lock` icon and the explicit label "Internal-only / never shown to prospect."

**Context.** `01_SLATE_PRODUCT_SPEC.md` requires that the internal fit score never appear to prospects. Marking the badge with a lock and an explicit caption protects against accidental reuse on prospect-facing routes (e.g. if a future engineer pulls a `Lead` into a public surface).

**Tradeoffs.** Slight visual chrome cost on the operator side. Worth it.

---

## 2026-05-01 — Scorecard state in `localStorage`, not URL or server

**Decision.** Scorecard answers are persisted only in `localStorage` under `slate.scorecard.v1`. The results page reads from storage and computes the score on render.

**Context.** Sprint 2 explicitly rules out backend persistence. URL search params would leak self-reported business data into history and analytics. `localStorage` keeps state on-device, survives refresh, and is trivially replaceable when a real lead-capture endpoint arrives.

**Tradeoffs.** Results aren't shareable via URL. Acceptable — the result is a personal diagnostic, not a public artifact. A real submission API will replace this in Sprint 3 alongside `/app/leads`.

---

## 2026-05-01 — Public scorecard does not use `AppShell`

**Decision.** `/scorecard*` routes use `PublicAssessmentShell` (minimal SLATE mark + trust strip + footer), not the internal `AppShell`.

**Context.** Per `docs/04_SLATE_UX_UI_CANON.md` website-continuity rules, the public scorecard should feel like a continuation of the marketing site, not a corner of the internal app. Sharing the AppShell would expose internal nav and break the boundary.

**Tradeoffs.** Two shells to maintain instead of one. They share the same design tokens and primitives, so duplication is minimal.

---

## 2026-05-01 — Internal Saipien Fit Score is computed but never rendered to prospects

**Decision.** `scoreScorecard()` returns a `fit` value used internally for routing/classification, but no scorecard view renders it.

**Context.** `01_SLATE_PRODUCT_SPEC.md`: "Internal fit score is never shown to prospect." The scorecard surfaces three prospect-facing scores (AI Readiness, Workflow Friction, Systems Readiness) and the classification label.

**Tradeoffs.** None. Fit score is reserved for the lead dashboard in Sprint 3.

---

## 2026-05-01 — Five result classifications with explicit boundary copy

**Decision.** Result classifications are: Not AI-ready yet, Automation-ready, Quick-win candidate, Audit-ready, Strategic AI systems candidate. Every classification routes to "Apply for AI Systems Review" with classification-specific framing.

**Context.** Canon requires that the free scorecard provide directional value but never cannibalize the paid AI Opportunity Sprint. Boundary copy appears in three places: landing boundary card, results disclaimer section, recommended-next-step card footer.

**Tradeoffs.** Slight repetition of boundary language. Intentional — the canon flags this as a conversion-protection requirement.

---

## 2026-05-01 — Root `/` redirects to `/app`

**Decision.** `app/page.tsx` redirects to `/app` for now.

**Context.** Sprint 1 only ships `/app`. A marketing landing or scorecard entry point arrives in Sprint 2 (`/scorecard`).

**Tradeoffs.** Will be replaced when public surfaces land.
