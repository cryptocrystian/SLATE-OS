# SLATE Data Model Draft

This draft maps the current `lib/<domain>/` mock-data shapes to Postgres tables. It assumes Supabase (Postgres 15 + RLS + Auth + Storage) but the schema is portable.

> **Conventions.**
> - All ids are `uuid` (`gen_random_uuid()` default).
> - All tables carry `created_at timestamptz default now()` and `updated_at timestamptz default now()` with a trigger to maintain `updated_at` on update.
> - All foreign keys carry `on delete restrict` by default; cascades are called out explicitly where used.
> - Enum values mirror the existing TypeScript union types verbatim. Define them as Postgres `enum`s for type safety.
> - "Mock note" in each section explains how the table is seeded from existing mock data and which existing types it replaces.
> - JSON columns use `jsonb` and are validated by application code; the schema does not over-normalize MVP-stable shapes.

---

## 1. `profiles`

Operator profile, joined to `auth.users` via shared `id`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | matches `auth.users.id` |
| `display_name` | text | |
| `title` | text | e.g. "Strategy · Saipien Labs" |
| `avatar_initials` | text | e.g. "MR"; derived if null |
| `created_at`, `updated_at` | timestamptz | |

**Relationships.** Referenced by `engagements.owner_id`, `findings.reviewed_by`, `report_sections.reviewed_by`, `notes.author_id`, `activity_events.actor_id`.

**RLS.** Authenticated operators can `select` all profiles; only the user themselves can `update` their own.

**Mock note.** Replaces the hard-coded "M. Reyes / J. Okafor / A. Lin" strings that currently live in `lib/engagements/mock-engagements.ts`. Seed three operator rows on first deploy.

---

## 2. `workspaces` (single-row)

Single Saipien Labs workspace. Exists so that future multi-tenant work is structural, not a refactor.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | seeded singleton |
| `name` | text | "Saipien Labs" |
| `created_at` | timestamptz | |

**Relationships.** Every internal record carries `workspace_id` for forward compatibility.

**RLS.** Read-only to authenticated operators.

**Mock note.** New concept, not in mock data. Always one row in v1.

---

## 3. `accounts`

Companies / clients / prospects, anchored at the company level.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `workspace_id` | uuid FK → workspaces | |
| `name` | text | "Helio Health" |
| `industry` | text | |
| `employee_range` | text | e.g. "51–200" |
| `revenue_range` | text nullable | |
| `practice_area` | enum (`ai_systems` / `custom_dev` / `venture_studio`) | |
| `created_at`, `updated_at` | timestamptz | |

**Relationships.** Has many `contacts`, `leads`, `engagements`.

**RLS.** Workspace-scoped. Operators read/write all.

**Mock note.** Replaces account fields embedded inside `Lead` and `Engagement` mock records (`lib/leads/types.ts:Lead.companyName`, `lib/engagements/types.ts:Engagement.accountName`). One account per company name in seed data.

---

## 4. `contacts`

People at an account. The primary contact on a lead points here.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `account_id` | uuid FK → accounts | |
| `full_name` | text | |
| `title` | text | |
| `email` | citext | unique per account |
| `created_at`, `updated_at` | timestamptz | |

**Relationships.** Referenced by `leads.contact_id`, `stakeholders.contact_id` (optional).

**RLS.** Workspace-scoped via `account_id → workspace_id`.

**Mock note.** Replaces `Lead.contactName / contactTitle / contactEmail` and the per-stakeholder name fields seeded in `lib/intake/mock-intake.ts`.

---

## 5. `scorecard_submissions`

One row per public scorecard completion.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `submitted_at` | timestamptz | default now() |
| `submitted_email` | citext | nullable for partials |
| `submitted_first_name` | text | |
| `submitted_last_name` | text | |
| `submitted_role` | text | |
| `submitted_company` | text | |
| `industry` | text | from `company.industry` answer |
| `employee_range` | text | from `company.size` answer |
| `prospect_ai_readiness` | smallint | 0–100, server-computed |
| `prospect_workflow_friction` | smallint | 0–100, server-computed |
| `prospect_systems_readiness` | smallint | 0–100, server-computed |
| `internal_fit_score` | smallint | 0–100, server-computed, **operator-only** |
| `classification` | enum (`not_ready` / `automation_ready` / `quick_win` / `audit_ready` / `strategic`) | |
| `lead_id` | uuid FK → leads | created in same transaction |
| `client_meta` | jsonb | optional UA, locale, source URL — for ops debugging |

**Relationships.** Has many `scorecard_answers`. Has-one `lead` (created same txn).

**RLS.** **Public can `insert` only** (Edge Function actually performs server-side write with service role; clients post a payload). Operators can `select` workspace-wide.

**Mock note.** Replaces the `Answers` blob in `lib/scorecard/storage.ts` (localStorage). The current `lib/scorecard/scoring.ts` becomes a server function.

---

## 6. `scorecard_answers`

One row per question per submission.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `submission_id` | uuid FK → scorecard_submissions on delete cascade | |
| `question_id` | text | matches the canonical `lib/scorecard/questions.ts` ids |
| `value` | jsonb | string / string[] / number per question type |

**RLS.** Insert with submission. Read by operator only.

**Mock note.** Same shape as `Answers` map keyed by question id.

---

## 7. `leads`

Internal lead record. Created automatically on scorecard submission; can also be created manually by an operator.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `workspace_id` | uuid FK → workspaces | |
| `account_id` | uuid FK → accounts | |
| `contact_id` | uuid FK → contacts nullable | |
| `source` | enum (`public_scorecard` / `referral` / `outbound` / `event` / `partner`) | |
| `practice_area` | enum (mirror `accounts.practice_area`) | |
| `status` | enum (`new` / `needs_review` / `high_fit` / `diagnostic_requested` / `nurture` / `disqualified` / `converted`) | |
| `internal_fit_score` | smallint | 0–100, denormalized from submission for fast list queries |
| `prospect_scores` | jsonb | `{ ai, friction, systems }` snapshot |
| `recommended_action` | jsonb | `{ headline, detail, cta }` |
| `submission_id` | uuid FK → scorecard_submissions nullable | |
| `last_activity_at` | timestamptz | maintained by triggers / writes |

**Relationships.** Has many `notes`, `activity_events`. Optional has-one `engagement` (when `status = 'converted'`).

**RLS.** Workspace-scoped. Operators full CRUD.

**Mock note.** Replaces `MOCK_LEADS` in `lib/leads/mock-leads.ts`. The six `fitDimensions` and `qualificationSignals` arrays in the current `Lead` type become two child tables (`lead_fit_dimensions`, `lead_qualification_signals`) — see below.

---

## 8. `lead_fit_dimensions`

Six rows per lead.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `lead_id` | uuid FK → leads on delete cascade | |
| `dimension_id` | enum (`business_value` / `budget` / `pain_intensity` / `technical_readiness` / `buyer_readiness` / `expansion`) | |
| `value` | smallint | 0–100 |
| `note` | text | operator-authored explanation |

**RLS.** Workspace-scoped via lead.

**Mock note.** Mirrors `Lead.fitDimensions[]` exactly.

---

## 9. `lead_qualification_signals`

Variable rows per lead.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `lead_id` | uuid FK → leads on delete cascade | |
| `label` | text | |
| `detail` | text | |
| `direction` | enum (`positive` / `watch` / `negative`) | |
| `position` | int | for stable ordering |

**RLS.** Workspace-scoped via lead.

**Mock note.** Mirrors `Lead.qualificationSignals[]`.

---

## 10. `engagements`

The AI Opportunity Sprint workspace anchor.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `workspace_id` | uuid FK → workspaces | |
| `account_id` | uuid FK → accounts | |
| `linked_lead_id` | uuid FK → leads nullable | source lead, if any |
| `name` | text | "Atlas — AI Opportunity Sprint" |
| `engagement_type` | enum (`ai_opportunity_sprint` / `workflow_automation_assessment` / `systems_readiness_review`) | |
| `status` | enum (mirror `EngagementStatus`) | |
| `current_stage` | enum (`setup` / `intake` / `synthesis` / `scoring` / `report` / `proposal`) | |
| `owner_id` | uuid FK → profiles | |
| `target_date` | date | |
| `last_activity_at` | timestamptz | |
| `next_milestone` | text | |
| `recommended_action` | jsonb | `{ headline, detail, cta }` |
| `scorecard_summary` | jsonb nullable | `{ ai, friction, systems, classification }` snapshot |
| `risk_notes` | text[] | |
| `dependencies` | text[] | |

**Relationships.** Has many `stakeholder_intake_sessions`, `documents`, `findings`, `opportunities`, `roadmap_items`. Has one `report`. Has one `proposal`.

**RLS.** Workspace-scoped.

**Mock note.** Replaces `MOCK_ENGAGEMENTS`. The six panel-status records (`intake`, `documents`, `findings`, `opportunities`, `report`, `proposal`) on the current `Engagement` type are *derived views* over the underlying tables — they should not be persisted as columns.

---

## 11. `stakeholder_intake_sessions`

One row per stakeholder per engagement.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `engagement_id` | uuid FK → engagements on delete cascade | |
| `contact_id` | uuid FK → contacts nullable | |
| `name_override` | text nullable | when contact isn't yet identified ("VP Operations · TBD") |
| `title` | text | |
| `role` | enum (mirror `StakeholderRole`) | |
| `status` | enum (`invited` / `in_progress` / `completed` / `needs_follow_up` / `not_started`) | |
| `completion_percent` | smallint | 0–100 |
| `response_quality` | enum (`strong` / `adequate` / `thin` / `missing`) | |
| `summary` | text | |
| `key_signals` | text[] | |
| `open_questions` | text[] | |
| `risk_flags` | text[] | |
| `last_activity_at` | timestamptz nullable | |
| `intake_token` | text unique nullable | nullable until invitation generated |
| `token_expires_at` | timestamptz nullable | |
| `token_revoked_at` | timestamptz nullable | |

**Relationships.** Has many `stakeholder_responses`, `documents`.

**RLS.** Operators read/write all in their workspace. Stakeholder reads/writes only their own session via `intake_token` set on the request.

**Mock note.** Replaces `Stakeholder` in `lib/intake/types.ts`. Token columns are new.

---

## 12. `stakeholder_responses`

One row per question per stakeholder.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `session_id` | uuid FK → stakeholder_intake_sessions on delete cascade | |
| `question_id` | text | canonical id |
| `value` | jsonb | |
| `submitted_at` | timestamptz | default now() |

**RLS.** Same as session.

**Mock note.** New table; not currently in mocks (the mock summary text is the only response surface today).

---

## 13. `documents`

Document metadata. Binary storage lives in Supabase Storage; this table holds the references.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `engagement_id` | uuid FK → engagements on delete cascade | |
| `session_id` | uuid FK → stakeholder_intake_sessions nullable | when uploaded by stakeholder |
| `uploaded_by_profile_id` | uuid FK → profiles nullable | when uploaded by operator |
| `title` | text | |
| `type` | enum (`operations_doc` / `process_map` / `data_export` / `system_screenshot` / `policy_doc` / `report` / `other`) | |
| `source` | text | "Daniel Patel · CTO" — display string |
| `status` | enum (`requested` / `received` / `reviewed` / `missing` / `outdated`) | |
| `evidence_quality` | enum (`strong` / `adequate` / `thin` / `unverified`) | |
| `linked_role` | enum (mirror `StakeholderRole`) nullable | |
| `summary` | text | |
| `storage_path` | text nullable | Supabase Storage bucket path; nullable for "requested but not received" |
| `mime_type` | text nullable | |
| `size_bytes` | bigint nullable | |

**RLS.** Operators read/write all in workspace. Stakeholders read/write only documents tied to their own session.

**Mock note.** Replaces `SupportingInput` in `lib/intake/types.ts`.

---

## 14. `findings`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `engagement_id` | uuid FK → engagements on delete cascade | |
| `category` | enum (mirror `FindingCategory`, 8 values) | |
| `statement` | text | one-sentence headline |
| `summary` | text | |
| `evidence_summary` | text | |
| `confidence` | enum (`high` / `medium` / `low` / `needs_evidence`) | |
| `review_status` | enum (`draft` / `needs_review` / `approved` / `edited` / `rejected` / `report_ready`) | |
| `suggested_impact` | text | |
| `assumption_flag` | text nullable | |
| `reviewer_note` | text nullable | |
| `ai_drafted` | boolean | default true |
| `reviewed_by` | uuid FK → profiles nullable | |
| `reviewed_at` | timestamptz nullable | |

**Relationships.** Has many `finding_source_refs`, `opportunity_finding_links`, `report_section_finding_links`.

**RLS.** Workspace-scoped.

**Mock note.** Replaces `Finding` in `lib/findings/types.ts`. The `sourceRefs[]` becomes its own table — see next.

---

## 15. `finding_source_refs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `finding_id` | uuid FK → findings on delete cascade | |
| `type` | enum (`stakeholder_response` / `uploaded_document` / `scorecard_answer` / `consultant_note`) | |
| `source` | text | display name (person or document title) |
| `role` | text nullable | |
| `excerpt` | text | quoted excerpt |
| `strength` | enum (`strong` / `adequate` / `thin`) | |
| `linked_response_id` | uuid FK → stakeholder_responses nullable | |
| `linked_document_id` | uuid FK → documents nullable | |
| `linked_answer_id` | uuid FK → scorecard_answers nullable | |
| `linked_note_id` | uuid FK → notes nullable | |

**RLS.** Workspace-scoped via finding.

**Mock note.** Mirrors `Finding.sourceRefs[]`. The four optional FKs let a typed source ref carry a real relationship when one exists, or fall back to the display strings (`source` + `excerpt`) when it doesn't.

---

## 16. `opportunities`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `engagement_id` | uuid FK → engagements on delete cascade | |
| `title` | text | |
| `category` | enum (mirror `OpportunityCategory`, 9 values) | |
| `description` | text | |
| `priority` | enum (`quick_win` / `strategic_build` / `low_priority` / `defer` / `avoid`) | |
| `quadrant` | enum (`quick_win` / `strategic_build` / `low_priority` / `defer_avoid`) | |
| `business_impact_score` | smallint | 0–100 |
| `complexity_score` | smallint | 0–100 |
| `risk_score` | smallint | 0–100 |
| `time_to_value_score` | smallint | 0–100 |
| `adoption_likelihood_score` | smallint | 0–100 |
| `strategic_value_score` | smallint | 0–100 |
| `evidence_strength` | enum (`strong` / `adequate` / `thin`) | |
| `source_summary` | text | |
| `recommended_action` | text | |
| `implementation_shape` | text | |
| `dependencies` | text[] | |
| `risks` | text[] | |
| `success_signals` | text[] | |

**Relationships.** Has many `opportunity_finding_links`, `roadmap_items`, `proposal_option_opportunity_links`.

**RLS.** Workspace-scoped.

**Mock note.** Replaces `Opportunity` in `lib/opportunities/types.ts`.

---

## 17. `opportunity_finding_links`

Join table.

| Column | Type | Notes |
| --- | --- | --- |
| `opportunity_id` | uuid FK | composite PK |
| `finding_id` | uuid FK | composite PK |

**Mock note.** Replaces `Opportunity.relatedFindingIds[]`.

---

## 18. `roadmap_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `engagement_id` | uuid FK → engagements on delete cascade | |
| `phase` | enum (`first_30` / `days_31_60` / `days_61_90`) | |
| `title` | text | |
| `objective` | text | |
| `linked_opportunity_id` | uuid FK → opportunities nullable | |
| `priority` | enum (mirror `OpportunityPriority`) | |
| `key_actions` | text[] | |
| `dependencies` | text[] | |
| `success_criteria` | text[] | |
| `risks` | text[] | |
| `owner_placeholder` | text nullable | |
| `readiness_note` | text nullable | |
| `position` | int | within phase, for stable ordering |

**Relationships.** Belongs to opportunity (optional). Linked from `report_section_roadmap_links`, `proposal_option_roadmap_links`.

**RLS.** Workspace-scoped.

**Mock note.** Replaces `RoadmapItem` in `lib/roadmap/types.ts`.

---

## 19. `reports`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `engagement_id` | uuid FK → engagements unique | one report per engagement |
| `title` | text | |
| `status` | enum (`draft` / `needs_review` / `approved` / `final`) | |
| `generated_at` | timestamptz | |
| `last_edited_at` | timestamptz | |
| `recommended_next_step` | text | |
| `consultant_notes` | text[] | |
| `export_status` | enum (`locked` / `preview_only` / `ready_for_export_placeholder`) | |

**Relationships.** Has many `report_sections`.

**RLS.** Workspace-scoped via engagement.

**Mock note.** Replaces `Report` in `lib/reports/types.ts`.

---

## 20. `report_sections`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `report_id` | uuid FK → reports on delete cascade | |
| `section_type` | enum (mirror `ReportSectionType`, 12 values) | |
| `title` | text | |
| `position` | int | canonical order |
| `status` | enum (`not_started` / `drafted` / `needs_review` / `approved` / `final`) | |
| `summary` | text | |
| `draft_preview` | text | |
| `evidence_notes` | text | |
| `reviewer_note` | text nullable | |
| `ai_drafted` | boolean | default true |
| `confidence` | enum (mirror `ReportConfidence`) | |
| `reviewed_by` | uuid FK → profiles nullable | |
| `reviewed_at` | timestamptz nullable | |

**Relationships.** Has many of: `report_section_finding_links`, `report_section_opportunity_links`, `report_section_roadmap_links`.

**Mock note.** Replaces `ReportSection`.

---

## 21–23. `report_section_*_links`

Three join tables for the typed source trail:

- `report_section_finding_links` — `(report_section_id, finding_id)` composite PK
- `report_section_opportunity_links` — `(report_section_id, opportunity_id)` composite PK
- `report_section_roadmap_links` — `(report_section_id, roadmap_item_id)` composite PK

**Mock note.** Replaces `ReportSection.linkedFindingIds[] / linkedOpportunityIds[] / linkedRoadmapItemIds[]`.

---

## 24. `proposals`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `engagement_id` | uuid FK → engagements unique | one proposal per engagement |
| `title` | text | |
| `status` | enum (`draft` / `needs_review` / `approved` / `sent_placeholder` / `accepted_placeholder`) | |
| `recommended_option_id` | uuid FK → proposal_options nullable | |
| `assumptions` | text[] | |
| `dependencies` | text[] | |
| `next_step` | text | |
| `export_status` | enum (mirror `Report.export_status`) | |
| `credit_eligible` | boolean | |
| `credit_amount_placeholder` | text | |
| `credit_window` | text | |
| `credit_notes` | text | |

**Mock note.** Replaces `Proposal` + `ImplementationCredit`.

---

## 25. `proposal_options`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `proposal_id` | uuid FK → proposals on delete cascade | |
| `title` | text | |
| `type` | enum (`quick_win_build` / `ai_workflow_system` / `managed_ai_partner`) | |
| `recommended` | boolean | default false |
| `best_fit_scenario` | text | |
| `scope_summary` | text | |
| `timeline` | text | |
| `deliverables` | text[] | |
| `assumptions` | text[] | |
| `dependencies` | text[] | |
| `risks` | text[] | |
| `pricing_placeholder` | text | |
| `confidence` | enum (`high` / `medium` / `low`) | |

**Relationships.** Linked via `proposal_option_opportunity_links` and `proposal_option_roadmap_links`.

**Mock note.** Replaces `ProposalOption`.

---

## 26–27. `proposal_option_*_links`

- `proposal_option_opportunity_links` — `(proposal_option_id, opportunity_id)` composite PK
- `proposal_option_roadmap_links` — `(proposal_option_id, roadmap_item_id)` composite PK

**Mock note.** Replaces `ProposalOption.includedOpportunityIds[] / linkedRoadmapItemIds[]`.

---

## 28. `notes`

Operator-authored notes attached to leads, engagements, findings, sections, or opportunities.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `workspace_id` | uuid FK → workspaces | |
| `author_id` | uuid FK → profiles | |
| `body` | text | |
| `subject_table` | enum (`lead` / `engagement` / `finding` / `report_section` / `opportunity` / `proposal`) | |
| `subject_id` | uuid | not a foreign key (polymorphic) |
| `created_at`, `updated_at` | timestamptz | |

**RLS.** Workspace-scoped.

**Mock note.** Replaces the per-record `notes: string[]` arrays scattered across `Lead`, `Engagement`, etc.

---

## 29. `activity_events`

The cross-engagement activity timeline that already exists on the Command Center.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `workspace_id` | uuid FK → workspaces | |
| `event_type` | enum (mirror `ActivityType`, 7 values; extensible) | |
| `title` | text | |
| `detail` | text | |
| `subject_table` | enum (mirror `notes.subject_table` plus `scorecard_submission`) | |
| `subject_id` | uuid | |
| `actor_id` | uuid FK → profiles nullable | nullable for system / AI actors |
| `actor_label` | text | "SLATE · suggested" or operator name; denormalized for the UI |
| `account_id` | uuid FK → accounts nullable | for "Helio Health · …" subtitle |
| `at` | timestamptz | default now() |

**RLS.** Workspace-scoped read; insert via triggers on the underlying tables (or service role from app code) — operators don't typically write events directly.

**Mock note.** Replaces `ActivityEvent` in `lib/mock-data.ts`.

---

## Derived (Not Tables)

The following pieces of the current `Engagement` type are **derived** from the underlying tables and should not be persisted:

- `engagement.intake.{stakeholdersResponded, rolesCovered, rolesMissing, lastResponseAt, status}` — derive from `stakeholder_intake_sessions` aggregates
- `engagement.documents.{requested, received, reviewed, status}` — derive from `documents` aggregates
- `engagement.findings.{candidate, approved, rejected, status}` — derive from `findings` aggregates
- `engagement.opportunities.{identified, quickWins, strategicBuilds, defer, status}` — derive from `opportunities` aggregates
- `engagement.report.{sectionsTotal, sectionsDrafted, sectionsApproved, status}` — derive from `report_sections` aggregates
- `engagement.proposal.{options, recommendedOption, status}` — derive from `proposals` + `proposal_options`

Implement these as Postgres views (`engagement_panel_status_v`) or compute inline in the query layer. Either way, the UI keeps consuming the same shape — `lib/engagements/queries.ts` returns the engagement plus its computed panel status block.

---

## Relationships at a Glance

```
workspaces ──┬── accounts ──── contacts
             │       │
             │       └── leads ─┬── lead_fit_dimensions
             │                  ├── lead_qualification_signals
             │                  └── (linked_lead_id) engagements ─┬── stakeholder_intake_sessions ──── stakeholder_responses
             │                                                    │                              └──── documents
             │                                                    ├── findings ─── finding_source_refs
             │                                                    ├── opportunities ─── opportunity_finding_links
             │                                                    ├── roadmap_items
             │                                                    ├── reports ─── report_sections ─┬── report_section_finding_links
             │                                                    │                                ├── report_section_opportunity_links
             │                                                    │                                └── report_section_roadmap_links
             │                                                    └── proposals ─── proposal_options ─┬── proposal_option_opportunity_links
             │                                                                                       └── proposal_option_roadmap_links
             ├── notes (polymorphic)
             └── activity_events (polymorphic)

scorecard_submissions ─── scorecard_answers
                      └── (creates) leads
profiles ─── (auth.users)
```

---

## Migration Notes (Aggregate)

- All enum types are derived from the existing TypeScript union types verbatim. The migration script is mechanical.
- The `mock-*.ts` files become a one-shot seed script that runs against a fresh local Supabase.
- The `recommended_action` jsonb columns on `leads` and `engagements` could be normalized into their own table later if the shape stabilizes; for the first persistence sprint, jsonb is the right call.
- Document binary storage uses a single `engagement-documents` Supabase Storage bucket with paths `<engagement_id>/<document_id>/<filename>`. Bucket policy mirrors the `documents` table RLS.
- Token columns on `stakeholder_intake_sessions` should be indexed (`unique` on `intake_token`).
- All `*_at` timestamps are `timestamptz`, defaulting to `now()`. `updated_at` is maintained by a single shared trigger.

The data model deliberately stays close to the existing TypeScript types so the query layer is a thin translation, not a re-architecture.
