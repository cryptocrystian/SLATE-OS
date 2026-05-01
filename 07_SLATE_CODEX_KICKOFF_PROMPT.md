# SLATE Codex Kickoff Prompt

Use this prompt to begin implementing SLATE.

---

You are building SLATE, the internal operating system for Saipien Labs.

Saipien Labs is a venture studio and technology services firm with three connected practices:

1. AI Systems
2. Custom Development
3. Venture Studio

SLATE is the internal product that supports lead qualification, AI Workflow Scorecards, stakeholder intake, audit generation, proposal creation, delivery workflows, and eventually venture operations.

The MVP focus is:

**AI Workflow Scorecard → Lead Qualification → AI Opportunity Sprint → Audit Report → Proposal / SOW**

Your task is to implement the initial product foundation using the canon docs in `/docs` as the source of truth.

## Source of Truth

Before coding, read these docs:

- `README.md`
- `docs/00_SLATE_MASTER_CANON.md`
- `docs/01_SLATE_PRODUCT_SPEC.md`
- `docs/02_SLATE_MVP_SCOPE.md`
- `docs/03_SLATE_INFORMATION_ARCHITECTURE.md`
- `docs/04_SLATE_UX_UI_CANON.md`
- `docs/05_SLATE_IMPLEMENTATION_ARTIFACTS.md`
- `docs/06_SLATE_BUILD_PLAN.md`

Do not drift from the canon.

Do not invent unrelated features.

Do not make this look like a generic admin dashboard.

## Quality Bar

The product must feel:

- Premium
- Dark-mode native
- Product-grade
- Clear
- Trustworthy
- Human-guided AI
- Visually aligned with the Saipien Labs website

The UI should feel like a proprietary operating system for a serious AI and software studio.

## MVP Boundaries

Build the foundation for GrowthOps + AdvisoryOps.

Do not build yet:

- BuildOps
- StudioOps
- Full client portal
- Billing
- Time tracking
- Complex permissions
- Real AI orchestration unless specifically requested
- Full backend if mock data is sufficient for the sprint

## Initial Implementation Sequence

Follow this sequence:

1. Create design tokens and app shell
2. Build `/app` command center with mock data
3. Build public scorecard routes
4. Build leads dashboard and lead detail
5. Build engagement workspace shell
6. Build intake/findings/opportunities/report/proposal routes with realistic mock states

## Important Route Groups

Public:

- `/scorecard`
- `/scorecard/start`
- `/scorecard/results`
- `/apply/ai-systems-review`

Internal:

- `/app`
- `/app/leads`
- `/app/leads/[id]`
- `/app/accounts`
- `/app/accounts/[id]`
- `/app/engagements`
- `/app/engagements/[id]`
- `/app/engagements/[id]/intake`
- `/app/engagements/[id]/documents`
- `/app/engagements/[id]/findings`
- `/app/engagements/[id]/opportunities`
- `/app/engagements/[id]/roadmap`
- `/app/engagements/[id]/report`
- `/app/engagements/[id]/proposal`
- `/app/library`
- `/app/settings`

## Initial Sprint Recommendation

Start with Sprint 1 from `docs/06_SLATE_BUILD_PLAN.md`.

### Sprint 1 Goal

Create the foundation that makes SLATE feel premium immediately.

### Build

- Design tokens
- Base dark theme
- AppShell
- SidebarNav
- TopBar
- PageHeader
- Card system
- Badge/chip system
- Empty states
- Mock dashboard data
- `/app` overview dashboard

### Acceptance Criteria

- App shell looks premium
- Dark palette is cohesive
- Navigation is clear
- Dashboard communicates the product direction
- Components can be reused on website hero mockups
- UI does not feel like a generic admin template

## Technical Guidance

Use the existing project stack if a project already exists.

If starting from scratch, propose an app stack before implementation. Preferred direction:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn-style component primitives
- Framer Motion where useful, but restrained
- Mock data first
- Strong component organization

Do not overbuild the backend in Sprint 1.

## Design Guidance

Follow `docs/04_SLATE_UX_UI_CANON.md`.

Key design requirements:

- Premium dark-mode UI
- Layered dark surfaces
- Strong information hierarchy
- Clear navigation
- Fine borders and subtle glow
- Practice accents used sparingly
- No generic AI imagery
- No chatbot mascot
- No cheap SaaS template look
- No cluttered admin dashboard

## Required Output Report

When complete, return:

```md
## Sprint Summary

### Objective
...

### Files Changed
...

### What Was Implemented
...

### Commands Run
...

### Build/Test Results
...

### Screenshots
...

### Deviations From Canon
...

### Known Issues
...

### Recommended Next Step
...
```

If you encounter ambiguity, choose the option that best preserves MVP focus, premium UX, canon alignment, future extensibility, and clear human-guided AI workflows.

---

# Secondary Prompt: Visual QA After Sprint 1

After Sprint 1 implementation, use this prompt for browser/visual validation if available.

```md
Review the SLATE Sprint 1 implementation against the canon docs.

Open the app at `/app`.

Evaluate:

1. Does the app shell feel premium and product-grade?
2. Does it avoid generic admin dashboard patterns?
3. Is the dark-mode palette cohesive?
4. Is the navigation clear?
5. Is the visual hierarchy strong?
6. Are cards, badges, and panels consistent?
7. Does the dashboard communicate SLATE’s purpose?
8. Are empty states useful and human?
9. Does it feel visually aligned with Saipien Labs?
10. Is the app responsive at desktop, tablet, and mobile widths?

Capture screenshots at:

- 1440px desktop
- 1024px tablet
- 390px mobile

Return UX audit summary, screenshots, issues found, design drift from canon, recommended fixes, and priority order.
```
