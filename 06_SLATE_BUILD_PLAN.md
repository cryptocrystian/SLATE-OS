# SLATE Build Plan

## Build Strategy

SLATE should be built in controlled sprints.

The first goal is not full backend functionality. The first goal is to establish:

1. A premium product-grade app shell
2. A clear public scorecard flow
3. A useful internal lead qualification workflow
4. The structure for AI Opportunity Sprint delivery
5. A visual system strong enough to support the Saipien Labs website hero

The MVP should prioritize clarity, polish, and correct architecture over excessive feature depth.

---

# Sprint 1: Visual Foundation + App Shell

## Goal

Create the foundation that makes SLATE feel premium immediately.

## Build

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

## Acceptance Criteria

- App shell looks premium
- Dark palette is cohesive
- Navigation is clear
- Dashboard communicates the product direction
- Components can be reused on website hero mockups
- UI does not feel like a generic admin template

## Do Not Build Yet

- Full scorecard logic
- Real AI integration
- Auth
- Database
- Report generation
- Proposal generation
- BuildOps
- Venture Studio workflows

---

# Sprint 2: Public Scorecard Flow

## Goal

Build the first website-to-SLATE conversion asset.

## Build

- `/scorecard`
- `/scorecard/start`
- `/scorecard/results`
- Scorecard stepper
- Question model
- Result card
- Mock scoring logic
- Lead creation placeholder

## Acceptance Criteria

- Scorecard feels serious and polished
- User can complete the flow
- Result page gives directional value
- Result does not cannibalize paid audit
- Result page routes high-fit prospects toward AI Systems Review

## Important Boundary

The free scorecard identifies likely leverage areas. It does not provide full workflow map, technical architecture, ROI model, implementation roadmap, SOW, or detailed system plan.

---

# Sprint 3: Lead Dashboard + Qualification

## Goal

Allow internal review of scorecard completions.

## Build

- `/app/leads`
- `/app/leads/[id]`
- Lead list
- Fit score display
- Recommended actions
- Lead detail page
- Convert to account placeholder
- Status management

## Acceptance Criteria

- High-fit leads are easy to identify
- Internal fit score is clearly separate from prospect-facing score
- Lead detail page supports next action
- User can classify lead as high fit, nurture, disqualified, or converted

---

# Sprint 4: Engagement Workspace

## Goal

Create the shell for AI Opportunity Sprint management.

## Build

- `/app/engagements`
- `/app/engagements/[id]`
- Stage tracker
- Intake status
- Document status
- Findings status
- Opportunity status
- Report status
- Proposal status

## Acceptance Criteria

- AI Opportunity Sprint has a clear workflow
- User knows what step comes next
- The workspace can expand into deeper modules
- Stage progression feels structured and premium

---

# Sprint 5: Intake + Findings Review

## Goal

Support stakeholder intake and finding approval.

## Build

- `/app/engagements/[id]/intake`
- `/app/engagements/[id]/findings`
- Stakeholder table
- Role coverage map
- Finding cards
- Evidence panel
- Review actions

## Acceptance Criteria

- Intake progress is visible
- Stakeholder role coverage is clear
- Findings feel evidence-backed
- Human review is central
- AI-generated outputs are clearly labeled as draft/suggested

---

# Sprint 6: Opportunity Matrix + Roadmap

## Goal

Prioritize recommendations and sequence next steps.

## Build

- `/app/engagements/[id]/opportunities`
- `/app/engagements/[id]/roadmap`
- Opportunity cards
- Matrix view
- Score controls
- Roadmap columns

## Acceptance Criteria

- Quick wins and strategic builds are visually clear
- Opportunities link back to findings
- Roadmap supports 30/60/90-day planning
- Complexity and business impact are easy to understand

---

# Sprint 7: Report + Proposal Builder

## Goal

Create client-facing deliverable workflows.

## Build

- `/app/engagements/[id]/report`
- `/app/engagements/[id]/proposal`
- Report outline
- Section cards
- Proposal option cards
- Implementation credit block
- Export placeholders

## Acceptance Criteria

- Report builder feels premium
- Proposal builder supports tiered options
- Output can support sales conversations
- Implementation credit language is represented clearly
- Human review and finalization remain required

---

# Future Sprint: BuildOps Foundation

Do not build until GrowthOps + AdvisoryOps MVP is working.

Future build: `/app/builds`, project command center, context hub, sprint pipeline, agent session manager, handoff generator, QA workspace, deployment visibility.

---

# Sprint Reporting Format

Every implementation sprint should produce:

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

---

# Visual QA Requirement

After each UI sprint, capture screenshots for:

- Desktop width around 1440px
- Tablet width around 1024px
- Mobile width around 390px
- Empty states
- Main populated state
- Key hover/active/review state if relevant

Screenshots should be reviewed against `04_SLATE_UX_UI_CANON.md`.
