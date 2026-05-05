# SLATE Current Status

_Last updated: 2026-05-05 — Persistence/Auth Step 3 (lead inbox + lead detail persistence) implemented; `/app/leads*` reads real Supabase rows under RLS_

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
| P2 | Persistence/Auth Step 2 — Public scorecard submission persistence | ✅ Complete |
| P3 | Persistence/Auth Step 3 — Lead inbox + lead detail persistence | ✅ Complete |

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

## Persistence/Auth Step 2 — what landed (2026-05-04)

Public scorecard submissions now persist to Supabase server-side. Internal fit score never leaves the server.

**Migration `0002_scorecard_leads.sql` (applied to live project).**

- Enums: `practice_area`, `lead_source`, `lead_status`, `fit_dimension_id`, `qualification_signal_direction`, `scorecard_classification`.
- Tables: `accounts`, `contacts` (citext email), `leads` (with internal `fit_score smallint`), `lead_fit_dimensions`, `lead_qualification_signals`, `scorecard_submissions` (with internal `internal_fit_score smallint` + deferred `lead_id` FK), `scorecard_answers`.
- All idempotent (`create … if not exists` + `drop policy if exists`). RLS enabled with operator-full policies workspace-scoped via `profiles.id = auth.uid()`.
- **No anon insert policies.** All public writes go through the service-role client on the server. This is a deliberate deviation from the canon "anon insert is fine" sketch — service-role-only is simpler to reason about and keeps the public schema completely unwritable to the browser.
- Indexes: `accounts(workspace_id, lower(name))` unique, `contacts(account_id, email)` unique where email not null, `leads(workspace_id, status, last_activity_at desc)`, `submissions(submitted_at desc)`, `submissions(submitted_email)`, `answers(submission_id)`, `answers(submission_id, question_id)` unique.

**Public/internal split.**

- `lib/scorecard/public-result.ts` — `PublicScoreResult = Omit<ScoreResult, "fit">` plus `toPublicScoreResult()` with an explicit field allowlist (not destructure-and-discard, since the lint config rejects unused variable bindings). Anything the public scorecard API returns to the browser must conform to this shape — `fit` is operator-only.
- `lib/leads/derive.ts` — `deriveFitDimensions(answers, result)` returns six dimensions (business_value, budget, pain_intensity, technical_readiness, buyer_readiness, expansion); `deriveQualificationSignals(answers, result)` returns 0–5 directional signals; `deriveLeadStatus(result)` maps classification + fit to status + recommended-action block.

**Server endpoints.**

- `POST /api/scorecard/submit`
  - Validates contact fields (firstName/lastName/email/company required; email regex).
  - Runs `scoreScorecard(answers)` server-side. The browser never computes the score for a real submission.
  - Looks up the singleton workspace; upserts an `accounts` row by `ilike(name)` within workspace; upserts a `contacts` row by `(account_id, email)`.
  - Inserts the submission, then `scorecard_answers` (with submission cleanup on partial failure), then the `leads` row, then `lead_fit_dimensions` + `lead_qualification_signals`, then back-fills `submissions.lead_id`.
  - Returns **only** `{ submissionId, result: PublicScoreResult, displayContext: { firstName, company } }`. No fit, no lead id, no contact id.
- `GET /api/scorecard/results/[id]`
  - UUID validation.
  - Selects only safe submission columns (`id, submitted_first_name, submitted_company, submitted_at`) — never `internal_fit_score` or `submitted_email`.
  - Re-fetches answers from `scorecard_answers`, re-runs `scoreScorecard`, returns `toPublicScoreResult(result)`.
- `lib/supabase/service.ts` — `createSupabaseServiceClient()` is server-only (`import "server-only"`), constructs a fresh client with `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`.

**Client wiring.**

- `components/scorecard/scorecard-stepper.tsx` — `submit()` now POSTs to `/api/scorecard/submit`. On success, redirects to `/scorecard/results?submission_id=<uuid>`. On failure, sets `submitError` state but keeps localStorage answers as a resume buffer. Continue button shows a spinner during submission.
- `components/scorecard/scorecard-results-view.tsx` — uses `useSearchParams()` to read `submission_id`. If present, fetches `/api/scorecard/results/<id>`. If absent, falls back to localStorage answers (computes `scoreScorecard` locally for the resume case only). Added `ResultsErrorState`.
- `components/scorecard/scorecard-result-hero.tsx` — prop type changed from `ScoreResult` to `PublicScoreResult`.
- `app/scorecard/results/page.tsx` — `export const dynamic = "force-dynamic"` (required because `useSearchParams()` precludes static prerender).

**Mock boundary preserved.**

- `/app/leads*` continues to render mock data from `lib/leads/mock-leads.ts`. The new `leads` table is populated by submissions but the operator UI is not yet wired to read it. That's Step 3.
- `/scorecard/start` and `/scorecard/results` remain unauth (only `/app/*` is gated).
- Operator allowlist + Mailgun SMTP from Step 1 follow-ups still in place.

**End-to-end smoke test (real Supabase).**

POSTed a synthetic submission to `/api/scorecard/submit`. Verified via Mgmt API SQL:

| field | value |
| --- | --- |
| submission classification | `automation_ready` |
| `internal_fit_score` (DB only) | 55 |
| lead status | `needs_review` |
| answers persisted | 14 |
| fit dimensions persisted | 6 |
| qualification signals persisted | 5 |
| account / contact upserts | 1 each |

Public response from both `submit` and `results/[id]` confirmed to contain no `fit` field. `/scorecard/start` 200 unauth; `/app` 307 → `/login` unauth — auth posture unchanged.

**Dev-only.**

- `scripts/dev/apply-migration.cjs` — applies any `supabase/migrations/*.sql` file via the Mgmt API SQL endpoint. Mirrors the SMTP helper pattern: reads PAT + REF from `.env.local` via `@next/env`, redacts secrets from output, never logs the SQL body. Used to apply both `0001_…` and `0002_…` to the live project.

## Persistence/Auth Step 3 — what landed (2026-05-05)

`/app/leads` and `/app/leads/[id]` now read real Supabase-backed lead rows. Mock lead data is retired from runtime use.

**Query layer.**

- `lib/leads/queries.ts` — server-only (`import "server-only"`). `getAllLeads()` selects `leads` with joined `accounts` (name/industry/employee_range/revenue_range), `contacts` (full_name/title/email), and `scorecard_submissions.submitted_at`, ordered by `last_activity_at desc`. `getLeadById(id)` adds parallel fetches of `lead_fit_dimensions`, `lead_qualification_signals`, and `scorecard_answers`; the answers feed `scoreScorecard()` server-side to re-derive `opportunityAreas` + `riskNotes` so the rest of the UI surface keeps consuming the existing `Lead` shape unchanged. Both functions use `createSupabaseServerClient()` (anon key + cookies) so RLS is exercised on every read; service role is **not** used in these queries. UUID guard on `getLeadById` returns `null` for non-UUID ids before hitting the DB.
- `lib/leads/mappers.ts` — DB↔TS shape translators. Hyphenated TS unions (`public-scorecard`, `high-fit`, `business-value`, etc.) ↔ underscored DB enums (`public_scorecard`, `high_fit`, `business_value`). `formatRelative(iso)` renders the persisted `last_activity_at` timestamp as the short relative phrase (`12 minutes ago`, `Yesterday`, `Last week`, `Mar 14, 2026`) the existing UI already expects. `orderFitDimensions` reshuffles dimensions into the canonical UI order regardless of insertion order.

**Lead inbox (`/app/leads`).**

- Server component. `export const dynamic = "force-dynamic"`.
- Same five status `MetricCard`s + `LeadList` filter tabs as before; the count math now reflects live row counts.
- New empty state: when `total === 0`, renders `EmptyState` with copy "No scorecard submissions yet — When someone completes the AI Workflow Scorecard, their lead record will appear here for review." plus an "Open public scorecard" link. No fake CRM placeholder counts.
- Page meta strip eyebrow updated from `Sprint 3 · Mock data` → `Persistence Step 3 · Live`.

**Lead detail (`/app/leads/[id]`).**

- Server component. `export const dynamic = "force-dynamic"`. `generateStaticParams` removed (lead ids are now per-submission UUIDs, not slugs).
- Fetches a single lead via `getLeadById`. `notFound()` when the lead doesn't exist or RLS denies (no error leak).
- All existing components reused unchanged: `LeadProfileHeader`, `ScorecardSummaryPanel`, `OpportunityAreaCard`, `RiskReadinessNote`, `QualificationSignalsPanel`, `RecommendedActionCard`, `InternalFitScorePanel`, `LeadActionsPanel`, `LeadSourceCard`, `LeadNotesPanel`.
- `OpportunityAreaCard`, `RiskReadinessNote`, `QualificationSignalsPanel` render conditionally on the underlying arrays being non-empty so a freshly-created lead with no signals doesn't ship empty headers.
- Notes panel surfaces an empty list (notes persistence lands in Step 9). `LeadActionsPanel` continues to render its existing mock buttons; engagement creation is **not** wired this step (Step 4).

**Internal fit boundary preserved.**

- `internal_fit_score`, `lead_fit_dimensions`, and `lead_qualification_signals` are read only from the authenticated server client inside `/app/*`. They never touch a public route. `lib/scorecard/public-result.ts` continues to strip `fit` from any response that leaves `/api/scorecard/*`.

**Mock retirement.**

- `lib/leads/mock-leads.ts` deleted. No other route imported it.
- Engagement / intake / findings / opportunities / roadmap / reports / proposals / activity events all remain mock-backed. `engagementForLead(leadId)` continues to return `undefined` for UUID-keyed leads (the mock engagements still key off the legacy slug ids); that gracefully renders the `LeadActionsPanel`'s "Mock — not wired" affordance until Step 4.

**RLS / security.**

- Reused existing `0002_scorecard_leads.sql` policies. Each affected table has an operator policy of the shape `for all to authenticated using (workspace_id = (select id from public.workspaces limit 1))` (or an `EXISTS` join to a parent that does). For sub-tables without a direct `workspace_id`, the policy joins through the parent. No new migration was required — `0003_lead_query_policy_fix.sql` was scoped but not authored because the existing posture covers the new authenticated reads.
- Verified posture: anonymous principal cannot select `leads`/`accounts`/`contacts`/`lead_fit_dimensions`/`lead_qualification_signals`/`scorecard_submissions` (no `to anon` policies exist). Authenticated server client reads under RLS as expected.
- `/app/leads*` continues to be middleware-gated; anonymous traffic 307s to `/login`.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean. 48 routes generate. `/app/leads` and `/app/leads/[id]` are now both `ƒ` (dynamic) — expected because they cookie-bind a Supabase session for RLS.
- Secret handling: `.env.local` was not read, modified, or staged; `git status --short --ignored` shows it as `!!`-ignored. No service role key, magic-link URL, or other credential printed during this sprint.

## Recommended Next Step

**Step 4 — Engagement creation + engagement detail persistence.** Migrate `/app/engagements*` from `MOCK_ENGAGEMENTS` to a real `engagements` table joined on the new `leads.account_id`. The lead detail "Start AI Opportunity Sprint" CTA becomes a real `createEngagementFromLead(leadId)` server action that ties `linked_lead_id` to the persisted lead, snapshots scorecard summary, and sets the lead's status to `converted`. Per `docs/persistence/02_MIGRATION_SEQUENCE.md`.
