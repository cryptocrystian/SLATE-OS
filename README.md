# SLATE

SLATE is the internal operating system for [Saipien Labs](https://saipienlabs.com) — a venture studio and technology services firm spanning AI Systems, Custom Development, and Venture Studio practices.

SLATE supports the full engagement lifecycle: prospect qualification, AI Workflow Scorecards, AI-guided stakeholder intake, opportunity scoring, audit generation, proposal generation, delivery, and venture workflows.

> The operating system behind Saipien Labs' discovery, strategy, build, and venture workflows.

## MVP Focus

```
AI Workflow Scorecard → Lead Qualification → AI Opportunity Sprint → Audit Report → Proposal / SOW
```

The first version focuses on **GrowthOps** (scorecards, lead qualification) and **AdvisoryOps** (audits, intake, findings, reports, proposals). BuildOps, StudioOps, and ClientOps are anticipated but deferred.

## Operating Tracks

| Track | Scope | Phase |
| --- | --- | --- |
| GrowthOps | Scorecards, lead qualification, funnel routing | MVP |
| AdvisoryOps | Audits, intake, findings, reports, roadmaps, proposals | MVP |
| BuildOps | Development pipeline, sprint mgmt, agent sessions, QA | Later |
| StudioOps | Venture portfolio, theses, validation, product pipeline | Later |
| ClientOps | Retainers, expansion, QBRs, managed services | Later |

## Tech Direction

The preferred stack (per `docs/07_SLATE_CODEX_KICKOFF_PROMPT.md`):

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn-style component primitives
- Framer Motion (restrained)
- Mock data first; backend added as sprints require it

## Documentation

The canon docs in [`/docs`](./docs) are the source of truth. Read them before contributing code.

| Doc | Purpose |
| --- | --- |
| [`00_SLATE_MASTER_CANON.md`](./docs/00_SLATE_MASTER_CANON.md) | Product purpose, strategic role, philosophy |
| [`01_SLATE_PRODUCT_SPEC.md`](./docs/01_SLATE_PRODUCT_SPEC.md) | Product scope, users, flows, scoring |
| [`02_SLATE_MVP_SCOPE.md`](./docs/02_SLATE_MVP_SCOPE.md) | What is and isn't in the MVP |
| [`03_SLATE_INFORMATION_ARCHITECTURE.md`](./docs/03_SLATE_INFORMATION_ARCHITECTURE.md) | Routes, navigation, data model |
| [`04_SLATE_UX_UI_CANON.md`](./docs/04_SLATE_UX_UI_CANON.md) | Visual system, design tokens, UX principles |
| [`05_SLATE_IMPLEMENTATION_ARTIFACTS.md`](./docs/05_SLATE_IMPLEMENTATION_ARTIFACTS.md) | Screen inventory, components, wireframes |
| [`06_SLATE_BUILD_PLAN.md`](./docs/06_SLATE_BUILD_PLAN.md) | Sprint-by-sprint build plan |
| [`07_SLATE_CODEX_KICKOFF_PROMPT.md`](./docs/07_SLATE_CODEX_KICKOFF_PROMPT.md) | Implementation kickoff prompt |

## Build Plan

Sprints are defined in `docs/06_SLATE_BUILD_PLAN.md`:

1. Visual Foundation + App Shell
2. Public Scorecard Flow
3. Lead Dashboard + Qualification
4. Engagement Workspace
5. Intake + Findings Review
6. Opportunity Matrix + Roadmap
7. Report + Proposal Builder

## Product Principles

- Systems over tools
- Practicality over hype
- Human judgment over blind automation
- Premium output over raw speed
- Repeatable, but not generic
- Built to evolve

## Status

Pre-implementation. Repo currently contains canon docs and project scaffolding. Sprint 1 has not yet started.
