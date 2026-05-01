# SLATE Session Handoff

Use this doc when picking up SLATE work in a new session. It captures repo state, where things live, and how to start the next sprint without re-reading every canon doc end-to-end.

---

## Where We Are

Sprints 1–5 are complete. See `docs/08_CURRENT_STATUS.md` for the implementation summary.

Next planned: **Sprint 6 — Opportunity Matrix + Roadmap** (`/app/engagements/[id]/opportunities`, `/app/engagements/[id]/roadmap`). The locked CTA on `OpportunityStatusPanel` is the natural entry point.

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
    storage.ts             # localStorage helpers (slate.scorecard.v1)
  leads/
    types.ts               # Lead, LeadStatus, FitDimension, QualificationSignal
    helpers.ts             # fitCategoryFor, status labels/tones, filter set
    mock-leads.ts          # 6 seeded leads spanning the qualification range
  engagements/
    types.ts               # Engagement + 6 panel-status types, ScorecardSnapshot
    helpers.ts             # STAGES, STAGE_LABEL/DESCRIPTION, STATUS labels/tones, filters
    mock-engagements.ts    # 5 seeded engagements covering Setup → Proposal
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

## Starting Sprint 6 — Opportunity Matrix + Roadmap

**Goal.** Take approved findings into the prioritization and sequencing surface.

- `/app/engagements/[id]/opportunities` — impact × complexity matrix with Quick Wins / Strategic Builds / Low Priority / Defer quadrants
- `/app/engagements/[id]/roadmap` — 30/60/90-day roadmap built from selected opportunities

**Entry points (currently locked).** `OpportunityStatusPanel` ("Score Opportunities", `Sprint 6` lock label) on the engagement detail page. Replace with active links once the routes ship. Recommended Action card on the engagement detail also routes to `/opportunities` when the engagement is in the `scoring` stage; flip the lock there too.

**Reuse from Sprints 1–5.**
- Approved findings (`Finding[]` from `lib/findings/mock-findings.ts`, status `approved` or `report-ready`) are the input rows.
- `OpportunityArea` from `lib/scorecard/types.ts` already has the right shape for the matrix's cards.
- `EngagementProfileHeader`, `EngagementStageTracker`, `EngagementContextCard`, `EngagementRecommendedActionCard`.
- `Card`, `Badge`, `MetricCard`, `Button`, `EmptyState`, plus the `ScoreCard` per-dimension banding for impact/complexity.

**New components likely needed.** `OpportunityCard`, `OpportunityMatrix` (a 2×2 quadrant view), `ScoringControl`, `PriorityLabel`, `RelatedFindingsPanel`, `RiskDependencyList`, `RoadmapPhaseColumn`, `RoadmapCard`, `DependencyChip`, `SuccessCriteriaBlock`.

**Boundaries.** Mock data, mock scoring, no backend. The matrix and roadmap should make the consultant's prioritization legible inside SLATE without auto-promoting any opportunity into the report.

**End-of-sprint.** Run the audit protocol, capture screenshots to `docs/screenshots/sprint-6/`, update `docs/08_CURRENT_STATUS.md`, append to `docs/09_DECISION_LOG.md` for any material decisions, and adjust this handoff for Sprint 7.

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
