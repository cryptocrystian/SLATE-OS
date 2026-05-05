# SLATE Session Handoff

Use this doc when picking up SLATE work in a new session. It captures repo state, where things live, and how to start the next sprint without re-reading every canon doc end-to-end.

---

## Where We Are

Sprints 1–7 are complete. MVP Stabilization closed cleanly. The MVP Acceptance Audit returned 4.8/5 and approved the surface as the baseline. The Persistence/Auth architecture canon is drafted in `docs/persistence/`. **Persistence/Auth Steps 0, 1, and 2 are verified end-to-end against a real Supabase project; Steps 3 (lead inbox + detail), 4 (engagement creation + detail), 4.5 (scorecard anti-abuse + email quality), and 5 (stakeholder intake + documents) ship build-clean against the same project.** All `/app/*` routes are auth-protected. Public scorecard submissions persist server-side with internal fit/lead derivation; the public response is type-narrowed to `PublicScoreResult` (no `fit` leak). The submit endpoint runs honeypot, minimum-duration, disposable-domain, and per-email/domain rate limiting; submissions and leads carry typed quality + trust metadata that surfaces only inside `/app/*` (small `LeadTrustChip` on the inbox + lead detail). `/app/leads*` and `/app/engagements*` read real Supabase rows under operator-only RLS via the authenticated server client. `Start AI Opportunity Sprint` on a real lead now creates (or reopens) a real engagement, with the unique partial index on `engagements.linked_lead_id` providing idempotency. **Operators can now mint token-gated stakeholder intake links from the engagement intake workspace; stakeholders complete intake on a public `/intake/[token]` route without a SLATE login.** Raw tokens are never stored — only the sha256 hash. Findings, opportunities, roadmap, report, and proposal remain placeholder-rendered for UUID engagements (Steps 6–8). `lib/leads/mock-leads.ts` is retired; `lib/engagements/mock-engagements.ts` and `lib/intake/mock-intake.ts` are retained as fixtures for legacy slug-keyed demo paths only.

Next planned: **Migration Sequence Step 6 — Findings persistence.** Migrate `/app/engagements/[id]/findings` from `MOCK_FINDINGS` to real `findings` and `finding_source_refs` tables. Wire the review action bar (Approve / Edit / Reject / Add note) to real server actions; reflect approved counts on the engagement detail's Findings panel. Email automation, document binary upload, and AI synthesis remain deferred per the canon.

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

**Order.** Follow `docs/persistence/02_MIGRATION_SEQUENCE.md` strictly. Step 2 (scorecard submission) is next; do not skip ahead to leads, engagements, or any of Steps 3–10.

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
