# SLATE Information Architecture

## Primary Internal Navigation

- Overview
- Leads
- Accounts
- Engagements
- Audits
- Proposals
- Delivery
- Library
- Settings

Future modules: Builds, Ventures, Client Success, Analytics.

---

# Public Route Map

## `/scorecard`

Landing/entry route for the AI Workflow Scorecard.

Key components: ScorecardHero, ScorecardValueProps, ScorecardFitSection, ScorecardBoundarySection, StartScorecardCTA.

## `/scorecard/start`

Interactive multi-step AI Workflow Scorecard intake.

Key components: PublicScorecardShell, ScorecardStepper, ScorecardProgress, ScorecardQuestionCard, ConditionalQuestionGroup, SaveProgressIndicator, ContinueButton.

## `/scorecard/results`

Directional scorecard results and next-step routing.

Key components: ScorecardResultHero, AIReadinessScoreCard, WorkflowFrictionCard, SystemsReadinessCard, OpportunityAreaList, RiskReadinessNotes, RecommendedNextStepCard, DiagnosticReviewCTA.

Important rule: provide value but not full roadmap, architecture, or implementation plan.

## `/apply/ai-systems-review`

Application page for high-fit prospects.

Key components: ApplicationHero, QualificationForm, ScorecardReferenceSummary, SubmitApplicationCTA.

---

# Internal App Route Map

## `/app`

Overview dashboard / command center.

Key components: AppShell, CommandCenterHeader, PipelineSummaryCards, ReviewQueue, ActiveEngagementsPanel, RecentScorecardsPanel, OpenProposalsPanel, FollowUpTasksPanel.

## `/app/leads`

Lead dashboard and triage center.

Key components: LeadDashboardHeader, LeadFilters, LeadTable, LeadStatusChip, FitScoreBadge, RecommendedActionBadge, LeadDetailDrawer.

## `/app/leads/[id]`

Detailed lead review page.

Key components: LeadProfileHeader, ScorecardSummaryPanel, InternalFitScorePanel, QualificationSignals, RecommendedNextAction, LeadNotes, ConvertToAccountButton, StartEngagementButton.

## `/app/accounts`

List companies/prospects/clients.

## `/app/accounts/[id]`

Account workspace.

Key components: AccountHeader, CompanyProfileCard, ContactStakeholderPanel, EngagementHistoryPanel, ScorecardHistoryPanel, DocumentsPanel, NotesPanel, NextActionCard.

## `/app/engagements`

List active and past engagements.

## `/app/engagements/[id]`

Engagement command center.

Key components: EngagementHeader, EngagementStageTracker, EngagementSummaryCards, StakeholderProgressPanel, DocumentStatusPanel, FindingsStatusPanel, OpportunityStatusPanel, ReportStatusPanel, ProposalStatusPanel.

## `/app/engagements/[id]/intake`

Manage stakeholder intake and discovery inputs.

## `/app/engagements/[id]/documents`

Manage uploaded client documents and evidence inputs.

## `/app/engagements/[id]/findings`

Review, edit, approve, and reject generated findings.

## `/app/engagements/[id]/opportunities`

Score and prioritize AI/system opportunities.

## `/app/engagements/[id]/roadmap`

Build 30/60/90-day roadmap.

## `/app/engagements/[id]/report`

Assemble and edit AI Opportunity Sprint report.

## `/app/engagements/[id]/proposal`

Create proposal/SOW options.

## `/app/library`

Reusable frameworks, templates, playbooks, prompts, and report modules.

## `/app/settings`

App configuration.

---

# Future BuildOps Routes

Do not build in initial MVP.

- `/app/builds`
- `/app/builds/[id]`
- `/app/builds/[id]/context`
- `/app/builds/[id]/sprints`
- `/app/builds/[id]/sessions`
- `/app/builds/[id]/docs`
- `/app/builds/[id]/qa`
- `/app/builds/[id]/deployments`

---

# External Stakeholder Routes

## `/intake/[token]`

Secure stakeholder intake link.

## `/upload/[token]`

Document upload flow.

---

# Key Object Model

- Lead
- Account
- Contact
- Stakeholder
- Engagement
- Assessment
- Response
- Document
- Finding
- Opportunity
- RoadmapItem
- Report
- Proposal
- Project
- Asset
