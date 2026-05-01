# SLATE Product Spec

## Product Summary

SLATE is the internal operating system for Saipien Labs.

It supports the lifecycle of Saipien Labs engagements across AI Systems, Custom Development, and Venture Studio.

The first version focuses on:

> AI Workflow Scorecard → Lead Qualification → AI Systems Diagnostic Review → AI Opportunity Sprint → Audit Report → Proposal / SOW

SLATE helps Saipien Labs qualify prospects, collect structured discovery data, synthesize stakeholder input, score opportunities, create premium audit reports, generate implementation recommendations, and convert advisory work into build projects.

---

## Product Scope by Practice Area

## AI Systems Practice

This is the MVP focus.

### Core Jobs

- Capture inbound prospect interest
- Run automated AI Workflow Scorecards
- Score fit and readiness
- Route prospects into the right next step
- Run AI-guided stakeholder intake
- Collect documents and workflow context
- Synthesize findings
- Score AI and automation opportunities
- Build audit reports
- Generate implementation proposals
- Support transition into delivery

### Primary Outputs

- AI Workflow Scorecard
- Internal Saipien Fit Score
- Lead qualification summary
- Stakeholder synthesis
- Workflow friction map
- AI opportunity matrix
- AI Opportunity Sprint report
- 30/60/90-day roadmap
- Implementation SOW options

---

## Custom Development Practice

Supported after AI Systems MVP.

MVP representation: Build Fit Call, Software Build Blueprint, requirements capture, feature scoping, architecture planning, proposal/SOW support, future delivery handoff.

Future outputs: Software Build Blueprint, requirements summary, user/workflow map, feature priority matrix, architecture recommendation, MVP roadmap, build SOW, delivery plan.

---

## Venture Studio Practice

Later phase.

Future outputs: venture thesis cards, product opportunity briefs, validation reports, build pipeline views, venture portfolio dashboard, case study records.

---

## Primary Users

### Founder / Operator / Admin

Needs visibility across pipeline, accounts, audits, proposals, and delivery.

Key screens: overview dashboard, lead dashboard, account workspace, engagement overview, findings review, report builder, proposal builder.

### Strategist / Consultant

Uses SLATE to run audits, review AI-generated findings, and shape recommendations.

Key screens: engagement workspace, stakeholder intake summary, findings review, opportunity matrix, report builder, roadmap builder.

### Technical / Delivery Lead

Translates recommendations into implementation scope.

Key screens: opportunity detail, systems inventory, proposal builder, delivery workspace, launch criteria, risk/dependency log.

### Prospect / Client

Interacts with public scorecard, stakeholder intake, document upload, and review application flows.

---

# Core Product Flows

## Public AI Workflow Scorecard Flow

1. Visitor lands on scorecard page.
2. Visitor answers structured questions about company, industry, size, systems, workflow friction, AI adoption, data sensitivity, urgency, and goals.
3. System calculates prospect-facing scores and internal fit score.
4. Lead is created internally.
5. Lead is routed to high-fit review queue, nurture, or education path.
6. Prospect receives result and CTA.

Key rules:

- Provide useful insight without becoming a free audit.
- Directional and based on self-reported data.
- Preserve value of paid AI Opportunity Sprint.
- Internal fit score is never shown to prospect.

## Lead Qualification Flow

Statuses: New, Needs Review, High Fit, Diagnostic Requested, Qualified, Nurture, Disqualified, Converted to Engagement.

Internal user reviews pain intensity, budget likelihood, operational complexity, technical readiness, urgency, and expansion potential.

## AI Opportunity Sprint Flow

1. Create engagement workspace.
2. Add stakeholders.
3. Send role-based intake.
4. Collect responses and docs.
5. AI synthesizes candidate findings.
6. Consultant reviews findings.
7. System generates opportunity recommendations.
8. Consultant reviews scores/priorities.
9. System drafts report.
10. Consultant finalizes report.
11. System generates roadmap and SOW options.

## Stakeholder Intake Flow

Roles: executive, operations, sales, marketing, finance/admin, IT/technical, frontline user, other.

The intake should feel like a guided business interview, not a generic form.

## Findings Review Flow

Each finding includes statement, category, evidence summary, sources, confidence, and suggested business impact.

Actions: approve, edit, reject, regenerate, add manual note.

## Opportunity Scoring Flow

Categories: business impact, implementation complexity, time to value, risk level, adoption likelihood, strategic value, repeatability.

Labels: Quick Win, Strategic Build, Defer, Avoid / Not Recommended.

## Report Builder Flow

Sections: Executive Summary, Business Context, Current-State Systems Snapshot, AI Readiness Assessment, Workflow Friction Analysis, Stakeholder Discovery Synthesis, AI Opportunity Portfolio, Priority Recommendations, Risk/Governance Notes, 30/60/90 Roadmap, Recommended Next Step, Appendix.

## Proposal / SOW Flow

Supports tiered options:

1. Quick-Win Build
2. AI Workflow System / Department System
3. Managed AI Partner

---

# Scoring Systems

## Prospect-Facing Scores

- AI Readiness Score
- Workflow Friction Score
- Systems Readiness Snapshot

## Internal Saipien Fit Score

Dimensions: business value potential, budget likelihood, pain intensity, technical readiness, buyer readiness, expansion potential.

Fit categories:

- 80–100: Prime Candidate
- 65–79: Good Candidate
- 50–64: Nurture
- Below 50: Disqualify / Education Path

---

# Product Success Criteria

- Faster lead triage
- Reduced manual discovery
- Faster premium audit production
- Better audit-to-SOW conversion
- Reports feel specific and evidence-backed
- UX feels cohesive and premium
