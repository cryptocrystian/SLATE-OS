# SLATE Implementation Artifacts

## Working Name

SLATE is the working product name for the internal operating system behind Saipien Labs.

## Name Impression

SLATE communicates structure, clarity, precision, a blank surface for strategy/building, a system of record, consulting-grade thinking, product discipline, and calm technical confidence.

Do not force an acronym right now.

Supporting descriptor:

> The operating system behind Saipien Labs’ discovery, strategy, build, and venture workflows.

Website descriptor:

> Powered by SLATE, our internal operating system for AI discovery, software planning, and delivery execution.

---

# Screen Inventory

## Public Screens

1. AI Workflow Scorecard landing screen
2. Scorecard stepper screen
3. Scorecard results screen
4. AI Systems Review application screen
5. Stakeholder intake screen
6. Stakeholder document upload screen
7. Stakeholder completion screen

## Internal Screens

1. Overview dashboard
2. Lead dashboard
3. Lead detail
4. Accounts list
5. Account detail/workspace
6. Engagement list
7. Engagement overview
8. Intake manager
9. Document manager
10. Findings review workspace
11. Opportunity matrix
12. Roadmap builder
13. Report builder
14. Proposal builder
15. Library
16. Settings

## Website Hero-Derived Visual Components

- SLATE command center preview
- Scorecard result preview
- Opportunity matrix preview
- Report builder preview
- Build pipeline preview
- Venture pipeline preview

---

# Page-by-Page Wireframe Specs

## Public Scorecard Landing

Purpose: explain the AI Workflow Scorecard and start the diagnostic.

Hero copy:

- Eyebrow: AI Workflow Scorecard
- Headline: Where could AI actually create value in your business?
- Subheadline: A short diagnostic to identify readiness, workflow friction, and likely opportunity areas.
- CTA: Start the Scorecard

Middle: what you get, who it is for, what it does not include.

Key rule: make it feel serious, not like a quiz.

## Scorecard Stepper

Purpose: collect prospect input in a consultative way.

Sections:

1. Company profile
2. Business model and goals
3. Workflow friction
4. Systems and tools
5. AI adoption
6. Data and risk
7. Urgency and investment readiness
8. Contact details

Key rule: questions should feel consultative, not bureaucratic.

## Scorecard Results

Purpose: give immediate value and route prospect.

Layout:

- Result classification
- AI Readiness Score
- Workflow Friction Score
- Systems Readiness Snapshot
- Risk/readiness flags
- Top 3 likely opportunity areas
- What deeper analysis would validate
- Apply for AI Systems Review CTA

Key rule: provide value, but preserve paid audit.

## Internal Overview Dashboard

Purpose: calm command-center view.

Show: new scorecards, high-fit leads, active audits, reports needing review, open proposals, review queue, active engagements, recent activity, follow-ups, system status.

## Lead Dashboard

Purpose: triage inbound leads.

Lead row fields: company, contact, source, practice area, AI readiness, internal fit score, status, recommended action, last activity.

Key rule: best leads obvious at a glance.

## Lead Detail

Purpose: review one lead and decide next action.

Show: scorecard summary, internal fit score breakdown, qualification signals, opportunity areas, risk notes, contact info, notes, actions.

## Account Workspace

Purpose: central home for a company.

Tabs: overview, contacts, engagements, documents, notes, history.

## Engagement Overview

Purpose: manage AI Opportunity Sprint.

Stage tracker: Setup → Intake → Synthesis → Scoring → Report → Proposal.

## Intake Manager

Purpose: track stakeholder discovery.

Show: intake summary, role coverage map, stakeholder table, response summary drawer.

## Findings Review Workspace

Purpose: convert AI-generated synthesis into approved findings.

Three-column layout: findings list, selected finding/editor, evidence panel.

Actions: approve, edit, reject, regenerate, add manual finding.

## Opportunity Matrix

Purpose: prioritize opportunities.

Quadrants: Quick Wins, Strategic Builds, Low Priority, Defer/Avoid.

## Roadmap Builder

Purpose: sequence recommendations into 30/60/90-day roadmap.

## Report Builder

Purpose: assemble premium AI Opportunity Sprint report.

Layout: outline, section editor/preview, findings/evidence panel.

## Proposal Builder

Purpose: generate implementation SOW options.

Show: three proposal option cards, scope, timeline, pricing placeholder, assumptions, implementation credit, terms.

---

# Component Inventory

## Layout Components

AppShell, PublicAssessmentShell, SidebarNav, TopBar, PageHeader, WorkspacePanel, ContextPanel, SectionHeader, SplitPaneLayout, StageTracker.

## Scorecard Components

ScorecardHero, ScorecardStepper, ScorecardProgress, ScorecardQuestionCard, ConditionalQuestionGroup, ScorecardResultHero, ReadinessScoreCard, WorkflowFrictionCard, SystemsReadinessCard, OpportunityAreaCard, RiskReadinessNote, RecommendedNextStepCard.

## Lead Components

LeadTable, LeadListItem, LeadDetailDrawer, LeadProfileHeader, FitScoreBadge, LeadStatusChip, RecommendedActionBadge, QualificationSignalsPanel.

## Account Components

AccountHeader, CompanyProfileCard, ContactCard, StakeholderRoleTag, EngagementHistoryPanel, ScorecardHistoryPanel, NotesPanel.

## Engagement Components

EngagementHeader, EngagementStageTracker, EngagementSummaryCard, StakeholderProgressPanel, IntakeStatusChip, DocumentStatusChip.

## Findings Components

FindingCard, FindingList, FindingStatusChip, EvidenceBlock, EvidencePanel, ConfidenceIndicator, ReviewActionBar, AIAssumptionNote.

## Opportunity Components

OpportunityCard, OpportunityMatrix, OpportunityDetailDrawer, ScoringControl, PriorityLabel, RelatedFindingsPanel, RiskDependencyList.

## Roadmap Components

RoadmapPhaseColumn, RoadmapCard, DependencyChip, SuccessCriteriaBlock.

## Report Components

ReportOutlineSidebar, ReportSectionCard, ReportSectionEditor, ReportSectionStatusChip, LinkedFindingsPanel, ExportReportButton.

## Proposal Components

ProposalOptionCard, ScopeBuilderPanel, PricingPlaceholderPanel, ImplementationCreditPanel, AssumptionsPanel, ExportProposalButton.

## Shared UI Components

Button, Card, Badge, Tabs, Drawer, Modal, Tooltip, Input, Select, Textarea, Progress, EmptyState, DataTable, MetricCard, MiniChart, CommandMenu.

---

# Design Token Direction

## Base

`--color-bg-page`, `--color-bg-shell`, `--color-bg-surface`, `--color-bg-surface-elevated`, `--color-bg-panel`, `--color-border-subtle`, `--color-border-strong`

## Text

`--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-disabled`, `--color-text-inverse`

## Brand / Practice

`--color-brand-primary`, `--color-practice-ai`, `--color-practice-dev`, `--color-practice-studio`

## Semantic

`--color-status-success`, `--color-status-warning`, `--color-status-risk`, `--color-status-critical`, `--color-status-info`, `--color-status-neutral`

## Effects

`--shadow-card`, `--shadow-elevated`, `--glow-primary`, `--glow-ai`, `--glow-dev`, `--glow-studio`

---

# Website Hero Visual Components

Use a layered interface preview showing SLATE command center, scorecard result, opportunity matrix, report status, build pipeline, and venture pipeline.

Foreground: large Scorecard Result Card, AI Readiness Score, Recommended Next Step.

Midground: Opportunity Matrix mini-preview.

Background: engagement stage tracker, build pipeline cards, venture studio node.
