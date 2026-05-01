# BuildOps Integration Canon

## Purpose

This document defines how BuildOps relates to the current SLATE MVP without changing the current MVP scope.

BuildOps is the Saipien Labs AI-native development pipeline methodology and eventual SLATE module for managing software builds, persistent project context, AI-assisted architecture, Claude Code implementation workflows, QA, visual validation, CI/CD, releases, and delivery reporting.

BuildOps is important to the long-term SLATE vision, but it should not disrupt the current GrowthOps + AdvisoryOps MVP.

---

## Current SLATE MVP Priority

The current SLATE app MVP remains focused on:

> AI Workflow Scorecard → Lead Qualification → AI Opportunity Sprint → Audit Report → Proposal / SOW

This means the active application build should prioritize:

- Public AI Workflow Scorecard
- Lead qualification
- Internal lead review
- Account and engagement workspaces
- Stakeholder intake
- Findings review
- Opportunity matrix
- Roadmap builder
- Audit report builder
- Proposal / SOW builder

The current MVP should continue following the existing sprint sequence in `docs/06_SLATE_BUILD_PLAN.md`.

---

## BuildOps Status

BuildOps is being developed in parallel as a repo-native methodology and operating layer.

For now, BuildOps should live primarily as:

- Canon docs
- Operating methodology
- Claude Code workflow standards
- Context persistence templates
- Sprint handoff templates
- QA and visual validation standards
- Code audit templates
- Reporting templates
- Project state schemas

BuildOps should not yet be implemented as full application functionality unless explicitly prioritized later.

---

## Non-Disruption Rule

BuildOps must not introduce scope creep into the current GrowthOps + AdvisoryOps MVP.

Do not add the following to the active app MVP unless explicitly approved:

- `/app/builds`
- Build project dashboards
- Sprint management UI
- Agent session tracking UI
- Repo context manager UI
- QA workspace UI
- Deployment visibility UI
- Claude/Codex session management UI
- Full BuildOps database tables
- Full BuildOps backend services

These remain future capabilities.

---

## Future BuildOps App Module

When the current GrowthOps + AdvisoryOps MVP is stable enough, BuildOps may become a first-class SLATE module.

The future route structure may include:

```txt
/app/builds
/app/builds/[id]
/app/builds/[id]/context
/app/builds/[id]/sprints
/app/builds/[id]/sessions
/app/builds/[id]/docs
/app/builds/[id]/qa
/app/builds/[id]/deployments
