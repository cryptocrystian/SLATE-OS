# SLATE Current Status

_Last updated: 2026-05-05 — Persistence/Auth Step 8 (reports + proposals persistence) implemented; operators initialize a 12-section report and 3-option proposal per UUID engagement, section approve / needs-review / final actions and option recommendation persist, implementation credit lands as a bounded commercial lever, export / SOW / send remain locked_

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

## Recommended Next Step

**Step 9 — Activity events + notes persistence.** Capture engagement-scoped activity events (intake invites, finding decisions, opportunity selections, roadmap moves, report approvals, proposal recommendations) and operator-authored notes into a unified `activity_events` table with a thin `notes` table for free-form text. Wire the engagement detail timeline + the per-domain notes panels. Per `docs/persistence/02_MIGRATION_SEQUENCE.md`.
