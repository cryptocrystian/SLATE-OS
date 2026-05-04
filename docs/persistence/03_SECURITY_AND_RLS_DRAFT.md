# SLATE Security + RLS Draft

This document defines the access posture for the persisted SLATE. It is the source of truth for which routes are public, which require operator auth, which require a stakeholder token, and which RLS policies enforce each boundary.

> **Principles.**
> - Default deny. Every table starts with RLS enabled and no policy; only the policies in this doc are added.
> - The service-role key never reaches the browser bundle.
> - The `anon` key is OK in the browser; it has read-only `auth` scope by default and no app-table grants beyond what RLS allows.
> - Public scorecard writes go through a server endpoint that uses the service-role key. Clients post payloads, the server inserts.
> - Stakeholder tokens authenticate via a single `set_token(token)` Postgres function called server-side at the start of every stakeholder request.

---

## Route Posture

### Public routes — anonymous-allowed

| Route | Auth | Tables touched | Notes |
| --- | --- | --- | --- |
| `/scorecard` | none | none | static |
| `/scorecard/start` | none | `scorecard_submissions`, `scorecard_answers`, `accounts`, `contacts`, `leads`, `lead_fit_dimensions` (all via server endpoint) | server endpoint uses service role; client never holds it |
| `/scorecard/results` | none | `scorecard_submissions` (read-back, server-rendered, scoped to `submission_id` query param + a short-lived single-use cookie or signed URL) | result page never returns `internal_fit_score` |
| `/apply/ai-systems-review` | none | none | static stub |

### Stakeholder routes — token-gated

| Route | Auth | Tables touched | Notes |
| --- | --- | --- | --- |
| `/intake/[token]` | stakeholder token (server-validated) | `stakeholder_intake_sessions`, `stakeholder_responses`, `documents` | scoped to the session that owns the token |
| `/upload/[token]` | stakeholder token | `documents` + Storage upload | same scope as `/intake/[token]` |

### Internal routes — operator-authenticated

Every route under `/app/*` requires an authenticated Supabase session. Middleware redirects to `/login` otherwise.

| Route | Auth | Tables touched |
| --- | --- | --- |
| `/login`, `/auth/callback` | anonymous (auth flow) | `auth.users`, `profiles` (trigger upsert) |
| `/app` | operator | `leads`, `engagements`, `findings`, `report_sections`, `proposals`, `proposal_options`, `activity_events` (read aggregates) |
| `/app/leads`, `/app/leads/[id]` | operator | `leads`, `lead_fit_dimensions`, `lead_qualification_signals`, `accounts`, `contacts`, `notes` |
| `/app/engagements`, `/app/engagements/[id]` | operator | `engagements` + `engagement_panel_status_v` view |
| `/app/engagements/[id]/intake` | operator | `stakeholder_intake_sessions`, `stakeholder_responses`, `documents` |
| `/app/engagements/[id]/findings` | operator | `findings`, `finding_source_refs` |
| `/app/engagements/[id]/opportunities` | operator | `opportunities`, `opportunity_finding_links` |
| `/app/engagements/[id]/roadmap` | operator | `roadmap_items` |
| `/app/engagements/[id]/report` | operator | `reports`, `report_sections`, `report_section_*_links` |
| `/app/engagements/[id]/proposal` | operator | `proposals`, `proposal_options`, `proposal_option_*_links` |

### Service-role-only operations

These run server-side and never via RLS:

- Public scorecard submission (scoring + insert + lead creation in one transaction)
- Stakeholder invite minting (generates the `intake_token`, returns it to the operator)
- Activity event emission triggered by status changes
- Storage signed-URL generation for document download
- Daily token expiration sweep (if introduced later)

---

## RLS Principles

For every table:

1. **Enable RLS.** `ALTER TABLE … ENABLE ROW LEVEL SECURITY;`
2. **Write the operator policy first.** Operators (any authenticated `auth.users`) can read/write workspace-scoped rows.
3. **Write the stakeholder policy second** for the four tables a stakeholder can touch (`stakeholder_intake_sessions`, `stakeholder_responses`, `documents`, optionally `notes` if stakeholder-side notes are ever introduced).
4. **Never write a public-anon policy** other than on `scorecard_submissions` / `scorecard_answers` (insert-only, see below). All other public access flows through server-side service-role endpoints.

---

## Per-Table Policy Sketches

> Pseudo-SQL — finalized at implementation time. Workspace-scoping uses `workspace_id = (select id from workspaces limit 1)` for v1 (single workspace).

### `profiles`

```sql
-- read: any authenticated operator
create policy profiles_read on profiles
  for select
  to authenticated
  using (true);

-- update: only the user themselves
create policy profiles_self_update on profiles
  for update
  to authenticated
  using (id = auth.uid());
```

### `accounts`, `contacts`, `leads`, `lead_fit_dimensions`, `lead_qualification_signals`, `engagements`, `findings`, `finding_source_refs`, `opportunities`, `opportunity_finding_links`, `roadmap_items`, `reports`, `report_sections`, `report_section_*_links`, `proposals`, `proposal_options`, `proposal_option_*_links`, `notes`, `activity_events`

```sql
-- read+write: any authenticated operator (workspace-scoped)
create policy operator_full on <table>
  for all
  to authenticated
  using (workspace_id = (select id from workspaces limit 1))
  with check (workspace_id = (select id from workspaces limit 1));
```

For tables without a direct `workspace_id` column (join tables, `lead_*`, `report_section_*`, `proposal_option_*`, `finding_source_refs`), the policy joins to the parent's `workspace_id` via `EXISTS`.

### `scorecard_submissions`

```sql
-- public can insert (server endpoint actually performs the write with service role,
-- but having an explicit insert policy lets us verify the boundary is correct)
create policy scorecard_public_insert on scorecard_submissions
  for insert
  to anon
  with check (
    -- guardrails on the payload shape, e.g. submitted fields are present
    submitted_email is not null
    and length(submitted_company) > 0
  );

-- anonymous can read only their own submission, only by id, and only the
-- prospect-facing columns. We enforce this at the API layer, not RLS:
-- the result page reads via a server route that selects an explicit
-- column list excluding internal_fit_score.
-- RLS therefore allows no anon select. Operators read all.
create policy scorecard_operator_read on scorecard_submissions
  for select
  to authenticated
  using (true);
```

The result page intentionally relies on an API-layer column-list filter rather than column-level RLS. `internal_fit_score` is never selected for an anonymous request.

### `scorecard_answers`

```sql
-- public can insert (paired with a submission insert in the server transaction)
create policy scorecard_answers_public_insert on scorecard_answers
  for insert
  to anon
  with check (true);

-- only operators read
create policy scorecard_answers_operator_read on scorecard_answers
  for select
  to authenticated
  using (true);
```

### `stakeholder_intake_sessions`

```sql
-- operator full access
create policy session_operator_full on stakeholder_intake_sessions
  for all
  to authenticated
  using (true)
  with check (true);

-- stakeholder can read+update only their own session, only via the token
create policy session_stakeholder_self on stakeholder_intake_sessions
  for select using (
    intake_token = current_setting('stakeholder.token', true)
    and (token_expires_at is null or token_expires_at > now())
    and token_revoked_at is null
  );

create policy session_stakeholder_update on stakeholder_intake_sessions
  for update using (
    intake_token = current_setting('stakeholder.token', true)
    and (token_expires_at is null or token_expires_at > now())
    and token_revoked_at is null
  )
  with check (
    intake_token = current_setting('stakeholder.token', true)
  );
```

The stakeholder server endpoint calls `select set_config('stakeholder.token', $1, true)` at the start of each request. The session is local to the request.

### `stakeholder_responses`

```sql
-- operator full
create policy responses_operator_full on stakeholder_responses
  for all to authenticated using (true) with check (true);

-- stakeholder can insert/update/select only their own responses
create policy responses_stakeholder_self on stakeholder_responses
  for all
  using (exists (
    select 1 from stakeholder_intake_sessions s
    where s.id = stakeholder_responses.session_id
      and s.intake_token = current_setting('stakeholder.token', true)
      and (s.token_expires_at is null or s.token_expires_at > now())
      and s.token_revoked_at is null
  ))
  with check (exists (
    select 1 from stakeholder_intake_sessions s
    where s.id = stakeholder_responses.session_id
      and s.intake_token = current_setting('stakeholder.token', true)
  ));
```

### `documents`

```sql
-- operator full
create policy docs_operator_full on documents
  for all to authenticated using (true) with check (true);

-- stakeholder can insert+select+update only documents tied to their own session
create policy docs_stakeholder_self on documents
  for all
  using (
    session_id is not null
    and exists (
      select 1 from stakeholder_intake_sessions s
      where s.id = documents.session_id
        and s.intake_token = current_setting('stakeholder.token', true)
        and (s.token_expires_at is null or s.token_expires_at > now())
        and s.token_revoked_at is null
    )
  )
  with check (
    session_id is not null
    and exists (
      select 1 from stakeholder_intake_sessions s
      where s.id = documents.session_id
        and s.intake_token = current_setting('stakeholder.token', true)
    )
  );
```

Storage bucket `engagement-documents` carries an analogous policy that mirrors this `documents`-table policy.

---

## Public Scorecard Submission Policy

The free scorecard remains directional and the internal fit score remains operator-only. Mechanism:

1. The browser posts the answers payload to a Next.js Route Handler at `/api/scorecard/submit`.
2. The Route Handler runs server-side with the service-role key.
3. The handler validates the payload, runs `lib/scorecard/scoring.ts` (server side), inserts `scorecard_submission` + `scorecard_answers` + `account` (upsert) + `contact` (upsert) + `lead` + `lead_fit_dimensions` in a single transaction.
4. The handler returns `{ submission_id }` and a short-lived signed cookie (or the same in a redirect URL fragment) so `/scorecard/results?submission=<id>` can read back the prospect-facing columns.
5. `/scorecard/results` is **server-rendered**. It selects an explicit column list from `scorecard_submissions` that excludes `internal_fit_score`. The internal score never leaves the server.

If a malicious client tries to read `internal_fit_score` via `supabase-js` directly: the operator-only RLS policy on `scorecard_submissions` denies the read.

If a malicious client posts a forged `internal_fit_score`: the server endpoint ignores client-supplied scoring and recomputes from `scorecard_answers`.

---

## Stakeholder Intake Token Policy

Tokens are opaque random strings (32 bytes, base64url). Properties:

- Stored in `stakeholder_intake_sessions.intake_token` with a unique index.
- `token_expires_at` defaults to `engagement.target_date + interval '14 days'`.
- `token_revoked_at` is set when an operator manually revokes a stakeholder invite.
- Each stakeholder server request calls `select set_config('stakeholder.token', $1, true)` to scope subsequent reads/writes.
- Tokens never appear in client-side JS bundles or in URL query strings sent off-domain (`/intake/[token]` is a path segment, not a query param, so the Referer header doesn't leak it; HTTPS hides it from network observers).
- Token rotation: regenerating an invite revokes the old `intake_token` (sets `token_revoked_at`) and issues a new one.

---

## Internal Operator Policy

- One Saipien Labs workspace. Every authenticated operator can read/write workspace-scoped rows.
- Operator deletes are intentionally not exposed in v1. Status changes (`status = 'rejected'`, `revoked_at`) are the soft-delete pattern.
- Audit trail is `activity_events` + `notes`. Mutations to canonical records (lead status, finding status, report-section status) emit activity events.

---

## Document Metadata Policy

- Metadata in `documents` follows the operator/stakeholder pattern above.
- Binary storage in `engagement-documents` Supabase Storage bucket follows an equivalent bucket policy:

```sql
-- bucket: engagement-documents
-- policy: operator_full
( authenticated session exists )

-- policy: stakeholder_self
( bucket prefix matches a `documents` row whose `session_id` matches the
  current stakeholder token )
```

Signed URLs for download are minted server-side by an operator endpoint or a stakeholder endpoint scoped to the same session. URLs expire in 5 minutes.

---

## Audit / Activity Event Policy

- `activity_events` is operator-readable (workspace-scoped) and write-only via triggers / server actions.
- Operators do not write events directly via the client.
- The Recent Activity panel queries the latest 10 events ordered by `at desc`.
- Events emitted by stakeholder writes (e.g. "Sora Tanaka submitted intake response") have `actor_id = null` and `actor_label = '<contact_name> · <role>'`.

---

## What Not To Expose Client-Side

The following must never appear in a client bundle, in a client-side response, or in a network response readable by an anonymous principal:

- `SUPABASE_SERVICE_ROLE_KEY`
- `scorecard_submissions.internal_fit_score`
- Any `lead_fit_dimensions` or `lead_qualification_signals` rows
- Any operator-side recommended action `cta` text on a public surface
- Any `stakeholder_intake_sessions.intake_token` belonging to another stakeholder
- Any `documents.storage_path` belonging to another stakeholder's session
- Any draft `report_sections` content prior to operator approval (the report builder is operator-only — public principals cannot reach `/app/*` at all, but this also rules out reusing the same query layer on a future public client portal without a column filter)

---

## What Stays Future / Out of Scope

- Multi-workspace tenancy (RLS would change to `workspace_id = current_setting('app.workspace_id')` style; trivial to retrofit, deliberately out of v1)
- Granular operator roles (founder vs. strategist vs. delivery lead — adds a `profiles.role` column and a `case … end` in the operator policies; deferred)
- Public client portal (would introduce a new `client_user` principal with RLS on a per-account basis)
- BuildOps surfaces and policies — explicit non-goal of this canon
- Realtime subscriptions (Supabase realtime is supported on the data model but not enabled in v1; reads happen on navigation)
- Service-account API keys for external integrations (HubSpot, etc.) — not in scope

This document is the boundary. Any future expansion (multi-workspace, granular roles, client portal, BuildOps) must be scoped as its own decision-log entry and either extend or replace these policies explicitly.
