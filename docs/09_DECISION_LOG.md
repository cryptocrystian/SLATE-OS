# SLATE Decision Log

A running log of significant product, architecture, and design decisions. Each entry should record the decision, context, and any tradeoffs.

---

## 2026-05-05 — Persistence/Auth Step 5: token-gated stakeholder intake persists; operators mint and share intake links manually, email automation + document upload + AI synthesis deferred

**Decision.** `/app/engagements/[id]/intake` now reads/writes real `stakeholder_intake_sessions`, `stakeholder_responses`, and `input_assets` for UUID engagements. A new public route `/intake/[token]` lets stakeholders submit responses without a SLATE login. Tokens are 32 random bytes (base64url); SLATE persists only the sha256 hash. Operators copy the generated `/intake/<token>` URL and deliver it manually — email automation, real document upload, and AI synthesis are explicitly deferred.

**Context.** Step 5 of `docs/persistence/02_MIGRATION_SEQUENCE.md`. Steps 0–4.5 closed the public-scorecard → lead inbox → engagement creation loop. Step 5 closes the engagement → discovery loop: a real engagement can now collect role-specific stakeholder responses. Without this, the intake workspace would remain a placeholder for every UUID engagement, and Step 6 (findings synthesis) has nothing to synthesize from.

**Implementation.**
- `supabase/migrations/0005_stakeholder_intake.sql` — three tables (`stakeholder_intake_sessions` with unique `token_hash` index + `token_expires_at`, `stakeholder_responses` with `(session_id, question_id)` unique, `input_assets` for metadata only). RLS enabled with operator-only `for all to authenticated using/with check (workspace_id = (select id from public.workspaces limit 1))` on every table. Status / response_quality / asset_type / status / evidence_quality stay text-typed so vocabulary can evolve without a migration.
- `lib/intake/tokens.ts` — `generateIntakeToken()` (32 random bytes, base64url), `hashIntakeToken()` (sha256 hex), `compareTokenHashes()` (constant time), `isPlausibleRawToken()`, `buildIntakeUrl()`. The raw token is returned exactly once at creation; only the hash hits the DB.
- `lib/intake/queries.ts` (server-only) — `getIntakeRecordForEngagement(engagementId)` returns the existing TS `IntakeRecord` shape from real rows; `getIntakeStatusSummary(engagementId)` powers the engagement detail panel.
- `lib/intake/mappers.ts` — DB↔TS translators (role / status / quality enums), role-coverage derivation from a fixed required-role set, follow-up queue derivation, input-asset mapping, completion-percent heuristic, summary-text builder, formatRelativeOrDash.
- `lib/intake/seed-questions.ts` — seven generic stakeholder intake questions + per-role contextual prompts.
- `lib/intake/actions.ts` (`"use server"`) — `createStakeholderSession({ engagementId, name, email, title, role, department })` validates, auth-checks via `supabase.auth.getUser()`, generates a token, persists only the hash, and returns `{ ok: true, sessionId, intakeUrl }` exactly once. `revalidatePath` on both `/app/engagements/<id>/intake` and `/app/engagements/<id>`.
- `lib/intake/public.ts` (server-only, service role) — `loadStakeholderSessionByToken(rawToken)` and `submitStakeholderResponses({ rawToken, answers })`. Both hash before DB lookup, validate `token_expires_at`, narrow the response to public-safe fields (engagement company name, engagement name, target date, stakeholder name / title / role, existing answers). Submit upserts on `(session_id, question_id)`, classifies response quality from total chars + filled-count, marks the session `completed`. Internal fit, lead trust reasons, and operator copy are never returned.
- `app/intake/[token]/page.tsx` + `actions.ts` + `components/intake/public-intake-form.tsx` — anonymous, server-rendered, `force-dynamic`, `robots: { index: false, follow: false }`. Renders one of three states (invalid / expired / completable) and uses the public `PublicAssessmentShell` for brand continuity. Form submit goes through a page-local server action that delegates to `submitStakeholderResponses`.
- `components/intake/create-stakeholder-form.tsx` (`"use client"`) — operator-side form with one-time copy block, "Copy this intake link and send it manually. Email automation lands later." caption, and a soft warning surfaced when the source lead is `flagged` / `rejected` per Step 4.5: "This lead was flagged during public scorecard submission. Confirm before sending stakeholder intake."
- `app/app/engagements/[id]/intake/page.tsx` — branches on the `loadEngagementForSubroute` kind. UUID engagements render the live workspace + create-stakeholder form; legacy slug engagements continue rendering the seeded mock fixture.
- `app/app/engagements/[id]/page.tsx` — `mergeIntakeStatus(engagement, summary)` overlays derived counts (invited / completed / needs-follow-up / rolesCovered / rolesMissing / nextAction) on top of the engagement's persisted `intake_status` jsonb when at least one session exists.

**Tradeoffs.**
- *Operator manually copies the link instead of email automation.* The canon defers email delivery to a later conversion/notification sprint. Manual delivery keeps Step 5 scoped to persistence and avoids pulling in Mailgun template / unsubscribe / bounce-handling work that has its own surface area. The token URL is shown exactly once on the operator screen with explicit "send it manually" copy, and the operator is the only principal who ever sees it.
- *No anon RLS policies; service role for token-gated reads/writes.* The canon sketched a `current_setting('stakeholder.token', true)` model for stakeholder RLS. We chose service-role-only writes through a narrowly-scoped server module because (1) it avoids per-request `set_config` plumbing that is easy to leak between connections, (2) the public route's blast radius is constrained to one server file (`lib/intake/public.ts`) that already enforces token-hash-keyed access, and (3) it matches the Step 2 / 4.5 posture of "every public write goes through one auditable server endpoint." Cost: any leak of the service role key is total. Mitigated by the existing `import "server-only"` boundary, no `NEXT_PUBLIC_` prefix, and no logging of the key.
- *Status / response_quality / asset_type stored as `text` not enum.* Mirrors the Step 4.5 decision — the vocabulary (especially `expired`, `needs_follow_up`, future status values) is still evolving, and text columns let the app code be the single source of truth without another migration each time.
- *`input_assets` is metadata only; no Supabase Storage bucket.* Real binary upload lands in Step 10 of the migration sequence. Step 5 supports operator-authored or response-derived input metadata so the workspace renders the supporting-inputs panel for real engagements; the actual file blob does not yet exist. The schema reserves the linkage so Step 10 is purely additive.
- *Per-stage panel jsonb on `engagements` retained.* The data-model draft notes these become derived views once the underlying tables ship. Step 5 augments the engagement detail's intake panel with live counts via a small overlay rather than dropping the column — Step 6 (findings) and beyond will repeat the pattern, and the column can be dropped (or formalized as a materialized snapshot) once all six panels read from real tables.
- *21-day token TTL.* Long enough to outlast a typical 6-week sprint's intake window without forcing operators to mint frequently; short enough that abandoned links don't linger forever. `token_revoked_at` style soft-delete is reserved for a future operator action.
- *Response quality classified from char count + filled-count rather than NLP.* MVP heuristic. Real synthesis will re-classify when AI is wired.

**Boundary preserved.** Findings, opportunities, roadmap, reports, and proposals remain placeholder-rendered for UUID engagements. No real document upload, no email delivery, no AI synthesis. Public response shape exposes only company / engagement / role / stakeholder name; no `internal_fit_score`, lead trust reasons, scorecard summary internals, or operator copy. Service role key is server-only. `/app/*` remains middleware-gated; `/intake/[token]` is anonymous by design and indexed `noindex, nofollow`. No BuildOps surfaces.

**Verified.** `npm run lint` clean; `NEXT_TELEMETRY_DISABLED=1 npm run build` clean; `git status --short --ignored` shows `.env.local` as `!!` (ignored, untracked); no secrets, raw intake tokens, magic-link URLs, or service-role keys printed during this sprint. Manual end-to-end verification (apply migration → operator mints session → stakeholder submits via incognito session → response visible in operator workspace) deferred to a real Supabase round-trip.

---

## 2026-05-05 — Persistence/Auth Step 4.5: scorecard anti-abuse + email quality; immediate browser results retained, email delivery + email-click verification deferred

**Decision.** Public scorecard submissions now run through a small server-side anti-abuse + email-quality pipeline before persisting. Honeypot, minimum-duration thresholds, a hand-curated disposable-domain blocklist, and per-email/domain rate limiting collapse into two storage signals: `scorecard_submissions.anti_abuse_status` (`accepted` | `flagged`) and `leads.trust_status` (`unverified` | `flagged`). Operators see a small trust chip on the lead inbox / detail; public surfaces never see the chip or any abuse internal. SLATE keeps the immediate-result UX — there is no email-verification gate before showing the result — and email delivery / email-click verification are explicitly deferred to a later conversion/notification sprint.

**Context.** The scorecard now writes real submissions, real leads, and real engagements (Steps 2–4). The next deeper persistence step (intake) makes lead quality more expensive to ignore: synthetic / disposable submissions burden the operator inbox and pollute the qualification signals on every downstream analysis. A small hardening sprint before Step 5 catches the obvious garbage without disrupting the conversion-friendly "see your result instantly" flow that the public scorecard was built around.

**Implementation.**
- `supabase/migrations/0004_scorecard_abuse_hardening.sql` — adds nine nullable columns to `scorecard_submissions` (`email_normalized` / `email_domain` / `email_quality` / `email_verified` / `anti_abuse_status` / `anti_abuse_reasons` / `submission_duration_ms` / `honeypot_value` / `client_fingerprint_hash`) and two columns to `leads` (`trust_status` / `trust_reasons`). New indexes on `(email_normalized, submitted_at desc)` and `(email_domain, submitted_at desc)` power the rate-limit count queries. RLS posture unchanged (operator-only via Step 2 policies).
- `lib/scorecard/email-quality.ts` — pure module exporting `classifyEmailQuality(email)` plus the smaller helpers (`normalizeEmail`, `isValidEmailSyntax`, `getEmailDomain`, `isDisposableEmailDomain`, `isFreeEmailDomain`, `isFakeEmailDomain`). ~17 disposable domains, ~22 free providers, fake-host blocklist for `example.com` / `test.com` / etc. No DNS / MX checks, no external validation services.
- `app/api/scorecard/submit/route.ts` — typed public error vocabulary (`invalid-json`, `invalid-submission`, `missing-fields`, `invalid-email`, `disposable-email`, `submission-too-fast`, `rate-limited`, `service-not-configured`). Honeypot read from both `payload.honeypot` and `answers.website` — non-empty rejects with 400 (and the value is never persisted). Duration < 15s rejects, 15s–45s accept-but-flag, > 45s accept. Per-email rate limit (3/h) and per-domain rate limit (6/h, skipped for free providers). Email normalized to lowercase before contact upsert + submission insert. Coarse `client_fingerprint_hash` (`sha256(userAgent | locale | timezone | normalizedEmail)`); raw IP is never collected.
- `components/scorecard/scorecard-stepper.tsx` — tracks `startedAt` on first hydration, persists it through `slate.scorecard.v1` so a resume doesn't reset the duration baseline; sends `clientMeta = { startedAtIso, completedAtIso, submissionDurationMs, locale, timezone }` and the honeypot field on POST. Visually-hidden honeypot input (`-left-[9999px]`, `aria-hidden`, `tabIndex={-1}`, `autocomplete="off"`). Public error codes mapped to typed copy.
- `lib/leads/types.ts` + `mappers.ts` + `queries.ts` — `LeadTrustStatus` union added to `Lead`; the new columns are selected and translated into the existing TS shape. `components/leads/lead-trust-chip.tsx` — small `Badge` with status-tinted icon, reasons rendered as a `title` hover tooltip. Wired into `LeadListItem` and `LeadProfileHeader`.

**Tradeoffs.**
- *Hand-curated disposable list vs DNS / MX checks vs third-party validation API.* DNS lookups in serverless are slow and flaky; third-party validation adds vendor + cost + privacy surface for a public scorecard. The hand-curated list catches the bulk of garbage with zero latency and is trivially extensible. If conversion data ever shows we need a real verification step, that's a separate decision.
- *Free-provider emails are accept-but-flag, not reject.* Many real prospects in early-stage companies submit from gmail / outlook. Rejecting them would harm conversion more than it would clean the inbox. Flagging gives operators a visible signal without blocking a real lead.
- *Per-email rate limit (3/h) and per-domain rate limit (6/h, skipped for free providers).* Conservative defaults; intentionally not aggressive. The query path is two `count: 'exact', head: true` reads against the new indexes — cheap. If a legitimate enterprise has multiple stakeholders submit from the same domain in an hour, the 6/h ceiling is permissive enough.
- *Trust columns on `leads` instead of derived from `scorecard_submissions`.* Step 3 reads leads directly and the operator inbox is the surface that needs the chip. Putting the columns on `leads` keeps the inbox query cheap and lets future operator actions (`Verify`, `Mark flagged`) write a single row rather than reach back across the join.
- *No raw IP storage.* The fingerprint hash is a coarse user-agent + locale + timezone + email bucket. We don't retain network identifiers; if abuse patterns ever require it, that's a separate decision with its own privacy review.
- *Immediate result preserved; email-click verification deferred.* Requiring email verification before the result would suppress conversion in a way the scorecard was deliberately designed to avoid. The trust posture (`unverified` default) records that we have not yet confirmed the address, so a future verification sprint can promote rows to `verified` without re-architecting anything.

**Boundary preserved.** Public response shape unchanged: `{ submissionId, result: PublicScoreResult, displayContext }`. No `fit`, `trust_status`, `anti_abuse_status`, or abuse reasons leak. Public error responses are typed strings, never internal stacktraces. `/app/leads*` remains middleware-gated; the trust chip only renders inside `/app/*`. No service-role exposure beyond the existing public submit endpoint. No BuildOps surfaces, no email delivery, no third-party services.

**Verified.** `npm run lint` clean; `NEXT_TELEMETRY_DISABLED=1 npm run build` clean; `git status --short --ignored` shows `.env.local` as `!!` (ignored, untracked); no secrets staged. Manual end-to-end verification deferred to a real Supabase session — the abuse pipeline runs server-side against real DB constraints which CI doesn't have a live session for.

---

## 2026-05-05 — Persistence/Auth Step 4: engagement creation + detail persist; Start AI Opportunity Sprint becomes a real action

**Decision.** `/app/engagements` and `/app/engagements/[id]` now read real Supabase-backed engagement rows. A new server action `createOrOpenEngagementForLead(leadId)` powers the lead detail `Start AI Opportunity Sprint` CTA: existing engagements for the lead reopen, otherwise a fresh engagement is created with default per-stage status panel JSON, source-snapshot scorecard context, and the operator as `owner_profile_id`. A unique partial index on `engagements.linked_lead_id` guarantees one engagement per lead. Downstream sub-routes (`/intake` / `/findings` / `/opportunities` / `/roadmap` / `/report` / `/proposal`) gracefully render a premium "activates with Step N" placeholder for real UUID engagements, and continue to render their seeded mock workspaces for the legacy slug demo paths.

**Context.** Step 4 of `docs/persistence/02_MIGRATION_SEQUENCE.md`. Step 3 brought leads onto real Supabase but `engagementForLead(uuid)` always returned undefined because the mock engagements key off legacy slugs (`atlas-manufacturing`, etc.). Step 4 closes the lead-to-engagement loop so the public scorecard → internal lead → AI Opportunity Sprint workspace is end-to-end live, while keeping the mature deliverable workspaces (intake / findings / opportunities / roadmap / report / proposal) on their seeded fixtures until their own step ships.

**Implementation.**
- `supabase/migrations/0003_engagements.sql` — `engagements` table, three enums (`engagement_type`, `engagement_status`, `engagement_stage`), six per-stage status `jsonb` columns (`intake_status` / `document_status` / `findings_status` / `opportunity_status` / `report_status` / `proposal_status`), source/recommended/risks/dependencies/notes jsonb, indexes on workspace+activity / account / contact / linked_lead / current_stage / status, partial unique index on `linked_lead_id where not null`, RLS enabled with operator-full policy `for all to authenticated using/with check (workspace_id = (select id from public.workspaces limit 1))`. Idempotent — uses `do $$ begin … exception when duplicate_object …` for enums and `if not exists` everywhere else.
- `lib/engagements/queries.ts` (server-only, `import "server-only"`) — `getAllEngagements`, `getEngagementById`, `getEngagementIdForLead`. Uses cookie-bound authenticated server client so RLS is the boundary.
- `lib/engagements/mappers.ts` — defensive jsonb-to-typed-shape parsers with safe defaults so a row missing one of the panel-status columns still renders a reasonable workspace. `defaultIntakeStatus()` / `defaultDocumentStatus()` / etc. are reused both at insert time (the action seeds them) and at render time (the mapper falls back to them when the column is null).
- `lib/engagements/actions.ts` — `createOrOpenEngagementForLead(leadId)` server action. Auth-checks via `supabase.auth.getUser()` first; reuses any existing engagement (same `linked_lead_id`); otherwise loads lead + account + submission, builds a starter row (`setup` or `intake` stage depending on lead status), persists default panel JSON, mirrors lead status forward to `diagnostic_requested`, and redirects. Catches PG `23505` to handle a race that lost to a concurrent submit.
- `lib/engagements/load-for-subroute.ts` — small helper for the six downstream sub-routes. Tries the seeded mock fixtures first (so `atlas-aios-q2`, `helio-aios-q2`, `meridian-aios-q2`, `quanta-aios-q2`, `caldera-aios-q2` keep rendering exactly the seeded workspaces operators have been demoing), falls back to a real Supabase lookup. Returns `{ kind: "mock" | "real", engagement }` so each page can branch into the existing mock workspace or the new placeholder.
- `components/engagements/persistence-placeholder.tsx` — shared premium "activates with Step N" surface. Premium dark card + recommended-action card + engagement context card on the right. Used by all six downstream sub-routes when the engagement was persisted in Step 4.
- `app/app/engagements/page.tsx` and `app/app/engagements/[id]/page.tsx` — `force-dynamic`, server components, real reads. New empty state on the list ("No engagements yet — Start an AI Opportunity Sprint from a qualified lead to create the first workspace.").
- `components/leads/lead-actions-panel.tsx` — primary CTA bound to the server action via `<form action={createOrOpenEngagementForLead.bind(null, leadId)}>`. When an engagement already exists, switches to a `Link` labeled `Open AI Opportunity Sprint`. Other action buttons remain visual placeholders (disabled rather than active) until later steps wire them.
- `app/app/leads/[id]/page.tsx` — uses `getEngagementIdForLead(lead.id)` to choose between Start vs Open. Removed the legacy `engagementForLead(slug)` call.
- `lib/engagements/mock-engagements.ts` — kept as the fixture set with a header comment documenting its new role (downstream-only).

**Tradeoffs.**
- *Per-stage status panels stored as `jsonb` instead of normalized child tables.* The data model draft (`docs/persistence/01_DATA_MODEL_DRAFT.md`) calls these out as derived views over the underlying `stakeholder_intake_sessions` / `findings` / `opportunities` / `report_sections` / `proposals` tables, but those tables don't exist yet (Steps 5–8). Persisting the panel snapshots as `jsonb` columns lets the engagement detail page render meaningfully *before* those tables land, and the columns are written by the action with safe defaults so no UI panel ships empty. When the underlying tables ship, the columns either become the materialized snapshot maintained by triggers, or are dropped in favor of a derived view — both are non-breaking changes for the UI surface.
- *Single unique partial index `(linked_lead_id) where linked_lead_id is not null` instead of upsert in the action.* Upsert via `on conflict` would have been equivalent, but the index is cheaper to reason about: re-clicking `Start AI Opportunity Sprint` from the same lead is provably idempotent at the database level, not just by application convention.
- *Legacy mock slugs survive on the downstream sub-routes.* Steps 5–8 will replace the mock workspaces one-by-one; until then keeping the slug fallback means the seeded Quanta / Caldera demo paths (which carry mature findings / opportunities / report / proposal data) keep working unchanged. New UUID engagements show a clean placeholder instead of empty mock panels.
- *No `engagement_stage_events` audit table.* Activity-event persistence is Step 9; emitting events from the engagement insert path now would require a table that doesn't exist yet. Status changes are best-effort logged via the existing `console.error` whitelist on failure, and the lead status flip is non-fatal if it errors.

**Boundary preserved.** Intake / findings / opportunities / roadmap / report / proposal remain mock-backed for legacy slug ids and placeholder-rendered for real UUIDs. No real stakeholder intake, no real findings synthesis, no real opportunity scoring, no real report / proposal generation. No BuildOps surfaces. No service-role code in client components. Public scorecard path unchanged; `/app/*` routes remain auth-gated.

**Verified.** `npm run lint` clean; `NEXT_TELEMETRY_DISABLED=1 npm run build` clean; `git status --short --ignored` shows `.env.local` as `!!` (ignored, untracked); no secrets staged. Manual end-to-end verification deferred to a real Supabase session — the create/open flow exercises an auth-gated server action and an RLS-protected insert, neither of which is reachable from CI without a live magic-link round-trip.

---

## 2026-05-05 — Persistence/Auth Step 3: lead inbox + detail read real Supabase rows under operator-only RLS

**Decision.** `/app/leads` and `/app/leads/[id]` now read real Supabase-backed lead records via an authenticated server client (anon key + cookies) so RLS is exercised on every read. Mock lead data (`lib/leads/mock-leads.ts`) is deleted. Engagement / intake / findings / opportunities / roadmap / reports / proposals continue to render mock data; only the lead surface migrates this sprint. The internal fit score, fit dimensions, and qualification signals stay server-side and operator-only.

**Context.** Step 3 of `docs/persistence/02_MIGRATION_SEQUENCE.md`. Step 2 already persists submissions and writes `leads`/`lead_fit_dimensions`/`lead_qualification_signals` rows with derived internal qualification. This step closes the public-to-internal handoff loop: a scorecard submitted on `/scorecard/start` now appears in the operator inbox after sign-in, with the internal Saipien Fit Score and qualification signals visible only inside the auth-protected `/app/*` chrome. The TS `Lead` shape predates persistence, so the query layer translates DB enums (underscores) to the existing TS unions (hyphens) rather than reshape every component.

**Implementation.**
- `lib/leads/queries.ts` (server-only via `import "server-only"`) — `getAllLeads()` and `getLeadById(id)`. Both use `createSupabaseServerClient()` (cookie-bound anon key) so RLS evaluates with `auth.role() = 'authenticated'`. `getLeadById` UUID-guards before any DB call. The list selects `leads` joined to `accounts`, `contacts`, and `scorecard_submissions.submitted_at`, ordered by `last_activity_at desc`. The detail layer additionally fetches `lead_fit_dimensions`, `lead_qualification_signals`, and `scorecard_answers`; the answers feed a server-side `scoreScorecard()` re-run to re-derive `opportunityAreas` + `riskNotes` so the existing `OpportunityAreaCard` + `RiskReadinessNote` keep working without persisting that derivation on the lead row.
- `lib/leads/mappers.ts` — pure DB↔TS shape translators (status / source / practice / fit-dimension enum mappers, prospect-scores clamp, recommended-action with safe defaults, `formatRelative()` for the relative-time string the existing UI expects, canonical fit-dimension ordering).
- `app/app/leads/page.tsx` — `force-dynamic`, server component. Reuses the existing `MetricCard`s + `LeadList`. New empty state when there are no submissions (no fake CRM stats). Eyebrow updated to `Persistence Step 3 · Live`.
- `app/app/leads/[id]/page.tsx` — `force-dynamic`, server component. `generateStaticParams` removed (UUID ids replace slugs). `notFound()` on missing or RLS-denied. Conditionally renders `OpportunityAreaCard` / `RiskReadinessNote` / `QualificationSignalsPanel` only when their arrays are non-empty so a freshly-created lead with no signals doesn't ship empty headers.
- `lib/leads/mock-leads.ts` — deleted; no other importers. Other domain mock files (`lib/engagements`, `lib/intake`, `lib/findings`, `lib/opportunities`, `lib/roadmap`, `lib/reports`, `lib/proposals`) are intentionally kept; they're retired in Steps 4–8.

**No new migration.** Step 2's `0002_scorecard_leads.sql` already enables RLS on every affected table with operator-full policies workspace-scoped via `(select id from public.workspaces limit 1)`. The intended `0003_lead_query_policy_fix.sql` was scoped but not authored — the existing posture covers the new authenticated reads.

**Tradeoffs.**
- *Re-running `scoreScorecard` on detail reads vs persisting the derived opportunity areas + risk notes on the lead row.* Re-running is cheap, deterministic from the persisted answers, and keeps `lib/scorecard/scoring.ts` as the single source of truth. If the rules ever become "the contract" we'd snapshot the derivation on insert and read it back verbatim — same tradeoff already taken for the public results page in Step 2.
- *Authenticated server client (anon key + cookies + RLS) instead of service role for these reads.* The canon explicitly prefers this so RLS is the boundary, not application code. Service role is reserved for the public submit endpoint where there is no authenticated principal.
- *UUID ids break the legacy `engagementForLead(slug)` lookup.* That's expected: the mock engagement-to-lead linkage was always slug-keyed (`atlas-manufacturing`, `helio-health`). Step 4's real engagement creation will key off the new UUID. Until then `LeadActionsPanel` continues to render its "Mock — not wired" affordance for any UUID-keyed lead.
- *Removed `generateStaticParams`* — `/app/leads/[id]` is now `ƒ` dynamic. SSG of operator routes was already at the boundary of correctness once auth landed in Step 1; with real lead IDs there's nothing meaningful to prerender.

**Boundary preserved.** Public `/api/scorecard/results/[id]` continues to strip `fit` via `toPublicScoreResult()`. `internal_fit_score`, `lead_fit_dimensions`, and `lead_qualification_signals` are read only from server-rendered `/app/*` pages. `/app/leads*` remains middleware-gated. No real engagement creation, no AI Opportunity Sprint creation, no deliverable workspace migration. No BuildOps surfaces.

**Verified.** `npm run lint` clean; `NEXT_TELEMETRY_DISABLED=1 npm run build` clean; `git status --short --ignored` shows `.env.local` as `!!` (ignored, untracked); no secrets staged. Manual smoke-test deferred to a real Supabase round-trip — the authenticated server client requires a signed-in operator session that this environment does not have a magic-link round-trip for.

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
