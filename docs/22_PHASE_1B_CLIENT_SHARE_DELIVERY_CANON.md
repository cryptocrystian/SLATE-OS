# Phase 1B Client Share Delivery Canon

## Status

- **Date:** 2026-05-14.
- **Branch:** `persistence/step-0-1-auth-shell`.
- **Sprint scope:** **Sprint 4D-A — canon / decision only.** This document is documentation. No source code, schema, migration, API route, package, token-generation pipeline, public route, storage policy, email pipeline, CRM integration, PDF binary, e-signature, or AI synthesis change is created or modified by this sprint.
- **No implementation is authorized by this canon.** Implementation may begin only when the operator approves the recommendations in § Open Decisions / Operator Approval Needed, the prerequisite Sprint 4D-B / 4D-C / 4D-D scopes are explicitly opened, and (where applicable) downstream canons (storage policy, CRM, e-signature) have landed.
- **`Send to Client` remains locked** throughout Sprint 4D-A.
- **`Prepare SOW Draft` remains locked** throughout Sprint 4D-A.
- **`Prepare Client Review` remains locked** throughout Sprint 4D-A.
- **`Prepare Report` remains locked** throughout Sprint 4D-A.
- **Group-B exhibits remain excluded** from every client-bound surface. Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge stay confined to `/app/charts-preview` until `docs/14` / `docs/15` advance.
- **No public route / storage bucket / email pipeline / CRM integration code created.**
- **Audit references:** `docs/19_PHASE_1B_CLIENT_DELIVERY_CANON.md`, `docs/20_PHASE_1B_REPORT_PDF_CANDIDATE_CANON.md`, `docs/21_PHASE_1B_REPORT_PDF_CANDIDATE_ACCEPTANCE_AUDIT.md`, `docs/14`, `docs/15`, `artifacts/walkthroughs/sprint-4c-d-candidate-polish/notes.md`.

---

## Why This Exists

Sprint 4C-A through 4C-D shipped the operator-only report PDF candidate workflow: `report_delivery_snapshots` table (Sprint 4C-B), an operator-only `/app/engagements/[id]/report/pdf-candidate/[snapshotId]` route, the Generate PDF Candidate action with R2 readiness + claim-guard + stale acceptance, the Past Candidates panel, void snapshot affordance, and the snapshot-pure candidate document. **All of that is authenticated `/app/*` territory** — no client of the engagement has ever seen the artifact.

Client share / delivery is a fundamentally different boundary. Once SLATE emits a URL or artifact accessible outside the operator session, the surface inherits a new class of risks:

1. **Public access leakage.** A leaked URL is a perpetual public read of operator-internal content unless explicitly bounded by token + expiry + revocation.
2. **Token leakage.** Tokens forwarded in email, embedded in CRM, or quoted in chat behave like passwords — they must be one-way-hashed at rest, single-purpose, and revocable.
3. **Stale or voided snapshots.** The Sprint 4C-D void path solves operator-side audit cleanup; a client URL pointing at a now-voided snapshot must visibly stop serving content.
4. **Draft or non-approved content.** Sprint 4C-A canonized that `draft_watermark=true` snapshots are operator-only; a client share must enforce that boundary at link creation, not just at render.
5. **Unsupported financial / benchmark claims.** Group-B is excluded today; surfacing benchmark / financial language to a client without `docs/14` / `docs/15` Gate 1+ is a canon breach that compounds the moment the artifact leaves operator-only space.
6. **No revocation / audit trail.** Operator must be able to revoke a link in real time. Every access (or attempted access) must be loggable. Without that, the artifact is effectively permanent and untraceable.
7. **Raw asset URL exposure.** Internal `engagement-documents` signed URLs, internal route paths, operator-only deep links, and internal section/snapshot UUIDs must not enter the public artifact body.
8. **Accidental SOW / commercial-finality confusion.** Client review of an advisory report is not contract acceptance. The artifact must visibly say so. `docs/19` Locked Control Policy + `docs/20` claim-guard scan are the floor; this canon adds the client-bound footer rule.

This canon defines the contract before the code so future implementation agents have an unambiguous safety boundary. It is the prerequisite to Sprint 4D-B / 4D-C / 4D-D and is consumed by — but does not authorize — the eventual `Send to Client` unlock.

---

## Current Delivery Boundary

| Surface | State | Notes |
|---|---|---|
| `/app/engagements/[id]/report/pdf-candidate/[snapshotId]` | **Authenticated operator-only.** | `/app/*` middleware gates; persisted-UUID-only; `snapshot.engagementId === params.id` defense-in-depth. |
| `report_delivery_snapshots` (Supabase) | Metadata only. `status: candidate \| generated \| voided`, `delivery_surface: client_pdf_candidate \| internal_candidate`. | Workspace-scoped operator-full RLS. `artifact_*` columns reserved (always null today). |
| PDF binary | **Not stored** anywhere. | No bucket, no signed URLs for PDF artifacts. |
| Manual browser Save-as-PDF | Operator-controlled workflow. | The candidate route surfaces an operator hint pill with Ctrl-P / Cmd-P instructions. SLATE does not produce a binary. |
| SLATE-mediated client delivery | **Does not exist.** | No `app/api/share/*` route. No `app/share/*` route. No email send pipeline. No CRM integration. |
| Public share link | **Does not exist.** | No `share_tokens` / `report_share_tokens` table. No `/share/*` or `/r/*` route. |
| `Send to Client` `LockedActionButton` | Locked verbatim on `/app/engagements/[id]/proposal`. | Anti-pattern: never re-pointed at the candidate route. |
| `Prepare SOW Draft` `LockedActionButton` | Locked verbatim on `/app/engagements/[id]/proposal`. | |
| `Prepare Client Review` `LockedActionButton` | Locked verbatim (header chip on `/app/engagements/[id]/proposal`). | |
| `Prepare Report` `LockedActionButton` | Locked / state-driven via existing helper on `/app/engagements/[id]/roadmap`. | |
| Group-B exhibits | Confined to `/app/charts-preview`. | `omitted_exhibits` jsonb on snapshots always carries the canonical `group_b_block` confirmation entry. |
| Operator-only Past Candidates panel | Shipped Sprint 4C-D. Read + void only. | No share affordance. No client-facing label. |

---

## Delivery Surface Taxonomy

SLATE recognizes seven possible future delivery surfaces. Each carries a different risk profile and is gated by a different canon.

1. **Operator-only candidate route** — **shipped** (Sprint 4C-B/4C-D). `/app/engagements/[id]/report/pdf-candidate/[snapshotId]`. No client access. No further work.
2. **Operator-downloaded PDF artifact** — **possible manual workflow today.** Operator uses the browser's native Save-as-PDF on the candidate route. SLATE does not produce, store, or send the file. Operator is responsible for distribution. **Not Sprint 4D-B implementation scope.**
3. **Client share link** — **future, first Sprint 4D-B implementation candidate.** Public read-only HTML view of an immutable snapshot payload, gated by an opaque token. No file binary. No client interactivity. **Authorized by Sprint 4D-A only as the recommended first implementation surface; Sprint 4D-B opens the implementation scope.**
4. **Client download link** — **future, separate scope.** A client can download the artifact (PDF or HTML) directly. Requires a server-side rendering pipeline OR a stored binary + signed URL. **Not Sprint 4D-B/4D-C/4D-D scope.** Requires a separate canon if and when authorized.
5. **Email / CRM-mediated delivery** — **future, separate canon.** SLATE invokes an email or CRM API to push the artifact to a client. Requires both a delivery-channel canon and `Send to Client` unlock. **Not Sprint 4D-B/4D-C/4D-D scope.**
6. **Proposal / SOW delivery** — **separate canon (not yet authored).** Operates on the commercial leg of the engagement, governed by pricing placeholders, implementation credit framing, commercial-finality patterns. Tracked separately per `docs/19` § Proposed Sprint Sequence. **Not addressed by this canon.**
7. **E-signature** — **explicitly later.** Out of Phase 1B scope unless separately authorized. Requires the proposal-delivery canon to land first.

### Sprint 4D-B implementation recommendation (per § Sprint Sequence below)

**Surface 3 only** in Sprint 4D-B: client share link to a specific approved snapshot, no stored PDF binary, read-only web artifact. The artifact may be printed by the client via their own browser; SLATE does not produce or store a PDF.

Surfaces 4 and 5 are explicitly out of Sprint 4D-B / 4D-C / 4D-D scope. They require additional canons.

---

## Snapshot Eligibility Rules

A snapshot is **share-eligible** for client surface 3 (client share link) when **all** of the following are true. The first Sprint 4D-B implementation must enforce these at link creation time AND at link render time. Render-time enforcement is required because snapshot status can change between link creation and access (e.g., the operator voids the snapshot).

| Rule | Required for share-eligibility |
|---|---|
| `status` | Must be `candidate` or `generated`. **`voided` is never share-eligible.** |
| `delivery_surface` | Must be `client_pdf_candidate`. `internal_candidate` is never share-eligible. |
| `draft_watermark` | Must be `false`. Draft-watermarked snapshots are operator-only by canon (`docs/20` § Report Readiness Gate R2). |
| `claim_guard_result.passed` | Must be `true`. Any violation blocks eligibility. |
| Group-B exhibits | Must **not** appear in `exhibit_snapshot[]` with `renderedInArtifact: true`. Canonical `group_b_block` entry must appear in `omitted_exhibits` jsonb. |
| `docs/14` / `docs/15` gate state | Must remain at Gate 0 for Sprint 4D-B. Group-B inclusion requires Gate advancement + a separate wiring sprint. |
| Included section statuses | Every `sectionSnapshot[].includedInArtifact === true` entry must have `status` of `approved` or `final`. Drafted / needs-review / not-started cannot ship to a client. |
| Stale slots | `sourceSummarySnapshot.acceptedStaleSlots` should be empty for the first implementation. Operator-accepted stale slots block share-eligibility in Sprint 4D-B unless a future amendment explicitly permits client delivery with a visible stale warning. |
| Group-B omission appendix | Must be present in `omitted_exhibits[]` as `group_b_block` (machine-readable). The client artifact renders this as the canonical omission notice. |
| Snapshot age | Must not be older than a configurable `SHARE_MAX_AGE` (recommended default: **14 days**). Older snapshots require regeneration before share-link creation. |

### Default behavior summary

**Only non-voided, non-watermarked, claim-guard-passing snapshots whose included sections are all `approved`/`final` and whose `acceptedStaleSlots[]` is empty are share-eligible.** The first Sprint 4D-B implementation must default to this strict floor; any relaxation (e.g., allowing stale-accepted snapshots) is a future canon amendment, not a feature flag.

### Eligibility check placement

- **At link creation time:** the operator-only Generate Share Link action must evaluate all rules above against the snapshot row and refuse with an explicit error code when any rule fails. Failure should match the existing error vocabulary pattern (`'snapshot-voided'`, `'snapshot-watermarked'`, `'snapshot-stale'`, etc.).
- **At link render time:** the public route's server-side token lookup must re-evaluate every rule before rendering. A snapshot voided between link creation and access must render the safe revoked/expired state (see § Public Route Security).

---

## Token / Link Model

### Token format

- **Opaque random token** — not a JWT. JWT carries claims (workspace id, snapshot id) that, if leaked, reveal more than necessary. Opaque tokens lose nothing on inspection.
- **Entropy ≥ 128 bits**, preferred **256 bits**. Generated by Node's `crypto.randomBytes(32)` (or equivalent) and base-64-URL-encoded.
- **Stored hashed at rest.** The raw token is shown to the operator once (clipboard-copy affordance); the database stores `sha256(token)` only. A token leaked from the DB cannot be replayed.
- **Single-purpose.** Each token maps to exactly one `snapshot_id` + `workspace_id` + `engagement_id` + `report_id` (denormalized for fast lookup).
- **One-time-display UI semantics.** After link creation the operator must save the URL externally; SLATE never shows the raw token again. A new link requires a new token.

### Suggested public URL shape

**Recommended: `/r/[token]`.**

Alternatives considered: `/share/report/[token]`, `/share/[token]`, `/client/[token]`, `/report-share/[token]`.

Rationale for `/r/[token]`:
- Short — leaves the token as the dominant URL segment, no padding.
- Generic — doesn't hint at the artifact type (operator may later reuse the path shape for proposal share without canon change).
- No `share` in the path — avoids semantic baggage that could be confused with client-product `share` actions.
- Single-letter prefix is unambiguous when SLATE later adds other public token surfaces (e.g., `/i/[token]` for intake invites already uses a similar shape).

Final URL shape is in § Open Decisions; the canon recommends `/r/[token]` as default.

### Conceptual `report_share_tokens` table

**Not implemented in Sprint 4D-A.** Conceptual shape for Sprint 4D-B's migration to follow:

```sql
create table if not exists public.report_share_tokens (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspaces(id) on delete cascade,
  engagement_id            uuid not null references public.engagements(id) on delete cascade,
  report_id                uuid not null references public.reports(id) on delete cascade,
  snapshot_id              uuid not null references public.report_delivery_snapshots(id) on delete cascade,

  token_hash               text not null unique,
  status                   text not null default 'active'
    check (status in ('active','revoked','expired')),

  audience_label           text,
  recipient_email_hash     text,

  expires_at               timestamptz not null,

  created_by               uuid references auth.users(id) on delete set null,
  created_at               timestamptz not null default now(),

  revoked_at               timestamptz,
  revoked_by               uuid references auth.users(id) on delete set null,
  revoke_reason            text,

  last_accessed_at         timestamptz,
  access_count             integer not null default 0,

  metadata                 jsonb not null default '{}'::jsonb,
  updated_at               timestamptz not null default now()
);

create index report_share_tokens_workspace_idx
  on public.report_share_tokens (workspace_id);
create index report_share_tokens_snapshot_idx
  on public.report_share_tokens (snapshot_id);
create index report_share_tokens_status_expires_idx
  on public.report_share_tokens (status, expires_at);
create unique index report_share_tokens_token_hash_idx
  on public.report_share_tokens (token_hash);

alter table public.report_share_tokens enable row level security;
-- Workspace-scoped operator-full policy (mirrors report_delivery_snapshots
-- from migration 0013). Public route reads via service-role client only.
```

Notes:
- `token_hash` is the SHA-256 of the raw token; the unique index lets the public route do an `O(log n)` lookup without storing the raw token.
- `recipient_email_hash` is optional, intentionally a hash (not raw email) so the audit trail can answer "did we share with this client?" without storing client PII.
- `audience_label` is a freeform operator-visible label (e.g., "Acme exec team draft 1") with no client-facing exposure.
- `metadata jsonb` reserved for future operator-set notes (delivery channel, accompanying context) without schema churn.

**This schema is canonized here for Sprint 4D-B; the migration is not authored by Sprint 4D-A.**

---

## Expiry Policy

- **Default expiry: 14 days** from token creation.
- **Maximum expiry: 30 days** without a canon amendment. Operators may pick any value `≤ 30` at creation time. Asking for `> 30` is rejected.
- **No never-expire links.** `expires_at` is NOT NULL in the schema. Persisting a never-expiring link is a canon breach.
- **Expired links render a safe expired state** — no content body, no metadata, no UUIDs, no "your snapshot is at /pdf-candidate/..." hints. Generic copy: "This client report link has expired. Contact your Saipien Labs advisor for a renewed link."
- **Operators can revoke earlier** via the share management UI (Sprint 4D-D).
- **Regenerating a snapshot does not mutate an existing token's `snapshot_id`.** The token continues to point at the original snapshot. To share the new snapshot, the operator must create a new token. This guarantees that "the URL I sent the client" always renders the same content (or the safe revoked/voided state) — never silently updates beneath the client's feet.

---

## Revocation Policy

- **Revoke immediately disables public access.** Sprint 4D-B's eligibility check at render time re-evaluates `status` on every request; flipping `status='revoked'` propagates immediately (no caching surface should bypass this).
- **Revoked links render a safe revoked state** — same copy posture as expired. Generic, non-leaky.
- **Audit trail preserved.** The token row is **not deleted**; `revoked_at` + `revoked_by` + `revoke_reason` columns populate, and the activity event `report_share_token_revoked` (see § Audit Events) fires.
- **Voiding a snapshot must cascade.** When `voidReportDeliverySnapshotAction` runs (or its future equivalent), Sprint 4D-D should automatically mark all `active` tokens pointing at that snapshot as `revoked` with `revoke_reason = 'snapshot_voided'`. Alternatively, the public route's render-time eligibility check covers this implicitly — but the explicit cascade is preferred so the audit log distinguishes operator-initiated vs cascade-revocations.
- **Voided snapshots are never publicly renderable.** The public route's eligibility check rejects `status='voided'` snapshots regardless of token state.

---

## Audience Model

Sprint 4D-B's first implementation supports a **single audience per token** — a "label" identifying who the share was intended for. There is no identity-authenticated client login.

- **`audience_label`** is operator-visible only. It's a freeform string (e.g., "Acme executive team — pre-meeting draft") that helps the operator track who they sent which link to. The label is NOT shown on the client-facing artifact.
- **`recipient_email_hash`** is optional. If the operator chooses to record the recipient identity, SLATE stores a SHA-256 of the lowercased trimmed email — never the raw email. This lets a future audit answer "did we share this with this person?" without persisting client PII.
- **No multi-client portal.** Sprint 4D-B does not implement client login, client comments, client approvals, or any client-side state.
- **No client comments / approvals** in first implementation.
- **No e-signature** — out of Phase 1B scope.
- **No SOW acceptance** — proposal-side delivery is a separate canon.

The audience model is intentionally minimal so Sprint 4D-B can ship without authentication, OAuth, or session work. A future "client portal" sprint may layer identity on top.

---

## Public Route Security

The public share route `/r/[token]` (or whatever final shape lands in Sprint 4D-B) must enforce:

### Server-side token lookup only

- Token lookup happens **server-side** in the route handler — never via a client-side Supabase query. Public traffic must never touch the Supabase JS client with anon credentials.
- Lookup uses `service_role` server client (matching the existing pattern for the public scorecard route) — the public route is the trust boundary; the client gets read-only HTML output.
- The route reads `token_hash = sha256(params.token)` and short-circuits on miss.

### No raw snapshot / engagement / report UUIDs in the public URL

- The URL is **token-only**. `/r/[token]` contains no `snapshot_id` or `engagement_id`.
- Internal IDs are also reduced or hidden from the rendered HTML body (see § Content Rendering Policy below).

### No raw private asset URLs

- The public artifact must not embed signed URLs from `engagement-documents` or any other private bucket.
- Embedded charts (Sprint 4D-B will likely defer SVG; see § Content Rendering Policy) are SVG-inline or omitted.
- Embedded fonts ship from the SLATE CDN / inline; nothing fetched from a private bucket at view time.

### No workspace / engagement enumeration

- Token mismatch, snapshot missing, snapshot voided, snapshot stale-rejected, token expired, token revoked → **all return the same generic "Not found / expired" page.**
- Server logs may distinguish causes for the audit trail (see § Audit Events), but the public response copy is identical across all rejection modes. No state leaks.

### Robots / cache headers

- `<meta name="robots" content="noindex,nofollow">` on every render of the route, including the rejection page.
- HTTP `X-Robots-Tag: noindex, nofollow` header on every response.
- `Cache-Control: no-store, max-age=0` for the rejection page. For the success page, prefer `Cache-Control: private, no-cache, max-age=0, must-revalidate` so intermediate proxies don't cache the artifact across requests.

### No operator-only content

- The public artifact must not expose reviewer notes (unless a future canon amendment specifically authorizes it).
- The public artifact must not expose raw activity events.
- The public artifact must not expose Saipien Fit Score, internal scoring, AI synthesis run IDs, or any operator-internal metadata.
- Sprint 4D-C must apply a "sanitized snapshot payload" filter that strips operator-only fields before render.

### No client-side database access

- No `@supabase/ssr` browser-client mount on `/r/[token]`.
- No anonymous database policies added.
- No client-side fetch to `/api/*`.

---

## Content Rendering Policy

The public artifact renders from the **immutable snapshot JSON payload only** — never from live `reports` / `report_sections` / `roadmap_items` / etc. rows. This guarantees that the content the client sees matches the content the operator approved at link creation time.

### Snapshot-pure rendering

- The public route loads the `report_delivery_snapshots` row and renders from `section_snapshot` + `exhibit_snapshot` + `source_summary_snapshot` + `claim_guard_result` + `omitted_exhibits` jsonb columns.
- No additional Supabase reads against live domain rows.
- No `ChartAdapterResult` re-computation. No live SVG re-render.

### Group-A entries

- Sections in `section_snapshot[]` with `includedInArtifact: true` render as text (title + summary + draftPreview + evidenceNotes). Reviewer notes are intentionally **not** rendered (per § Public Route Security).
- Exhibits in `exhibit_snapshot[]` with `renderedInArtifact: true` render as source-summary metadata cards (slot name + source label + row count + freshness chip). **First Sprint 4D-C implementation does not embed live SVG.** A future amendment may add SVG rendering once a snapshot-side SVG persistence model is canonized.

### Omitted exhibits appendix

- The canonical `group_b_block` entry from `omitted_exhibits` is **always rendered** as a visible appendix card explaining that benchmark / financial exhibits are intentionally omitted.
- Per-Group-A omissions (insufficient_data / invalid_data / gated) render with the operator-facing copy from the snapshot, **with internal deep links to `/app/engagements/...` stripped** (a sanitization pass converts those to plain-text descriptions).

### Group-B omission remains visible

- The Group-B omission notice is non-negotiable on the client artifact. Stripping it is a canon breach.

### Claim guard result presentation

- The artifact may show a small "Content safety checks passed" indicator — affirmative, not detail-heavy.
- The artifact **must not** show the raw 26-pattern list, the violation codes, or the scanned-field count. That's operator-internal detail.

### Internal IDs reduction

- The client artifact **must not** show `report_delivery_snapshots.id`, `engagement_id`, `report_id`, or `report_section.id` codes prominently. The operator audit view (the existing operator-only candidate route) keeps the full identity strip; the client artifact replaces it with a friendlier "Report generated <date> for <audience_label or company name>" header.
- Hiding these reduces enumeration leaks if someone tries to swap segments of a leaked URL.

### Generated timestamp visible

- The artifact prominently shows `report_delivery_snapshots.generated_at` so the client knows the freshness of the content they're looking at.
- Format: human-readable date + time + timezone (UTC).

### Required client-visible footer

- **Mandatory footer copy** at the bottom of every public artifact:
  > "This is an advisory report prepared by Saipien Labs. It is not a Statement of Work, a binding quote, a financial guarantee, or a contract. Pricing, implementation timelines, and engagement scope are subject to a separate commercial agreement. For questions, contact your Saipien Labs advisor."
- Sprint 4D-C may tune the wording, but it **must** include the four denials (not a SOW, not a binding quote, not a financial guarantee, not a contract).

---

## Audit Events

Sprint 4D-B / 4D-C add the following new `ActivityEventType` values. **Not added to `lib/activity/types.ts` in Sprint 4D-A.**

| Event type | Trigger | Metadata |
|---|---|---|
| `report_share_token_created` | Operator creates a new share link via Sprint 4D-B's Generate Share Link action | `{ tokenId, snapshotId, expiresAt, audienceLabel, hasRecipientHash: boolean }` |
| `report_share_token_revoked` | Operator revokes a token via Sprint 4D-D's share management UI, OR Sprint 4D-D cascade fires from a void action | `{ tokenId, snapshotId, revokeReason, cascade: boolean }` |
| `report_share_token_accessed` | Public route renders the artifact successfully for a token | `{ tokenId, snapshotId, userAgentHash, ipHash, accessCount }` |
| `report_share_token_expired` (optional) | First public access attempt after `expires_at` | `{ tokenId, snapshotId, expiresAt }` |
| `report_sent_to_client` (only if SLATE-mediated send is later implemented; out of Sprint 4D scope) | SLATE actively pushes the artifact (email / CRM) to the client | TBD by the future delivery-channel canon |

### Access logging notes

- Access events should be logged **server-side** by the public route handler — never relying on client-side beacons.
- **Rate-limited:** to prevent log flooding from bots or repeated refreshes, the access logger should debounce per `(tokenId, ipHash)` at a coarse interval (e.g., one access event per token per IP per 5 minutes). Sprint 4D-C will canonize the exact debounce policy.
- **No raw IP / user agent stored.** SHA-256 hash with a server-side pepper if policy allows. The hash lets the audit log answer "different recipients accessed the same token" without persisting identifying data.
- Failed token lookups (revoked / expired / not found) should **not** emit detailed audit events — a single `unknown_token_attempt` counter (incremented in metadata of a separate aggregated event, or a server log only) is sufficient. Detailed events for failed lookups risk leaking state to an attacker via timing.

---

## Send to Client Unlock Policy

The `LockedActionButton label="Send to Client"` on `/app/engagements/[id]/proposal` remains **locked** until all of the following are true:

1. **Share-token model implemented** — Sprint 4D-B has landed: `report_share_tokens` table, token service, operator-only Generate Share Link action.
2. **Snapshot eligibility rules enforced** — at both link creation and link render time (per § Snapshot Eligibility Rules).
3. **Token revocation implemented** — Sprint 4D-D has landed the operator revoke flow + the void-cascade revoke.
4. **Access logging implemented** — the public route handler emits `report_share_token_accessed` events with the canonized metadata shape.
5. **Public route security reviewed** — Sprint 4D-C's `/r/[token]` route is reviewed for the full § Public Route Security checklist + the § Rate Limit / Abuse Controls list.
6. **Client-facing rendering reviewed** — § Content Rendering Policy is fully implemented and operator-acceptance-tested in Sprint 4D-D.
7. **Operator confirms recipient / audience** — the Send to Client action must require explicit operator confirmation of who the share is going to before sending (Sprint 4D-E).

### Auto-email is explicitly out of first-implementation scope

- The first implementation (Sprint 4D-B) **must not** auto-email clients. It creates a link the operator copies to their own outbound channel.
- "Generate Share Link" **must** land before "Send to Client". Sprint 4D-B opens the link surface; Sprint 4D-E (if approved) layers SLATE-mediated send on top.

### `Send to Client` is the last control unlocked

Per `docs/19` § Locked Control Policy, `Send to Client` is the last of the five locked controls to unlock. Even after Sprint 4D-E, the unlock must be explicit, sprint-bound, and operator-authorized in the same change.

---

## Export Report Interaction

- **`Export Report` / Generate PDF Candidate remains operator-only.** Sprint 4D-A does not relabel, re-point, or unlock the existing flow. The button continues to read "Generate PDF Candidate" for persisted UUID engagements; the locked chip stays on mock paths.
- **Share token points at a specific candidate snapshot.** Token creation captures `snapshot_id`; the token is bound to that one snapshot for its entire lifetime.
- **Snapshot voiding cascades to public access.** If the operator voids a snapshot via the Sprint 4C-D Void affordance after a share link is active, the public route must stop rendering content (see § Revocation Policy).
- **New candidate ≠ updated share link.** Generating a newer candidate snapshot does **not** automatically replace an existing shared snapshot. To share the new snapshot, the operator must create a new token. This guarantees content stability for any URL the operator has handed to a client.

---

## Storage Policy

- **First share implementation remains metadata / snapshot-rendered.** The public artifact is server-rendered HTML from the snapshot JSON. No PDF binary is stored; no PDF binary is served.
- **If future stored PDF binary is needed, a separate storage canon is required** — canonized in a `docs/23_PHASE_1B_REPORT_BINARY_STORAGE_CANON.md` (or equivalent) before any implementation sprint touches storage.
- **No public bucket** for client artifacts under any circumstances. Public buckets are a canon breach. (Same posture as `docs/19` § Storage Rules.)
- **No long-lived signed URLs.** If a future sprint introduces stored binaries gated by signed URLs (operator-only download), the maximum TTL is **15 minutes** per `docs/19` § Storage Rules.
- **Public share route renders, not redirects.** The route serves HTML directly, never a `302` redirect to a storage URL. This prevents URL exfiltration.

---

## Rate Limit / Abuse Controls

The public route is on the open Internet and must defend against scanner / scraper traffic without leaking operator state.

- **Lightweight rate limiting** at the route level. Initial recommendation: per-IP token-lookup rate limit (e.g., 30 requests / minute per IP). Sprint 4D-C will tune.
- **Per-token render limit** is also worth considering — e.g., refuse to render more than 1,000 distinct IPs against the same token within a 24-hour window without re-revalidating. Sprint 4D-C will canonize the threshold.
- **Invalid token attempts** return the generic "Not found / expired" page with no diagnostic details. Server logs may distinguish failure modes for the audit trail.
- **Avoid detailed error messages publicly.** No "this snapshot was voided at 18:35 UTC" type leakage. Generic copy only.
- **CAPTCHA is out of scope** for the first implementation. Sprint 4D-C may revisit if access logs show automated scanning. The existing `lib/scorecard/honeypot` pattern (already used on the public scorecard) is a backup mitigation if needed.

---

## Benchmark / Financial / Commercial Claim Policy

References `docs/14` (Benchmark Data Canon) and `docs/15` (Financial Assumptions Canon).

- **Group-B excluded from first client share implementation.** Benchmark Comparison Bars, AI-Savings Waterfall, ROI Bridge stay confined to `/app/charts-preview` until `docs/14` advances to Gate 1+ (`internal_directional`) and `docs/15` advances to Gate 1+ (`operator_estimated`), respectively, AND a separate wiring sprint authorizes inclusion in client-bound artifacts.
- **No benchmark / ROI / savings / payback / break-even claims** unless the gates advance. The Sprint 4C-B claim-guard scan already enforces this at snapshot creation; the public route enforces it again at render via the eligibility check (which requires `claim_guard_result.passed = true`).
- **`claim_guard_result.passed` required** for share eligibility (per § Snapshot Eligibility Rules).
- **Mandatory client artifact footer** must state that the report is advisory and not a binding quote / SOW / contract / financial guarantee (per § Content Rendering Policy).
- **Proposal / SOW delivery remains separate** — gated by a future proposal-delivery canon. Sprint 4D-A / 4D-B / 4D-C / 4D-D / 4D-E never touch the proposal-side share surface.

---

## Proposed Sprint Sequence

| Sprint | Scope | Type |
|---|---|---|
| **4D-A** | This canon — defines the boundary, taxonomy, eligibility, token / link model, expiry, revocation, audience, public-route security, content rendering, audit events, unlock policy. **No code.** | Docs-only |
| **4D-B** | `report_share_tokens` table migration + token service (create / hash / verify / revoke / expire) + operator-only **Generate Share Link** action for eligible snapshots. Surfaces a copy-once UI affordance in the Past Candidates panel. **Send to Client stays locked.** No public route yet. | Code |
| **4D-C** | Public read-only `/r/[token]` route. Server-side rendering from sanitized snapshot payload. `noindex,nofollow` + `Cache-Control: no-store`. Access logging via `report_share_token_accessed`. Rate-limiting. Eligibility re-check at render. Generic rejection page. | Code |
| **4D-D** | Share management UI panel — list active tokens per engagement, show access count + last access timestamp, expose Revoke action. Void-cascade revoke wiring. | Code |
| **4D-E** | (Optional) Send to Client action — operator-mediated send via the operator's own channel, OR a controlled email / CRM integration (subject to a separate channel canon). Unlocks the `Send to Client` `LockedActionButton`. | Code |
| Separate | Proposal / SOW delivery canon (`docs/24`?) | Docs |
| Separate | Benchmark Gate 1 advancement (`docs/14` → `internal_directional`) | Docs + data |
| Separate | Financial Gate 1 advancement (`docs/15` → `operator_estimated`) | Docs + data |
| Later | E-signature / CRM integration (out of Phase 1B unless separately authorized) | — |

Sprint 4D-B / 4D-C / 4D-D can ship operator-only — none of them unlock client-bound write surfaces. Sprint 4D-E is the only sprint that unlocks `Send to Client` and is gated on all four prior sprints accepting + an explicit operator authorization.

---

## Open Decisions / Operator Approval Needed

The following decisions require operator approval before Sprint 4D-B begins. The recommended defaults appear below each; the operator may override with explicit instructions in the Sprint 4D-B prompt.

1. **Token URL shape** — `/r/[token]` (recommended) vs `/share/[token]` vs `/share/report/[token]` vs `/client/[token]`.
2. **Default expiry** — 14 days (recommended) vs 7 / 30 / other.
3. **Maximum expiry** — 30 days (recommended) vs 60 / 90 / longer (would require canon amendment).
4. **Include recipient email hash** — optional at creation time (recommended) vs required vs never.
5. **First-implementation behavior** — link creation only (recommended) vs link + immediate email send (would require channel canon).
6. **Client artifact shows internal IDs** — hide (recommended; show friendly date + audience label) vs show snapshot UUID prominently.
7. **Access logging stores hashed IP / user agent** — yes with server-side pepper (recommended) vs no IP / UA storage at all vs raw IP storage (rejected).
8. **Stale-accepted snapshots share-eligible** — no for first implementation (recommended) vs yes with visible stale warning.
9. **Share route allows browser print / save** — yes (recommended; the artifact is HTML, browser print is the operator-style fallback) vs no (would require Cache-Control / CSP work).
10. **Operator-facing label** — "Client Report Link" (recommended) vs "Share Link" vs "Client Review Link" vs "Read-only Link".

### Recommended defaults (committed by this canon)

- URL shape: **`/r/[token]`**
- Default expiry: **14 days**
- Max expiry: **30 days** (without canon amendment)
- Recipient email hash: **optional, not required**
- First-implementation behavior: **link creation only, no email send**
- Client artifact internal IDs: **hidden** (friendly date + audience label only)
- Access logging: **hashed IP + UA with server-side pepper**
- Stale-accepted snapshots: **not share-eligible** in first implementation
- Browser print / save: **allowed** (HTML-side, no SLATE-hosted PDF binary)
- Operator label: **"Client Report Link"**

---

## Non-Goals

This canon explicitly does not authorize, and is not consulted as authority for, any of the following:

- **No implementation.** No source code under `app/`, `components/`, `lib/`, `supabase/`, `middleware.ts`, `package.json`, or `package-lock.json` is modified by Sprint 4D-A.
- **No share link code.** No `report_share_tokens` migration. No token service. No public route. No Generate Share Link button.
- **No `Send to Client` unlock.** The locked chip stays.
- **No public route.** No file under `app/r/` or `app/share/`.
- **No schema / migration.** Head migration remains `0013_report_delivery_snapshots.sql`.
- **No API route.** No new file under `app/api/`.
- **No storage policy change.** No new bucket, no new `storage.objects` policy.
- **No PDF binary generation.** No `puppeteer` / `playwright` / `@react-pdf/renderer` / `jspdf` / any PDF library added.
- **No PDF dependency.** `package.json` / `package-lock.json` untouched.
- **No email / CRM pipeline.** No external delivery integration.
- **No SOW / e-signature work.** Out of scope, gated by separate canons.
- **No Group-B wiring.** Benchmark Comparison Bars, AI-Savings Waterfall, ROI Bridge stay confined to `/app/charts-preview`.
- **No `docs/14` / `docs/15` gate advancement.** Both unchanged.
- **No AI synthesis changes.** Steps 3 / 4 / 5 are unchanged.
- **No chart library / package work.** The Visx recommendation plan file remains parked.
- **No modification to existing canon docs (`docs/14`, `docs/15`, `docs/19`, `docs/20`, `docs/21`)** unless a contradiction must be noted. Sprint 4D-A references them rather than editing.

---

## Acceptance Criteria

1. `docs/22_PHASE_1B_CLIENT_SHARE_DELIVERY_CANON.md` exists.
2. The current delivery boundary is documented (operator-only candidate route, no public route, no PDF binary, all five locked controls intact).
3. Snapshot eligibility rules are defined (status, delivery_surface, draft_watermark, claim_guard pass, Group-B exclusion, approved/final sections, stale-slot policy, snapshot age limit).
4. Token / link model is defined (opaque random, ≥ 128 bits, hashed at rest, conceptual `report_share_tokens` schema).
5. Expiry policy is defined (default 14 days, max 30 days, no never-expire, regeneration ≠ link mutation).
6. Revocation policy is defined (immediate disable, audit trail, void-cascade).
7. Public route security policy is defined (server-side lookup, no raw UUIDs, no enumeration, robots noindex, no client-side DB access).
8. Content rendering policy is defined (snapshot-pure, no live re-query, Group-B omission visible, claim-guard affirmative-only, internal IDs hidden, required client-visible footer).
9. Audit event model is defined (`report_share_token_created`, `_revoked`, `_accessed`, optional `_expired`).
10. `Send to Client` unlock policy is defined (last control unlocked; requires all four prior sprints landed).
11. Sprint 4D-B / 4D-C / 4D-D / 4D-E sequence is defined.
12. Open decisions are listed with recommended defaults committed by this canon.
13. `docs/08_CURRENT_STATUS.md` and `docs/10_SESSION_HANDOFF.md` are updated.
14. No source / schema / API / package / public-route / storage / PDF / share-token code is changed by Sprint 4D-A.

---

## Pointer-Forward

Future client-delivery / share implementation agents working on any of Sprint 4D-B, 4D-C, 4D-D, or 4D-E **must** treat this canon as the source of truth for the share surface. Deviations — adding a JWT instead of opaque tokens, exposing raw snapshot UUIDs in the public URL, including Group-B content in a client artifact, dropping the mandatory footer, allowing voided snapshots to render publicly, unlocking `Send to Client` outside Sprint 4D-E, or implementing email / CRM delivery without the corresponding channel canon — require a canon amendment landed in this document **before** the corresponding code change is authored.

The operator-only candidate workflow shipped in Sprint 4C-B / 4C-D is the baseline; the client share surface is a higher-risk extension on top of it. This canon is the binding boundary.
