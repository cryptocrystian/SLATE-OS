# SLATE Current Status

_Last updated: 2026-05-01 — End of Sprint 2_

## Sprint State

| Sprint | Title | Status |
| --- | --- | --- |
| 1 | Visual Foundation + App Shell | ✅ Complete (audit 4.4/5, polish patch applied) |
| 2 | Public Scorecard Flow | ✅ Complete |
| 3 | Lead Dashboard + Qualification | ⏳ Not started |
| 4 | Engagement Workspace | ⏳ Not started |
| 5 | Intake + Findings Review | ⏳ Not started |
| 6 | Opportunity Matrix + Roadmap | ⏳ Not started |
| 7 | Report + Proposal Builder | ⏳ Not started |

## Stack

- Next.js 14.2.x (App Router) — patched for security advisory
- React 18
- TypeScript (strict)
- Tailwind CSS v3 with CSS variable–driven design tokens
- `lucide-react` for icons
- `clsx` + `tailwind-merge` (`cn()` helper)
- Inter (sans) and JetBrains Mono (mono) via `next/font`
- No backend, no auth, no database, no AI integration — mock data only
- Scorecard answers persisted client-side via `localStorage`

## Implemented

### Internal app (Sprint 1)

- `/` redirects to `/app`
- `/app` Command Center dashboard
- AppShell, SidebarNav, TopBar, PageHeader
- UI primitives: Button, Card, Badge, MetricCard, EmptyState, Input
- Design tokens, dark theme, fonts, radial glow

### Public scorecard (Sprint 2)

- `/scorecard` — landing
  - `ScorecardHero` with two-column layout: messaging + result preview card
  - `ScorecardValueProps` — four directional reads explained
  - `ScorecardBoundaryCard` — explicit "what this is / what it isn't" with the paid-sprint boundary
- `/scorecard/start` — multi-step intake
  - 8 sections (Company → Business → Friction → Systems → AI → Data → Urgency → Contact)
  - 19 questions across 4 control types: single-choice, multi-choice (with max), 1–5 scale, text
  - `ScorecardProgress` (sectioned progress bar with % complete and aria-progressbar)
  - `ScorecardQuestionCard` with "why we ask" microcopy
  - Per-section validation, back/next navigation, localStorage persistence
- `/scorecard/results` — directional result
  - `ScorecardResultHero` with classification name in brand color, personalized greeting
  - Three `ScoreCard` components (AI Readiness, Workflow Friction, Systems Readiness) with band labels
  - Top 3 likely opportunity areas, ranked, mapped from selected friction
  - `RiskReadinessNote` derived from data sensitivity, systems maturity, AI usage
  - `RecommendedNextStepCard` routing to `/apply/ai-systems-review`
  - Boundary disclaimer + "restart with new answers" / "back to overview" actions
- Mock scoring (`lib/scorecard/scoring.ts`) — categorical + scale weights → AI / Friction / Systems / internal Fit, then 5-band classification
- `PublicAssessmentShell` — minimal public chrome (SLATE mark, trust strip, footer); deliberately not wrapped in `AppShell`

## Routes Reserved (Not Yet Built)

- `/apply/ai-systems-review` — referenced from scorecard results CTA; arrives in a later sprint
- Stakeholder intake routes (`/intake/[token]`, `/upload/[token]`)
- Internal routes other than `/app` (Leads, Accounts, Engagements, Audits, Proposals, Delivery, Library, Settings) — render as locked in the sidebar until their sprint lands

## Verified

- `npm run lint` — clean
- `npm run build` — clean, all routes prerender as static (`/`, `/app`, `/scorecard`, `/scorecard/start`, `/scorecard/results`)
- Sprint 2 screenshots captured at 1440 / 1024 / 390 to `docs/screenshots/sprint-2/` for landing, start, and a seeded results view

## Known Constraints

- Scorecard state lives only in `localStorage` — no server persistence, no lead creation in the internal app yet (will arrive in Sprint 3 alongside `/app/leads`).
- `/apply/ai-systems-review` is referenced from the results CTA but not implemented; Sprint 3 should build it or stub it cleanly.
- The free scorecard intentionally produces directional output only. Boundary copy is enforced in three places (landing boundary card, results disclaimer, recommended-next-step card footer).

## Recommended Next Step

Begin Sprint 3: Lead Dashboard + Qualification (`/app/leads`, `/app/leads/[id]`). Wire scorecard completions into the lead inbox so the public-to-internal flow is end-to-end visible.
