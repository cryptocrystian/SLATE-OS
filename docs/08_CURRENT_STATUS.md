# SLATE Current Status

_Last updated: 2026-05-01 — End of Sprint 6_

## Sprint State

| Sprint | Title | Status |
| --- | --- | --- |
| 1 | Visual Foundation + App Shell | ✅ Complete (audit 4.4/5, polish patch applied) |
| 2 | Public Scorecard Flow | ✅ Complete (audit 4.7/5, fixes folded into Sprint 3) |
| 3 | Lead Dashboard + Qualification | ✅ Complete |
| 4 | Engagement Workspace | ✅ Complete (audit 4.8/5, fixes folded into Sprint 5) |
| 5 | Intake + Findings Review | ✅ Complete (audit 4.7/5, fixes folded into Sprint 6) |
| 6 | Opportunity Matrix + Roadmap | ✅ Complete |
| 7 | Report + Proposal Builder | ⏳ Not started |

## Stack

- Next.js 14.2.x (App Router) — patched for security advisory
- React 18, TypeScript (strict)
- Tailwind CSS v3 with CSS variable–driven design tokens
- `lucide-react`, `clsx` + `tailwind-merge`
- Inter (sans) and JetBrains Mono (mono) via `next/font`
- No backend, no auth, no database, no AI integration — mock data only

## Implemented (Sprint 6 additions)

- `/app/engagements/[id]/opportunities` — Opportunity matrix workspace
  - PageHeader with eyebrow `AdvisoryOps · Opportunities`, primary `Build Roadmap` (when opportunities exist), secondary `Back to engagement`
  - 6 summary metrics (Identified / Quick Wins / Strategic Builds / Defer · Avoid / Avg Impact / Strong Evidence) with em-dash zero-states
  - `OpportunityMatrix` — 4-quadrant view (Quick Wins / Strategic Builds / Low Priority / Defer · Avoid) with axis legends, per-quadrant tone, and clickable cards
  - `OpportunitiesWorkspace` (client) below the matrix: filter tabs by quadrant, opportunity list, and a selected detail panel with `OpportunityScoreStrip` (six 0–100 scores), implementation shape, source summary, risks/dependencies/success-signals blocks, and a recommended-next-action card
  - `RelatedFindingsPanel` linking each opportunity back to its source findings (and from there to evidence)
  - Empty state for engagements without approved findings: "Approve findings before opportunity scoring begins" with a deep-link to the findings workspace
  - Boundary reminder card
- `/app/engagements/[id]/roadmap` — 30/60/90 roadmap workspace
  - PageHeader with eyebrow `AdvisoryOps · Roadmap`, primary `Prepare Report` (locked, `Sprint 7`), secondary `Back to Opportunities`
  - 6 summary metrics (Roadmap Items / Quick Wins / Strategic Builds / Dependencies / First 30 Days / Report-ready Inputs)
  - Three `RoadmapPhaseColumn`s (First 30 Days / Days 31–60 / Days 61–90), each with phase description card and a column of `RoadmapCard`s
  - `RoadmapCard` carries priority chip, linked-opportunity badge, objective, key actions, dependencies, success criteria, risks, owner placeholder, readiness note
  - Empty state for engagements without opportunities yet
  - Boundary reminder framing the roadmap as advisory implementation-readiness, not a project-management board

## Sprint 5 Audit Fixes (folded in)

- **Recommended-action routing helper.** New `lib/engagements/recommended-action.ts` — `recommendedActionRoute(engagement, currentPath?)` returns `{ href?, lockedNote?, selfReference? }`. Used by all five engagement detail/intake/findings/opportunities/roadmap pages. The card now never loops to itself: when the resolved destination matches the current path it renders as a "Current workspace · You are here" read-only state without a clickable CTA.
- **Findings list selection accessibility.** `FindingsWorkspace` list buttons now expose `aria-pressed={isSelected}` and a descriptive `aria-label` (`"<finding statement>, <review status>"`). Visual styling unchanged.
- **Engagement command-center wiring.** `OpportunityStatusPanel` now accepts `opportunitiesHref` and renders an active link for engagements in scoring/report/proposal stages. The Sprint 4 lock pattern remains for engagements still in earlier stages.

## Verified

- `npm run lint` — clean
- `npm run build` — clean. **41 routes prerender as static**: 5 engagement detail pages × 5 child routes (detail, intake, findings, opportunities, roadmap) plus leads (6), scorecard (3), apply, landing routes, and the root.
- Sprint 6 screenshots captured at 1440 / 1024 / 390 to `docs/screenshots/sprint-6/` for: Quanta + Caldera opportunities and roadmap (mature engagements), Meridian + Helio + Atlas opportunities and roadmap (empty/early states), the Helio engagement detail (CTAs unchanged but routing now via the helper), and the Helio findings page (post-aria-pressed fix).

## BuildOps Boundary

Reaffirmed: BuildOps remains documentation-only. No `/app/builds`, no BuildOps nav, no sprint manager / agent session / repo context UI, no related backend.

## Known Constraints

- Opportunities and roadmap items are seeded mock data; no real scoring persistence, no drag/drop sequencing.
- Review actions on findings, action buttons on lead detail, and the various locked CTAs (`Prepare Report`, `Draft Proposal`) remain mock with explicit labels.
- Filter and selection state in the workspaces is local-only and resets on navigation.

## Recommended Next Step

Begin Sprint 7: Report + Proposal Builder (`/app/engagements/[id]/report`, `/app/engagements/[id]/proposal`). The locked CTAs on `ReportStatusPanel`, `ProposalStatusPanel`, and the roadmap page's `Prepare Report` button are the natural entry points. Bind the report builder to approved + report-ready findings; bind the proposal builder to opportunities tagged Quick-Win / Strategic Build and the roadmap's first-30/31-60/61-90 sequencing.
