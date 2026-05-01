# SLATE Current Status

_Last updated: 2026-05-01 — End of Sprint 1_

## Sprint State

| Sprint | Title | Status |
| --- | --- | --- |
| 1 | Visual Foundation + App Shell | ✅ Complete |
| 2 | Public Scorecard Flow | ⏳ Not started |
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

## Implemented

- `/` (redirects to `/app`)
- `/app` Command Center dashboard with:
  - PageHeader with eyebrow, title, supporting copy, primary + secondary actions, status meta
  - 6 metric cards (New Scorecards, High-Fit Leads, Active Audits, Findings Needing Review, Reports in Progress, Open Proposals)
  - Review Queue panel (5 mock items: scorecard, finding, proposal, lead, report)
  - Active Engagements panel (4 mock engagements with stage tracker)
  - Recent Activity timeline (6 mock events)
  - Human-Guided AI explainer aside
- AppShell: persistent sidebar (desktop) + mobile drawer
- SidebarNav: SLATE mark, Operate / Deliver / System sections, active state, lock affordance for deferred routes
- TopBar: context breadcrumb, command-menu placeholder, review queue indicator, notifications
- Reusable primitives:
  - `Button` (primary, secondary, outline, ghost · sm/md/lg)
  - `Card` (base, elevated, interactive) + Header/Title/Description/Body/Footer
  - `Badge` with 10 tones (neutral, info, success, warning, risk, critical, brand, ai, dev, studio) and optional dot
  - `MetricCard` with tonal accent
  - `EmptyState`
  - `PageHeader`
- Design tokens via CSS variables: surfaces (5 layers), borders (subtle/strong), text (5 levels), brand + practice accents, semantic statuses, shadows
- Restrained motion (fade-up, soft pulse) and subtle radial glow background

## Routes Reserved (Not Yet Built)

Sidebar references these; they currently render as locked items:

- `/app/leads`, `/app/leads/[id]`
- `/app/accounts`, `/app/accounts/[id]`
- `/app/engagements`, `/app/engagements/[id]/*`
- `/app/audits`, `/app/proposals`, `/app/delivery`
- `/app/library`, `/app/settings`

Public routes (`/scorecard*`, `/apply/ai-systems-review`) and stakeholder routes (`/intake/[token]`, `/upload/[token]`) are not yet built — Sprint 2.

## Verified

- `npm run lint` — clean
- `npm run build` — clean, all routes prerender as static

## Known Constraints

- All data is mock; no persistence layer.
- No authentication; all routes are publicly accessible during development.
- Sidebar items beyond Overview are intentionally non-navigable until their sprint lands.
- Icons in TopBar (search, command-menu) are visual placeholders only.

## Recommended Next Step

Begin Sprint 2: Public Scorecard Flow (`/scorecard`, `/scorecard/start`, `/scorecard/results`). Reuse the design system established in Sprint 1.
