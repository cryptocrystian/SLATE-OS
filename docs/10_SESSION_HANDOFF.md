# SLATE Session Handoff

Use this doc when picking up SLATE work in a new session. It captures repo state, where things live, and how to start the next sprint without re-reading every canon doc end-to-end.

---

## Where We Are

Sprint 1 (Visual Foundation + App Shell) is complete. See `docs/08_CURRENT_STATUS.md` for the implementation summary.

Next planned: **Sprint 2 — Public Scorecard Flow** (`/scorecard`, `/scorecard/start`, `/scorecard/results`).

---

## Repo Layout

```
app/
  layout.tsx               # Root layout, fonts, viewport, metadata
  page.tsx                 # Redirect → /app
  app/
    layout.tsx             # AppShell wrapper
    page.tsx               # Command Center dashboard
components/
  layout/
    app-shell.tsx          # Persistent sidebar + top bar + main
    sidebar-nav.tsx        # Primary nav (sectioned, with lock affordance)
    top-bar.tsx            # Context, search/command, review queue, notifications
    page-header.tsx        # Eyebrow / title / description / actions / meta
  ui/
    button.tsx             # Variants: primary | secondary | outline | ghost
    card.tsx               # Card + Header/Title/Description/Body/Footer
    badge.tsx              # 10 tones, soft/outline, optional dot
    metric-card.tsx        # Pipeline metric with tonal accent
    empty-state.tsx        # Reusable empty state
  slate/
    review-queue.tsx       # Cross-engagement review inbox
    active-engagements-panel.tsx  # Engagement list with stage tracker
    recent-activity-panel.tsx     # Activity timeline
lib/
  mock-data.ts             # Typed mock data (metrics, queue, engagements, activity)
  utils.ts                 # cn() helper
styles/
  globals.css              # Design tokens (CSS variables) + base styles
docs/
  00–07                    # Canon (do not drift)
  08 CURRENT_STATUS.md     # What is built right now
  09 DECISION_LOG.md       # Significant decisions
  10 SESSION_HANDOFF.md    # This file
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

## Starting Sprint 2 — Public Scorecard Flow

**Goal.** First website-to-SLATE conversion asset. Routes:

- `/scorecard` — landing
- `/scorecard/start` — multi-step intake
- `/scorecard/results` — directional result + diagnostic CTA

**Reuse from Sprint 1.** PageHeader, Button, Card, Badge, EmptyState, MetricCard (for score cards), design tokens, fonts, layout patterns. Do **not** wrap public routes in `AppShell` — the public surface should feel like a continuation of the marketing site, not the internal app.

**New components likely needed.** `PublicAssessmentShell`, `ScorecardStepper`, `ScorecardProgress`, `ScorecardQuestionCard`, `ConditionalQuestionGroup`, `ReadinessScoreCard`, `WorkflowFrictionCard`, `SystemsReadinessCard`, `OpportunityAreaCard`, `RecommendedNextStepCard`, `DiagnosticReviewCTA`.

**Boundaries.** Mock scoring logic only. The free scorecard must never produce a full roadmap, architecture, or SOW — see `docs/01_SLATE_PRODUCT_SPEC.md` and the Sprint 2 acceptance boundary.

**End-of-sprint.** Update `docs/08_CURRENT_STATUS.md`, append to `docs/09_DECISION_LOG.md` if anything material changed, and adjust this handoff if the workflow drifted.

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
