# SLATE Session Handoff

Use this doc when picking up SLATE work in a new session. It captures repo state, where things live, and how to start the next sprint without re-reading every canon doc end-to-end.

---

## Where We Are

Sprints 1–7 are complete. MVP Stabilization closed cleanly. The MVP Acceptance Audit returned 4.8/5 and approved the surface as the baseline. The Persistence/Auth architecture canon is drafted in `docs/persistence/`. **Persistence/Auth Steps 0–10 plus AI Synthesis Steps 1, 1.1, and 2 are complete and ship build-clean against a real Supabase project.**

**Phase boundary (2026-05-07).** AdvisoryOps Phase 1A is the internal operating-system foundation and was accepted on 2026-05-07 with two minor fixes applied during the audit (stale `Mock — not wired` badges removed from `ProposalOptionDetail` and `FollowUpQueue`). It does not yet certify that reports, proposals, exports, or client collateral meet top-tier consulting quality. **Phase 1B must define and build the Consulting-Grade Deliverable Engine before customer-facing output claims are made.** The canonical Phase 1A audit is `docs/12_PHASE_1A_ACCEPTANCE_AUDIT.md`. The Phase 1B chart/exhibit canon has landed at `docs/13_PHASE_1B_CHART_EXHIBIT_CANON.md` — it approves Visx, formalizes the SLATE chart-vocabulary architecture, defines the eight required exhibits, and sets implementation order. The canon does not authorize building the remaining seven exhibits — that requires a separate sprint approval.

**Phase 1B Exhibit Sprint 1 (2026-05-07)** shipped the first real exhibit: `RiskAdjustedPriorityQuadrant` at `components/charts/exhibits/risk-adjusted-priority-quadrant.tsx`. Analytical 2×2 (impact × complexity), bubble size = business impact, color = risk band (`success / info / warning / risk` from existing chart-tone vocabulary). Pure server component. Accepts a narrow `RiskAdjustedQuadrantPoint[]` shape; exports `opportunityToRiskQuadrantPoint` adapter for future report wiring. Rendered alongside the proof-of-fit Executive Summary 2×2 on the unlinked `/app/charts-preview` route. **Not yet wired into the report or proposal builders — Sprint 1 proves the component and preview rendering only.** No package dependencies added; no new Visx packages.

**Phase 1B Exhibit Sprint 2 (2026-05-08)** shipped the Capability Maturity Heatmap at `components/charts/exhibits/capability-maturity-heatmap.tsx` plus a new reusable primitive at `components/charts/primitives/chart-heatmap-cell.tsx`. Capability × dimension grid; cell color encodes a 4-band maturity scale (0–39 risk · 40–59 warning · 60–79 info · 80–100 success) and the cell label is the score in tabular mono. Plain SVG `rect` + `text` cell — **`@visx/heatmap` was deliberately NOT installed**; the primitive will back the future Stakeholder Coverage Matrix without changes. Pure server component. Accepts a narrow `CapabilityMaturityCell[]` shape plus `capabilities[]` and `dimensions[]` row/column arrays. Rendered as the third exhibit on `/app/charts-preview` (Executive Summary 2×2 + Risk-Adjusted Priority Quadrant + Capability Maturity Heatmap). **Sprint 2 ships the preview component only — not yet wired into the report or proposal builders.** No package dependencies added.

**Phase 1B Exhibit Sprint 3 (2026-05-08)** shipped the Stakeholder Coverage Matrix at `components/charts/exhibits/stakeholder-coverage-matrix.tsx`. Role × topic heatmap surfacing evidence-coverage gaps before a report is treated as fully grounded. 4-tone evidence-strength scale (`missing → neutral`, `thin → warning`, `adequate → info`, `strong → success`); present cells show `responseCount`, missing cells render an em-dash at recessive opacity so coverage gaps visibly differ from low-strength responses. **Reuses the Sprint 2 `ChartHeatmapCell` primitive without modification** — the canon's primitive-reuse promise is now realized. Pure server component. Accepts `StakeholderCoverageCell[]` plus `roles[]` and `topics[]` row/column arrays. Rendered as the fourth exhibit on `/app/charts-preview`. **Sprint 3 ships the preview component only — not yet wired into the report or proposal builders.** No package dependencies added.

**Phase 1B Exhibit Sprint 4 (2026-05-08)** shipped the Roadmap Gantt with Dependencies at `components/charts/exhibits/roadmap-gantt-with-dependencies.tsx` plus two new generic primitives: `components/charts/primitives/chart-gantt-bar.tsx` and `components/charts/primitives/chart-dependency-arrow.tsx` (the latter exports `ChartDependencyArrowheadMarker` for the SVG `<marker>` arrowhead). 30/60/90-day timeline with phase headers, dashed phase boundaries, a brand-primary Today marker, and right-angle dependency arrows. Bar color = `RoadmapStatus` (`planned → info`, `in_progress → brand`, `blocked → risk`, `complete → neutral` muted). Item titles in the left margin; bars are clean colored blocks. Defensive clamping for out-of-range / invalid item geometry. Both new primitives are domain-agnostic. Pure server component. Accepts `RoadmapGanttItem[]` plus an optional `todayOffset`. Rendered as the fifth exhibit on `/app/charts-preview`. **Sprint 4 ships the preview component only — not wired into reports/proposals, no roadmap AI drafting added.** No package dependencies added; no new Visx packages.

**Phase 1B Benchmark Data Canon (2026-05-08)** has landed at `docs/14_PHASE_1B_BENCHMARK_DATA_CANON.md`. It defines three benchmark-data tiers (`illustrative` / `internal_directional` / `validated`), exact source-note strings for each, a future TS data shape with validation rules (`p25 ≤ p50 ≤ p75`, methodology required for validated, etc.), prohibited / allowed claim language, three readiness gates, and six proposed dimensions.

**Phase 1B Exhibit Sprint 5 (2026-05-08) · Gate 0 illustrative only** shipped Benchmark Comparison Bars at `components/charts/exhibits/benchmark-comparison-bars.tsx` plus the new `ChartPercentileBand` primitive at `components/charts/primitives/chart-percentile-band.tsx`. Per-dimension client score plotted against an illustrative p25/p50/p75 percentile band. Brand-primary diamond marker (visually primary), info-tone IQR box (muted scaffolding), median line, faint rail, neutral `SCORE · 0–100` axis framing (the canon prohibits "better"/"stronger" copy because `Workflow friction` is inverted). Exports `validateAndClampPoint` (rejects rows with bad percentile order — never silently sorts) and `defaultBenchmarkSourceNote` (derives the exact canon-prescribed source-note string from `dataset.status`). Default takeaway is conservative ("Illustrative comparison structure only; validated benchmark data is required before client-facing use."). Legend includes a status pill (`Illustrative · Gate 0`) so the credibility tier is visible chrome. Pure server component; rendered as the sixth exhibit on `/app/charts-preview`. **MUST NOT be wired into reports, proposals, public-scorecard, or PDF until a Gate 1 / Gate 2 dataset exists.** No package dependencies added; no benchmark data files; no schema.

**Phase 1B Financial Assumptions Canon (2026-05-08)** has landed at `docs/15_PHASE_1B_FINANCIAL_ASSUMPTIONS_CANON.md`. Four-tier validation system (`illustrative` / `operator_estimated` / `client_validated` / `finance_approved`), exact source-note strings per tier, 13 required financial inputs (baseline / rates / costs / risk / time-to-value / confidence / owner / status / reviewedAt), future TS data shapes (`FinancialAssumptionSet`, `SavingsWaterfallContribution`, `RoiBridgePoint`) with 12 validation rules, prohibited claim language ("guaranteed savings" / "payback in X months" / "will save $X" / "board-ready ROI" all gated on Gate 3 finance approval), allowed-by-tier language table, four readiness gates (Gate 0 preview → Gate 3 final-client-facing), plus dedicated rule blocks for AI-Savings Waterfall and ROI Bridge.

**Phase 1B Exhibit Sprint 6 (2026-05-08) · Gate 0 illustrative only** shipped AI-Savings Waterfall at `components/charts/exhibits/ai-savings-waterfall.tsx` plus the new `ChartWaterfallBar` primitive at `components/charts/primitives/chart-waterfall-bar.tsx`. Cost-baseline → per-contribution savings / cost bars → modeled-state bar with dashed-outline "modeled" treatment. Y-axis is COST, not savings — savings descend the cost stack (`success` tone), costs ascend (`warning` tone). Dashed connectors at the running cost stack between adjacent bars. Exports `validateAssumptionSet`, `validateContribution`, `defaultFinancialSourceNote`, and `deriveBaselineCost` — all pure helpers. Default takeaway ("Illustrative savings structure only; validated financial assumptions are required before client-facing use."), legend status pill ("Illustrative · Gate 0"), and exact illustrative source note ("Source: Illustrative sample data · not a financial model") all carry the Gate 0 framing deliberately. Pure server component; rendered as the seventh exhibit on `/app/charts-preview`. **MUST NOT be wired into reports, proposals, public-scorecard, or PDF until a Gate 1 / Gate 2 / Gate 3 assumption set exists.** ROI Bridge is NOT implemented in this sprint. No package dependencies added; no financial data files; no schema. **`ChartPercentileBand` (Sprint 5) and `ChartWaterfallBar` (Sprint 6) primitives both remain Gate 0; Sprint 6 sets up the infrastructure for the final ROI Bridge sprint without committing to its data tier.** All `/app/*` routes are auth-protected. Public scorecard submissions persist server-side with internal fit/lead derivation; the public response is type-narrowed to `PublicScoreResult` (no `fit` leak). The submit endpoint runs honeypot, minimum-duration, disposable-domain, and per-email/domain rate limiting; submissions and leads carry typed quality + trust metadata that surfaces only inside `/app/*` (small `LeadTrustChip` on the inbox + lead detail). `/app/leads*` and `/app/engagements*` read real Supabase rows under operator-only RLS via the authenticated server client. `Start AI Opportunity Sprint` creates / reopens a real engagement, idempotent on `linked_lead_id`. Operators mint token-gated stakeholder intake links; stakeholders submit responses on the public `/intake/[token]` route. Operators author real findings tied to stakeholder intake evidence; review actions persist. Operators score opportunities from approved findings (quadrant + priority derived server-side from impact + complexity + risk) and manually sequence selected opportunities into a 30/60/90 roadmap. Operators initialize a 12-section report and 3-option proposal per UUID engagement; section approve / needs-review / final actions and option recommendation persist; implementation credit lands as a bounded commercial lever defaulted to canonical commercial-lever copy. Production export, SOW draft, send-to-client, and e-signature stay behind `LockedActionButton`. **Operators have an operator-only auditable activity trail across every Step 4–8 action plus internal notes on real leads + engagements (soft delete, pin/unpin, edit in place). Logging is best-effort and never blocks the primary action. Public scorecard and stakeholder intake routes never expose notes or activity rows.** **Step 10 wires real binary file storage: stakeholders can attach supporting documents on the public `/intake/[token]` page, operators can upload internal documents on the engagement intake workspace, and operators download via 5-minute signed URLs through `/api/app/assets/[id]/download`. Bucket `engagement-documents` is private (10 MiB cap, 9-MIME allowlist); all access flows through server-only helpers under the existing token + auth boundary — no `storage.objects` policies are added.** **AI Synthesis Step 1 layers operator-triggered draft finding generation on top: `Generate draft findings` on `/app/engagements/[id]/findings` calls a server-only OpenAI adapter (`fetch`-based, no SDK), validates JSON output against allowlists, persists 3–7 candidates as `ai_drafted = true` / `needs_review`, and records a safe-summary `ai_synthesis_runs` row plus an `ai_findings_generated` activity event. Uploaded files are not parsed — only metadata reaches the model. Drafts must pass operator approval before becoming report-ready.** **AI Synthesis Step 1.1 surfaces the synthesis surface from the engagement workflow without overriding the intake-first recommended action: the engagement stage tracker shows a small `Sparkles` next to the synthesis stage, the Findings status panel shows an `AI draft available` badge plus an evidence-aware readiness footnote, and the page-level "Limited evidence" warning gained a `Manage intake first ↗` deep link. AI affordances render only on real persisted UUID engagements when `OPENAI_API_KEY` is configured server-side.** `lib/leads/mock-leads.ts` is retired; `lib/engagements/mock-engagements.ts`, `lib/intake/mock-intake.ts`, `lib/findings/mock-findings.ts`, `lib/opportunities/mock-opportunities.ts`, `lib/roadmap/mock-roadmap.ts`, `lib/reports/mock-reports.ts`, and `lib/proposals/mock-proposals.ts` are retained as fixtures for legacy slug-keyed demo paths only — those paths skip the notes + activity queries and the persisted assets panel entirely.

Next planned: **scope Phase 1B — Consulting-Grade Deliverable Engine.** Suggested order: charting layer + SLATE chart vocabulary → eight consulting exhibits (Executive Summary 2×2, Capability Maturity Heatmap, AI-Savings Waterfall, ROI Bridge, Roadmap Gantt with Dependencies, Risk-Adjusted Priority Quadrant, Stakeholder Coverage Matrix, Benchmark Comparison Bars) → rich-text section bodies → AI synthesis Steps 3/4/5 (report sections, proposal options, roadmap drafting) → server-only document parsing → real PDF export for reports + SOWs → public scorecard PDF download + benchmark dataset. E-signature, CRM integration, and BuildOps remain explicit non-goals.

---

## Repo Layout

```
app/
  layout.tsx               # Root layout, fonts, viewport, metadata
  page.tsx                 # Redirect → /app
  app/
    layout.tsx             # AppShell wrapper
    page.tsx               # Command Center dashboard
    leads/
      page.tsx             # Lead inbox (server)
      [id]/page.tsx        # Lead detail (SSG via generateStaticParams)
    engagements/
      page.tsx             # Engagement list (server)
      [id]/page.tsx        # Engagement command center (SSG)
      [id]/intake/page.tsx       # Stakeholder intake manager (SSG, Sprint 5)
      [id]/findings/page.tsx     # Findings review workspace (SSG, Sprint 5)
      [id]/opportunities/page.tsx  # Opportunity matrix workspace (SSG, Sprint 6)
      [id]/roadmap/page.tsx        # 30/60/90 roadmap (SSG, Sprint 6)
      [id]/report/page.tsx         # Report builder (SSG, Sprint 7)
      [id]/proposal/page.tsx       # Proposal & SOW options (SSG, Sprint 7)
  apply/
    ai-systems-review/
      page.tsx             # Premium "Application coming soon" stub
  scorecard/
    layout.tsx             # Public metadata only
    page.tsx               # /scorecard landing
    start/page.tsx         # /scorecard/start (renders ScorecardStepper)
    results/page.tsx       # /scorecard/results (renders ScorecardResultsView)
components/
  layout/                  # Internal app shell (Sprint 1)
    app-shell.tsx
    sidebar-nav.tsx
    top-bar.tsx
    page-header.tsx
  ui/
    button.tsx             # Variants: primary | secondary | outline | ghost
    card.tsx               # Card + Header/Title/Description/Body/Footer
    badge.tsx              # 10 tones, soft/outline, optional dot
    metric-card.tsx
    empty-state.tsx
    input.tsx              # Text/email input primitive (added in Sprint 2)
    locked-action-button.tsx  # Shared locked-CTA primitive (Sprint 7)
  slate/                   # Internal /app composition
    review-queue.tsx
    active-engagements-panel.tsx
    recent-activity-panel.tsx
  leads/                   # Lead dashboard + detail (Sprint 3)
    lead-status-chip.tsx
    fit-score-badge.tsx
    lead-filter-tabs.tsx
    lead-list.tsx
    lead-list-item.tsx
    lead-profile-header.tsx
    scorecard-summary-panel.tsx
    internal-fit-score-panel.tsx
    qualification-signals-panel.tsx
    recommended-action-card.tsx
    lead-actions-panel.tsx        # Now links to seeded engagement when present
    lead-source-card.tsx
    lead-notes-panel.tsx
  intake/                  # Stakeholder intake manager (Sprint 5)
    role-coverage-map.tsx
    stakeholder-list.tsx
    supporting-inputs-panel.tsx
    follow-up-queue.tsx
  findings/                # Findings review workspace (Sprint 5)
    finding-status-chip.tsx
    confidence-indicator.tsx
    evidence-panel.tsx
    findings-workspace.tsx       # Client orchestrator (3-pane on lg+)
  opportunities/           # Opportunity matrix (Sprint 6)
    opportunity-priority-chip.tsx
    opportunity-card.tsx
    opportunity-matrix.tsx
    opportunity-score-strip.tsx
    related-findings-panel.tsx
    opportunities-workspace.tsx  # Client orchestrator (matrix + list + detail + evidence)
  roadmap/                 # 30/60/90 roadmap (Sprint 6)
    roadmap-card.tsx
    roadmap-phase-column.tsx
  reports/                 # Report builder (Sprint 7)
    report-status-chip.tsx
    report-workspace.tsx         # Client orchestrator (3-pane: outline / preview / linked)
  proposals/               # Proposal & SOW options (Sprint 7)
    proposal-status-chip.tsx
    proposal-workspace.tsx       # Client orchestrator (option cards + selected detail)
    implementation-credit-panel.tsx
  engagements/             # Engagement workspace (Sprint 4)
    engagement-status-chip.tsx
    engagement-stage-chip.tsx
    engagement-stage-tracker.tsx  # Horizontal on lg, vertical below
    engagement-list.tsx
    engagement-list-item.tsx
    engagement-profile-header.tsx
    engagement-status-panel.tsx   # Generic shell used by 6 specific panels
    stakeholder-progress-panel.tsx
    document-status-panel.tsx
    findings-status-panel.tsx
    opportunity-status-panel.tsx
    report-status-panel.tsx
    proposal-status-panel.tsx
    engagement-context-card.tsx
    engagement-risks-panel.tsx
    engagement-recommended-action-card.tsx
    engagement-notes-panel.tsx
  scorecard/               # Public scorecard composition
    public-assessment-shell.tsx
    scorecard-hero.tsx     # Landing hero + result preview
    scorecard-value-props.tsx
    scorecard-boundary-card.tsx
    scorecard-progress.tsx
    scorecard-question-card.tsx (single/multi/scale/text controls)
    scorecard-stepper.tsx  # Client orchestrator: state, persistence, validation
    scorecard-results-view.tsx
    scorecard-result-hero.tsx
    score-card.tsx         # Per-dimension score with band + bar
    opportunity-area-card.tsx
    risk-readiness-note.tsx
    recommended-next-step-card.tsx
lib/
  mock-data.ts             # Internal /app mock data
  utils.ts                 # cn() helper
  scorecard/
    types.ts               # Sections, Question types, ScoreResult, etc.
    questions.ts           # 19-question bank with dimension weights
    scoring.ts             # Mock scoring + classification + opportunity match
    storage.ts             # localStorage helpers (slate.scorecard.v1) — now also stores startedAt
    public-result.ts       # Step 2: PublicScoreResult Omit<…, "fit"> + allowlist
    email-quality.ts       # Step 4.5: classifyEmailQuality + disposable/free/fake blocklists
  leads/
    types.ts               # Lead, LeadStatus, FitDimension, QualificationSignal
    helpers.ts             # fitCategoryFor, status labels/tones, filter set
    queries.ts             # server-only: getAllLeads, getLeadById (Step 3)
    mappers.ts             # DB ↔ TS shape translators + formatRelative (Step 3)
    derive.ts              # Step 2 fit-dimension/signal/status derivations
  engagements/
    types.ts               # Engagement + 6 panel-status types, ScorecardSnapshot
    helpers.ts             # STAGES, STAGE_LABEL/DESCRIPTION, STATUS labels/tones, filters
    queries.ts             # server-only: getAllEngagements / getEngagementById / getEngagementIdForLead (Step 4)
    mappers.ts             # DB ↔ TS shape translators + safe-default panel JSON parsers (Step 4)
    actions.ts             # createOrOpenEngagementForLead server action (Step 4)
    load-for-subroute.ts   # mock-fixture-first loader used by downstream sub-routes (Step 4)
    mock-engagements.ts    # Fixtures for legacy slug-keyed demo paths only (Steps 5–8 retire piece by piece)
    recommended-action.ts  # Shared routing helper (Sprint 6)
  opportunities/           # Opportunity scoring (Sprint 6)
    types.ts               # Opportunity, priorities, quadrants, evidence strength
    helpers.ts             # priority/quadrant/evidence labels and tones, computeQuadrant
    mock-opportunities.ts  # Seeded opportunities for Quanta + Caldera
  roadmap/                 # 30/60/90 sequencing (Sprint 6)
    types.ts               # RoadmapItem, RoadmapPhase
    helpers.ts             # PHASE_ORDER, PHASE_LABEL, PHASE_DESCRIPTION
    mock-roadmap.ts        # Seeded 30/60/90 items for Quanta + Caldera
  reports/                 # Report assembly (Sprint 7)
    types.ts               # Report, ReportSection, statuses, confidence
    helpers.ts             # SECTION_ORDER/LABEL, status labels/tones, filters
    mock-reports.ts        # Seeded reports for Quanta + Caldera (12 sections each)
  proposals/               # Proposal & SOW options (Sprint 7)
    types.ts               # Proposal, ProposalOption, ImplementationCredit
    helpers.ts             # OPTION_TYPE_LABEL/TONE, status labels/tones
    mock-proposals.ts      # Seeded 3-tier proposal for Caldera
  intake/                  # Stakeholder intake (Sprint 5)
    types.ts               # Stakeholder, RoleCoverageRow, SupportingInput, IntakeRecord
    helpers.ts             # Role/status/quality labels and tones, filter set
    mock-intake.ts         # IntakeRecord per engagement
  findings/                # Findings review (Sprint 5)
    types.ts               # Finding, SourceRef, FindingCategory, etc.
    helpers.ts             # Review status / confidence / category labels and tones
    mock-findings.ts       # Seeded findings per engagement
styles/
  globals.css              # Design tokens (CSS variables) + base styles
scripts/
  capture-screenshots.cjs  # Sprint 1 capture
  capture-sprint-2.cjs     # Sprint 2 capture (seeds localStorage for results)
  capture-sprint-3.cjs     # Sprint 3 capture (leads, lead detail, /apply, /scorecard/results)
  capture-sprint-4.cjs     # Sprint 4 capture (engagements list + 4 detail variants + linked lead)
  capture-sprint-5.cjs     # Sprint 5 capture (intake + findings × multiple engagement states)
  capture-sprint-6.cjs     # Sprint 6 capture (opportunities + roadmap × multiple engagement states)
  capture-sprint-7.cjs     # Sprint 7 capture (report + proposal × multiple engagement states)
docs/
  00–07                    # Canon (do not drift)
  08 CURRENT_STATUS.md
  09 DECISION_LOG.md
  10 SESSION_HANDOFF.md    # This file
  11 VISUAL_UX_AUDIT_PROTOCOL.md
  screenshots/sprint-1/
  screenshots/sprint-2/
  screenshots/sprint-3/
  screenshots/sprint-4/
  screenshots/sprint-5/
  screenshots/sprint-6/
  screenshots/sprint-7/
  screenshots/mvp-stabilization/
  persistence/                      # Persistence/Auth architecture canon (Sprint P0)
    00_PERSISTENCE_AUTH_CANON.md
    01_DATA_MODEL_DRAFT.md
    02_MIGRATION_SEQUENCE.md
    03_SECURITY_AND_RLS_DRAFT.md
supabase/                           # Persistence/Auth Step 0/1
  migrations/
    0001_auth_workspaces_profiles.sql
    README.md
middleware.ts                       # /app/* auth guard + session refresh
.env.example                        # names only — never commit .env.local
```

### Auth-related files added in Step 0/1

```
lib/env.ts                          # safe env getters; throws at call time only
lib/supabase/client.ts              # browser client (anon key only)
lib/supabase/server.ts              # server client bound to cookies()
lib/supabase/middleware.ts          # updateSession(request) helper
lib/auth/actions.ts                 # signInWithMagicLink, signOut server actions
lib/auth/identity.ts                # getOperatorIdentity() with safe fallbacks
lib/auth/operator-allowlist.ts      # email + domain allowlist (fail-closed)
components/auth/login-form.tsx      # client form using server action; useFormStatus
app/login/page.tsx                  # premium dark SLATE-styled login surface
app/auth/callback/route.ts          # magic-link code → session exchange
scripts/dev/configure-supabase-smtp.cjs  # dev-only Mgmt API SMTP patch
scripts/dev/probe-smtp-auth.cjs          # dev-only SMTP AUTH probe (no mail sent)
```

---

## Local Development

```bash
npm install
npm run dev         # http://localhost:3000  (redirects to /app)
npm run lint
npm run build
```

Both `lint` and `build` are clean as of end of Sprint 1.

---

## Design System Cheat Sheet

**Tokens** (`styles/globals.css`):

- Surfaces: `bg-bg-page`, `bg-bg-shell`, `bg-bg-surface`, `bg-bg-elevated`, `bg-bg-panel`
- Borders: `border-border-subtle`, `border-border-strong`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-disabled`
- Brand / practice: `text-brand-primary`, `text-practice-ai`, `text-practice-dev`, `text-practice-studio`
- Status: `text-status-success | warning | risk | critical | info | neutral`
- Shadows: `shadow-card`, `shadow-elevated`

**Type**: `font-sans` (Inter) for UI, `font-mono` (JetBrains Mono) for scores, IDs, eyebrows.

**Motion**: `animate-fade-up`, `animate-pulse-soft`. Keep it restrained.

---

## Conventions

- Components use named exports. No default exports outside `app/` route files.
- `"use client"` only when needed (state, effects, navigation hooks).
- Every primitive accepts `className` and forwards it through `cn()`.
- Mock data is the single source of truth until a real data layer is added — do not introduce ad-hoc inline mocks in components.
- AI-generated content must always be visibly labeled (`Badge tone="ai"` or similar).
- Empty states are required for every list/feed view, even when mock data is present.
- New routes referenced in the sidebar should either be implemented or render as locked.

---

## Persistence/Auth Step 0 + Step 1 — Status & Local Setup

Step 0 (Supabase setup + env scaffolding) and Step 1 (auth shell + operator login) are implemented. The full lifecycle UI under `/app/*` continues to render mock domain data — only auth/session/profile/workspace are real now.

### Local setup checklist

1. Copy `.env.example` to `.env.local` and fill in real values from the Supabase project dashboard. Never commit `.env.local`. The service role key stays server-only — do not prefix it `NEXT_PUBLIC_`.
2. **Populate the operator allowlist.** Set `SLATE_OPERATOR_DOMAIN_ALLOWLIST=saipienlabs.com` (and/or list explicit emails in `SLATE_OPERATOR_EMAIL_ALLOWLIST=`). If both are empty, every sign-in attempt is rejected — the policy is fail-closed.
3. In Supabase Dashboard → SQL Editor (or `supabase db push`), apply `supabase/migrations/0001_auth_workspaces_profiles.sql`. The migration is idempotent.
4. In Supabase Dashboard → Authentication → URL Configuration, set:
   - Site URL: `http://localhost:3000` (or your deployed origin / dev port)
   - Redirect URLs: include the matching `/auth/callback` for each port/origin you'll exercise (`http://localhost:3000/auth/callback`, `http://localhost:3001/auth/callback`, prod, etc.)
5. In Supabase Dashboard → Authentication → Providers → Email, enable magic link. **For operator auth, keep Supabase signups restricted where possible — disable "Allow new users to sign up" if your project plan exposes that toggle.** SLATE also enforces a server-side operator allowlist in `signInWithMagicLink`; both layers should remain in place before Step 2 begins.
6. Invite each Saipien Labs operator via Supabase Dashboard → Authentication → Users. The `on_auth_user_created` trigger automatically creates a corresponding `profiles` row.
7. (Optional) Configure custom SMTP. Supabase's free-tier email cap is ~3/hour and rate-limits aggressively during dev. Two helpers under `scripts/dev/` automate this for the SLATE Mailgun account: `configure-supabase-smtp.cjs` PATCHes Supabase Auth via the Management API, and `probe-smtp-auth.cjs` connects to the SMTP host with `AUTH LOGIN` to verify creds without sending mail. Both are dev-only, read everything from `process.env`, and redact secrets from output.
8. `npm run dev` and sign in at `/login`.

## Starting Persistence/Auth Implementation

**Goal.** Replace seeded mock data route-by-route while preserving the accepted UI surface.

**Order.** Follow `docs/persistence/02_MIGRATION_SEQUENCE.md` strictly. Steps 0–10 are complete; the canon ends here. Future work is documentation-mode only until a fresh workstream (AI synthesis, production export, or storage hardening) is scoped.

**Per-step end state.** `npm run lint` clean, `npm run build` clean, the visual UX audit protocol passes against the affected routes, and the per-step acceptance criteria from the migration sequence doc are met.

**Reuse.** Every existing `lib/<domain>/types.ts` is the contract for the corresponding `queries.ts` file. The component surface in `components/` should not change. The `LockedActionButton` pattern stays — locked CTAs (`Export Report`, `Send to Client`, `Prepare SOW Draft`, `Prepare Client Review`) remain locked through the persistence sprint.

**Boundaries.** Per `docs/persistence/00_PERSISTENCE_AUTH_CANON.md`: no real AI synthesis, no production document export, no e-signature, no email delivery, no billing, no real CRM integration, no BuildOps. Each is its own future workstream.

**End-of-sprint.** Re-run the MVP acceptance audit against the persisted product on Quanta and Caldera demo paths. After sign-off, scope the next workstream (likely AI synthesis for findings, then real export, then BuildOps).

---

## Historical: Starting Post-MVP — Stabilization + End-to-End Polish

**Goal.** Run a final cross-sprint visual + accessibility + copy audit, then a stabilization window that hardens the seven-stage demo path. No new feature scope until stabilization is signed off.

**Recommended sequence.**

1. **Final Sprint 7 visual UX audit.** Capture state for the report and proposal pages on Quanta and Caldera, plus the empty-state pages on Helio / Meridian / Atlas. Verify recommended-action helper across all seven engagement-related pages routes correctly and never loops.
2. **End-to-end demo path.** Walk the full lifecycle on Quanta (Lead → Engagement → Intake → Findings → Opportunities → Roadmap → Report) and Caldera (… → Report → Proposal). Confirm every CTA either links to a real destination or carries a `LockedActionButton` with sprint label.
3. **Cross-sprint visual consistency.** Confirm shared primitives are used uniformly: `LockedActionButton`, `EngagementRecommendedActionCard` (`href` / `lockedNote` / `selfReference`), `MetricCard` zero-state copy, `ScoreCard` per-dimension banding, segmented filter tabs.
4. **Cross-sprint accessibility pass.** Verify `aria-pressed` on every selectable button (findings list, opportunities list + matrix cells, report outline, proposal options), `aria-describedby` on the matrix axes, locked-CTA `aria-label` strings, and color contrast on tonal text.
5. **Microcopy pass.** Confirm AI-drafted content is always labeled, boundary reminders are present on every deep page, and pricing copy never reads as final.

**Out of scope (post-stabilization).** BuildOps surfaces, StudioOps surfaces, ClientOps surfaces, real backend, real auth, real AI synthesis, production export, real SOW execution. Each of these is its own dedicated multi-sprint workstream.

**End-of-stabilization.** Update `docs/08_CURRENT_STATUS.md` to mark stabilization complete, append a final decision-log entry on stabilization sign-off, and decide the next workstream (likely real persistence as the unlock for the existing UI).

---

## Historical: Starting Sprint 7 — Report + Proposal Builder

**Goal.** Build the final two AI Opportunity Sprint deliverables.

- `/app/engagements/[id]/report` — assemble the audit report section by section, with linked evidence and approved findings
- `/app/engagements/[id]/proposal` — three-tier SOW options (Quick-Win Build, AI Workflow System, Managed AI Partner) with implementation credit, assumptions, and pricing placeholders

**Entry points (currently locked).** `ReportStatusPanel` and `ProposalStatusPanel` on the engagement detail page. The roadmap page header's `Prepare Report` button is locked with `Sprint 7`. The recommended-action helper already returns `lockedNote: "Sprint 7"` for `report` and `proposal` stages — flip those to live `href`s once the routes ship.

**Reuse from Sprints 1–6.**
- Approved + report-ready findings from `lib/findings/mock-findings.ts` are the report's content layer; `Finding.sourceRefs[]` carries the evidence trail.
- Opportunities from `lib/opportunities/` and roadmap items from `lib/roadmap/` are the proposal's content layer (tiered SOW pulls from quadrant + phase combinations).
- `EngagementProfileHeader`, `EngagementStageTracker`, `EngagementContextCard`, `EngagementRecommendedActionCard`, `OpportunityScoreStrip`, `EvidencePanel` (from findings).
- `Card`, `Badge`, `MetricCard`, `Button`, `EmptyState`, the recommended-action helper.

**New components likely needed.** `ReportOutlineSidebar`, `ReportSectionCard`, `ReportSectionEditor`, `ReportSectionStatusChip`, `LinkedFindingsPanel`, `ExportReportButton`, `ProposalOptionCard`, `ScopeBuilderPanel`, `PricingPlaceholderPanel`, `ImplementationCreditPanel`, `AssumptionsPanel`, `ExportProposalButton`.

**Boundaries.** Mock content, no real export, no backend. Report and proposal sections must surface AI authorship and require human approval. No real PDF generation, no actual SOW PDF — placeholder only.

**End-of-sprint.** Run the audit protocol, capture screenshots to `docs/screenshots/sprint-7/`, update `docs/08_CURRENT_STATUS.md`, append to `docs/09_DECISION_LOG.md` for any material decisions, and close out the MVP arc in this handoff.

---

## Out-of-Scope Reminders

Do **not** introduce in upcoming sprints unless the sprint goal explicitly says so:

- Authentication, authorization, RBAC
- Backend services or databases
- Real AI model calls
- Email/notification delivery
- Billing / time tracking
- BuildOps, StudioOps, ClientOps modules
- Production export (PDF generation, etc.)
- Light theme

These are listed in `docs/02_SLATE_MVP_SCOPE.md` under Out of Scope.
