# SLATE Current Status

_Last updated: 2026-05-01 — End of Sprint 4_

## Sprint State

| Sprint | Title | Status |
| --- | --- | --- |
| 1 | Visual Foundation + App Shell | ✅ Complete (audit 4.4/5, polish patch applied) |
| 2 | Public Scorecard Flow | ✅ Complete (audit 4.7/5, fixes folded into Sprint 3) |
| 3 | Lead Dashboard + Qualification | ✅ Complete |
| 4 | Engagement Workspace | ✅ Complete |
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
- Scorecard answers persisted client-side via `localStorage`; lead and engagement data is seeded mock

## Implemented

### Internal app (Sprints 1 + 3 + 4)

- `/` redirects to `/app`
- `/app` — Command Center dashboard (Sprint 1)
- `/app/leads` — Lead inbox (Sprint 3)
- `/app/leads/[id]` — Lead detail (Sprint 3); the "Start AI Opportunity Sprint" action now links to the seeded engagement when one exists for the lead (Sprint 4)
- `/app/engagements` — Engagement list (Sprint 4)
  - PageHeader with eyebrow `AdvisoryOps · Engagements`, primary `Review Active Sprints` + secondary `Open Leads`
  - 5 pipeline metrics (Active Sprints, Intake in Progress, Findings Need Review, Reports In Progress, Proposals In Draft)
  - Stage filter tabs (`All / Setup / Intake / Synthesis / Scoring / Report / Proposal / Completed`)
  - Premium engagement cards: type, industry, status chip, mini stage tracker, four status counts (Intake / Documents / Findings / Report), recommended action
- `/app/engagements/[id]` — Engagement command center (Sprint 4)
  - `EngagementProfileHeader` (account, type, industry, owner, status chip, stage chip, next milestone)
  - Full-fidelity `EngagementStageTracker` with horizontal layout on `lg+` and a vertical stack on smaller viewports
  - Six summary metric cards mirroring intake / documents / findings / opportunities / report / proposal
  - Six status panels (Stakeholder Intake, Documents & Inputs, Findings, Opportunity Scoring, Audit Report, Proposal & SOW) — each with icon, status badge, description, progress bar where useful, evidence metrics, next action, and a clearly-labeled locked CTA pointing at the future sprint that will activate it (Sprint 5 / 6 / 7)
  - Risks & dependencies panel
  - Right rail: Recommended Action card, Linked Context card (account / industry / practice / owner / target / linked lead / source scorecard with classification + 3 scores), Notes panel, boundary reminder
- AppShell, SidebarNav (Engagements now unlocked with badge `5`), TopBar, PageHeader

### Public scorecard (Sprint 2 + Sprint 3 polish)

- `/scorecard`, `/scorecard/start`, `/scorecard/results`
- `/apply/ai-systems-review` premium stub
- Per-dimension score banding on `ScoreCard`

## Engagement Data Model

Mock engagement model in `lib/engagements/`:
- `types.ts` — `Engagement` plus `EngagementStage`, `EngagementStatus`, `EngagementType`, `IntakeStatus`, `DocumentStatus`, `FindingsStatus`, `OpportunityScoringStatus`, `ReportStatus`, `ProposalStatus`, `ScorecardSnapshot`, `PanelStatusBadge`
- `helpers.ts` — `STAGES`, `STAGE_LABEL`, `STAGE_DESCRIPTION`, `STATUS_LABEL`, `STATUS_TONE`, `ENGAGEMENT_FILTERS`, `stageIndex()`
- `mock-engagements.ts` — five seeded engagements covering every stage:

| Engagement | Stage | Status | Linked Lead | Owner |
| --- | --- | --- | --- | --- |
| Atlas Manufacturing | Setup | Setup | atlas-manufacturing | M. Reyes |
| Helio Health | Intake | Active | helio-health | M. Reyes |
| Meridian Advisors | Synthesis | Needs Review | — | J. Okafor |
| Quanta Operations | Report | Ready for Report | — | A. Lin |
| Caldera Capital Group | Proposal | Proposal Draft | — | J. Okafor |

Each engagement carries an optional `scorecardSummary` (AI / Friction / Systems + classification), full status records for all six panels (counts, review state, next action), risk notes, dependencies, internal notes, and a `recommendedAction` shown in the right rail.

## Routes Reserved (Not Yet Built)

- `/app/accounts`, `/app/accounts/[id]`
- `/app/audits`, `/app/proposals`, `/app/delivery`
- `/app/library`, `/app/settings`
- Stakeholder routes (`/intake/[token]`, `/upload/[token]`)

## Verified

- `npm run lint` — clean
- `npm run build` — clean. 21 routes prerender. All 5 engagement detail pages and all 6 lead detail pages SSG via `generateStaticParams`
- Sprint 4 screenshots captured at 1440 / 1024 / 390 to `docs/screenshots/sprint-4/` for `/app/engagements`, four engagement detail variants (Setup, Intake, Report, Proposal), and the updated `/app/leads/helio-health`

## BuildOps Boundary

Reaffirmed: BuildOps remains documentation-only. No `/app/builds` route, BuildOps nav item, sprint manager, agent session UI, repo context manager, or related backend was added. The active app MVP stays focused on GrowthOps + AdvisoryOps.

## Known Constraints

- Lead and engagement data are fully seeded; no scorecard → lead → engagement persistence yet.
- Engagement status panels carry locked CTAs (`Manage Intake`, `Review Findings`, `Score Opportunities`, `Build Report`, `Draft Proposal`) labeled with the sprint that will activate them.
- Filter state is local UI only.

## Recommended Next Step

Begin Sprint 5: Intake + Findings Review (`/app/engagements/[id]/intake`, `/app/engagements/[id]/findings`). The locked CTAs on `StakeholderProgressPanel`, `DocumentStatusPanel`, and `FindingsStatusPanel` are the natural entry points.
