# SLATE Current Status

_Last updated: 2026-05-04 — Persistence/Auth Step 0 + Step 1 verified end-to-end (real Supabase + Mailgun SMTP)_

## Sprint State

| Sprint | Title | Status |
| --- | --- | --- |
| 1 | Visual Foundation + App Shell | ✅ Complete (audit 4.4/5, polish patch applied) |
| 2 | Public Scorecard Flow | ✅ Complete (audit 4.7/5, fixes folded into Sprint 3) |
| 3 | Lead Dashboard + Qualification | ✅ Complete |
| 4 | Engagement Workspace | ✅ Complete (audit 4.8/5, fixes folded into Sprint 5) |
| 5 | Intake + Findings Review | ✅ Complete (audit 4.7/5, fixes folded into Sprint 6) |
| 6 | Opportunity Matrix + Roadmap | ✅ Complete (audit 4.8/5, fixes folded into Sprint 7) |
| 7 | Report + Proposal Builder | ✅ Complete (audit 4.8/5, fixes folded into stabilization) |
| — | MVP Stabilization + End-to-End Polish | ✅ Complete |
| — | MVP Acceptance Audit | ✅ Approved (4.8/5) |
| P0 | Persistence/Auth Architecture | ✅ Canon drafted |
| P1 | Persistence/Auth Step 0 — Supabase setup + env scaffolding | ✅ Complete |
| P1 | Persistence/Auth Step 1 — Auth shell + operator login | ✅ Complete |

The GrowthOps + AdvisoryOps MVP arc is feature-complete and stabilized. The persistence/auth architecture canon is drafted in `docs/persistence/`. Persistence Step 0 (Supabase scaffolding) and Step 1 (operator auth shell) are now implemented. Domain persistence (scorecard submission, leads, engagement, intake, findings, opportunities, roadmap, reports, proposals, activity events) starts in Step 2+ and is **not** in this sprint — `/app/*` still renders mock domain data behind the new auth guard.

## Stack

- Next.js 14.2.x (App Router) — patched for security advisory
- React 18, TypeScript (strict)
- Tailwind CSS v3 with CSS variable–driven design tokens
- `lucide-react`, `clsx` + `tailwind-merge`
- Inter (sans) and JetBrains Mono (mono) via `next/font`
- No backend, no auth, no database, no AI integration — mock data only

## Implemented (Sprint 7 additions)

- `/app/engagements/[id]/report` — AI Opportunity Sprint report builder
  - PageHeader with eyebrow `AdvisoryOps · Report`, primary `Open Proposal Builder` (when ≥50% of sections approved/final), secondary `Back to engagement`, tertiary `Export Report` (locked mock)
  - 6 summary metrics (Sections / Needs Review / Approved / Evidence Links / Roadmap Items / Export Status)
  - `ReportWorkspace` (client) — three-pane: outline (filter tabs + numbered ordered list with status chips) / selected section preview (AI-drafted badge, confidence chip, summary, draft preview, linked-counts, optional reviewer note, optional needs-evidence warning, mock review action bar) / linked-context panel (typed back-references to findings, opportunities, and roadmap items, each with deep links)
  - Right rail: Recommended Action card (uses helper, supports `selfReference`), Engagement context, Recommended-next-step + consultant-notes panel
  - Empty state for engagements without report data: "Approve findings and score opportunities before report assembly begins" with deep links to findings + opportunities
- `/app/engagements/[id]/proposal` — Proposal & SOW option builder
  - PageHeader with eyebrow `AdvisoryOps · Proposal`, primary locked `Prepare Client Review`, secondary `Back to Report`
  - 6 summary metrics (Options / Recommended / Quick Wins Included / Strategic Builds / Dependencies / Implementation Credit)
  - `ProposalWorkspace` (client) — three side-by-side `ProposalOptionCard`s with `Recommended` badge + brand-tinted ring on the recommended option, plus a full `ProposalOptionDetail` below: scope summary, timeline, deliverables, included opportunities, linked roadmap items, dependencies, assumptions, risks, prominent pricing-placeholder block, two locked SOW actions (`Prepare SOW Draft`, `Send to Client`)
  - Right rail: Recommended Action card (helper-routed), `ImplementationCreditPanel` with eligible/not-eligible badge and explicit "commercial planning lever, not an automatic discount" copy, report-readiness card, commercial-assumptions card, engagement context
  - Empty state for engagements without proposal data: "Build the report and roadmap before proposal options are assembled" with deep link to report builder

## Sprint 6 Audit Fixes (folded in)

- **Matrix axis accessibility.** `OpportunityMatrix` grid container now sets `role="grid"` + `aria-describedby="opportunity-matrix-axis-x opportunity-matrix-axis-y"` pointing at the visible legend strips. The legends carry stable IDs.
- **Locked CTA primitive consistency.** New `components/ui/locked-action-button.tsx` (`LockedActionButton`) provides one place for every locked-CTA pattern. Reused on the roadmap header `Prepare Report` button (now locked or unlocked depending on roadmap presence), the report header `Export Report` button, the proposal header `Prepare Client Review`, and the in-detail `Prepare SOW Draft` / `Send to Client` actions.
- **Roadmap linked-opportunity titles.** `RoadmapCard` now accepts an `opportunityTitles` map and surfaces the actual linked-opportunity title inside the chip (e.g. `→ AI-drafted handoff briefs`). The roadmap page builds the lookup once and threads it through the phase columns.

## Recommended-Action Helper

`lib/engagements/recommended-action.ts` now resolves stages → routes for the full lifecycle:

- `setup`, `intake` → `/intake`
- `synthesis` → `/findings`
- `scoring` → `/opportunities`
- `report` → `/report`
- `proposal` → `/proposal`

With `currentPath`, the helper returns `selfReference: true` so the recommended-action card renders as `Current workspace · You are here` instead of looping. Used by all seven engagement-related pages (detail, intake, findings, opportunities, roadmap, report, proposal).

## Verified

- `npm run lint` — clean
- `npm run build` — clean. **51 routes prerender as static**: 5 engagement detail pages × 7 sub-routes (detail, intake, findings, opportunities, roadmap, report, proposal) plus leads (6), scorecard (3), apply, landing routes
- Sprint 7 screenshots captured at 1440 / 1024 / 390 to `docs/screenshots/sprint-7/` for: Quanta + Caldera report and proposal (mature), Helio + Meridian + Atlas report (empty/early), Helio proposal (empty/early), the Quanta engagement detail (Report panel CTA wired), and the Quanta roadmap (Prepare Report CTA wired).

## Lifecycle End-to-End

A Saipien Labs strategist can now follow the full advisory motion inside SLATE:

1. **Public scorecard** (`/scorecard*`) — directional diagnostic
2. **Lead inbox** (`/app/leads*`) — qualification with internal-only Saipien Fit Score
3. **Engagement command center** (`/app/engagements/[id]`) — stage tracker + six panels
4. **Stakeholder intake** (`/intake`) — role coverage, response quality, supporting inputs
5. **Findings review** (`/findings`) — AI-drafted findings with evidence panels and review action bar
6. **Opportunity matrix** (`/opportunities`) — Quick Wins / Strategic Builds / Low Priority / Defer · Avoid
7. **30/60/90 roadmap** (`/roadmap`) — phase columns with linked-opportunity titles
8. **Report builder** (`/report`) — 12-section assembly with linked findings/opportunities/roadmap
9. **Proposal builder** (`/proposal`) — three tiered SOW options with implementation credit

Evidence trail is intact end-to-end: every report section and proposal option points back to its source opportunities, findings, and stakeholder/document evidence.

## BuildOps Boundary

Reaffirmed: BuildOps remains documentation-only. No `/app/builds`, no BuildOps nav, no sprint manager / agent session / repo context UI, no related backend.

## Known Constraints

- All deliverable content is seeded mock data; no real AI synthesis, no production export, no real SOW execution, no e-signature, no billing.
- Review actions across findings / report / proposal are mock with explicit labeling.
- Workspace selection state is local-only and resets on navigation.

## Stabilization Pass (2026-05-01)

Three Sprint 7 audit fixes folded in plus a cross-sprint integrity pass:

- **Fix 1 — Empty-state CTA routing.** Both `/report` and `/proposal` empty states now use `recommendedActionRoute(engagement)` to direct the user to the engagement's actual current step. Helio (intake stage) → "Continue at intake"; Atlas (setup) → "Continue at intake"; Meridian (synthesis) → "Continue at findings"; Quanta (report stage proposal page) → "Open report builder". New `recommendedActionLabel(href)` helper provides the human label.
- **Fix 2 — Canonical report section numbering.** `ReportWorkspace` outline now displays each section's true index in the report (e.g. AI Opportunity Portfolio stays `07` even when filtered to "Needs Review"). `aria-label` on each outline button now reads `Section <N> of <total>, <title>, <status>`.
- **Fix 3 — Roadmap linked-opportunity chip accessibility.** Visual truncation now uses `text-ellipsis whitespace-nowrap`; the chip carries `aria-label="Linked opportunity: <full title>"` and the visible truncated text is `aria-hidden`. Title attribute kept for hover.

Cross-sprint integrity verified (no dead links, no no-op loops, every CTA either routes to an active page, renders as `LockedActionButton` with sprint label, or resolves via `recommendedActionRoute` for empty states).

## Persistence/Auth Architecture Canon

Four documents drafted in `docs/persistence/`:

- `00_PERSISTENCE_AUTH_CANON.md` — goals, principles, role model, mock-to-real migration principle, eight acceptance criteria
- `01_DATA_MODEL_DRAFT.md` — 29 tables mapped from existing `lib/<domain>/` types; six derived panel-status pieces called out as views, not columns
- `02_MIGRATION_SEQUENCE.md` — 11-step route-by-route sequence with goals, tables introduced, mock data replaced, acceptance criteria, and risks per step
- `03_SECURITY_AND_RLS_DRAFT.md` — route posture, default-deny RLS principles, public scorecard / stakeholder token / operator policy sketches, audit-trail policy, what not to expose client-side

Recommended stack: **Supabase Postgres + Supabase Auth + RLS + Next.js Route Handlers / Server Actions**. Justified in `00_PERSISTENCE_AUTH_CANON.md`.

## Persistence/Auth Step 0 + Step 1 — what landed

**Step 0 — Supabase setup + env scaffolding.**

- `@supabase/supabase-js` and `@supabase/ssr` installed.
- `lib/env.ts` — typed env getters (`getPublicEnv`, `isSupabaseEnvConfigured`, `getSiteUrl`); throws only at call time so `next build` does not crash with missing env.
- `lib/supabase/client.ts` — browser client (uses anon key only).
- `lib/supabase/server.ts` — server client bound to `cookies()` for server components, route handlers, server actions.
- `lib/supabase/middleware.ts` — `updateSession(request)` helper for the root middleware.
- `.env.example` — names only, no values; service role key is **not** prefixed `NEXT_PUBLIC_`.
- `supabase/migrations/0001_auth_workspaces_profiles.sql` — singleton `workspaces` row, `profiles` table joined to `auth.users`, shared `set_updated_at` trigger, RLS (operator read on workspaces; operator read + self-update + self-insert on profiles), `on_auth_user_created` trigger that auto-inserts a `profiles` row when a new `auth.users` row is created.
- `supabase/migrations/README.md` — apply via Supabase Dashboard SQL Editor or `supabase db push`; CLI is optional.

**Step 1 — Auth shell + operator login.**

- `/login` (premium dark SLATE-styled magic-link form, success / error states, `?sent=1` confirms email sent, `?error=…` surfaces controlled error copy without leaking Supabase internals).
- `/auth/callback` (route handler that exchanges `code` → session and redirects to `/app`, or to `/login?error=callback` on failure).
- Root `middleware.ts` — refreshes Supabase session on `/app/*`, `/login`, `/auth/*`; redirects unauthenticated `/app/*` → `/login`; degrades to `/login?error=config` if Supabase env is unset; leaves `/scorecard*`, `/apply/*`, `/` untouched.
- Sign-out — `signOut()` server action wired to a small icon button in the sidebar identity tile; redirects to `/login`.
- Sidebar/user identity — `app/app/layout.tsx` is now an async server layout that resolves the operator via `getOperatorIdentity()` (auth user + `profiles` row, with safe fallbacks: `display_name → email → "Operator"`, derived initials when `avatar_initials` is null), threads identity to `AppShell` → `SidebarNav`. The hard-coded "MR · M. Reyes · Strategy · Saipien Labs" string is gone.
- Login form is a client component that uses the `signInWithMagicLink` server action; `LoginForm` passes the action to a real `<form action={…}>` with a pending state.

## Data / Mock Boundary (preserved)

- `/app/*` is auth-protected.
- `/app/*` still renders mock domain data from `lib/<domain>/mock-*.ts`.
- `/scorecard/*` still uses localStorage / mock scoring.
- No scorecard submission persistence (Step 2).
- No leads persistence (Step 3).
- No engagement / intake / findings / opportunities / roadmap / reports / proposals persistence (Step 4–8).
- No activity events / notes persistence (Step 9).
- No mock data deletion. No domain queries against Supabase. The only real data this sprint introduces is auth/session/profile/workspace.

## BuildOps Boundary (preserved)

Reaffirmed: BuildOps remains documentation-only. No `/app/builds`, no BuildOps nav, no builds/sprints/agent-session/repo-context tables, no QA workspace, no deployment visibility, no BuildOps API or RLS, no BuildOps backend services. None of the above changed in this sprint.

## Verified

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean. 54 routes generate (the previous 51 prerendered routes plus `/login`, `/auth/callback`, and the now-dynamic `/app` root). `/app`, `/app/leads`, `/app/engagements` are now `ƒ` (dynamic) because the layout reads cookies; the engagement and lead detail routes still SSG via `generateStaticParams`. Middleware compiles to ~82 kB.
- Curl smoke-test against `npm run dev`:
  - `/login`, `/scorecard`, `/scorecard/start`, `/apply/ai-systems-review` → 200.
  - `/app`, `/app/leads`, `/app/engagements` (no session) → 307 → `/login`.
  - `/auth/callback` (no `code`) → 307 → `/login?error=callback`.
  - `/login?sent=1` and `/login?error=callback` → 200 with success / error UI.
  - `/` → 307 → `/app` (preserved; subsequent `/app` request bounces to `/login` for anonymous principals).
- Magic-link round-trip with a real Supabase project requires applying `0001_auth_workspaces_profiles.sql`, configuring Site URL and Redirect URL in the Supabase dashboard (`http://localhost:3000/auth/callback`), and inviting at least one operator email. Those steps are dashboard work; not testable from CI.

## Known Constraints (still)

- All deliverable content under `/app/*` remains seeded mock data. Real persistence lands route-by-route in Step 2+.
- Screenshot capture for this sprint was skipped — Playwright + Chromium are not installed locally in this environment. `/login`, `/login?sent=1`, and `/login?error=callback` were verified via curl; capture in a future session if needed for the UX audit log.

## Verification Follow-Ups (2026-05-04)

End-to-end magic-link verification revealed three small follow-ups, all closed in the same branch:

- **Operator allowlist enforced server-side.** `lib/auth/operator-allowlist.ts` reads `SLATE_OPERATOR_EMAIL_ALLOWLIST` (exact emails) and `SLATE_OPERATOR_DOMAIN_ALLOWLIST` (bare domains). `signInWithMagicLink` rejects unauthorized addresses with `/login?error=unauthorized` *before* any Supabase call, so unauthorized emails never trigger an OTP send and don't leak account existence via timing. Fail-closed: if both env vars are empty, every email is rejected. The login page surfaces the controlled copy "That email is not authorized for SLATE operator access."
- **Login form spinner fix preserved.** `components/auth/login-form.tsx` uses `useFormStatus()` from `react-dom`, which correctly resets the pending state across the same-route navigation to `/login?sent=1`. Eliminates the double-submit pitfall that previously triggered Supabase's per-email OTP cooldown.
- **Diagnostic logging sanitized.** `logAuthError` in `lib/auth/actions.ts` whitelists exactly four Supabase response fields (`name`, `code`, `status`, `message`) and never logs the email, redirect target, or raw error object.
- **Two dev-only Mgmt API helpers committed.** `scripts/dev/configure-supabase-smtp.cjs` and `scripts/dev/probe-smtp-auth.cjs`. Both read all secrets from `process.env`, redact known credential patterns from output, are clearly marked dev-only (`.cjs` under `scripts/dev/`), and are never imported by the app runtime.

## Recommended Next Step

**Step 2 — Public scorecard submission persistence.** Per `docs/persistence/02_MIGRATION_SEQUENCE.md`. Introduces `workspaces` (already seeded), `accounts`, `contacts`, `leads`, `lead_fit_dimensions`, `lead_qualification_signals`, `scorecard_submissions`, `scorecard_answers`. Server endpoint at `/api/scorecard/submit` does the scoring and inserts (service-role on server only); `/scorecard/results` switches to read-by-`submission_id` with localStorage as a resume buffer.
