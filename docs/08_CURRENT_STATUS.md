# SLATE Current Status

_Last updated: 2026-05-06 — AI Synthesis Step 2 (operator-triggered draft opportunity generation) implemented; `Generate draft opportunities` CTA on `/app/engagements/[id]/opportunities` produces 2–6 draft opportunities from approved/report-ready findings, server-derives quadrant + priority from clamped scores (high-risk override preserved), persists `opportunity_finding_links` for traceability, drafts enter `status = draft` and require operator selection/defer/reject before they enter the roadmap_

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
| P4 | Persistence/Auth Step 4 — Engagement creation + engagement detail persistence | ✅ Complete |
| P4.5 | Persistence/Auth Step 4.5 — Public scorecard anti-abuse + email quality | ✅ Complete |
| P5 | Persistence/Auth Step 5 — Stakeholder intake + documents persistence | ✅ Complete |
| P6 | Persistence/Auth Step 6 — Findings persistence | ✅ Complete |
| P7 | Persistence/Auth Step 7 — Opportunities + roadmap persistence | ✅ Complete |
| P8 | Persistence/Auth Step 8 — Reports + proposals persistence | ✅ Complete |
| P9 | Persistence/Auth Step 9 — Activity events + notes persistence | ✅ Complete |
| P10 | Persistence/Auth Step 10 — File / document binary storage | ✅ Complete |
| AI1 | AI Synthesis Step 1 — Findings draft generation | ✅ Complete |
| AI1.1 | AI Synthesis Step 1.1 — Findings discoverability + guidance | ✅ Complete |
| AI2 | AI Synthesis Step 2 — Opportunity drafting from approved findings | ✅ Complete |

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

## Persistence/Auth Step 4 — what landed (2026-05-05)

`/app/engagements` and `/app/engagements/[id]` now read real Supabase-backed engagement rows. Clicking `Start AI Opportunity Sprint` on a real lead creates (or reopens) a real engagement linked to that lead.

**Migration `0003_engagements.sql`.**

- New enums: `engagement_type`, `engagement_status`, `engagement_stage`.
- New table `engagements` with: `workspace_id`, `account_id`, `contact_id`, `linked_lead_id`, `name`, `engagement_type`, `status`, `current_stage`, `owner_profile_id`, `target_date`, `last_activity_at`, `next_milestone`, `recommended_action jsonb`, six per-stage status `jsonb` columns (`intake_status` / `document_status` / `findings_status` / `opportunity_status` / `report_status` / `proposal_status`), `risk_notes`/`dependencies`/`notes`/`source_snapshot` jsonb, plus `created_at` / `updated_at` with the shared `set_updated_at` trigger.
- Indexes on `(workspace_id, last_activity_at desc)`, `account_id`, `contact_id`, `linked_lead_id`, `current_stage`, `status`, plus a partial **unique** index on `linked_lead_id where linked_lead_id is not null` so re-clicking `Start AI Opportunity Sprint` from the same lead always reopens the same workspace.
- RLS enabled with `engagements_operator_full` policy: `for all to authenticated using/with check (workspace_id = (select id from public.workspaces limit 1))`. No anon access.

**Query / action layer.**

- `lib/engagements/queries.ts` (server-only) — `getAllEngagements()` selects engagements joined to `accounts` (name/industry/practice_area), `contacts` (full_name/title/email), and `profiles` (display_name) ordered by `last_activity_at desc`. `getEngagementById(uuid)` reads a single row; `getEngagementIdForLead(leadUuid)` powers the lead actions panel CTA.
- `lib/engagements/mappers.ts` — DB↔TS mapping for engagement enums (underscored ↔ hyphenated), defensive jsonb parsers for each panel-status block (with safe defaults so a missing column never crashes the UI), `formatRelative()` for `last_activity_at`, and `defaultIntakeStatus()` / etc. used both at insert time and as render fallbacks.
- `lib/engagements/actions.ts` — single server action `createOrOpenEngagementForLead(leadId)` that auth-checks via `supabase.auth.getUser()`, looks up any existing engagement by `linked_lead_id`, otherwise loads the lead + account + contact + submission, builds a starter engagement (initial stage `setup` or `intake` depending on lead status), persists default panel status JSON, owner_profile_id = current operator, source_snapshot capturing `{ leadId, submissionId, classification, ai/friction/systems, capturedAt, scorecardSummary }`, then updates lead status to `diagnostic_requested` if it was `new` / `needs_review` / `high_fit`, then redirects to `/app/engagements/<uuid>`. Race protection on the unique linked_lead_id index (PG `23505` falls through to the existing engagement).
- `lib/engagements/load-for-subroute.ts` — small helper used by every downstream sub-route. Tries the legacy mock fixtures first (so `atlas-aios-q2` etc. demo paths keep working), falls back to a real engagement lookup. Returns `{ kind: "mock" | "real", engagement }` so the page can render either its existing mock workspace or the persistence placeholder.

**Engagement list (`/app/engagements`).**

- Server component, `force-dynamic`. Reads via `getAllEngagements()`. The five existing pipeline `MetricCard`s and the `EngagementList` filter tabs all render against real rows. Eyebrow updated from `Sprint 4 · Mock data` → `Persistence Step 4 · Live`.
- Empty state: when zero rows, renders `EmptyState` with copy *"No engagements yet — Start an AI Opportunity Sprint from a qualified lead to create the first workspace."* plus a primary `Open Leads` CTA.

**Engagement detail (`/app/engagements/[id]`).**

- Server component, `force-dynamic`. Reads via `getEngagementById()`. UUID-guarded; `notFound()` on missing or RLS-denied. `generateStaticParams` removed.
- Components reused unchanged (`EngagementProfileHeader`, `EngagementStageTracker`, `StakeholderProgressPanel`, `DocumentStatusPanel`, `FindingsStatusPanel`, `OpportunityStatusPanel`, `ReportStatusPanel`, `ProposalStatusPanel`, `EngagementRisksPanel`, `EngagementContextCard`, `EngagementRecommendedActionCard`, `EngagementNotesPanel`).
- Each status panel renders a sensible default when its underlying jsonb column is null (a freshly-created engagement shows "Ready to send" intake, "Not yet requested" docs, etc., with stage-appropriate next-action copy).

**Lead → engagement flow.**

- `components/leads/lead-actions-panel.tsx` now binds the `Start AI Opportunity Sprint` button to `createOrOpenEngagementForLead(leadId)` via a `<form action={…}>` (no client JS path on the action itself). When an engagement already exists, the button switches to a `Link` labeled `Open AI Opportunity Sprint` that points at the existing workspace.
- `app/app/leads/[id]/page.tsx` looks up `getEngagementIdForLead(lead.id)` to pick the right CTA mode, removed the legacy `engagementForLead(slug)` call.
- Re-clicking from the same lead is idempotent: the unique partial index on `engagements.linked_lead_id` plus the action's existing-row check guarantees a single engagement per lead. The race path catches `23505` and falls through to the existing record.

**Downstream sub-route boundary.**

- The six engagement sub-routes (`/intake`, `/findings`, `/opportunities`, `/roadmap`, `/report`, `/proposal`) now use `loadEngagementForSubroute(id)`. For legacy mock slug ids (`atlas-aios-q2`, `helio-aios-q2`, `meridian-aios-q2`, `quanta-aios-q2`, `caldera-aios-q2`) they continue to render their seeded workspaces unchanged. For UUID-keyed real engagements they render a shared `EngagementPersistencePlaceholder` (premium dark surface with eyebrow / title / description / activates-in label / Back-to-engagement CTA / engagement context card / recommended action). No fake downstream data is ever generated for a real engagement.
- All six sub-routes are now `force-dynamic`; `generateStaticParams` removed because the route accepts both seed slugs and UUIDs.

**Mock engagement boundary preserved.**

- `lib/engagements/mock-engagements.ts` retained as the fixture set for legacy slug-keyed demo paths. A header comment now documents that runtime engagement list/detail use Supabase and that this file remains only for the downstream advisory workspaces until Steps 5–8.
- All other domain mock files (`lib/intake`, `lib/findings`, `lib/opportunities`, `lib/roadmap`, `lib/reports`, `lib/proposals`) untouched.

**RLS / security.**

- Authenticated operators can `select` / `insert` / `update` / `delete` engagements; no `to anon` policies exist. `linked_lead_id` is nullable but indexed `unique where not null` so manual operator-created engagements (no source lead) stay supported.
- The server action calls `supabase.auth.getUser()` before any read/write so an unauthenticated request bounces to `/login` rather than relying solely on RLS to refuse the insert.
- No service role used in engagement code paths — internal reads/writes go through the authenticated cookie-bound server client.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean. 21 routes generate. `/app/engagements`, `/app/engagements/[id]`, and all six engagement sub-routes are `ƒ` dynamic.
- Secret handling: `.env.local` was not read, modified, or staged; `git status --short --ignored` shows it as `!!`-ignored. No service role key, magic-link URL, or other credential printed during this sprint.

## Persistence/Auth Step 4.5 — what landed (2026-05-05)

A hardening sprint between Step 4 and Step 5. Public scorecard submissions now run through a server-side anti-abuse + email-quality pipeline before they're persisted, and the resulting leads carry a small operator-only trust chip.

**Migration `0004_scorecard_abuse_hardening.sql`.**

- `scorecard_submissions` gains nullable columns: `email_normalized`, `email_domain`, `email_quality text default 'unknown'`, `email_verified boolean default false`, `anti_abuse_status text default 'accepted'`, `anti_abuse_reasons text[]`, `submission_duration_ms integer`, `honeypot_value text`, `client_fingerprint_hash text`. Permitted values stay enforced in app code (text columns, not enums) so the vocabulary can evolve without another migration.
- `leads` gains `trust_status text default 'unverified'` and `trust_reasons text[]`. Indexed on `(workspace_id, trust_status, last_activity_at desc)` for the operator-side filter that lands later.
- New indexes on `scorecard_submissions(email_normalized, submitted_at desc)` and `(email_domain, submitted_at desc)` for the rate-limit count queries; one on `(anti_abuse_status, submitted_at desc)` for ops triage. RLS posture unchanged.

**Email quality (`lib/scorecard/email-quality.ts`).**

- `normalizeEmail`, `isValidEmailSyntax`, `getEmailDomain`, `isDisposableEmailDomain`, `isFreeEmailDomain`, `isFakeEmailDomain`, and `classifyEmailQuality(rawEmail)`.
- Hand-curated disposable list (~17 domains) covers the common throwaway hosts (`mailinator`, `tempmail`, `10minutemail`, `guerrillamail`, `yopmail`, `trashmail`, `sharklasers`, `getairmail`, `fakeinbox`, `maildrop`, `dispostable`, `mintemail`, `mohmal`, etc.). Fake list adds `example.com` / `test.com` etc. Free-provider list (~22 domains) is allowed but tagged.
- No DNS / MX checks. No third-party validation services.

**Submit route hardening (`app/api/scorecard/submit/route.ts`).**

- Public error vocabulary narrowed and typed: `invalid-json`, `invalid-submission`, `missing-fields`, `invalid-email`, `disposable-email`, `submission-too-fast`, `rate-limited`, `service-not-configured`. Internal abuse details never leak.
- **Honeypot.** A hidden `website` field is read from `payload.honeypot` and from `answers.website`. Any non-empty value rejects with 400 `invalid-submission`. The honeypot value itself is never persisted (`honeypot_value` is always written `null`).
- **Duration thresholds.** `< 15s` rejects `submission-too-fast`; `15s–45s` flags but accepts; `> 45s` accepted.
- **Disposable / fake email blocks.** Reject before reaching the DB. Free-provider emails accept-but-flag.
- **Rate limiting.** Two cheap counts against the new indexes — per `email_normalized` (max 3/h) and per `email_domain` (max 6/h, **skipped for free-provider domains** so a normal Gmail population doesn't fight itself). On limit, returns 429 `rate-limited`.
- **Fingerprint hash.** `sha256(userAgent | locale | timezone | normalizedEmail)` stored as `client_fingerprint_hash`. Coarse repeat-submission bucket; not a tracking fingerprint. **Raw IP is never collected or stored.**
- All abuse signals collapse into `anti_abuse_status` (`accepted` | `flagged`) and `anti_abuse_reasons` on submissions, plus `trust_status` (`unverified` | `flagged`) and `trust_reasons` on leads. `verified` and `rejected` are reserved for the email-click-verification sprint and a future operator action.
- Email is normalized before contact upsert and submission insert so the same prospect using `Mike@Acme.COM` and `mike@acme.com` lands on the same contact row.

**Stepper hardening (`components/scorecard/scorecard-stepper.tsx`).**

- Tracks `startedAt` on first hydration, persists it into `slate.scorecard.v1` so a refresh / resume preserves the duration baseline.
- Sends `clientMeta = { startedAtIso, completedAtIso, submissionDurationMs, locale, timezone }` and the empty `honeypot` field on POST.
- Visually-hidden honeypot input (`-left-[9999px]`, `aria-hidden`, `tabIndex={-1}`, `autocomplete="off"`).
- Maps the new public error codes to typed copy.

**Internal lead trust chip.**

- `LeadTrustStatus` union added to `Lead` type. `lib/leads/queries.ts` selects + `mappers.ts` translation surface `trust_status` + `trust_reasons` into the existing `Lead` shape.
- New `components/leads/lead-trust-chip.tsx` — small `Badge` with status-tinted icon. Reasons render as a `title` hover tooltip.
- Wired into `LeadListItem` (top-right cluster, next to status + fit) and `LeadProfileHeader`. **Never rendered on a public surface.**

**Email delivery decision (deferred).**

- SLATE will continue showing immediate scorecard results in-browser while storing email/trust metadata. Email delivery and email-click verification are deferred to a later conversion/notification sprint.

**Public/internal boundary preserved.**

- Public response shape unchanged: `{ submissionId, result: PublicScoreResult, displayContext }`. No `fit`, no `trust_status`, no `anti_abuse_status`, no abuse reasons.
- Public error responses are coded with controlled strings; no internal stacktrace, DB error, or schema detail leaks.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean. 21 routes generate. `/scorecard/start` and `/app/leads` grew slightly to accommodate the honeypot field and the trust chip; everything else unchanged.
- Secret handling: `.env.local` was not read, modified, or staged; no Supabase keys, service role key, or magic-link URL printed during this sprint.

## Persistence/Auth Step 5 — what landed (2026-05-05)

`/app/engagements/[id]/intake` now reads/writes real stakeholder intake sessions, responses, and lightweight input-asset metadata for UUID engagements. Operators mint token-gated `/intake/<token>` links manually; stakeholders submit responses on a public route without a SLATE login. Email automation, file upload, and AI synthesis remain deferred.

**Migration `0005_stakeholder_intake.sql`.**

- `stakeholder_intake_sessions` — workspace + engagement scoped, sha256 `token_hash` (unique), `token_expires_at`, status / response_quality as text columns so vocabulary can evolve, contact join optional, `last_activity_at` / `started_at` / `completed_at` timestamps.
- `stakeholder_responses` — one row per (session, question), unique `(session_id, question_id)`, `answer_text` + optional `answer_json`, cascades on session delete.
- `input_assets` — metadata only (no Supabase Storage bucket yet). Title / type / status / evidence-quality / linked-role / summary / metadata jsonb. Cascades on engagement delete; nullable session link.
- RLS enabled with operator-only `for all to authenticated using/with check (workspace_id = (select id from public.workspaces limit 1))`. **No anon policies** — public stakeholder writes go through a server-only service-role client that scopes by token hash.

**Token model.**

- `lib/intake/tokens.ts` — `generateIntakeToken()` (32 random bytes, base64url), `hashIntakeToken()` (sha256 hex), `compareTokenHashes()` (constant time), `isPlausibleRawToken()` (cheap shape guard before any DB call), `buildIntakeUrl()`. The raw token is returned exactly once at creation; only the hash is persisted. Tokens default to a 21-day TTL.
- Token never appears in logs, telemetry, server responses to other principals, or final reports.

**Public stakeholder route `/intake/[token]`.**

- `app/intake/[token]/page.tsx` — server-rendered, anonymous, `force-dynamic`, `robots: { index: false, follow: false }`. Hashes the URL token, looks up the session via `lib/intake/public.ts` (service role), validates `token_expires_at`, renders one of three states: invalid / expired / completable. Reuses the public `PublicAssessmentShell` for visual continuity with the scorecard.
- `components/intake/public-intake-form.tsx` (`"use client"`) — renders the seven seed questions from `lib/intake/seed-questions.ts`, pre-fills any prior responses, submits via the page-local `submitPublicIntake` server action which delegates to `submitStakeholderResponses` in `lib/intake/public.ts`. Public surface only exposes `companyName`, `engagementName`, and the stakeholder's role / name / title — never internal fit, lead trust reasons, or scorecard summary internals.

**Operator intake workspace.**

- `lib/intake/queries.ts` (server-only) — `getIntakeRecordForEngagement(engagementId)` returns the existing `IntakeRecord` shape from real rows, derives role coverage from a fixed required-role set and the stakeholders' statuses, and emits a follow-up queue + intake risk notes. `getIntakeStatusSummary(engagementId)` powers the engagement detail page's Stakeholder Progress panel.
- `lib/intake/mappers.ts` — DB↔TS shape translators. Underscored `customer_success` ↔ hyphenated `customer-success` role enum mapping, status / quality / asset-type / asset-status / evidence-quality conversions, summary-text builder that prefers the automation-wishlist or success-for-role response, completion-percent heuristic from response count, formatRelativeOrDash for the persisted timestamps.
- `lib/intake/seed-questions.ts` — seven generic intake questions plus a per-role contextual prompt rendered at the top of the public form.
- `lib/intake/actions.ts` (`"use server"`) — `createStakeholderSession({ engagementId, name, email, title, role, department })` validates the inputs, requires an authenticated operator session, generates a fresh token, persists the hash, and returns `{ ok: true, sessionId, intakeUrl }` exactly once. Calls `revalidatePath` for both the intake workspace and the engagement detail.
- `components/intake/create-stakeholder-form.tsx` (`"use client"`) — minimal operator form (name / email / title / role / department) with a one-time copy block for the generated link and an explicit "Copy this intake link and send it manually. Email automation lands later." caption. Surfaces a soft warning when the source lead is `flagged` / `rejected` per Step 4.5 trust metadata: "This lead was flagged during public scorecard submission. Confirm before sending stakeholder intake." — never blocks.
- `app/app/engagements/[id]/intake/page.tsx` — branches on the `loadEngagementForSubroute` result. For UUID engagements it loads the live intake record, exposes the create-stakeholder form, and stamps the meta strip "Persistence Step 5 · Live". For legacy slug engagements it continues to render the seeded mock workspace. Empty state: "Invite stakeholders above. Each invite generates a unique token-gated link…" with role coverage, supporting inputs, and follow-up queue still rendered.

**Engagement detail status panel.**

- `app/app/engagements/[id]/page.tsx` overlays a derived intake summary on top of the persisted `intake_status` jsonb when `getIntakeStatusSummary` returns rows. Roles covered / missing, `stakeholdersInvited` / `stakeholdersResponded`, status badge tone, and next-action copy all reflect the live tables. Engagements with zero sessions keep their existing default copy.

**Mock boundary preserved.**

- Legacy mock slug engagements (`atlas-aios-q2`, `helio-aios-q2`, `meridian-aios-q2`, `quanta-aios-q2`, `caldera-aios-q2`) continue to render the seeded `MOCK_INTAKE` fixtures. Real UUID engagements now render the persisted workspace.
- `/findings`, `/opportunities`, `/roadmap`, `/report`, `/proposal` remain placeholder-rendered for UUID engagements until Steps 6–8.

**RLS / security.**

- Authenticated operators read/write all three new tables (workspace-scoped). No anon policies; the public stakeholder route never authenticates, so its reads/writes happen through the server-only service-role client gated by token-hash lookup.
- Tokens are never stored in raw form, never logged, never returned to anyone other than the operator at creation time. The page exposing the token URL is operator-side only and behind `/app/*` middleware auth.
- Public route does not expose `internal_fit_score`, lead `trust_status`, lead `trust_reasons`, scorecard summary internals, or recommended-action operator copy.
- Service role key is read only inside `lib/supabase/service.ts` (already `import "server-only"`); no new client-bundle exposure.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean.
- Secret handling: `.env.local` was not read, modified, or staged; no Supabase keys, service role key, magic-link URL, or raw intake tokens printed during this sprint.

## Persistence/Auth Step 6 — what landed (2026-05-05)

`/app/engagements/[id]/findings` now reads/writes real findings and source references for UUID engagements. Operators author findings manually with optional links to existing stakeholder intake responses or input assets; review actions (approve / reject / mark report-ready / reopen / reviewer note) persist to Supabase. Engagement detail's Findings panel reflects live counts via a derived overlay.

**Migration `0006_findings.sql`.**

- `findings` — workspace + engagement scoped, `category` / `confidence` / `review_status` as text columns so vocabulary can evolve, `assumption_flag` (bool) + `assumption_note` for reviewer flags, `reviewer_note`, `ai_drafted` (default false for manual findings), `position` for stable ordering, `reviewed_by` FK + `last_reviewed_at`, `created_at` / `updated_at` with the shared trigger.
- `finding_source_refs` — workspace + engagement + finding scoped, `source_type` (text) for `stakeholder_response` / `input_asset` / `scorecard_answer` / `consultant_note`, optional `source_id` (uuid) plus display fields (`source_label`, `source_role`), `excerpt`, `strength` (text), `metadata jsonb`. Cascades on finding delete.
- RLS enabled with operator-only `for all to authenticated using/with check (workspace_id = (select id from public.workspaces limit 1))` on both tables. **No anon policies.** Findings are operator-only — public `/intake/[token]` cannot read them.

**Query / action layer.**

- `lib/findings/queries.ts` (server-only) — `getFindingsForEngagementPersisted(uuid)`, `getFindingByIdPersisted(uuid)`, `getFindingsStatusSummary(uuid)`, and `getEvidenceCandidatesForEngagement(uuid)` returning intake-response + input-asset candidates the operator can attach as source refs.
- `lib/findings/mappers.ts` — DB↔TS translators for category / review-status / confidence / source-type / strength enums (underscored ↔ hyphenated). `mapFindingRow(row, refs)` returns the existing TS `Finding` shape so the visual workspace components stay unchanged.
- `lib/findings/actions.ts` (`"use server"`) — `createManualFinding`, `approveFinding`, `rejectFinding`, `markFindingReportReady`, `markFindingNeedsReview`, `updateFindingNote`, `editFinding`. Every action `auth.getUser()`-gates, stamps `reviewed_by` + `last_reviewed_at`, bumps the engagement's `last_activity_at`, and `revalidatePath`s both the findings route and the engagement detail.

**Findings workspace.**

- `components/findings/findings-workspace.tsx` (existing) gained an optional `renderActionBar?: (finding) => React.ReactNode` prop. Mock paths render the existing static action bar; persisted paths inject the real action bar.
- `components/findings/review-action-bar.tsx` (new, `"use client"`) — wires Approve / Mark report-ready / Add note / Reopen / Reject buttons to the server actions via `useTransition`, with inline note editor and compact pending / error / saved feedback. Reviewer-note edit is operator-only.
- `components/findings/create-finding-form.tsx` (new, `"use client"`) — operator form with category, statement, summary, evidence summary, confidence, suggested impact, assumption flag + note, reviewer note, and an evidence multi-selector that lists intake responses + input assets from the same engagement. Selected candidates persist as `finding_source_refs` rows on save.
- `app/app/engagements/[id]/findings/page.tsx` — branches on `loadEngagementForSubroute`. UUID engagements load real findings + evidence candidates, render the create-finding form, and render the workspace with persisted review actions; legacy slug engagements continue to render seeded `MOCK_FINDINGS`. Empty state for UUID engagements with zero findings: "Add a manual finding from stakeholder intake evidence above, or wait for AI-assisted synthesis in a later sprint." Meta strip toggles between "Persistence Step 6 · Live" and "Sprint 5 · Mock data".

**Engagement detail status panel.**

- `app/app/engagements/[id]/page.tsx` overlays a derived findings summary on top of the persisted `findings_status` jsonb when `getFindingsStatusSummary` returns rows. Approved + report-ready counts merge into the panel's `approved` total; tone / next-action copy reflect the live triage state. Engagements with zero findings keep their existing default copy.

**Mock boundary preserved.**

- Legacy mock slug engagements continue to render seeded `MOCK_FINDINGS` with the existing static action bar.
- `/opportunities`, `/roadmap`, `/report`, `/proposal` remain placeholder-rendered for UUID engagements until Steps 7–8.

**RLS / security.**

- Operators have full CRUD on `findings` and `finding_source_refs`, workspace-scoped via the existing single-workspace policy shape.
- No anon policies; the public `/intake/[token]` route never authenticates and has no path to findings reads.
- All review actions evaluate under RLS with the operator's `auth.uid()`. No service-role client touches the findings code path.
- Reviewer-note text and stakeholder excerpts surfaced in `EvidencePanel` are operator-only — public surfaces never reach them.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean.
- Secret handling: `.env.local` was not read, modified, or staged; no Supabase keys, service role key, magic-link URL, raw intake tokens, or stakeholder PII printed during this sprint.

## Persistence/Auth Step 7 — what landed (2026-05-05)

`/app/engagements/[id]/opportunities` and `/app/engagements/[id]/roadmap` now read/write real opportunities, opportunity↔finding links, and 30/60/90 roadmap items for UUID engagements. Operators score opportunities from approved or report-ready findings, defer/select/reject them, and manually sequence selected opportunities into a roadmap. Engagement detail's Opportunities panel reflects live quadrant + selection + roadmap-progress counts via a derived overlay.

**Migration `0007_opportunities_roadmap.sql`.**

- `opportunities` — workspace + engagement scoped, six 0–100 score columns (`business_impact_score`, `complexity_score`, `risk_score`, `time_to_value_score`, `adoption_likelihood_score`, `strategic_value_score`), text-typed `category` / `priority` / `quadrant` / `evidence_strength` / `status` (`draft` / `scored` / `selected` / `deferred` / `rejected`), array columns for `dependencies` / `risks` / `success_signals`, plus `position` / `reviewed_by` / `last_reviewed_at` / standard timestamps. RLS enabled with operator-only `for all to authenticated` policy.
- `opportunity_finding_links` — workspace + engagement + opportunity + finding scoped, with a unique `(opportunity_id, finding_id)` index. RLS operator-only.
- `roadmap_items` — workspace + engagement scoped, `phase` (`first_30` / `days_31_60` / `days_61_90`), `priority`, `status` (`planned` / `ready` / `blocked` / `deferred` / `completed`), array columns for `key_actions` / `dependencies` / `success_criteria` / `risks`, optional `opportunity_id` FK on delete `set null`. RLS operator-only.

**Opportunity query / action layer.**

- `lib/opportunities/queries.ts` (server-only) — `getOpportunitiesForEngagementPersisted(uuid)`, `getOpportunityStatusSummary(uuid)`, `getFindingCandidatesForEngagement(uuid)` (approved + report-ready findings only), and `getMinimalFindingsForEngagement(uuid)` to feed the related-findings panel without re-loading source refs.
- `lib/opportunities/mappers.ts` — DB↔TS translators for priority / quadrant / category / evidence-strength / status, score clamping (0–100), TS Opportunity emission.
- `lib/opportunities/actions.ts` (`"use server"`) — `createOpportunity`, `updateOpportunityScores`, `markOpportunitySelected`, `deferOpportunity`, `rejectOpportunity`, `reopenOpportunity`. Quadrant + priority are derived server-side from impact + complexity + risk via `computeQuadrant` (with a high-risk override → `defer-avoid` when `risk >= 85`). Every action `auth.getUser()`-gates, stamps `reviewed_by` / `last_reviewed_at`, bumps engagement activity, and `revalidatePath`s opportunities + roadmap + engagement detail.
- `lib/opportunities/types.ts` — `Opportunity` gained an optional `status?: OpportunityStatus`. Mock fixtures omit it; persisted records always set it.

**Roadmap query / action layer.**

- `lib/roadmap/queries.ts` (server-only) — `getRoadmapForEngagementPersisted(uuid)`, `getRoadmapStatusSummary(uuid)`, `getOpportunityCandidatesForEngagement(uuid)`.
- `lib/roadmap/mappers.ts` — DB↔TS translators for phase / priority / status, TS RoadmapItem emission.
- `lib/roadmap/actions.ts` (`"use server"`) — `createRoadmapItem`, `setRoadmapItemStatus`, `removeRoadmapItem`. Each action authenticates, bumps engagement activity, and revalidates the roadmap + engagement detail.

**Opportunity workspace.**

- `components/opportunities/opportunities-workspace.tsx` got a new optional `renderActionBar?: (opportunity: Opportunity) => React.ReactNode` render-prop that injects a per-opportunity action panel inside the detail column.
- `components/opportunities/create-opportunity-form.tsx` (new, `"use client"`) — operator form with title / category / description, six 0–100 score inputs, evidence strength selector, source summary / recommended action / implementation shape, three textareas (dependencies / risks / success signals) split on newlines, and a finding multi-selector listing approved + report-ready findings.
- `components/opportunities/opportunity-action-bar.tsx` (new, `"use client"`) — Mark selected / Defer / Reopen / Reject buttons via `useTransition`, with status badge.
- `app/app/engagements/[id]/opportunities/page.tsx` — branches on `loadEngagementForSubroute`. UUID engagements load real opportunities + finding candidates and render the create form + persisted action bar. Empty state for UUID engagements with zero opportunities: "Create opportunities from approved or report-ready findings using the form above. Quadrant placement is derived from impact + complexity + risk on save." Meta strip toggles between "Persistence Step 7 · Live" and "Sprint 6 · Mock data".

**Roadmap workspace.**

- `components/roadmap/create-roadmap-item-form.tsx` (new, `"use client"`) — operator form with phase / priority selectors, optional opportunity link (drawn from the candidates query), title + objective inputs, four textareas (key actions / dependencies / success criteria / risks) split on newlines, and owner placeholder + readiness note.
- `app/app/engagements/[id]/roadmap/page.tsx` — branches on `loadEngagementForSubroute`. UUID engagements load real roadmap items + opportunity candidates and render the create form + phase columns. Empty state for UUID engagements with zero items: "Add roadmap items from selected opportunities using the form above. Each item lives in 30, 60, or 90-day sequencing and links back to its source opportunity." Meta strip toggles between "Persistence Step 7 · Live" and "Sprint 6 · Mock data".

**Engagement detail status panel.**

- `app/app/engagements/[id]/page.tsx` overlays a derived opportunity summary on top of `engagement.opportunities` when at least one opportunity exists. Total / quick wins / strategic builds / defer counts and the status badge tone reflect live data; when at least one roadmap item exists, the scoring-state copy switches to a 30/60/90 breakdown ("X · Y · Z roadmap items sequenced") and the next-action copy bumps to roadmap milestones (blocked items, sequencing prompts, completion). Engagements with zero opportunities keep their existing default copy.

**Mock boundary preserved.**

- Legacy slug engagements continue to render `MOCK_OPPORTUNITIES` and `MOCK_ROADMAP` fixtures unchanged, with no create-form rendered.
- `/report`, `/proposal` remain placeholder-rendered for UUID engagements until Step 8.

**RLS / security.**

- Operators have full CRUD on `opportunities`, `opportunity_finding_links`, and `roadmap_items`, workspace-scoped via the existing single-workspace policy shape.
- No anon policies; the public `/intake/[token]` route never authenticates and has no path to opportunities or roadmap reads.
- All actions evaluate under RLS with the operator's `auth.uid()`. No service-role client touches the opportunities/roadmap code path.
- Finding evidence linked to an opportunity is operator-only — finding statements / source-ref excerpts never leak to public surfaces.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean.
- Secret handling: `.env.local` was not read, modified, or staged; no Supabase keys, service role key, magic-link URL, raw intake tokens, stakeholder PII, or finding excerpts printed during this sprint.

## Persistence/Auth Step 8 — what landed (2026-05-05)

`/app/engagements/[id]/report` and `/app/engagements/[id]/proposal` now read/write real reports, report sections, and proposals + options for UUID engagements. Operators initialize a 12-section report and a 3-option proposal per engagement, approve sections, mark a recommended option, and edit implementation credit copy — all under operator-only RLS. Production export, SOW draft, send, and e-signature remain locked behind `LockedActionButton`. Engagement detail's Report and Proposal panels reflect live counts via two new derived overlays.

**Migration `0008_reports_proposals.sql`.**

- `reports` — workspace + engagement scoped, unique `(engagement_id)`, text-typed `status` / `export_status`, `recommended_next_step`, `consultant_notes` text[], `reviewed_by` / `last_reviewed_at`. RLS operator-only `for all to authenticated using/with check (workspace_id = (select id from public.workspaces limit 1))`.
- `report_sections` — workspace + engagement + report scoped, unique `(report_id, section_type)`, text-typed `section_type` / `status` / `confidence`, `summary` / `draft_preview` / `evidence_notes` / `reviewer_note`, `ai_drafted` bool, `position` for canonical ordering. RLS operator-only.
- `report_section_finding_links`, `report_section_opportunity_links`, `report_section_roadmap_links` — three join tables with `(report_section_id, ref_id)` unique pairs and cascading `on delete cascade` from both sides. Each has its own engagement-scoped index for cross-section evidence queries. RLS operator-only.
- `proposals` — workspace + engagement scoped, unique `(engagement_id)`, text-typed `status` / `export_status`, `recommended_option_id` (nullable FK on delete `set null` to `proposal_options`), text/array columns for `assumptions` / `dependencies` / `next_step`, plus four implementation-credit columns (`credit_eligible bool`, `credit_amount_placeholder`, `credit_window`, `credit_notes`) defaulting to the canonical commercial-lever copy. RLS operator-only.
- `proposal_options` — workspace + engagement + proposal scoped, unique `(proposal_id, option_type)`, text-typed `option_type` (`quick_win_build` / `ai_workflow_system` / `managed_ai_partner`) / `confidence`, `recommended` bool, `best_fit_scenario` / `scope_summary` / `timeline` / `pricing_placeholder`, four text[] columns (`deliverables` / `assumptions` / `dependencies` / `risks`). RLS operator-only.
- `proposal_option_opportunity_links`, `proposal_option_roadmap_links` — two join tables with `(proposal_option_id, ref_id)` unique pairs and cascading deletes. RLS operator-only.
- The `proposals.recommended_option_id` FK is added inside an idempotent `do $$ … end $$` block after `proposal_options` exists, so a fresh install applies cleanly without circular dependency ordering.

**Report query / action layer.**

- `lib/reports/queries.ts` (server-only) — `getReportForEngagementPersisted(uuid)` joins the report row with sections + the three link tables and returns the existing TS `Report` shape with sections sorted by canonical `SECTION_ORDER`. `getReportStatusSummary(uuid)` returns `{ exists, status, total, notStarted, drafted, needsReview, approved, final, evidenceLinks, exportStatus }` — `evidenceLinks` is computed via three `count: "exact", head: true` reads against the join tables so we never hydrate rows we don't need.
- `lib/reports/mappers.ts` — DB↔TS translators for section type / status / report status / confidence / export status (underscored ↔ hyphenated), `mapReportSectionRow` filters the three link arrays by section id and emits `linkedFindingIds` / `linkedOpportunityIds` / `linkedRoadmapItemIds` on the existing TS shape.
- `lib/reports/actions.ts` (`"use server"`) — `initializeReportForEngagement` (idempotent: returns the existing report id when one is present, otherwise inserts the report row plus all 12 canonical sections at `not_started` with the SECTION_LABEL titles), `approveReportSection`, `markReportSectionNeedsReview`, `markReportSectionFinal`, `markReportSectionDrafted`, `updateReportSectionDraft` (auto-promotes `not_started` → `drafted` when summary or draft preview lands), `updateReportSectionNote`, plus `linkReportSection` / `unlinkReportSection` for the three link kinds (treats unique-violation `23505` as benign). Every action `auth.getUser()`-gates, stamps `reviewed_by` + `last_reviewed_at`, bumps engagement activity, and `revalidatePath`s report + proposal + engagement detail.

**Proposal query / action layer.**

- `lib/proposals/queries.ts` (server-only) — `getProposalForEngagementPersisted(uuid)` joins proposal + options + the two link tables and returns the existing TS `Proposal` shape. `getProposalStatusSummary(uuid)` returns `{ exists, status, options, recommendedOptionTitle, exportStatus, totalDependencies, creditEligible, creditWindow }`.
- `lib/proposals/mappers.ts` — DB↔TS translators for option type / status / confidence / export status. `mapProposalRow` always synthesizes the canonical `ImplementationCredit` block (falling back to the canonical copy when columns are null), so the public ImplementationCreditPanel keeps rendering verbatim.
- `lib/proposals/actions.ts` (`"use server"`) — `initializeProposalForEngagement` (idempotent: seeds proposal + three canonical options pre-pointing AI Workflow System as recommended), `approveProposal`, `markProposalNeedsReview`, `reopenProposal`, `markProposalOptionRecommended` (atomically demotes other options first, then promotes), `updateProposalOption` (per-field), `updateImplementationCredit` (treats blank fields as a request to restore the canonical default copy), plus `linkProposalOption` / `unlinkProposalOption` for opportunities and roadmap items.

**Workspace components.**

- `components/reports/report-workspace.tsx` gained a `renderActionBar?: (section: ReportSection) => React.ReactNode` prop that replaces the static "Review actions · mock" block in the section preview when supplied.
- `components/reports/report-section-action-bar.tsx` (new, `"use client"`) — Approve section / Needs review / Mark drafted / Lock as final via `useTransition` with status badge and inline error/saved feedback.
- `components/reports/initialize-report-form.tsx` (new, `"use client"`) — operator CTA explaining the 12-section seed; calls `initializeReportForEngagement` and reveals the workspace immediately on success via `revalidatePath`.
- `components/proposals/proposal-workspace.tsx` gained `renderOptionActionBar?: (option: ProposalOption) => React.ReactNode` rendered above the locked SOW button row.
- `components/proposals/proposal-option-action-bar.tsx` (new, `"use client"`) — Mark recommended action with recommended/non-recommended badge.
- `components/proposals/initialize-proposal-form.tsx` (new, `"use client"`) — operator CTA explaining the 3-option seed and the canonical implementation-credit copy.

**Routes.**

- `app/app/engagements/[id]/report/page.tsx` branches on `loadEngagementForSubroute`. UUID engagements parallel-fetch report + findings + opportunities + roadmap from the persisted queries, render the initialize CTA when no report exists, and render `ReportWorkspace` with the persisted action bar when one does. Mock slug engagements continue to render seeded `MOCK_REPORTS`. Meta strip toggles between "Persistence Step 8 · Live" and "Sprint 7 · Mock data". The header `Export Report` button stays a `LockedActionButton`.
- `app/app/engagements/[id]/proposal/page.tsx` mirrors the same shape: persisted parallel fetch, initialize CTA, `ProposalWorkspace` with the persisted recommendation action bar, and `ImplementationCreditPanel` rendering the canonical copy. The header `Prepare Client Review` plus the in-detail `Prepare SOW Draft` and `Send to Client` actions all stay `LockedActionButton`s.

**Engagement detail status panels.**

- `app/app/engagements/[id]/page.tsx` adds `mergeReportStatus(engagement, summary)` and `mergeProposalStatus(engagement, summary)`. Both run via `Promise.all` alongside the existing intake / findings / opportunities / roadmap status reads. The Report panel surfaces `<approved>/<total>` plus a state line counting evidence links, and rotates next-action copy through "Initialize the report outline → Review N sections → Draft N not-started sections → Lock approved as final → Open the proposal builder". The Proposal panel surfaces option count, the recommended option title, and rotates next-action copy through "Initialize the proposal → Mark a recommended option → Move into review → Approve → Validate scope before quoting". Engagements with zero rows fall back to the persisted `report_status` / `proposal_status` jsonb defaults.

**Mock boundary preserved.**

- Legacy slug engagements continue to render `MOCK_REPORTS` and `MOCK_PROPOSALS` unchanged. The visual workspaces are byte-identical for mock paths; the persisted paths get the action bars + initialize CTA injected via the new render-prop.

**Locked commercial boundary.**

- `LockedActionButton` retained on every external/commercial action: `Export Report`, `Prepare Client Review`, `Prepare SOW Draft`, `Send to Client`. No e-signature, no payment, no PDF export, no email automation in this step. The locked CTA copy was tightened from "Mock" to "Locked" so the affordance reads accurately on persisted engagements.

**RLS / security.**

- Operators have full CRUD on `reports`, `report_sections`, all three report-section join tables, `proposals`, `proposal_options`, and both proposal-option join tables, workspace-scoped via the existing single-workspace policy shape.
- No anon policies; public `/intake/[token]` and `/scorecard/*` routes never read reports or proposals.
- All actions evaluate under RLS with the operator's `auth.uid()`. No service-role client touches the reports / proposals code path.
- Section drafts, reviewer notes, recommended-next-step copy, and proposal assumptions / dependencies are operator-only — public surfaces never reach them.
- Implementation-credit copy stays constant across all engagements unless the operator explicitly edits it; clearing a credit field restores the canonical commercial-lever copy.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean. 22 routes generate. `/app/engagements/[id]/report` at 6.89 kB / 110 kB First Load; `/app/engagements/[id]/proposal` at 5.97 kB / 109 kB First Load.
- Secret handling: `.env.local` was not read, modified, or staged; no Supabase keys, service role key, magic-link URL, raw intake tokens, or stakeholder PII printed during this sprint.

## Persistence/Auth Step 9 — what landed (2026-05-05)

`/app/leads/[id]` and `/app/engagements/[id]` now expose operator-only persisted internal notes and a per-entity activity timeline. Core operator actions across Steps 4–8 emit best-effort activity events under operator-only RLS. Public scorecard and stakeholder intake routes never expose notes or activity rows; the public stakeholder-intake submit path emits a single safe service-role activity event without surfacing it back to the stakeholder.

**Migration `0009_activity_notes.sql`.**

- `activity_events` — workspace-scoped, polymorphic `entity_type` + `entity_id`, optional `engagement_id` / `lead_id` / `account_id` / `contact_id` for fast per-entity queries. Operator profile + auth user references on the actor side. Text-typed `event_type` so vocabulary can evolve. `metadata jsonb` stays small + safe (sanitized at the helper level). Indexes on `(workspace_id, created_at desc)`, `(engagement_id, created_at desc)`, `(lead_id, created_at desc)`, `(entity_type, entity_id)`, and `(event_type, created_at desc)`. RLS posture: operator-only `select` + operator-only `insert` (service-role bypass for the public-server logger).
- `notes` — workspace-scoped polymorphic notes against any persisted entity. Author tracked via both `author_profile_id` and `author_user_id`. `body text not null`, `visibility text default 'internal'` (only `internal` used in Step 9), `pinned boolean default false`, soft delete via `deleted_at timestamptz`. `lead_id` / `engagement_id` denormalized for fast per-entity reads. `set_updated_at` trigger reused. Indexes on `(workspace_id, created_at desc)`, `(engagement_id, created_at desc)`, `(lead_id, created_at desc)`, `(entity_type, entity_id)`, and a partial pin index on non-deleted notes. RLS operator-full (workspace-scoped); no anon policies.

**Activity logger.**

- `lib/activity/log.ts` (`import "server-only"`) exposes `logActivityEvent(input, options)`. Defaults to the cookie-bound authenticated server client so operator-side logging records the actor's `auth.uid()` under RLS. Public-server contexts (intake submit) opt in via `{ viaServiceRole: true }`. The logger is best-effort — every error is swallowed after a sanitized `console.error`; the primary business action never fails because of a failed log write.
- `sanitizeMetadata` shallow-clones the caller's metadata, drops keys matching `/token|secret|password|apikey|authorization|cookie|email|body|raw|excerpt/i`, truncates strings to 200 chars, caps array length to 10, caps key count to 12. This is a defense-in-depth surface — callers are still expected to pass safe metadata, but accidental leakage is contained.
- `lib/activity/queries.ts` (`import "server-only"`) exposes `getActivityForEngagement(uuid, limit = 25)` and `getActivityForLead(uuid, limit = 15)`. Both use the authenticated server client so RLS evaluates with the operator's session. Actor display name is hydrated via a lightweight `profiles` join keyed off `actor_profile_id`.
- `lib/activity/types.ts` exports the `ActivityEventType` (24 values) + `ActivityEntityType` (13 values) text unions and the `ActivityEvent` UI shape (no raw metadata rendered by default; the timeline shows `actorDisplayName ?? "System"` as a fallback).

**Notes layer.**

- `lib/notes/queries.ts` (`import "server-only"`) — `getNotesForEntity(entityType, entityId)` returns non-deleted notes ordered by `pinned desc, created_at desc` with author display names hydrated.
- `lib/notes/actions.ts` (`"use server"`) — `createNote`, `updateNote`, `deleteNote` (soft delete via `deleted_at`), `toggleNotePinned`. Every action `auth.getUser()`-gates and routes through `resolveEntityContext` which validates the entity exists, returns its `workspace_id`, and pre-populates the note's `lead_id` / `engagement_id` so per-entity queries stay simple. Each create/update/delete fires a `note_created` / `note_updated` / `note_deleted` activity event. `revalidatePath` covers both `/app/leads/<lead>` and `/app/engagements/<engagement>` so the timeline refreshes immediately.

**Activity wiring across Steps 4–8 actions.**

- Step 4 — `createOrOpenEngagementForLead` logs `engagement_created` only on the new-row path (the existing-engagement path falls through to `redirect` without emitting a duplicate). Lead-status forward push logs `lead_status_changed` with previous/next status metadata.
- Step 5 — `createStakeholderSession` logs `intake_session_created`. The public-server `submitStakeholderResponses` emits `intake_response_submitted` via the service-role logger with response-quality + count metadata. The raw intake token is never persisted in metadata.
- Step 6 — `createManualFinding` logs `finding_created`; `setReviewStatus` logs `finding_approved` / `finding_rejected` / `finding_report_ready` keyed off the resulting status (`needs-review`, `draft`, `edited` do not emit dedicated events).
- Step 7 — `createOpportunity` logs `opportunity_created`; `setStatus` logs `opportunity_selected` / `opportunity_deferred` / `opportunity_rejected`. `createRoadmapItem` logs `roadmap_item_created`; `setRoadmapItemStatus` logs `roadmap_item_status_changed`.
- Step 8 — `initializeReportForEngagement` logs `report_initialized`; `setSectionStatus` logs `report_section_status_changed`. `initializeProposalForEngagement` logs `proposal_initialized`; `markProposalOptionRecommended` logs `proposal_option_recommended`; `setProposalStatus` logs `proposal_status_changed`.

**UI surfaces.**

- `components/activity/activity-timeline.tsx` — server-rendered compact timeline. Each row shows an event-type badge (24 typed labels mapped to badge tones), short timestamp, actor display name (falls back to "System"), title, and optional summary. Raw metadata is intentionally never rendered — the panel is for shape, not debug.
- `components/notes/notes-panel.tsx` (`"use client"`) — composer with internal-only label, pin/unpin, edit-in-place, soft delete. Uses `useTransition` for inline pending + error feedback. Empty state copy is configurable per-entity; defaults follow the Step 9 spec.

**Lead detail integration.**

- `app/app/leads/[id]/page.tsx` parallel-fetches `getNotesForEntity("lead", lead.id)` + `getActivityForLead(lead.id)` alongside the existing engagement-id lookup. The static `LeadNotesPanel` is replaced with `<NotesPanel />`, and the sidebar gains a `<ActivityTimeline heading="Lead activity" />` with copy: *"No activity yet — Events will appear here as operators triage the lead and convert it into an engagement."*

**Engagement detail integration.**

- `app/app/engagements/[id]/page.tsx` parallel-fetches notes + activity only for UUID engagements (mock slug engagements still render the legacy `<EngagementNotesPanel notes={engagement.notes} />`). For UUID engagements the sidebar swaps in `<NotesPanel entityType="engagement" />` and renders `<ActivityTimeline heading="Engagement activity" />` with copy: *"No activity yet — Events will appear here as operators move the engagement through intake, findings, opportunities, roadmap, report, and proposal."*

**Public/internal boundary.**

- Public scorecard routes (`/scorecard/*`) never read notes or activity.
- Public stakeholder route (`/intake/[token]`) never reads notes or activity.
- Public stakeholder submit emits a single service-role activity event but does not surface it to the stakeholder.
- Operator-only RLS (workspace-scoped) on both `notes` and `activity_events`; only the `select` policy on `activity_events` is `to authenticated` plus a same-scope `insert` policy. No anon policies on either table.
- Service-role usage is confined to `lib/activity/log.ts` for the explicit `viaServiceRole: true` callers (currently only the public stakeholder submit). The service-role key never appears in the browser bundle.

**Mock boundary preserved.**

- Legacy mock slug engagements (`atlas-aios-q2`, `helio-aios-q2`, `meridian-aios-q2`, `quanta-aios-q2`, `caldera-aios-q2`) skip the notes + activity queries entirely and continue rendering the static `EngagementNotesPanel` from the seeded fixture. No mock domain files were deleted in this sprint.
- Real UUID leads always use persisted notes + activity (the previous static `LeadNotesPanel` was retired from the lead detail route).

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean. 22 routes generate. `/app/leads/[id]` and `/app/engagements/[id]` First Load JS each grew slightly to accommodate the notes composer client component.
- Secret handling: `.env.local` was not read, modified, or staged; no Supabase keys, service role key, magic-link URL, raw intake tokens, stakeholder PII, finding excerpts, proposal pricing, or note body text printed during this sprint.

## Persistence/Auth Step 10 — what landed (2026-05-05)

`/intake/[token]` and `/app/engagements/[id]/intake` now read/write real Supabase Storage-backed supporting documents for UUID engagements. A private `engagement-documents` bucket holds the binaries; `input_assets` rows hold the metadata; operators download via short-lived signed URLs that never appear in client-side JS. Public stakeholder surfaces cannot list, browse, or download any file. No OCR, parsing, or summarization.

**Migration `0010_file_storage.sql`.**

- Adds storage columns to `input_assets` via `add column if not exists`: `storage_bucket text`, `storage_path text`, `original_filename text`, `mime_type text`, `size_bytes bigint`, `uploaded_by_profile_id uuid → profiles`, `uploaded_by_user_id uuid → auth.users`, `uploaded_by_session_id uuid → stakeholder_intake_sessions`, `uploaded_at timestamptz`, `download_count integer default 0`, `last_downloaded_at timestamptz`, `checksum_sha256 text`. Existing metadata-only rows from Step 5 keep working unchanged.
- Adds an index on `(storage_bucket, storage_path)` for fast object-path lookups.
- Provisions the `engagement-documents` bucket via `insert into storage.buckets … on conflict (id) do update`. Bucket is private (`public = false`), `file_size_limit = 10 MiB`, `allowed_mime_types` is the canonical 9-MIME allowlist (PDF, DOC/DOCX, XLS/XLSX, TXT, CSV, PNG, JPG).
- **No `storage.objects` policies are added.** All read/write flows through server-only helpers under the existing token / auth boundary; broadening object-level access to `authenticated` here would leak the bucket to every signed-in client.

**Storage path model.**

- `lib/assets/paths.ts` — `sanitizeFilename` strips directory components and replaces anything outside `[A-Za-z0-9._-]` with `-`, lowercases, and trims to 96 chars.
- Stakeholder uploads: `workspaces/<workspace_id>/engagements/<engagement_id>/sessions/<session_id>/<asset_id>/<safe_filename>`.
- Operator uploads: `workspaces/<workspace_id>/engagements/<engagement_id>/operator/<asset_id>/<safe_filename>`.
- The `asset_id` segment guarantees per-row uniqueness even when two operators upload identically-named files. Stakeholder email and raw token never appear in the path.

**Validation.**

- `lib/assets/limits.ts` — single source of truth. `MAX_FILE_SIZE_BYTES = 10 MiB`, `ALLOWED_MIME_TYPES` (9 values). `validateUpload({ size, mimeType, filename })` returns `{ ok: true }` or `{ ok: false, reason }`. Server route + client form both call it before any upload, plus the bucket layer enforces the same limits.

**Public stakeholder upload — `/api/intake/[token]/assets` (POST, multipart/form-data).**

- `lib/assets/public.ts` — `uploadStakeholderAsset({ rawToken, filename, mimeType, size, bytes })`.
- Hashes the raw token, looks up the session by `token_hash`, rejects expired sessions. Validates file size + MIME + extension before any storage call.
- Inserts the `input_assets` row with `source = 'stakeholder'`, `status = 'received'`, `evidence_quality = 'unverified'`, `linked_role` from the session, `uploaded_by_session_id` set. Then uploads to `engagement-documents` at the deterministic path. Patches `storage_path` after the upload succeeds. Rolls back the metadata row if the storage upload fails.
- Service-role activity log: emits `input_asset_uploaded` with `metadata: { mimeType, sizeBytes, source: "stakeholder" }`. The raw token is never persisted in metadata.
- Returns `{ ok: true, asset: { id, title, status, sizeBytes, mimeType } }`. **Never** returns the storage path or a signed URL.

**Operator upload — `/api/app/engagements/[id]/assets` (POST, multipart/form-data).**

- `lib/assets/server.ts` — `uploadOperatorAsset({ engagementId, filename, mimeType, size, bytes, title?, summary?, assetType? })`.
- `auth.getUser()`-gates first; resolves engagement + workspace via the authenticated server client. Same validation as the public route.
- Inserts the `input_assets` row with `source = 'operator'`, `status = 'received'`, `evidence_quality = 'adequate'`, `uploaded_by_profile_id` + `uploaded_by_user_id` set. Storage upload uses the service-role client (since Supabase Storage doesn't grant arbitrary `authenticated` reads/writes on private buckets without object-level policies that would over-broaden access).
- Logs `input_asset_uploaded` with `metadata: { mimeType, sizeBytes, source: "operator" }`. Calls `revalidatePath` on `/app/engagements/<id>/intake` and `/app/engagements/<id>`.

**Operator download — `/api/app/assets/[assetId]/download` (GET).**

- `lib/assets/server.ts` — `createOperatorDownloadUrl(assetId)`.
- `auth.getUser()`-gates. Looks up the asset, mints a signed URL with `createSignedUrl(path, 300, { download: original_filename })` via the service-role client. TTL is 5 minutes.
- Bumps `download_count` and `last_downloaded_at` (best-effort). Logs `input_asset_downloaded` with `metadata: { ttlSeconds: 300 }`.
- Route returns a 302 redirect to the signed URL — the URL appears once in the redirect response, never in app logs or activity metadata.

**Activity events.**

- `lib/activity/types.ts` — added `input_asset_uploaded` + `input_asset_downloaded` to `ActivityEventType`; added `input_asset` to `ActivityEntityType`.
- `components/activity/activity-timeline.tsx` — added tone + label entries: `input_asset_uploaded → info / "Document uploaded"`, `input_asset_downloaded → neutral / "Document downloaded"`.
- Existing `sanitizeMetadata` (Step 9) drops keys matching `/token|secret|password|apikey|authorization|cookie|email|body|raw|excerpt/i` and caps string lengths — sensitive context cannot accidentally leak even if a future caller adds it.

**Public intake UI — `components/intake/public-intake-uploads.tsx`.**

- Optional `<PublicIntakeUploads />` rendered inside `PublicIntakeForm`, between the question fields and the submit row.
- Pre-flight size + MIME check before the network call so the user sees a controlled error immediately. POSTs to `/api/intake/[token]/assets`; on success appends a row showing original filename, size, "Upload complete" check.
- Copy: *"Optional · upload supporting documents that help explain your workflows, handoffs, reporting, or system constraints. PDF, Word, Excel, CSV, TXT, PNG, or JPG. 10 MB per file."* Validation copy maps cleanly to the `FileValidationError` reasons.
- Renders nothing about storage paths, signed URLs, or internal asset metadata.

**Operator intake UI.**

- New `components/intake/operator-upload-form.tsx` — operator file form with optional title + summary, controlled error/success states, POSTs to `/api/app/engagements/[id]/assets`. Locked to the same MIME / size limits.
- New `components/intake/persisted-supporting-inputs.tsx` — replaces the static `SupportingInputsPanel` for persisted engagements. Each row shows title, status, evidence quality, source (Operator / Stakeholder), size, MIME type, source-label (operator display name or stakeholder name from the session), uploaded-at timestamp, download button (`/api/app/assets/<id>/download`, 5-min link), and download count. Mock slug engagements continue to render the legacy `SupportingInputsPanel`.
- `app/app/engagements/[id]/intake/page.tsx` parallel-fetches `getOperatorAssetsForEngagement(engagement.id)` only on the persisted path. The "Inputs Received" metric now reflects the live asset count for UUID engagements.

**Public/internal boundary.**

- The bucket is `public = false`. There are no `storage.objects` policies — all access goes through server-side helpers gated by token validation or `auth.getUser()`.
- Public stakeholder route can upload only to its own session via the token-hash boundary; cannot list, browse, or download anything.
- Public scorecard surfaces cannot reach the asset routes — `/api/intake/[token]/assets` is the only public-facing asset endpoint and it requires a valid stakeholder token hash.
- Operator download response is a 302 redirect to a 5-minute signed URL. The URL never appears in app logs, activity metadata, or the rendered HTML for the operator workspace; the operator workspace links directly to `/api/app/assets/<id>/download`, which redirects on each click.
- `original_filename` is treated as already-operator-visible metadata (stakeholders see only their own filenames). It does not appear in activity metadata.
- Service-role usage is confined to `lib/supabase/service.ts` callers in `lib/intake/public.ts`, `lib/assets/public.ts`, and `lib/assets/server.ts`. The key never appears in the browser bundle.

**Mock boundary preserved.**

- Legacy mock slug engagements continue to render the seeded `SupportingInputsPanel` from the existing fixtures. No mock files were deleted.
- Real UUID engagements render the new `OperatorUploadForm` + `PersistedSupportingInputs`.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean. 25 routes generate (three new API routes: `/api/intake/[token]/assets`, `/api/app/engagements/[id]/assets`, `/api/app/assets/[assetId]/download`). `/intake/[token]` First Load grew from 113 kB to 115 kB; `/app/engagements/[id]/intake` from 109 kB to 110 kB.
- Secret handling: `.env.local` was not read, modified, or staged; no Supabase keys, service role key, magic-link URL, raw intake tokens, signed URLs, storage paths, file contents, stakeholder PII, or note body text printed during this sprint.

**Setup note (manual, one-time).**

- The migration provisions the bucket via `insert into storage.buckets … on conflict (id) do update`. Some Supabase regions deny the implicit storage-schema grants required for a regular SQL session; in that case the bucket can be created via the Supabase Dashboard with the same shape (private, 10 MiB limit, identical MIME allowlist) and the migration becomes a no-op.

## AI Synthesis Step 1 — what landed

**Goal.** Operator-triggered AI draft finding generation from persisted scorecard, stakeholder intake, and input asset metadata. AI output is stored as `needs-review` findings and must pass operator approval before becoming report-ready. Uploaded file contents are not parsed.

**Migration — `supabase/migrations/0011_ai_synthesis_runs.sql`.**

- New `ai_synthesis_runs` table. Columns: `id`, `workspace_id → workspaces`, `engagement_id → engagements (on delete cascade)`, `run_type text`, `status text default 'started'`, `provider text`, `model text`, `input_summary jsonb`, `output_summary jsonb`, `error_code text`, `error_message text`, `created_by_profile_id`, `created_by_user_id`, `started_at`, `completed_at`, `created_at`. Indexed on `(engagement_id, started_at desc)`, `(workspace_id, started_at desc)`, `(status, started_at desc)`.
- RLS: `ai_synthesis_runs_operator_full` for `authenticated`, `using/with check (workspace_id = (select id from public.workspaces limit 1))`. No anon access. Public scorecard / intake routes never read synthesis runs.
- `run_type` and `status` stay text-typed so the vocabulary can extend (future `report_section_draft`, `opportunity_draft`, etc.) without another migration.
- Idempotent (`create table if not exists`, `drop policy if exists` + `create policy`).

**AI provider layer — `lib/ai/{types,provider,findings-context,findings-synthesis}.ts`.**

- `lib/ai/types.ts` — `DraftFindingCandidate`, `DraftFindingSourceRef`, `AiProviderConfig`, `ProviderInvocationResult` discriminated union.
- `lib/ai/provider.ts` — server-only (`import "server-only"`). `getAiProviderConfig()` reads `SLATE_AI_PROVIDER`, `OPENAI_API_KEY`, `SLATE_AI_FINDINGS_MODEL` (default `gpt-4o-mini`); returns `null` if the key is absent. `isAiConfigured()` is a thin boolean wrapper used by the page server component to render a controlled unavailable state when no key is configured. `callChatJson(request)` POSTs to `https://api.openai.com/v1/chat/completions` via `fetch` with `response_format: { type: "json_object" }`, 60s `AbortController` timeout, status-aware error mapping (429 → `ai-rate-limited`, network failure → `ai-request-failed`, abort → `ai-timeout`). No SDK dependency added — `fetch` is enough and keeps the dep footprint zero. The key is never logged.
- `lib/ai/findings-context.ts` — `buildFindingsSynthesisContext(engagementId)`. Server-only, `auth.getUser()`-gated. Loads engagement + linked account + scorecard submission/answers (when present) + stakeholder sessions/responses + input asset metadata + existing findings. Caps: ≤ 50 intake responses, ≤ 30 input assets, ≤ 30 existing findings, ≤ 30 scorecard answers; per-string clip at 240–360 chars. Strips PII proactively (no email, no contact details). Internal fit score is intentionally omitted. Never reads binary file content; `mimeFamily` is the only file-shape signal passed to the model.
- `lib/ai/findings-synthesis.ts` — `synthesizeDraftFindings(context)` shapes a tight system + schema-instruction + user prompt, calls the provider with `temperature = 0.2`, then validates the JSON response with explicit allowlists. Bounds: 3–7 findings. Validator drops candidates without a statement, with unknown category, with no source refs and no `assumptionFlag = true`, and with malformed source refs. `category`, `confidence`, `sourceType`, `strength` all gated on `Set<DraftFinding…>` allowlists. Long fields are clipped to DB-safe lengths.

**Server action — `lib/findings/synthesis-actions.ts`.**

- `generateDraftFindingsForEngagement(engagementId)` — operator-only. Auth-gates first, returns `ai-not-configured` immediately when the key is absent.
- Opens an `ai_synthesis_runs` row in `started` state with `input_summary` containing only safe counts (`intakeResponses`, `intakeSessions`, `completedSessions`, `inputAssets`, `scorecardAnswers`, `existingFindings`, `min/maxFindings`). No prompt body, no excerpt, no model response is ever written to this row.
- Calls `synthesizeDraftFindings` and inspects the result. On provider error: marks the run `failed`, emits `ai_synthesis_failed`, revalidates routes, returns the typed error.
- On success: deduplicates against existing finding statements (case-insensitive whitespace-collapsed), inserts each surviving candidate as a finding row (`ai_drafted = true`, `review_status = 'needs_review'`, `category` / `confidence` from the validator's allowlist) plus its typed source refs into `finding_source_refs`. Source-ref `strength = "missing"` from the model is mapped to `"thin"` for DB compatibility (the existing strength vocabulary is `strong | adequate | thin`).
- Updates the run row to `completed` (or `failed` if zero findings persisted) with `output_summary` containing only counts + provider/model labels.
- Emits exactly one activity event per call (`ai_findings_generated` or `ai_synthesis_failed`). Metadata is restricted to `{ runType, generatedCount, skippedDuplicateCount, provider, model }` (no statements, excerpts, or stakeholder content).
- Revalidates `/app/engagements/<id>/findings` and `/app/engagements/<id>`. Returns `{ ok, generatedCount, skippedDuplicateCount, provider, model }` to the caller — never a raw model response.
- Partial-failure behavior: if a finding row inserts but its source refs fail, the finding row is left in `needs_review` and the operator can attach evidence manually. The error count is recorded on `output_summary.insertErrorCount`.

**UI integration.**

- `components/findings/generate-findings-form.tsx` (`"use client"`) — shows `Generate draft findings` CTA with subdued "Draft only · operator review required" badge. Three states:
  - `aiConfigured = true` and intake responses present → enabled CTA, copy explains scorecard + intake + metadata are used and uploaded files are not parsed.
  - `aiConfigured = true` and no intake responses → CTA enabled but a warning banner says synthesis will run on scorecard context only and most candidates will be flagged as assumptions.
  - `aiConfigured = false` → CTA disabled, controlled message: *"AI synthesis is not configured for this environment. Add the provider key server-side (`OPENAI_API_KEY` in `.env.local`) to enable draft generation."*
- Component uses `useTransition`. On success it shows generated count + skipped duplicates. On failure it shows a translated error code (e.g., `ai-rate-limited` → "AI provider rate-limit reached. Wait a minute and try again.").
- `app/app/engagements/[id]/findings/page.tsx` — calls `isAiConfigured()` server-side and threads it plus `hasIntakeEvidence = candidates.length > 0` into `<GenerateFindingsForm>`. The form renders only when `loaded.kind === "real"`. Mock slug engagements never see the AI synthesis surface. Page meta line now reads "AI Synthesis Step 1 · Live" / "AI draft + operator-authored · human approval required".
- `components/findings/findings-workspace.tsx` — finding detail panel now branches its category badges: AI-drafted findings keep the existing `Sparkles · AI-drafted` badge; operator-authored findings (`aiDrafted === false`) render a neutral `Operator-authored` badge instead. List items also gain a subtle `Sparkles · AI` badge when AI-drafted. Existing mock findings (where `aiDrafted` is undefined) keep the AI-drafted treatment so seeded screenshots don't regress.
- `lib/findings/types.ts` + `lib/findings/mappers.ts` — `Finding` type now carries an optional `aiDrafted: boolean`; the DB → TS mapper sets `aiDrafted: Boolean(row.ai_drafted)` so persisted findings carry the real flag.

**Activity events.**

- `lib/activity/types.ts` — added `ai_findings_generated` and `ai_synthesis_failed` to `ActivityEventType`; added `ai_synthesis_run` to `ActivityEntityType`.
- `components/activity/activity-timeline.tsx` — added tone + label entries: `ai_findings_generated → ai / "AI findings generated"`, `ai_synthesis_failed → risk / "AI synthesis failed"`.
- Activity metadata restricted to `{ runType, generatedCount, skippedDuplicateCount, provider, model }`. The existing `sanitizeMetadata` (Step 9) still drops keys matching `/token|secret|password|apikey|authorization|cookie|email|body|raw|excerpt/i` defensively even though the synthesis caller never includes those.

**Public/internal boundary.**

- Only authenticated operators can trigger synthesis. `generateDraftFindingsForEngagement` short-circuits on `auth.getUser()` before any context is built or any provider call is made.
- Synthesis output is stored as operator-only `findings` rows under existing `findings_operator_full` RLS. Public scorecard / public intake routes never read findings, source refs, synthesis runs, or activity events.
- The OpenAI key is read only in `lib/ai/provider.ts` (server-only) and never leaves the server. The browser bundle never receives any synthesis code (the `server-only` import enforces this at build time).
- The page server component reads `isAiConfigured()` once and passes only the boolean down — the key is never serialized into the rendered HTML.

**Mock boundary preserved.**

- Legacy mock slug engagements continue rendering the seeded mock findings from `lib/findings/mock-findings.ts` — no AI synthesis surface, no `GenerateFindingsForm`, no `ManualFindingPlaceholder` regression.
- The CTA appears only when `loaded.kind === "real"` AND `aiConfigured === true`.

**Validation guardrails.**

- Categories: 8-value allowlist matching `findings.category` DB vocabulary. Unknown → reject candidate.
- Confidence: 4-value allowlist. Unknown → default to `needs_evidence`.
- Source types: 4-value allowlist. Unknown → drop the source ref.
- Source strength: 4 values (`strong`, `adequate`, `thin`, `missing`). `missing` is recorded on the candidate but persisted as `thin` (the DB strength vocabulary is 3-valued).
- Statement required and non-empty; clipped to 240 chars.
- Source IDs are validated against the canonical UUID regex; invalid IDs are dropped (the source ref still persists with the label/excerpt only).
- Generated count clamped to 7 maximum even if the model returns more.
- Every finding must have ≥ 1 source ref OR `assumptionFlag = true`.
- Statement deduplication is case-insensitive and whitespace-collapsed against existing findings on the engagement.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean. 25 routes. `/app/engagements/[id]/findings` First Load grew from 113 kB to 114 kB (one new client component bundled).
- Build also succeeds with `OPENAI_API_KEY` unset — `getAiProviderConfig()` returns `null`, the page renders the controlled "AI synthesis is not configured" state, no provider calls are issued.
- Secret handling: `.env.local` was not read, modified, or staged; no provider keys, no prompt bodies, no raw model responses, no stakeholder content, no Supabase keys printed during this sprint. `.env.example` updated with names only (`SLATE_AI_PROVIDER`, `OPENAI_API_KEY`, `SLATE_AI_FINDINGS_MODEL`).

## AI Synthesis Step 1.1 — what landed

**Goal.** Make AI findings synthesis discoverable from the engagement workflow without encouraging premature low-evidence generation. No persistence changes, no provider behavior changes, no migrations.

**Engagement detail discoverability.**

- `app/app/engagements/[id]/page.tsx` reads `isAiConfigured()` server-side and computes `aiAvailable = isPersistedEngagement && isAiConfigured()` plus `hasIntakeEvidence` (true when ≥ 1 stakeholder is in-progress or completed). Both are passed down to the panel + tracker.
- `components/engagements/findings-status-panel.tsx` accepts new optional `aiAvailable` and `hasIntakeEvidence` props. When `aiAvailable === true`, the header renders a subtle `Sparkles · AI draft available` outline badge next to the existing status badge, plus a one-line readiness footnote between the description and progress bar:
  - With intake evidence: *"AI draft findings is ready to run."*
  - Without intake evidence: *"AI draft available, but intake evidence is thin. Capture stakeholder input first."*
- The Findings panel CTA (`Review Findings`) is now linked whenever `aiAvailable === true`, so operators can reach the synthesis CTA on a brand-new engagement without first having to advance the stage or accumulate findings.
- `components/engagements/engagement-status-panel.tsx` gained two new optional slots (`headerAccessory` and `footnote`). All existing call sites continue to render unchanged because the slots are undefined by default.

**Stage tracker indicator.**

- `components/engagements/engagement-stage-tracker.tsx` accepts an optional `aiAvailableStages?: EngagementStage[]` prop. When the synthesis stage is included, both layouts (desktop horizontal + mobile vertical) render a small `Sparkles` icon next to the stage label. Hover/title text and aria-label both read "AI draft findings available."
- Empty/undefined `aiAvailableStages` means no indicator renders — the prior visual is preserved exactly for legacy mock slug engagements and for environments without an AI provider key.
- The engagement detail page passes `aiAvailableStages={aiAvailable ? ["synthesis"] : undefined}`. No mock slug engagement renders the indicator because mock-engagement detail pages 404 (the engagement detail route only resolves UUIDs).

**Findings page guidance — `components/findings/generate-findings-form.tsx`.**

- Description copy gained one trailing sentence: *"Best results come after at least one stakeholder completes intake."*
- The "Limited evidence" warning text was rewritten:
  - Before: *"No stakeholder intake responses are attached yet. Synthesis will run on scorecard context only — most candidates will be flagged as assumptions until intake responses land."*
  - After: *"No stakeholder intake responses are attached yet. You can generate scorecard-only draft findings, but they will be assumption-heavy. For a stronger AI pass, capture stakeholder input first."*
- A new secondary `Manage intake first ↗` link sits inside the warning, deep-linking to `/app/engagements/<engagementId>/intake`. The primary `Generate draft findings` CTA remains enabled — the choice stays with the operator.

**Recommended action behavior.**

- Unchanged. `lib/engagements/recommended-action.ts` still routes by stage (`setup | intake → /intake`, `synthesis → /findings`, etc). When stakeholder evidence is missing the engagement is in `setup` or `intake`, so the recommended action stays `Manage Intake`. The new AI affordances are subordinate ambient signals, not primary CTAs.

**Mock + public boundary.**

- AI affordances render only when the engagement is a real persisted UUID AND `OPENAI_API_KEY` is configured. Mock slug engagements (`atlas-aios-q2`, `helio-aios-q2`, `meridian-aios-q2`, `quanta-aios-q1`, `caldera-aios-q1`) do not show the affordances.
- The public `/scorecard*` and `/intake/[token]` routes are unaffected — none of them import `isAiConfigured()` or render the engagement workflow surfaces.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean. 25 routes. `/app/engagements/[id]` First Load unchanged at 107 kB; `/app/engagements/[id]/findings` grew from 10.6 kB to 10.8 kB (the new `Manage intake first` link).
- Manual browser run via Playwright: signed in via service-role-minted magic link, navigated to `/app/engagements/76097653-fedb-42e5-9ef6-e89a0e97f802`, confirmed Sparkles next to "Synthesis" in stage tracker, `AI draft available` badge + "AI draft available, but intake evidence is thin. Capture stakeholder input first." footnote on the Findings panel, recommended action remains "Manage Intake". Navigated to `/findings`, confirmed updated copy + `Manage intake first` link inside the warning. Navigated to `quanta-aios-q1/findings` (mock slug), confirmed no AI affordance (page meta correctly shows "Sprint 5 · Mock data").

## AI Synthesis Step 2 — what landed

**Goal.** Operator-triggered AI draft opportunity generation from consultant-approved findings. AI output is stored as `status = draft` opportunities tied to the source findings via `opportunity_finding_links`. The operator must select, defer, or reject each draft using the existing review action bar — drafts do not auto-promote into the roadmap.

**No migration.** The Step 1 `ai_synthesis_runs` table accepts arbitrary `run_type` text; Step 2 reuses it with `run_type = 'opportunity_draft'`. The Step 7 `opportunities` and `opportunity_finding_links` tables already carry the score columns, status vocabulary, and join shape needed. Zero schema changes ship with this step.

**AI provider layer additions — `lib/ai/{types,provider,opportunities-context,opportunities-synthesis}.ts`.**

- `lib/ai/types.ts` — adds `DraftOpportunityCandidate`, `DraftOpportunityEvidenceStrength`, `OpportunityProviderInvocationOk`, and `OpportunityProviderInvocationResult` (a discriminated union mirroring the findings shape).
- `lib/ai/provider.ts` — adds `getAiOpportunityProviderConfig()`. Reads `SLATE_AI_OPPORTUNITIES_MODEL` first, falls back to `SLATE_AI_FINDINGS_MODEL`, then to the default model. Returns `null` when the provider key is absent. `isAiConfigured()` continues to gate the UI.
- `lib/ai/opportunities-context.ts` — `buildOpportunitySynthesisContext(engagementId)`. Server-only, `auth.getUser()`-gated. Loads engagement + linked account + scorecard summary (when present) + approved/report-ready findings (with up to 5 source refs each, label + role only — no excerpt) + input asset metadata + existing opportunities (with linked finding IDs). Caps: ≤ 20 findings, ≤ 5 source refs per finding, ≤ 20 existing opportunities, ≤ 20 scorecard answers, ≤ 20 input assets. Per-string clip 240–360 chars depending on field. Returns `error: 'no-approved-findings'` if zero eligible findings exist — short-circuiting before any provider call.
- `lib/ai/opportunities-synthesis.ts` — `synthesizeDraftOpportunities(context)` shapes the system + schema-instruction + user prompt and calls the provider with `temperature = 0.2`, `maxTokens = 2200`. Strict validator drops candidates without a title, candidates whose `linkedFindingIds` do not match the eligible set, candidates with unknown categories, and duplicate titles within the batch. Scores clamped to 0–100 integers. Arrays clamped to ≤ 6 items × ≤ 200 chars each. Generated count clamped to 6 maximum.

**Server action — `lib/opportunities/synthesis-actions.ts`.**

- `generateDraftOpportunitiesForEngagement(engagementId)` — operator-only. Auth-gates first, returns `ai-not-configured` immediately when the key is absent. Returns `no-approved-findings` immediately when the context builder returns no eligible findings — no `ai_synthesis_runs` row is opened in this case (the table records actual provider invocations, not pre-checks).
- Opens an `ai_synthesis_runs` row in `started` state with `input_summary` containing only safe counts (`findings`, `inputAssets`, `scorecardAnswers`, `existingOpportunities`, `min/maxOpportunities`). No prompt body, no excerpt, no model response is ever written to this row.
- Calls `synthesizeDraftOpportunities` and inspects the result. On provider error: marks the run `failed`, emits `ai_synthesis_failed`, revalidates routes, returns the typed error.
- On success: deduplicates against existing opportunity titles (case-insensitive, whitespace-collapsed) and within the batch. For each surviving candidate: derives quadrant via `pickQuadrant(impact, complexity, risk)` (preserves the high-risk `risk >= 85 → defer-avoid` override from `createOpportunity`), derives priority from quadrant via `priorityFromQuadrant`, inserts the opportunity row with `status = draft`. Then inserts `opportunity_finding_links` rows for every linked finding ID with `strength` mirroring the validated `evidenceStrength`.
- Updates the run row to `completed` (or `failed` if zero opportunities persisted) with `output_summary` containing only counts + provider/model labels + `linkErrorCount`.
- Emits exactly one activity event per call (`ai_opportunities_generated` or `ai_synthesis_failed`). Metadata is restricted to `{ runType, generatedCount, skippedDuplicateCount, provider, model }` (no titles, descriptions, or finding statements).
- Revalidates `/app/engagements/<id>/opportunities`, `/app/engagements/<id>/roadmap`, and `/app/engagements/<id>`. Returns `{ ok, generatedCount, skippedDuplicateCount, provider, model }` to the caller — never a raw model response.
- Partial-failure behavior: if an opportunity inserts but its links fail, the opportunity row is left in `draft` and the operator can attach evidence manually. The link error count is recorded on `output_summary.linkErrorCount`.

**UI integration.**

- `components/opportunities/generate-opportunities-form.tsx` (`"use client"`) — shows `Generate draft opportunities` CTA with a subdued "Draft only · operator review required" badge. Three states:
  - `aiConfigured = true` and `hasApprovedFindings = true` → enabled CTA, copy explains approved/report-ready findings are used as evidence and that drafts must still be selected/deferred/rejected.
  - `aiConfigured = true` and `hasApprovedFindings = false` → CTA disabled, controlled warning: *"Approve or mark findings report-ready before drafting opportunities."* with a deep link to `/app/engagements/<id>/findings`.
  - `aiConfigured = false` → CTA disabled, controlled message: *"AI opportunity drafting is not configured for this environment. Add the provider key server-side (`OPENAI_API_KEY` in `.env.local`) to enable draft generation."*
- Component uses `useTransition`. On success it shows generated count + skipped duplicates. On failure it shows a translated error code (e.g., `ai-rate-limited` → "AI provider rate-limit reached. Wait a minute and try again.").
- `app/app/engagements/[id]/opportunities/page.tsx` — calls `isAiConfigured()` server-side and threads `aiConfigured = isPersisted && isAiConfigured()` plus `hasApprovedFindings = findingCandidates.length > 0` (the existing Step 7 candidate query already filters `review_status in ('approved', 'report_ready')`) into `<GenerateOpportunitiesForm>`. The form renders only inside the `isPersisted` branch — mock slug engagements never see the AI drafting CTA. Page meta line now reads "AI Synthesis Step 2 · Live" when AI is configured on a real engagement.
- Existing manual `<CreateOpportunityForm>` continues to render below the AI form. `OpportunityActionBar` (selected / deferred / rejected / reopen) drives the lifecycle on AI-drafted opportunities exactly as it does on manually-scored ones.

**Activity events.**

- `lib/activity/types.ts` — added `ai_opportunities_generated` to `ActivityEventType` (no new entity type — `ai_synthesis_run` from Step 1 covers it).
- `components/activity/activity-timeline.tsx` — added tone + label entries: `ai_opportunities_generated → ai / "AI opportunities generated"`. `ai_synthesis_failed` continues to handle failures.
- Activity metadata restricted to `{ runType, generatedCount, skippedDuplicateCount, provider, model }`. The Step 9 `sanitizeMetadata` continues to drop forbidden keys defensively.

**Public/internal boundary.**

- Only authenticated operators can trigger opportunity synthesis. `generateDraftOpportunitiesForEngagement` short-circuits on `auth.getUser()` before any context is built or any provider call is made.
- Synthesis output is stored as operator-only `opportunities` rows under existing `opportunities_operator_full` RLS plus `opportunity_finding_links` rows under `opportunity_finding_links_operator_full`. Public scorecard / public intake routes never read opportunities, links, synthesis runs, or activity events.
- The OpenAI key is read only in `lib/ai/provider.ts` (server-only) and never leaves the server. The browser bundle never receives any synthesis code (the `server-only` import enforces this at build time).
- The page server component reads `isAiConfigured()` once and passes only the boolean down — the key is never serialized into the rendered HTML.

**Mock boundary preserved.**

- Legacy mock slug engagements continue rendering the seeded mock opportunities from `lib/opportunities/mock-opportunities.ts` — no AI synthesis surface, no `GenerateOpportunitiesForm`, no `CreateOpportunityForm` regression.
- The CTA appears only when `loaded.kind === "real"` AND `aiConfigured === true`.

**Validation guardrails.**

- Categories: 9-value allowlist matching the existing `OpportunityCategory` vocabulary. Unknown → reject candidate.
- Evidence strength: 3-value allowlist (`strong`, `adequate`, `thin`). Unknown → default to `adequate`.
- `linkedFindingIds`: must be valid UUIDs AND must be in the eligible set returned by the context builder (approved/report-ready findings only). Otherwise dropped.
- Title required and non-empty; clipped to 160 chars.
- Description / source summary / recommended action / implementation shape clipped to 800 / 600 / 400 / 500 chars.
- Arrays (`dependencies`, `risks`, `successSignals`): max 6 items × max 200 chars per item.
- All scores clamped to 0–100 integers (default 50 if missing or NaN).
- Generated count clamped to 6 max even if the model returns more.
- Title-based dedup is case-insensitive and whitespace-collapsed; runs against existing engagement opportunities AND within the same batch.
- Server-derives priority + quadrant from impact + complexity + risk via the existing `computeQuadrant` helper, then applies the high-risk override (`risk >= 85 → defer-avoid`). Model-provided priority/quadrant is ignored.

**Verification.**

- `npm run lint` — clean.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` — clean. Route count unchanged at 25; `/app/engagements/[id]/opportunities` First Load grew slightly to accommodate the new client component.
- Build also succeeds with `OPENAI_API_KEY` unset — `getAiProviderConfig()` returns `null`, the page renders the controlled "AI opportunity drafting is not configured" state, no provider calls are issued.
- Secret handling: `.env.local` was not read, modified, or staged; no provider keys, no prompt bodies, no raw model responses, no stakeholder content, no opportunity descriptions, no finding excerpts, no Supabase keys printed during this sprint. `.env.example` updated with names only (`SLATE_AI_OPPORTUNITIES_MODEL`).

## Recommended Next Step

**AI Synthesis Step 3 — document parsing pipeline OR roadmap drafting from selected opportunities.** Steps 1, 1.1, and 2 cover the operator-reviewed findings → operator-reviewed opportunities arc. Three natural follow-ons:

1. **Document parsing.** Steps 1 and 2 explicitly treat uploaded files as metadata-only. Adding a server-only PDF/DOCX/CSV text-extraction pipeline (with size + page caps, no OCR for scanned content) would let synthesis cite document excerpts as well as stakeholder responses. Storage hardening (per-asset RLS, virus scanning, content sniffing) should land alongside parsing rather than as a separate workstream.
2. **Roadmap drafting.** Once a body of selected opportunities exists for an engagement, roadmap items can be drafted by the same provider abstraction. Inputs would be selected opportunities + the existing evidence surface; the validator + activity logger pattern from Steps 1 + 2 transfers directly. Operator approval still required.
3. **Production export hardening.** Replace `LockedActionButton` for `Export Report` and `Send to Client` / `Prepare SOW Draft` with real PDF generation. Storage hardening overlaps with (1).

(4) BuildOps remains out of scope.
