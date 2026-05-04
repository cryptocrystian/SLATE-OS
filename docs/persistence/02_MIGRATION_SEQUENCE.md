# SLATE Persistence Migration Sequence

This document defines the order in which the existing mock data is replaced with real persistence. Each step is independently shippable, includes acceptance criteria, and preserves the UI surface unchanged.

> **Principle.** One step lands at a time. Every step ends with `npm run lint` clean, `npm run build` clean, and the visual UX audit protocol passing on the affected routes.

---

## Step 0 — Supabase Setup + Env Scaffolding

**Goal.** Stand up a Supabase project and the local-dev environment scaffolding without touching any existing route.

**Routes affected.** None. This is plumbing.

**Tables introduced.** None.

**Mock data replaced.** None.

**Work.**
- Create Supabase project (one prod, one preview).
- Add `@supabase/supabase-js` and `@supabase/ssr` to `package.json`.
- Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (and the deployment env), keep service role server-side only.
- Add `lib/supabase/server.ts` (server client factory) and `lib/supabase/browser.ts` (browser client factory). No usage yet.
- Add a `supabase/` directory at the repo root for migrations and seed scripts; first migration is empty.
- Update `.gitignore` to cover Supabase local artifacts (`supabase/.branches`, `supabase/.temp`).
- Update `.editorconfig` if needed for `.sql` files.

**Acceptance criteria.**
- `npm run build` still clean.
- `lib/supabase/{server,browser}.ts` exist but are not yet imported by any route.
- A local `supabase status` (or equivalent) connects to the project.

**Risks.** Lockfile churn. Verify no transitive dependency conflicts with Next.js 14.

---

## Step 1 — Auth Shell + Operator Login

**Goal.** Put a real signed-in operator behind every `/app/*` route.

**Routes affected.** New: `/login`. Modified: every page under `/app/*` (server-side guard only; component code unchanged).

**Tables introduced.** `profiles` (linked 1:1 with `auth.users`).

**Mock data replaced.** The hard-coded "M. Reyes / J. Okafor / A. Lin" strings in `lib/engagements/mock-engagements.ts` and the user identity tile in `SidebarNav` start reading from `profiles`.

**Work.**
- Migration: `profiles` table + trigger to upsert a `profile` row when a `auth.users` row is created.
- Add `app/login/page.tsx` (email + magic link via Supabase Auth UI or a minimal custom form).
- Add `app/auth/callback/route.ts` for the magic-link exchange.
- Add `middleware.ts` that protects `/app/*` and redirects to `/login` when no session.
- Update `SidebarNav` user tile to read the current operator's display name from `profiles` via a server component / loader.
- Seed three operator profiles (M. Reyes, J. Okafor, A. Lin) on first deploy so existing engagement owner strings still match.

**Acceptance criteria.**
- Anonymous request to `/app` redirects to `/login`.
- After magic-link auth, `/app` renders normally with the correct operator name in the sidebar.
- Public routes (`/scorecard*`, `/apply/*`) remain anonymous.

**Risks.** Middleware mis-scoping (e.g. accidentally guarding `/scorecard`). Test with both anonymous and authenticated sessions.

---

## Step 2 — Scorecard Submission Persistence

**Goal.** Replace the localStorage-only scorecard with a real submission that writes a `scorecard_submission` and a `lead`.

**Routes affected.** `/scorecard/start` (submit on completion), `/scorecard/results` (read by submission id).

**Tables introduced.** `workspaces` (singleton seed), `accounts` (created on submit if not present), `contacts` (created on submit if not present), `leads`, `lead_fit_dimensions`, `lead_qualification_signals`, `scorecard_submissions`, `scorecard_answers`.

**Mock data replaced.** `lib/scorecard/storage.ts` becomes a *resume buffer only* (the localStorage key still exists for in-progress drafts). Actual submission persists to the database.

**Work.**
- Migrations for the seven tables above.
- Server-side submit endpoint (`app/api/scorecard/submit/route.ts` or a server action) that:
  - Validates payload
  - Re-runs `lib/scorecard/scoring.ts` server-side (no client-side scoring trust)
  - Inserts `scorecard_submission` + N `scorecard_answers`
  - Looks up or inserts `account` (by `submitted_company` exact match for v1)
  - Looks up or inserts `contact` (by `submitted_email`)
  - Inserts `lead` with `submission_id` and the computed `internal_fit_score` + six `lead_fit_dimensions`
  - Returns `{ submission_id }` for the redirect to `/scorecard/results?submission=<id>`
- Update `/scorecard/results` to read by `submission` query param (server-rendered) when present, falling back to localStorage when absent (resume-buffer case).
- Drop or version the localStorage key once submitted.

**Acceptance criteria.**
- Completing the scorecard creates a real submission + lead row.
- `/scorecard/results?submission=<id>` renders the result from the database, not localStorage.
- Internal Saipien Fit Score is computed but not present in any public response.
- Returning to `/scorecard/start` mid-flow still resumes from localStorage.

**Risks.** Idempotency on duplicate submits. Use a client-generated `submission_uuid` and ON CONFLICT DO NOTHING.

---

## Step 3 — Lead Inbox + Lead Detail

**Goal.** `/app/leads` and `/app/leads/[id]` read from the database.

**Routes affected.** `/app/leads`, `/app/leads/[id]`.

**Tables introduced.** None new (same set as Step 2).

**Mock data replaced.** `MOCK_LEADS` in `lib/leads/mock-leads.ts` is deleted; replaced by `lib/leads/queries.ts` (`getAllLeads`, `getLeadById`).

**Work.**
- Build `lib/leads/queries.ts` returning the same `Lead` shape.
- Run a one-shot `seed_leads.sql` script that materializes the existing six mock leads as real rows so existing demo paths still resolve. This is the one place where the seed script does meaningful work — every other domain seeds from upstream.
- Replace mock import in `app/app/leads/page.tsx` and `app/app/leads/[id]/page.tsx`.
- `LeadActionsPanel`'s `engagementForLead(leadId)` becomes a real query.
- Filter state stays local-only for now; surfacing in URL params is a follow-up.

**Acceptance criteria.**
- The six seeded leads still render exactly as the screenshots show today.
- A new scorecard submission appears on `/app/leads` immediately.
- The internal fit score on lead detail matches the value computed at submission time.

**Risks.** Seed data drift between the mock file and the seed script. Generate the seed SQL from the mock file in a one-shot script during this step; commit the SQL but archive the TS mock.

---

## Step 4 — Engagement Creation + Engagement Detail

**Goal.** `/app/engagements*` reads from the database, including the six derived panel-status records.

**Routes affected.** `/app/engagements`, `/app/engagements/[id]`. The "Start AI Opportunity Sprint" button on `/app/leads/[id]` becomes a real engagement-creation action (still scoped to the trusted operator).

**Tables introduced.** `engagements`. Postgres view: `engagement_panel_status_v` (derived columns from intake / documents / findings / opportunities / report_sections / proposals — most of which are still empty at this step).

**Mock data replaced.** `MOCK_ENGAGEMENTS` in `lib/engagements/mock-engagements.ts` deleted. Replaced by `lib/engagements/queries.ts`.

**Work.**
- Migration for `engagements`.
- Seed the existing five mock engagements from the mock file.
- Server action `createEngagementFromLead(leadId)` that creates an `engagement` row tied to the lead's account, sets `linked_lead_id`, snapshots scorecard summary, sets `current_stage = 'setup'`. Updates the lead's `status` to `converted` in the same txn.
- `EngagementContextCard`'s "View source lead" link continues to work via `linked_lead_id`.

**Acceptance criteria.**
- Clicking "Start AI Opportunity Sprint" on a lead with no existing engagement creates one and routes to `/app/engagements/<new-id>`.
- The engagement detail page renders all six panel-status cards from real data (zero counts on the new engagement, populated counts on the seeded ones).
- Recommended-action helper continues to route correctly per stage.

**Risks.** The derived-view query needs to be cheap. If it isn't, materialize a denormalized status block per engagement and refresh on writes.

---

## Step 5 — Stakeholder Intake + Documents

**Goal.** `/app/engagements/[id]/intake` reads/writes real stakeholders, responses, and document metadata. New public route `/intake/[token]` lets stakeholders submit their own intake.

**Routes affected.** `/app/engagements/[id]/intake` (operator-side), `/intake/[token]` (new, public token-gated), `/upload/[token]` (optional companion for document upload).

**Tables introduced.** `stakeholder_intake_sessions`, `stakeholder_responses`, `documents`. Supabase Storage bucket `engagement-documents`.

**Mock data replaced.** `lib/intake/mock-intake.ts` deleted. `lib/intake/queries.ts` returns the same shapes.

**Work.**
- Migrations for the three tables + Storage bucket.
- Server action `createStakeholderSession(engagementId, role, title, contactId?)` that mints a token.
- Operator UI on `/intake` gets an "Invite" button per stakeholder that displays the generated token URL (operator copies and sends out-of-band; real email comes later).
- Public route `/intake/[token]` renders a minimal `PublicAssessmentShell` with the intake question flow scoped to the session's role.
- Stakeholder submit writes `stakeholder_responses` rows + updates `session.status` / `completion_percent` / `last_activity_at`.
- Document upload (operator or stakeholder) writes to Supabase Storage and inserts a `documents` row.

**Acceptance criteria.**
- An operator can mint a stakeholder invite, copy the token URL, complete it as the stakeholder, and see the response back in `/app/engagements/[id]/intake`.
- A stakeholder loading an invalid or revoked token sees an honest "This invite is no longer active" page, not a crash.
- Documents uploaded by stakeholders appear with the correct `linked_role` and `evidence_quality: 'unverified'` until an operator reviews.

**Risks.** Token leakage. Confirm tokens never appear in client-side JS or in URL referrers leaving the public scorecard.

---

## Step 6 — Findings

**Goal.** `/app/engagements/[id]/findings` reads/writes real findings + source refs. Mock review actions become real writes.

**Routes affected.** `/app/engagements/[id]/findings`. Engagement panel status updates (derived view).

**Tables introduced.** `findings`, `finding_source_refs`.

**Mock data replaced.** `lib/findings/mock-findings.ts` deleted.

**Work.**
- Migrations.
- Server actions: `approveFinding`, `editFinding`, `rejectFinding`, `regenerateFinding` (regenerate is mock — it just re-stamps `aiDrafted` for now), `addReviewerNote`.
- `FindingsWorkspace`'s mock review action bar wires to the real actions; UI feedback for in-flight states.
- Source refs that link to a real `stakeholder_response` / `document` / `scorecard_answer` populate the typed FK; otherwise display strings only (back-compat with seeded findings).

**Acceptance criteria.**
- Approving a finding updates `review_status = 'approved'` + `reviewed_by` + `reviewed_at`, and the change is reflected on the engagement detail page's Findings panel count.
- The right-pane Evidence panel still resolves source refs by id.

**Risks.** Concurrency — two operators reviewing the same finding. Acceptable for v1 (single-operator concurrency assumed); revisit with realtime if needed.

---

## Step 7 — Opportunities + Roadmap

**Goal.** Opportunity matrix and 30/60/90 roadmap read/write real data.

**Routes affected.** `/app/engagements/[id]/opportunities`, `/app/engagements/[id]/roadmap`.

**Tables introduced.** `opportunities`, `opportunity_finding_links`, `roadmap_items`.

**Mock data replaced.** `lib/opportunities/mock-opportunities.ts`, `lib/roadmap/mock-roadmap.ts`.

**Work.**
- Migrations.
- Server actions for opportunity create/update/score and roadmap item create/update/sequence.
- `OpportunitiesWorkspace` filter state can move into URL search params here as a quality-of-life improvement (reviewer can share a link to a specific quadrant).

**Acceptance criteria.**
- Creating a finding → promoting it to an opportunity → adding it to the roadmap is a real persisted flow.
- The matrix's quadrant placement is computed via `computeQuadrant(impact, complexity)` server-side and stored on `opportunities.quadrant` so listing queries stay simple.

**Risks.** Drag-drop reordering. Out of scope for v1 — sequencing remains the seed order or a manual `position` field.

---

## Step 8 — Reports + Proposals

**Goal.** Report builder and proposal builder read/write real data.

**Routes affected.** `/app/engagements/[id]/report`, `/app/engagements/[id]/proposal`.

**Tables introduced.** `reports`, `report_sections`, `report_section_finding_links`, `report_section_opportunity_links`, `report_section_roadmap_links`, `proposals`, `proposal_options`, `proposal_option_opportunity_links`, `proposal_option_roadmap_links`.

**Mock data replaced.** `lib/reports/mock-reports.ts`, `lib/proposals/mock-proposals.ts`.

**Work.**
- Migrations.
- `createReport(engagementId)` server action that scaffolds the 12 canonical sections in `not_started`.
- `createProposal(engagementId)` server action that scaffolds three default options (Quick-Win Build, AI Workflow System, Managed AI Partner) in `draft`.
- Section + option mock review actions become real writes.
- Locked CTAs (`Export Report`, `Prepare SOW Draft`, `Send to Client`, `Prepare Client Review`) **remain locked**. They wait for a separate export workstream.
- Report's `Open Proposal Builder` threshold (≥50% approved) becomes a derived condition.

**Acceptance criteria.**
- The Caldera demo path (12 final sections, 3 proposal options, AI Workflow System recommended) persists to the database with the same content the mock file currently shows.
- Approving a report section updates `status = 'approved'` and the engagement detail's Report panel counts.

**Risks.** None significant. This is a thicker schema but follows the same pattern as findings/opportunities.

---

## Step 9 — Activity Events + Notes

**Goal.** Cross-engagement activity timeline and operator notes are real.

**Routes affected.** `/app` Command Center (RecentActivityPanel), notes panels on lead / engagement / finding / report-section detail.

**Tables introduced.** `notes`, `activity_events`.

**Mock data replaced.** Activity entries in `lib/mock-data.ts` deleted.

**Work.**
- Migrations.
- Postgres triggers (or app-layer writes) on the major tables (leads, engagements, findings, opportunities, reports, proposals, scorecard_submissions) that emit an `activity_event` for the `RecentActivityPanel`.
- Notes panels everywhere wire to a single `<NotesPanel subjectTable="…" subjectId="…" />` component (already structurally aligned with the polymorphic `notes` table).

**Acceptance criteria.**
- The Command Center's Recent Activity panel shows the last 10 real events across the workspace.
- Notes added on lead detail or engagement detail persist and re-appear after refresh.

**Risks.** Trigger explosion if every column update creates an event. Limit event emission to status-change events and creation events.

---

## Step 10 — File / Document Binary Storage

**Goal.** Document upload and download are real.

**Routes affected.** `/intake/[token]` (stakeholder upload), `/app/engagements/[id]/intake` (operator review + upload).

**Tables introduced.** None new (uses `documents` from Step 5).

**Mock data replaced.** `documents.storage_path` becomes populated.

**Work.**
- Supabase Storage bucket `engagement-documents` with bucket-level policies mirroring the `documents` table RLS.
- Signed-URL generation server-side for download.
- `SupportingInputsPanel` adds a download affordance for documents with a `storage_path`.

**Acceptance criteria.**
- A stakeholder can upload a document via their token URL; an operator can download it from `/app/engagements/[id]/intake`.
- Documents without a `storage_path` continue to render as "Requested but not received."

**Risks.** Storage-policy gaps. Mirror the `documents` table RLS exactly in the bucket policy and test with stakeholder + operator + anonymous principals.

---

## Step 11 (Optional / Post-Persistence) — Export Placeholder Activation

**Goal.** Wire the locked `Export Report` / `Prepare SOW Draft` / `Send to Client` actions to a server-rendered preview (HTML), still not a true PDF. PDF generation is a later workstream.

**Routes affected.** `/app/engagements/[id]/report`, `/app/engagements/[id]/proposal`.

**Tables introduced.** None.

**Mock data replaced.** Export status moves from `preview-only` to a real preview URL.

**Work.** Out of scope for the persistence sprint proper. Keep the locked buttons locked until this step is explicitly scoped.

---

## Cross-Cutting Acceptance Criteria

In addition to per-step criteria, the persistence workstream is complete when:

- Anonymous request to any `/app/*` route redirects to `/login`.
- Public scorecard `/scorecard*` routes work without auth.
- Stakeholder `/intake/[token]` route works only with a valid token.
- All eight criteria from `00_PERSISTENCE_AUTH_CANON.md` are met.
- The visual UX audit protocol passes against the persisted Quanta and Caldera demo paths.
- The MVP acceptance audit can be re-run and re-pass against the persisted product.
