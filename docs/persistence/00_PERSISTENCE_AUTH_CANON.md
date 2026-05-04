# SLATE Persistence + Auth Canon

This document is the source of truth for how SLATE moves from a feature-complete mock-data MVP into a real persisted, authenticated operating system. It does not introduce new product scope. It defines the persistence and auth posture, the boundaries around it, and the principles that govern the migration.

> **Status.** Architecture canon. No code is implemented yet. The first implementation sprint follows this canon.

---

## Persistence Goals

1. **Replace seeded mock data, route by route, without redesigning the UI.** Every component in `components/` should keep working as-is once its data source switches from `lib/<domain>/mock-*.ts` to a server fetch.
2. **Make the lifecycle live.** Scorecard completions become real `Lead`s; leads convert into real `Engagement`s; intake responses, findings, opportunities, roadmap items, reports, and proposals all become real persisted records that survive a refresh and a session.
3. **Preserve evidence traceability end-to-end.** The trail `Stakeholder response → Finding → Opportunity → Roadmap → Report → Proposal` becomes foreign-key relationships in the database. The reviewer's ability to follow recommendations back to source evidence is non-negotiable.
4. **Keep the public-vs-internal boundary intact.** The free scorecard remains directional and never reveals the internal Saipien Fit Score. Stakeholder intake remains lightweight and tokenized. Operator surfaces remain operator-only.
5. **Optimize for the seven existing routes.** Every persistence decision should answer "does this make `/app/leads`, `/app/engagements/[id]/*`, and the public scorecard easier or harder to operate?"

## Auth Goals

1. **One trusted-operator role for the Saipien Labs team.** No granular RBAC in the first persistence sprint. Every authenticated session is an operator who can read and write across the internal app.
2. **Public scorecard is anonymous-write, never-read.** No login required to submit; nothing the public can read about other prospects.
3. **Stakeholder intake is token-gated.** Each stakeholder receives a one-time tokenized link that grants read-write access to *their own* intake session and document upload — never to other stakeholders, never to the operator surface.
4. **No auth UI redesign.** The internal app's existing chrome (`AppShell`, `SidebarNav`, `TopBar`) gets a real signed-in user identity behind it; the existing user identity tile in the sidebar is the single point of identity surfacing.
5. **No SSO, no OAuth providers in v1.** Email + magic link or email + password — whichever Supabase Auth supports cleanly with the least UX surface.

## Operator Roles

For the first persistence sprint, exactly two principals exist:

| Principal | Auth | Scope |
| --- | --- | --- |
| **Operator** | Authenticated Saipien Labs team member | Read/write across internal app (`/app/*`). Service role for cross-engagement reads. |
| **Stakeholder** | Tokenized link, no account | Read/write only their own intake session, their own uploaded document metadata. |

Granular operator roles (founder vs. strategist vs. delivery lead) and a separate client-portal principal are explicit non-goals for the first persistence sprint. They will be considered after persistence lands.

## Public Scorecard Submission Model

The public scorecard remains anonymous-write:

- A scorecard submission is a single insert into `scorecard_submissions` plus N inserts into `scorecard_answers`.
- The submission is server-computed: prospect-facing scores (AI Readiness / Workflow Friction / Systems Readiness), the classification, the opportunity-area shortlist, and the risk notes are derived server-side from the answers, not trusted from the client.
- The internal Saipien Fit Score is computed at submission time, stored on the row, but **never** returned in any public-facing API response. It is read only by the operator-side `/app/leads` route.
- Submission writes via a Supabase Edge Function (or Next.js Route Handler with the service-role key) so the client never holds the service role.
- `localStorage` (`slate.scorecard.v1`) becomes a *resume buffer* only — the source of truth is the submitted row. Once a submission lands, the localStorage buffer can be cleared.
- Every submission also writes a `lead` row in the same transaction so the public-to-internal handoff is atomic.

## Stakeholder Intake Token Model

Each stakeholder invitation produces a `stakeholder_intake_session` with a one-time token:

- The token is a cryptographically random opaque string (not a JWT).
- The token grants read/write access to:
  - The session's own row (`status`, `completion_percent`, `last_activity_at`, `summary`)
  - The session's own `stakeholder_response` rows
  - Document metadata uploaded under that session's own `documents` rows (no cross-stakeholder document reads)
- Tokens have an `expires_at` (default: engagement target date + 14 days) and can be `revoked_at` by an operator.
- Tokens authenticate via a single `stakeholder.auth.set_token(token)` Postgres function that sets a session-local config; RLS reads it back via `current_setting`.
- The public route is `/intake/[token]` (canon, not yet implemented). Token validation happens server-side; the route is server-rendered to keep the token out of the client bundle.

## Data Ownership Model

Two-layer ownership:

- **Workspace-level.** Every internal record belongs to the single Saipien Labs workspace. Operators in that workspace can read everything inside it.
- **Stakeholder-level.** Stakeholder sessions, responses, and documents are owned by the stakeholder via their token. Operators in the workspace can read all of them; the stakeholder can only read their own.

This is intentionally simpler than per-account ACLs. Saipien Labs is a single trusted operator org for the first persistence sprint.

## Mock-to-Real Migration Principle

Every existing `lib/<domain>/mock-*.ts` file is the contract for the real data layer. The principle:

> **The component imports keep their shape. The fetch function changes underneath.**

For each domain:

1. Create the table(s) per `01_DATA_MODEL_DRAFT.md`.
2. Build a `lib/<domain>/db.ts` (or `lib/<domain>/queries.ts`) that returns the same shape the mock file currently exports.
3. Replace `import { MOCK_X } from "./mock-x"` with `import { getX } from "./queries"` *one route at a time*.
4. Once a route is fully on real data, delete the corresponding mock file and remove the `mock-` prefix from any test fixtures.

This keeps the UI surface stable and makes each migration step independently reviewable.

## Route-by-Route Persistence Sequence (Summary)

Full sequence in `02_MIGRATION_SEQUENCE.md`. Headline order:

1. Supabase setup + env scaffolding (no UI changes)
2. Auth shell + operator login
3. Public scorecard submission persistence
4. Lead inbox + lead detail persistence
5. Engagement creation + engagement detail persistence
6. Intake + stakeholders + documents persistence
7. Findings persistence
8. Opportunities + roadmap persistence
9. Reports + proposals persistence
10. Activity events + notes persistence
11. File / document binary storage (Supabase Storage)

## What Remains Mock For Now

Even after the persistence sprint completes, these surfaces stay deliberately mock:

- **AI synthesis itself.** The `Finding.aiDrafted` flag persists; the actual generation pipeline does not yet exist. AI-drafted findings continue to come from seeded data or operator-authored content until a separate AI workstream lands.
- **Production document export.** PDF generation, branded report rendering, and SOW export remain placeholders.
- **E-signature / SOW execution.** Locked CTAs (`Send to Client`, `Prepare SOW Draft`) remain locked.
- **Real email delivery.** Stakeholder invite emails are out of scope for the first persistence sprint; the token URLs are surfaced to the operator to deliver manually.
- **Billing / invoicing / payment collection.** Implementation credit remains a planning lever, not a transaction.
- **Real CRM integration.** No HubSpot, Salesforce, or external sync.

## Non-Goals

- Multi-workspace tenancy (one Saipien Labs workspace only)
- Granular operator roles (one operator role)
- Public client portal
- BuildOps surfaces
- StudioOps surfaces
- ClientOps surfaces
- Mobile native shell
- Light theme
- Rich-text editing for report sections (continues to render `draftPreview` as plain text)
- Realtime collaboration (single-operator concurrency assumed)
- Scheduled jobs / cron (out of scope; revisit when AI synthesis ships)

## BuildOps Non-Disruption

This canon explicitly does **not** introduce any BuildOps surfaces:

- No `builds`, `sprints`, `agent_sessions`, `repo_contexts`, or `deployments` tables
- No BuildOps RLS policies
- No BuildOps auth roles
- No BuildOps API surface
- No BuildOps documentation expansion

BuildOps remains documentation-only and ships as its own dedicated workstream after the persistence sprint signs off.

## Acceptance Criteria

The persistence + auth workstream is complete when:

1. An operator can sign in to `/app/*`.
2. A scorecard submission from `/scorecard/start` persists and appears as a real lead at `/app/leads` with the same scoring the mock currently shows.
3. An operator can convert a lead into an engagement and the engagement workspace populates from real data.
4. A stakeholder can complete an intake via a token-gated link and the operator sees their response inside `/app/engagements/[id]/intake`.
5. Approved findings become opportunities; opportunities become roadmap items; report and proposal pages render from the real persisted records.
6. Every page that exists today still renders without component-level code changes.
7. RLS policies are in place such that the public scorecard cannot read internal scores, stakeholder tokens cannot read each other, and unauthenticated requests cannot reach `/app/*` data.
8. The visual UX audit protocol passes against the persisted version of the demo paths (Quanta, Caldera).

If any of these eight criteria slip, the workstream is not done.
