# SLATE Decision Log

A running log of significant product, architecture, and design decisions. Each entry should record the decision, context, and any tradeoffs.

---

## 2026-05-04 — Persistence/Auth Step 2: public scorecard submissions persist via service role; internal fit never leaves the server

**Decision.** Public scorecard submissions are now written to Supabase server-side via a service-role client. The browser never holds the service-role key, never computes the score for a real submission, and never receives the internal fit score in any response. A new `POST /api/scorecard/submit` endpoint does the scoring + insert chain (account → contact → submission → answers → lead → fit dimensions → qualification signals); a new `GET /api/scorecard/results/[id]` endpoint re-runs scoring from persisted answers and returns a `PublicScoreResult` (an explicit `Omit<ScoreResult, "fit">` allowlist).

**Context.** Step 2 of `docs/persistence/02_MIGRATION_SEQUENCE.md`. The directional public scorecard was already MVP-complete; persistence adds two real boundaries that didn't exist before: (1) every submission becomes an internal lead record, and (2) the internal Saipien Fit Score now actually has a system of record (the `submissions.internal_fit_score` and `leads.fit_score` columns) instead of being a derived browser-side computation that was implicitly trusted. The split between public and internal scoring shapes is enforced at the type system level by `PublicScoreResult` so any future endpoint that accidentally returns a full `ScoreResult` would fail typecheck.

**Implementation.**
- `supabase/migrations/0002_scorecard_leads.sql` — `accounts`, `contacts` (citext email), `leads` (with internal `fit_score`), `lead_fit_dimensions`, `lead_qualification_signals`, `scorecard_submissions` (with `internal_fit_score` + deferred `lead_id` FK), `scorecard_answers`. RLS enabled on every table with operator-full policies workspace-scoped via `profiles.id = auth.uid()`. **No anon insert policies** — all public writes go through service-role on the server.
- `lib/supabase/service.ts` — `createSupabaseServiceClient()` is `import "server-only"`, `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`. Throws if env is unset.
- `lib/scorecard/public-result.ts` — `PublicScoreResult = Omit<ScoreResult, "fit">`; `toPublicScoreResult()` uses an explicit field allowlist (not destructure-and-discard) so future operator-only fields stay out of the public response by default.
- `lib/leads/derive.ts` — `deriveFitDimensions` (6 dimensions), `deriveQualificationSignals` (0–5 signals), `deriveLeadStatus` (classification + fit → status + recommended-action block). All deterministic from answers + score; no LLM calls.
- `app/api/scorecard/submit/route.ts` — validates contact fields, runs `scoreScorecard` server-side, upserts account by `ilike(name)` within workspace, upserts contact by `(account_id, email)`, inserts submission, then answers (with submission cleanup on partial failure), then lead, then dimensions + signals, then back-fills `submissions.lead_id`. Returns `{ submissionId, result: PublicScoreResult, displayContext }`.
- `app/api/scorecard/results/[id]/route.ts` — selects only safe submission columns (never `internal_fit_score`, never `submitted_email`), re-fetches answers, re-runs `scoreScorecard`, returns `toPublicScoreResult(result)`.
- Client wiring: `scorecard-stepper.tsx` POSTs and routes to `/scorecard/results?submission_id=…` on success; `scorecard-results-view.tsx` reads by `submission_id` with localStorage as a resume buffer; `scorecard-result-hero.tsx` prop type narrowed to `PublicScoreResult`; `app/scorecard/results/page.tsx` is now `force-dynamic` because `useSearchParams()` precludes static prerender.
- `scripts/dev/apply-migration.cjs` — dev-only Mgmt API SQL applier (mirrors the SMTP helper pattern). Used to apply both `0001_…` and `0002_…` to the live Supabase project for end-to-end smoke testing.

**Tradeoffs.**
- *Service-role-only writes vs anon-with-RLS for the public submit path.* The canon's data-model draft sketched anon-insert policies for `scorecard_submissions` and `scorecard_answers`. We chose service-role-only because (1) it keeps the public schema completely unwritable from the browser, (2) it matches the stripe-webhook style "the only thing the server does on behalf of the public is exactly this controlled chain", and (3) it lets the API endpoint do the scoring + lead derivation atomically rather than racing a browser POST against an asynchronous lead-derivation worker. Cost: any leak of `SUPABASE_SERVICE_ROLE_KEY` is total. Mitigated by it never being prefixed `NEXT_PUBLIC_`, never imported into a client component (verified by `import "server-only"`), and never logged.
- *Re-running `scoreScorecard` on the GET path instead of persisting the result blob.* We persist answers + classification + internal fit score, but not the full `ScoreResult` JSON. This makes scoring rules a deploy-time concern (a rules change re-scores existing submissions on next view) which is appropriate for a directional diagnostic. If the rules ever become "the contract" we'd snapshot the full result on insert and read it back verbatim.
- *No anon-readable view of submissions.* The public results page hits `/api/scorecard/results/[id]` via service role. Anyone with a submission UUID can fetch the public result. UUID is enough secrecy for a directional self-assessment; if results ever contained PII or personalized recommendations, we'd add a one-time signed-token gate.
- *Internal `fit_score` is computed at insert time and not exposed via the public API.* This relies on the discipline of every public response going through `toPublicScoreResult`. The type system enforces it; a future code reviewer doesn't need to remember.

**Boundary preserved.** `/app/leads*` continues to render mock data from `lib/leads/mock-leads.ts`. The new `leads` table is populated by submissions but the operator UI is not yet wired to read from it — that's Step 3. `/scorecard/start` and `/scorecard/results` remain anonymous; only `/app/*` is auth-gated. No BuildOps surfaces.

**End-to-end smoke test (real Supabase).** A synthetic submission persisted as `automation_ready` with `internal_fit_score=55`, `lead.status=needs_review`, 14 answers, 6 fit dimensions, 5 qualification signals; public response confirmed to contain no `fit` field; `/scorecard/start` 200 unauth; `/app` 307 → `/login` unauth. Logged via `apply-migration.cjs` and a one-shot SQL verification through the Mgmt API.

---

## 2026-05-04 — Operator allowlist enforced server-side; magic-link auth verified end-to-end

**Decision.** `signInWithMagicLink` now rejects any email not present in `SLATE_OPERATOR_EMAIL_ALLOWLIST` (exact match) or `SLATE_OPERATOR_DOMAIN_ALLOWLIST` (domain match), *before* any Supabase API call. If both env vars are empty, every email is rejected — the policy is fail-closed in every environment. Unauthorized addresses redirect to `/login?error=unauthorized` with neutral copy ("That email is not authorized for SLATE operator access.") that does not reveal whether the email exists in Supabase.

**Context.** End-to-end verification of Step 1 against a real Supabase project surfaced that the auth gate's "operator-only" framing was UX copy only — the server action would forward any well-formed email to Supabase. With Mailgun now wired as the outbound mailer (no rate-limit floor), this would also have meant Supabase happily issuing magic links to any address that passed regex. The allowlist closes that gap before broader operator rollout. Done at the application layer rather than at Supabase Auth Hooks for two reasons: (1) the rejection happens in our codepath we already audit, with no additional cloud surface to manage, and (2) it short-circuits before Supabase is touched, so unauthorized addresses never burn an OTP send and never leak account existence through Supabase's rate-limit timing.

**Implementation.**
- `lib/auth/operator-allowlist.ts` — pure module exporting `isAuthorizedOperator(email)` and `isOperatorAllowlistConfigured()`. Email normalized (`trim().toLowerCase()`), domain stripped of leading `@`. Server-only by virtue of `process.env` read; never `NEXT_PUBLIC_` prefixed.
- `lib/auth/actions.ts` — calls `isAuthorizedOperator` after regex validation and before `signInWithOtp`. Diagnostic logger sanitized to whitelist exactly four Supabase response fields (`name`, `code`, `status`, `message`); never logs email, redirect target, or raw error.
- `app/login/page.tsx` — `unauthorized` added to `ERROR_COPY`.
- `.env.example` — documents both allowlist vars, with `SLATE_OPERATOR_DOMAIN_ALLOWLIST=saipienlabs.com` as a default for the SLATE deployment.

**Verification follow-ups also landed in this commit.**
- Login form pending state fixed via `useFormStatus()` from `react-dom`. Prior implementation kept a local `pending` flag set to `true` across the same-route navigation to `/login?sent=1`, which led to a stuck spinner and an accidental double-submit that hit Supabase's per-email OTP cooldown.
- Two dev-only Mgmt API helpers (`scripts/dev/configure-supabase-smtp.cjs`, `scripts/dev/probe-smtp-auth.cjs`) committed. Both read all secrets from `process.env`, redact known credential patterns from output, and are not imported by the app runtime.
- Mailgun replaces Supabase's free email service for all auth emails. SMTP is configured via the Management API patch script; the password lives in `.env.local` only, never in code or git.

**Tradeoffs.** Adding a new operator now requires editing `.env.local` (or the deployment's env), redeploying / restarting, and inviting them in Supabase Dashboard. For a single-org operator pool that's fine; if SLATE ever needs self-service operator provisioning we'd move the allowlist into a database table and a small admin UI. Not in scope.

---

## 2026-05-04 — Persistence/Auth Step 0/1 adds Supabase env scaffolding and operator auth

**Decision.** Step 0/1 introduces Supabase client/server helpers, env scaffolding, `/login`, `/auth/callback`, `/app/*` auth guard, and real operator identity wiring while preserving all mock domain data.

**Context.** The accepted MVP is now ready for persistence. Auth is the first boundary to establish before public scorecard submissions or internal records become real. Per `docs/persistence/02_MIGRATION_SEQUENCE.md`, Step 0 (env + helpers) and Step 1 (auth shell) ship together because Step 1 cannot land without Step 0 plumbing, and neither touches domain data.

**Implementation.**

- Dependencies: `@supabase/supabase-js`, `@supabase/ssr`.
- Helpers: `lib/env.ts` (lazy env reads, missing-env never crashes the build), `lib/supabase/{client,server,middleware}.ts`, `lib/auth/actions.ts` (`signInWithMagicLink`, `signOut`), `lib/auth/identity.ts` (operator → SidebarIdentity with safe fallbacks).
- Env scaffolding: `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, no `NEXT_PUBLIC_` prefix), `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. `.env.local` was not modified, never read for content, and remains gitignored via the existing `.env*.local` rule.
- SQL: `supabase/migrations/0001_auth_workspaces_profiles.sql` ships `workspaces` (singleton seed), `profiles` (1:1 with `auth.users`), shared `set_updated_at` trigger, `on_auth_user_created` trigger, RLS (operator read on workspaces; operator read + self-update + self-insert on profiles). The full 29-table schema from `01_DATA_MODEL_DRAFT.md` is intentionally **not** in this migration.
- Routes: `/login` (premium dark login surface, success and error states, no public-registration framing), `/auth/callback` (code → session exchange, controlled error redirect), root `middleware.ts` (`/app/*` guard, session refresh, public routes pass through, env-missing case redirects `/app/*` to `/login?error=config`).
- Sidebar/user identity: `app/app/layout.tsx` is now async + `force-dynamic`; identity flows from `getOperatorIdentity()` → `AppShell` → `SidebarNav`. Sign-out is a small icon button in the sidebar tile wired to the `signOut` server action.
- The `M. Reyes / J. Okafor / A. Lin` strings inside `lib/engagements/mock-engagements.ts` remain — they are illustrative engagement-owner display strings and are out of Step 1 scope. Step 2+ replaces those with real `profiles` references.

**Tradeoffs.** Internal routes now require a Supabase session locally and in deployed environments. `/app`, `/app/leads`, and `/app/engagements` are now dynamic instead of statically prerendered (they read cookies for the auth check); the `[id]` detail routes still SSG via `generateStaticParams`. Domain data remains mock until Step 2+. Real magic-link delivery requires Supabase Dashboard configuration that is not exercisable from CI; documented in `supabase/migrations/README.md`.

**Boundary preserved.** No BuildOps surfaces, tables, RLS, API, or backend services. Mock domain data preserved in place behind the auth guard. `/scorecard*`, `/apply/*`, and `/` remain anonymous.

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

## 2026-05-01 — Persistence/Auth canon drafted before any backend code

**Decision.** After MVP acceptance, SLATE enters a Persistence/Auth architecture sprint *before* implementation. Four canon documents are drafted in `docs/persistence/` (canon, data model, migration sequence, security + RLS). No backend packages, migrations, auth code, or database code added in this sprint.

**Context.** The MVP UI surface is broad (51 routes, seven engagement-related pages, full lifecycle from public scorecard through proposal). Implementing persistence without a written architecture would mean making schema and policy decisions inside a coding sprint where the context is heavy. Drafting the canon first lets the team review the data model, the migration order, and the security boundary before any irreversible commits to a stack.

**Recommended stack.** Supabase Postgres + Supabase Auth + RLS + Next.js Route Handlers / Server Actions. Default unless implementation discovers a strong reason to deviate. The recommendation is justified in `docs/persistence/00_PERSISTENCE_AUTH_CANON.md`.

**Migration principle.** Replace seeded mock data route-by-route while preserving the accepted UI surface. Components stay the same; the data source switches underneath via per-domain `queries.ts` files that return the existing TypeScript shapes.

**Tradeoffs.** A short delay before the first real persistence ships. Worth it: every per-step acceptance criterion is now decided up front.

---

## 2026-05-01 — Post-MVP stabilization preserves feature scope

**Decision.** A dedicated stabilization pass after Sprint 7 fixes the three priority items from the Sprint 7 audit and runs a cross-sprint integrity sweep — without adding backend, auth, persistence, BuildOps, or any new feature module. Specifically: empty-state CTAs on `/report` and `/proposal` now route via `recommendedActionRoute` for stage-aware handoff; report outline shows canonical section numbers regardless of filter; roadmap linked-opportunity chip carries `aria-label` + soft elision; new `recommendedActionLabel(href)` helper provides consistent CTA copy.

**Context.** The MVP scored 4.8/5 and approved on its final audit. Stabilization is the right shape of work *before* committing to the next workstream (real persistence, then BuildOps). Skipping stabilization would push small inconsistencies into a backend sprint where they're harder to isolate.

**Tradeoffs.** None significant. The surface stays feature-complete; quality goes up.

---

## 2026-05-01 — Report builder uses seeded report sections tied to findings, opportunities, roadmap items, and evidence

**Decision.** `/app/engagements/[id]/report` renders seeded `Report` records (in `lib/reports/mock-reports.ts`) for Quanta and Caldera. Each `ReportSection` carries `linkedFindingIds`, `linkedOpportunityIds`, and `linkedRoadmapItemIds` — the full source trail from the Sprint 5/6 data layer. AI-drafted sections carry an explicit `aiDrafted: true` flag and a `confidence` value; the workspace surfaces both visually and never auto-promotes a section to client-facing.

**Context.** Sprint 7 explicitly excludes production document generation and final SOW execution. The point is to show the consultant-grade assembly workspace operators will use, with evidence traceability intact from finding → opportunity → roadmap → report. Engagements without report data render an empty state pointing back to findings + opportunities.

**Tradeoffs.** Report content is illustrative. Acceptable for MVP; the surface is wired so swapping in real AI synthesis + persistence is a data-layer change.

---

## 2026-05-01 — Proposal builder uses seeded proposal options and pricing placeholders

**Decision.** `/app/engagements/[id]/proposal` renders seeded `Proposal` records tied to `Opportunity` and `RoadmapItem` IDs. Three tiered options (`quick-win-build`, `ai-workflow-system`, `managed-ai-partner`) are seeded for Caldera with the AI Workflow System tier marked `recommended`. Pricing fields are explicitly named `pricingPlaceholder` and rendered with "Pricing placeholder · for internal planning only" copy.

**Context.** Pricing depends on systems access, data readiness, and implementation assumptions. Hard-coding numbers risks anchoring on the wrong frame. Placeholder copy keeps the conversation honest and locks the boundary explicitly: this is a commercial planning workspace, not a quote.

**Tradeoffs.** Strategists can't quote from this surface today. Correct: final pricing always lives in the SOW, not in the planning workspace.

---

## 2026-05-01 — Implementation credit is a commercial planning lever, not a discount

**Decision.** `ImplementationCredit` carries `creditEligible`, `creditAmountPlaceholder`, `creditWindow`, and `creditNotes`. The `ImplementationCreditPanel` renders both an "Eligible / Not eligible" status badge and the explicit copy: "Represented as a commercial lever for the conversation, not an automatic discount or a legally binding term."

**Context.** Saipien Labs may credit a portion of the AI Opportunity Sprint fee toward implementation if the client proceeds within an agreed window. This is a commercial conversion lever, not a contractual obligation. The workspace must present it as such — final terms are negotiated in the SOW, not in the planning workspace.

**Tradeoffs.** None. Boundary is explicit in copy and structure.

---

## 2026-05-01 — Locked-CTA pattern consolidated into `LockedActionButton`

**Decision.** A shared `components/ui/locked-action-button.tsx` replaces ad-hoc disabled buttons. Used by the roadmap header, report header, proposal header, and per-option SOW actions. Carries a Lock icon, mono sprint/lock label, and `aria-label="<Action>, locked until <Sprint>"`.

**Context.** Sprint 6 audit flagged that the roadmap's `Prepare Report` was a raw HTML button rather than the `Button` primitive. Sprint 7 introduced multiple new locked CTAs; consolidating into one primitive removes drift and keeps assistive-tech treatment uniform.

**Tradeoffs.** Slight indirection. Worth it: every locked CTA in the codebase now passes through the same affordance.

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
