# SLATE Session Handoff

Use this doc when picking up SLATE work in a new session. It captures repo state, where things live, and how to start the next sprint without re-reading every canon doc end-to-end.

---

## Where We Are

Sprints 1 and 2 are complete. See `docs/08_CURRENT_STATUS.md` for the implementation summary.

Next planned: **Sprint 3 — Lead Dashboard + Qualification** (`/app/leads`, `/app/leads/[id]`). The public scorecard from Sprint 2 should feed the inbox built in Sprint 3.

---

## Repo Layout

```
app/
  layout.tsx               # Root layout, fonts, viewport, metadata
  page.tsx                 # Redirect → /app
  app/
    layout.tsx             # AppShell wrapper
    page.tsx               # Command Center dashboard
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
  slate/                   # Internal /app composition
    review-queue.tsx
    active-engagements-panel.tsx
    recent-activity-panel.tsx
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
    storage.ts             # localStorage helpers (slate.scorecard.v1)
styles/
  globals.css              # Design tokens (CSS variables) + base styles
scripts/
  capture-screenshots.cjs  # Sprint 1 capture
  capture-sprint-2.cjs     # Sprint 2 capture (seeds localStorage for results)
docs/
  00–07                    # Canon (do not drift)
  08 CURRENT_STATUS.md
  09 DECISION_LOG.md
  10 SESSION_HANDOFF.md    # This file
  11 VISUAL_UX_AUDIT_PROTOCOL.md
  screenshots/sprint-1/
  screenshots/sprint-2/
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

## Starting Sprint 3 — Lead Dashboard + Qualification

**Goal.** First internal triage surface for inbound scorecard completions. Routes:

- `/app/leads` — inbox / triage table
- `/app/leads/[id]` — lead detail
- (Stretch) `/apply/ai-systems-review` — currently linked from the scorecard results CTA but not yet implemented

**Reuse.** Internal `AppShell`, `PageHeader`, `Card`, `Badge`, `Button`, `MetricCard`, `EmptyState`, `Input`, design tokens, fonts.

**Reuse from Sprint 2.** The full `lib/scorecard/types.ts` model — `Lead` rows in Sprint 3 should embed a `ScoreResult` snapshot per submission. Internal **Saipien Fit Score** (`fit`) is already computed by `scoreScorecard()` and is the lead-side scoring dimension that the dashboard surfaces (canon: never shown to prospects).

**New components likely needed.** `LeadFilters`, `LeadTable`, `LeadStatusChip`, `FitScoreBadge`, `RecommendedActionBadge`, `LeadProfileHeader`, `ScorecardSummaryPanel`, `InternalFitScorePanel`, `QualificationSignals`, `LeadDetailDrawer` (or full page).

**Bridge from Sprint 2.** A simple submission queue can read the same `localStorage` key (`slate.scorecard.v1`) for a single demo lead. Replace with seeded mock data if multi-lead views are needed; do not introduce a backend.

**Boundaries.** No backend, no auth, no email. Status changes are local-only. Internal Fit Score and qualification signals are visible to operators; never to prospects.

**End-of-sprint.** Run the Visual UX Audit Protocol (`docs/11_VISUAL_UX_AUDIT_PROTOCOL.md`), capture screenshots to `docs/screenshots/sprint-3/`, update `docs/08_CURRENT_STATUS.md`, append to `docs/09_DECISION_LOG.md` for any material decisions, and adjust this handoff for Sprint 4.

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
