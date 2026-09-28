# GovernanceOS — Integration Plan (rev 2: G0/G1 build plan) — docs/72

## Status

- **Date:** 2026-09-25 (rev 2; rev 1 dated 2026-09-24)
- **Branch:** `persistence/step-0-1-auth-shell` (head `25be251`)
- **Type:** Canon-authoring / planning doc. No source code, no migration, no
  engagement mutation. **Ratified 2026-09-25. G0 + G1 executed 2026-09-28 — see `docs/77` and `docs/78`.**
- **Input:** *GovernanceOS — Implementation-Reconciled PRD v2* (2026-09-10,
  audited against `d4efa5a`). Referred to below as **the PRD**. Rev 2 adds the
  Architect's clarification of 2026-09-25 (§1).
- **Supersedes:** rev 1 of this doc. Rev 1's §3 "track" framing and its naming
  recommendation (D3/Q1) are **withdrawn**. See §1.2.

---

## 1. Architecture (ratified by Architect, 2026-09-25)

### 1.1 GovernanceOS has two roles

1. **A first-class SLATE module/product.** It has its own domain model, service
   layer, routes, operator UX, program lifecycle, dashboards, registry, risks,
   requirements, policies, controls, evidence, decisions, exceptions, incidents,
   actions, assessments, monitoring, reporting, and activity views.
2. **The cross-SLATE governance control plane.** ConsultOS, BuildOS, VentureOS,
   FDE/integration work, internal Saipien AI systems, and future agent runtimes
   register governed assets, query posture, and submit evidence/signals through
   GovernanceOS service contracts. Later they also consume gates and policy
   decisions through those contracts.

GovernanceOS **is not** collapsed into shared infrastructure. Its functionality
**is not** distributed across the other modules. The governance domain is owned
by GovernanceOS.

```
                ┌──────────────────────── SLATE ─────────────────────────┐
                │  ConsultOS     BuildOS     VentureOS     GovernanceOS  │ ◄─ modules (products)
                │      │            │            │          ▲    │       │
                │      └──── register / query / signal ─────┘    │       │
                │                (GovernanceOS contracts)        │       │
                ├─────────────────────────────────────────────────────────┤
                │  SLATE PLATFORM: auth · workspace membership · RLS      │ ◄─ shared primitives,
                │  helpers · audit/activity · AI provenance · durable     │    domain-agnostic
                │  file store · retention holds · share/snapshot engine   │
                └─────────────────────────────────────────────────────────┘
```

**Critical rule (canon).** A governed record may originate from, or reference,
a ConsultOS engagement, a BuildOS project, a VentureOS venture, a runtime agent,
or an external system. Its **durable governance state belongs to GovernanceOS**.
**No lifecycle event in another SLATE module may silently destroy or invalidate
GovernanceOS history.**

### 1.2 Naming canon

| Module (canon) | Legacy / internal alias (not renewed canon) | Where the alias survives |
|---|---|---|
| **ConsultOS** | AdvisoryOps; GrowthOps (funnel/scorecard) | `docs/00`, `docs/39`, `PRODUCT.md`, UI copy. No code identifiers use it. |
| **BuildOS** | BuildOps | `docs/00`, `docs/02`, `docs/persistence/00` ("BuildOps Non-Disruption"). |
| **VentureOS** | StudioOps | `docs/00`, `docs/02`. |
| **GovernanceOS** | none | New. |
| (ClientOps) | Later-phase track in `docs/00` | Remains an unassigned later lane. Most of it overlaps "Governance Program as a Service" + ConsultOS post-delivery. Not renamed here. |

Rules: new code, schema values, routes and docs use the canon names. Machine
values are lowercase: `consultos | buildos | ventureos | governanceos`. Legacy
aliases stay only in historical docs. There's no rename churn, because no code
identifier uses them (verified by grep). The G0 decision-log entry records the
alias table above. `docs/00` gets an amendment note, not a rewrite.

### 1.3 Ownership boundary: the test for "platform vs module"

Work belongs to the **SLATE platform** only if all three hold: it is
**domain-agnostic**, **needed by more than one module**, and it **encodes no
governance semantics**. Everything else, including every governance concept,
vocabulary, lifecycle, and screen, belongs to **GovernanceOS**.

| Layer | Owns | Code location | Migration naming |
|---|---|---|---|
| **SLATE platform** | Auth, workspace membership, RLS helper functions, `activity_events` (the table + logger), `ai_synthesis_runs` (the table), durable file store, retention holds, share-token/snapshot engine, test harness | `lib/auth/*`, `lib/platform/*` (new), `lib/activity/*`, `lib/supabase/*`, `lib/share-tokens/*`, `scripts/`, `tests/platform/` | `NNNN_platform_*.sql` |
| **GovernanceOS** | All `governance_*` tables and vocabularies. Programs, registry, policies, posture, contracts, routes, UX, reports. Its own activity/AI-run **types** and its own retention **holds** (as a *user* of the platform primitives). | `lib/governance/*`, `app/app/governance/*`, `components/governance/*`, `tests/governance/` | `NNNN_governance_*.sql` |
| **ConsultOS** | Unchanged. It gains no governance logic. In G1 it gets **zero code changes**; the link to a program is made from the GovernanceOS side. | existing | existing |

Dependency direction: **GovernanceOS → platform** (allowed). **ConsultOS/BuildOS/
VentureOS → GovernanceOS** (only via `lib/governance/contracts`, not in G1).
**Platform → GovernanceOS** (forbidden. Platform code never imports
`lib/governance`). A lint rule (`no-restricted-imports`) enforces the last two.

---

## 2. Repo facts this plan is built on (verified at `25be251`)

| # | Fact | Evidence |
|---|---|---|
| F1 | Highest migration is `0021_sow_share_tokens.sql`. The next free number is **`0022`**. | `supabase/migrations/` |
| F2 | **Auth exposure (likely live).** `signInWithOtp` is called **without `shouldCreateUser: false`**, and the allowlist is checked only inside our server action. Anyone with the public anon key can call Supabase Auth directly, create a user, get a session, and then pass every RLS policy. **The mitigation depends on dashboard settings that can't be seen from the repo.** | `lib/auth/actions.ts:41-46`; `lib/auth/operator-allowlist.ts`; `app/auth/callback/route.ts:24` (no allowlist re-check after code exchange) |
| F3 | All RLS uses `(select id from public.workspaces limit 1)` (66 occurrences, `0002`–`0021`). There are no membership/role concepts, and `profiles` has no role. | agent survey; `0006_findings.sql:60-64` |
| F4 | **26 FKs cascade from `engagements`,** covering intake, input assets/files, findings + source refs, opportunities/roadmap, reports/proposals, snapshots, share tokens, **`activity_events`**, **`notes`**, and **`ai_synthesis_runs`**. `contacts` cascade from `accounts`. | `grep "references public.engagements"` across `0005`–`0021` |
| F5 | No application code path deletes engagements or accounts. Cascades fire only from SQL/dashboard or from future code. | `grep .delete()` in `lib/` |
| F6 | `ai_synthesis_runs.engagement_id` is `NOT NULL`, so a non-engagement AI run can't be recorded. | `0011:28` |
| F7 | Files live on `input_assets` (engagement cascade) in bucket `engagement-documents`, accessed via the service role only. `checksum_sha256` exists, but it is unverified whether it's populated. | `0005:122-138`, `0010` |
| F8 | No test framework, no SQL/RLS tests. Verification to date = lint + build + documented walkthroughs. | `package.json` |
| F9 | The sidebar is a static `sections` array in `components/layout/sidebar-nav.tsx` (groups Operate / Deliver / System). | `:44-69` |
| F10 | Server-action convention is `lib/<domain>/actions.ts`, `"use server"`, cookie client (RLS applies), `getUser()`, typed `{ok}|{ok:false,error}`, `logActivityEvent`, `revalidatePath`. | `lib/findings/actions.ts:227-361` |

---

## 3. G0 — Platform prerequisites (SLATE platform work)

G0 is **platform hardening**. It builds no GovernanceOS product surface and is
not a substitute for G1. Its one GovernanceOS deliverable is a set of **decision
documents** (§3.8), which GovernanceOS owns.

### 3.1 [Platform] Auth exposure audit + fix (addresses F2)

1. **Audit (read-only, founder performs or approves):**
   - Supabase dashboard → Auth: whether "Allow new users to sign up" is on, which
     providers are enabled (email OTP/magic link, password, OAuth, anonymous
     sign-ins), redirect URL allowlist, and rate limits.
   - `select count(*), min(created_at) from auth.users` compared with the known
     operator list: are there unexpected users?
   - Record the findings in `docs/74_PLATFORM_AUTH_EXPOSURE_AUDIT.md`.
2. **Fix (defense in depth, all three layers):**
   - **Config:** disable public sign-ups; disable every provider except email
     magic link; disable anonymous sign-ins. Operator accounts get
     pre-provisioned/invited.
   - **Code:** `signInWithOtp(..., { shouldCreateUser: false })`. In
     `app/auth/callback/route.ts`, after `exchangeCodeForSession`, re-check the
     allowlist **and** workspace membership; sign out + redirect if either fails.
   - **Database (the actual control):** membership-based RLS (§3.2–3.3). An
     authenticated session with no membership reads nothing.
3. If the audit finds unexpected `auth.users`, the Architect decides whether to
   remove them. That's a destructive action, so it's never automated.

### 3.2 [Platform] Workspace membership + authorization primitives

Migration **`0022_platform_workspace_memberships.sql`**:

- `workspace_memberships(workspace_id, profile_id, role, status, created_at, created_by)`,
  PK `(workspace_id, profile_id)`. `role in ('owner','operator','viewer')` is the
  **platform** role. **Module roles are not platform roles.** GovernanceOS
  program roles live in GovernanceOS (G1 §4.4).
- `public.is_workspace_member(ws uuid) returns boolean`: `security definer`,
  `stable`, `set search_path = ''`, checks `auth.uid()` + `status = 'active'`.
- `public.has_workspace_role(ws uuid, roles text[]) returns boolean`.
- Seed: one `owner`/`operator` row per existing operator profile, in the
  singleton workspace. Seed rows are selected by explicit email list in the
  migration (reviewed in PR), **not** "all current profiles". This matters in case
  F2 has already been exploited.
- Membership rows are writable only by `owner` (RLS) or the service role.
- TypeScript: `lib/auth/authorization.ts` exports
  `requireWorkspaceMember(): Promise<{ userId, profileId, workspaceId, role }>`.
  It replaces the singleton lookup for new code only. `lib/activity/log.ts:38-59`
  keeps its lookup until the §3.3 swap.

### 3.3 [Platform] Existing-table RLS swap (staged)

Migration **`0023_platform_rls_membership_swap.sql`** replaces every
`workspace_id = (select id from public.workspaces limit 1)` predicate with
`public.is_workspace_member(workspace_id)`. It's a mechanical change across the
policies in `0002`–`0021`. Tables without a `workspace_id` (`contacts`) go through
their parent.

- **Timing:** authored + tested in G0. **Applied after the founder self-test
  completes and before any external/client use.** This keeps the self-test
  environment stable. The §3.1 config + code fix ships immediately and already
  closes the open-sign-up hole.
- **Gate:** the §3.6 negative tests + the `docs/69` runbook smoke run on the
  Meridian fixture pass after applying it.

### 3.4 [Platform] Lifecycle-durability audit + retention holds (addresses F4/F5)

The platform must guarantee that a module lifecycle event can't destroy another
module's history. Mechanism:

- **Audit deliverable:** a table of all 26 engagement cascades + the account→contact
  cascade, each classified as *engagement-private* (fine to cascade) or
  *cross-module-relevant*. It goes in `docs/75_PLATFORM_LIFECYCLE_DURABILITY_AUDIT.md`.
  Expected classification: everything ConsultOS-private may keep cascading. The
  cross-module-relevant ones are `activity_events`, `ai_synthesis_runs`, `notes`,
  and `input_assets` (files).
- **Retention holds (new platform primitive).** Migration **`0024_platform_retention_holds.sql`**:
  - `retention_holds(id, workspace_id, entity_type, entity_id, held_by_module, reason, created_at, created_by, released_at)`.
  - `BEFORE DELETE` triggers on `engagements` and `accounts` raise an error if an
    unreleased hold exists. Later, the same happens for BuildOS/VentureOS roots
    when those tables exist.
  - Holds are domain-agnostic: the platform doesn't know *why* GovernanceOS holds
    something. GovernanceOS places a hold when it links an engagement or account,
    or promotes a record from one.
  - **Result:** deleting a governance-linked engagement fails loudly instead of
    silently cascading.
- **Audit/provenance decoupling (same migration):**
  - `activity_events`: add `module text not null default 'consultos'`. Change
    `engagement_id` FK to `on delete set null`, and add non-FK
    `engagement_ref uuid` populated by a trigger on insert. The audit row then
    survives engagement deletion and still names its engagement.
  - `notes.engagement_id`: same treatment.
  - `ai_synthesis_runs`: make `engagement_id` **nullable** + `on delete set null`,
    add `engagement_ref uuid`, `module text not null default 'consultos'`,
    `subject_type text`, `subject_id uuid`. Add
    `check (engagement_id is not null or subject_id is not null or engagement_ref is not null)`.
  - **Behavior change to ConsultOS:** none for reads. ConsultOS queries filter by
    `engagement_id`, which is unchanged while the engagement exists. The only
    difference is that rows **survive** a manual engagement delete. Existing
    ConsultOS readers must tolerate `engagement_id is null` orphans. The audit doc
    lists every reader, and they filter by a specific engagement id, so orphans
    never appear.
- **Durable file store (new platform primitive).** Migration
  **`0025_platform_durable_files.sql`**:
  - `stored_files(id, workspace_id, bucket, path, sha256 not null, size_bytes, mime_type, original_filename, uploaded_by_profile_id, created_at)`.
    No engagement FK.
  - Private bucket `slate-durable-files` with the same service-role-only access
    pattern as `lib/assets/*`.
  - `lib/platform/files.ts` computes sha256 server-side on upload. It's also used
    to *copy* an engagement `input_assets` file into the durable store.
  - Verify whether `input_assets.checksum_sha256` is populated today (F7), and log
    the answer in the audit doc.

### 3.5 [Platform] Migration numbering discipline

- **Rule:** the next number = highest file in `supabase/migrations/` at *branch
  head when the PR is opened*. It's re-checked against the live project's applied
  list (Supabase `list_migrations`) before apply. Never assume a number from a doc.
- **Guard:** `scripts/check-migration-sequence.cjs` fails if there are gaps,
  duplicates, or a file not matching `^\d{4}_(platform_|governance_)?[a-z0-9_]+\.sql$`.
  The prefix is required from `0022` onward. It runs as `npm run check:migrations`.
- The G0/G1 numbers in this doc are **provisional**. They get renumbered at PR
  time if anything else lands first.

### 3.6 [Platform] Test foundation

- **Dependencies (canon authorization per `docs/39 §9` rule 7, recorded in the
  G0 decision-log entry):** `vitest` (dev). Nothing else. The Supabase CLI is
  used for a local stack if Docker is available in WSL. Otherwise, fall back to
  a dedicated **Supabase dev branch** (never production).
- **Layout:** `tests/platform/**`, `tests/governance/**`. Scripts:
  - `npm run test` for unit tests (pure functions, no DB)
  - `npm run test:db` for DB tests that need a local or branch database
- **DB test harness:** `tests/helpers/db.ts` creates synthetic auth users and
  mints JWTs for four personas:
  - anon
  - authenticated non-member
  - member of workspace B
  - member of workspace A

  It then queries through PostgREST with each persona's token. A second workspace
  is created **only in the test database**.
- **G0 negative tests (must pass before G1 merges):**
  1. anon reads 0 rows from every table in `public` (table list is
     auto-enumerated, so new tables are covered by default).
  2. The authenticated non-member reads 0 rows and can't insert into any
     membership-protected table (probe table in G0; all tables after `0023`).
  3. A workspace-B member can't read or write workspace-A rows.
  4. A non-owner can't insert/update `workspace_memberships`.
  5. `is_workspace_member` can't be spoofed by passing another user's id (it
     takes no user argument).
  6. Deleting an engagement with an active retention hold fails. Without a hold,
     it succeeds and leaves `activity_events`/`ai_synthesis_runs`/`notes` rows
     with `engagement_ref` intact.
  7. The callback route signs out a session whose email isn't allowlisted.
  8. The migration-sequence guard passes on the repo and fails on a synthetic gap.
- **CI:** none exists today. G0 adds the scripts. Running them in CI (GitHub
  Actions) is a separate, optional decision (§7, Q-G0-3).

### 3.7 [Platform] Share/snapshot engine: generalization plan only

No code in G0/G1. Record the decision: GovernanceOS reports become **additional
resource types on the existing share-token/snapshot engine**. There's no separate
sharing security system. The generalization (resource-type discriminator on
tokens + snapshots, surface-aware pre-delivery gate) happens when G5 needs it. A
governance-specific presentation route can be added later.

### 3.8 [GovernanceOS] Conventions finalized in G0 (documents, not code)

These are governance-domain decisions, so GovernanceOS owns them. They live in
`docs/76_GOVERNANCEOS_DOMAIN_CONVENTIONS.md`:

**(a) Program ownership: `program_kind`**

| `program_kind` | Owner reference | Constraint |
|---|---|---|
| `client` | `account_id` (FK `accounts`, `on delete restrict`, plus a retention hold) | `account_id is not null` |
| `internal` | the workspace itself (Saipien) | `account_id is null`. **No fake CRM account.** |
| `venture` | `venture_source_system = 'ventureos'` + `venture_source_id text` (lineage only; VentureOS has no tables yet) | `account_id` optional (a venture may later get an account) |

Enforced by a table-level `check`. Owner profile + optional executive-sponsor
**name snapshot** are recorded, so a deleted contact doesn't erase who was accountable.

**(b) Policy versioning: immutable, superseding**
- A `governance_policies` row is **identity** (stable `policy_key`, name, domain,
  owner).
- `governance_policy_versions` holds content: `version` (monotonic per policy),
  `status draft → active → superseded | retired`, `activation_mode`, `scope`, and
  `supersedes_version_id`.
- A version is **editable only while `draft`**. A DB trigger rejects UPDATE of
  content columns on non-draft versions, and rejects DELETE of any non-draft version.
- At most one `active` version per policy (partial unique index). Activating vN
  atomically marks vN-1 `superseded` in one server-side transaction (RPC).
- `activation_mode`: in G1 only `advisory` is accepted. `gated` becomes allowed
  when decision records exist (G3). `enforced` requires a registered enforcement
  adapter id (G4+), enforced by check + trigger.

**(c) Risk-rating vocabulary: fixed tiers, flexible scales**
- **Fixed, queryable, cross-program:** `rating_tier in ('low','medium','high','critical')`.
  It's derived **server-side**, never AI-set. This is the same principle as the
  opportunity quadrant derivation (`docs/09` 2026-05-06).
- **Fixed ordinal inputs:** `likelihood` and `impact` are integers 1–5, with
  canonical labels (rare…almost certain; negligible…severe).
- **Flexible per program:** the 5×5 → tier matrix (default supplied, programs
  may adjust thresholds) plus optional framework-specific labels/rationale stored
  on the risk. Framework vocabulary maps **onto** the ordinal scale. It never
  replaces the columns.
- Used from G2. It's fixed now so G1's posture contract can reserve the fields.

**(d) Licensed standards**
- A `governance_framework_sources` record (G2) carries a
  `license_class in ('public_domain','licensed_reference_only','client_proprietary')`.
- For `licensed_reference_only` (ISO/IEC 42001 and ISO/IEC 23894), requirement
  rows store **clause identifier + clause title + Saipien-authored guidance**,
  with `text_origin = 'saipien_paraphrase'`. A check forbids
  `text_origin = 'verbatim'` for that license class.
- NIST AI RMF (public domain) may be stored verbatim with attribution.
- Client-supplied policy text is `client_proprietary`, and it's never used
  outside that client's program.

**(e) Source lineage vocabulary**
- `source_system in ('consultos','buildos','ventureos','integration','runtime','internal','external')`.
- `source_entity_type text`, `source_entity_id text` (text, so non-UUID ids from
  external runtimes fit), `correlation_id text`.
- Lineage is **never** an authorization input.

### 3.9 [GovernanceOS / Saipien ops] `docs/73`: Saipien AI Governance Operating Standard

Drafted in G0 and ratified by the founder. It's the policy source for the
internal program created in G1. Contents:

1. Scope and principles (human authority, evidence-first, proportionality).
2. Approved AI providers/tools and data-handling rules: which data classes may
   reach which provider.
3. AI decision rights: who approves a new internal AI system, a model/provider
   change, a client-facing AI deliverable, or an exception.
4. Internal AI inventory (seed list for the G1 registry, §4.6).
5. Model/provider change procedure.
6. AI output incident procedure (links the `docs/69` stop conditions).
7. Governed Delivery checklist for BuildOS/FDE client deployments.
8. Review cadence (quarterly internal governance review).

### 3.10 G0 exit criteria

- [ ] `docs/74` auth exposure audit recorded. Config + code fixes (§3.1) deployed.
- [ ] `0022`, `0024`, `0025` applied to a dev branch/local; `0023` authored and
      tested, **held for post-self-test apply**.
- [ ] Negative tests 1–8 pass.
- [ ] `docs/75` durability audit, `docs/76` conventions, `docs/73` operating
      standard drafted. Decision-log entries written (naming canon, platform/module
      boundary, new deps, the staged RLS swap).
- [ ] `docs/69` runbook smoke run on Meridian unchanged (ConsultOS unaffected).

---

## 4. G1 — GovernanceOS foundation (GovernanceOS module work)

G1 builds GovernanceOS **as its own module**. Only work that is necessarily
platform-side is tagged [Platform]. Everything else is [GovernanceOS].

### 4.1 [GovernanceOS] Migrations (provisional numbers)

| # | File | Contents |
|---|---|---|
| 0026 | `governance_programs.sql` | `governance_programs`: `program_kind` + §3.8(a) checks, `status draft\|active\|paused\|archived`, owner, sponsor snapshot, `risk_scale jsonb`, `default_review_cadence`, `next_program_review_at`, `unique(id, workspace_id)`. **No DELETE policy** (archive only). `governance_program_engagements` (link rows; deletable, logged). **Linking places a platform retention hold on the engagement**, and unlinking releases it only if no other governance reference remains. |
| 0027 | `governance_assets.sql` | `governed_assets` (PRD §5.3 fields + §3.8(e) lineage + `parent_governed_asset_id`). Composite FK `(governance_program_id, workspace_id) → governance_programs(id, workspace_id)`. Lineage unique index `(governance_program_id, source_system, source_entity_type, source_entity_id)` where the source is present. `governed_asset_lifecycle_events` (append-only; no UPDATE/DELETE policy). |
| 0028 | `governance_policies.sql` | `governance_policies` + `governance_policy_versions` per §3.8(b), with immutability trigger, partial unique index, and `activate_policy_version()` RPC. |
| 0029 | `governance_platform_links.sql` | `activity_events.governance_program_id` (FK `restrict`) + index. `ai_synthesis_runs.governance_program_id` (FK `restrict`), reserved for G2. This column is added **by GovernanceOS** onto the platform tables. The platform tables never reference governance. |

Every table: `workspace_id not null`, RLS `using/with check (public.is_workspace_member(workspace_id))`,
`(workspace_id, governance_program_id)` indexes, `updated_at` trigger, and **no
`limit 1`** anywhere.

### 4.2 [GovernanceOS] Domain + service layer: `lib/governance/`

```
lib/governance/
  contracts.ts        # the control-plane surface other modules may import (types + functions)
  authorization.ts    # can(actor, action, program) — program roles (§4.4)
  activity.ts         # governance event types + emit wrapper (sets governance_program_id,
                      #   module='governanceos', NEVER sets engagement_id; engagement → metadata)
  retention.ts        # places/releases platform retention holds
  programs/  { queries.ts, actions.ts, types.ts, validation.ts }
  registry/  { queries.ts, actions.ts, types.ts, lifecycle.ts, lineage.ts }
  policies/  { queries.ts, actions.ts, types.ts, versioning.ts }
  posture/   { getGovernancePosture.ts }   # side-effect-free read model
```

- **Conventions:** follow F10 exactly: `"use server"` actions, cookie client,
  typed results, `revalidatePath`. Every mutation calls
  `authorization.can()` **and** relies on RLS.
- **G1 contracts (`contracts.ts`), in-process and typed:**
  - `registerGovernedAsset(input: GovernedAssetSourceContract)`: idempotent on the lineage key.
  - `linkGovernedAssetSource(assetId, source)`
  - `getGovernancePosture({ programId } | { assetId })` returns a structured result:
    - asset counts by type/lifecycle
    - unapproved-but-active assets
    - active advisory policies
    - linked engagements
    - staleness of `next_program_review_at`
    - `reserved` fields for risk/control/evidence posture (null until G2/G3)
  - `recordGovernanceEvent(...)` (internal)

  No other module imports these in G1. The contracts exist so G2+ callers
  integrate without refactoring.
- **Governed asset lifecycle in G1:** `proposed → assessment → active →
  restricted → retired`. The **`approved` state is reserved and unreachable
  until G3 decision records exist**. An asset already running (e.g. the SLATE
  synthesis pipeline) is honestly shown as **`active · not yet
  governance-approved`**. Every transition writes a `governed_asset_lifecycle_events`
  row + an activity event. `retired` is terminal; there's no delete.

### 4.3 [GovernanceOS] Routes and operator UX

GovernanceOS gets its **own sidebar group**, "GovernanceOS", alongside the existing
groups in `components/layout/sidebar-nav.tsx`. That file is a shared shell, so
this is a one-entry edit, not ConsultOS logic.

```
/app/governance                             → program portfolio (all programs; kind filter; status; next review)
/app/governance/programs/new                → create program (kind picker drives account/venture fields)
/app/governance/programs/[programId]        → overview (posture dashboard from getGovernancePosture)
  /registry                                 → governed asset registry (filters: type, lifecycle, source_system, autonomy, data sensitivity, environment)
  /registry/new
  /registry/[assetId]                       → asset detail: lineage panel, lifecycle timeline, relationships (reserved panels for risks/controls/evidence)
  /policies                                 → policies + active version + activation mode
  /policies/[policyId]                      → version history (immutable), draft editor, activate
  /engagements                              → linked ConsultOS engagements (link/unlink; shows hold status)
  /activity                                 → program activity feed
  /settings                                 → program metadata, review cadence, risk scale (stored; used G2)
```

- The same shell, design system (Phase 1 primitives: cards, FilterTabs, Dialog,
  toasts), and `loading.tsx`/`error.tsx` pattern are used. No separate app chrome.
- **Overview is decision-first,** the same principle as `docs/64` #2. It leads with
  "what needs attention" (active-but-unapproved assets, overdue program review,
  draft policies). Reserved G2+ cards render as explicit "not yet assessed"
  states, never as zeros that imply "no risk".
- AI features: **none in G1.**

### 4.4 [GovernanceOS] Program roles

- `governance_program_members(program_id, profile_id, role)` with
  `program_admin | governance_manager | reviewer | contributor | viewer`.
- **G1 behavior:** workspace `owner`/`operator` members are implicitly
  `program_admin` on internal programs. Explicit membership is required for
  client/venture programs (the creator is auto-added as `program_admin`).
- `authorization.can()` is the only place role logic lives. RLS enforces
  workspace membership. Program-level RLS (program membership) is **added in G1 for
  client programs**, so a future client user scoped to one program can't read
  another client's program.

### 4.5 [GovernanceOS] Source lineage in practice

| Source | G1 mechanism | Coupling |
|---|---|---|
| ConsultOS engagement | Link via `/engagements` (GovernanceOS side) plus a platform retention hold. Assets may cite `source_system='consultos'`, `source_entity_type='engagement'`. | FK on the link row only |
| BuildOS / VentureOS | `source_system='buildos'|'ventureos'`, text ids. Entered manually in G1 (no tables exist yet). | Lineage only, no FK |
| Runtime / integration / external | Same, with `external_runtime_id`, `deployment_environment`. | Lineage only |
| Internal Saipien | `source_system='internal'`, `source_entity_type` e.g. `slate_module`, `repo_path`. | Lineage only |

### 4.6 [GovernanceOS] The Saipien internal program (first real program)

Created through the G1 UI (not a migration seed): **"Saipien Labs — Internal AI
Governance"**, `program_kind = 'internal'`. The registry is seeded from `docs/73 §4`:

| Asset | Type | Lineage |
|---|---|---|
| SLATE AI synthesis pipeline (findings / opportunities / roadmap / report sections / proposal options) | `ai_system` | `internal` / `slate_module` / `lib/ai` |
| ↳ OpenAI model(s) per `SLATE_AI_*_MODEL` (default `gpt-4o-mini`) | `model` (child) | `internal` / `env_config` |
| SLATE client delivery engine (`/r` `/p` `/s`) | `workflow` | `internal` / `slate_module` |
| Claude Code / coding agents used on SLATE and client builds | `agent` | `internal` / `tooling` |
| Attio CRM read integration | `vendor_service` | `internal` / `integration` |
| Internal MCP servers / automations (inventoried in `docs/73`) | `agent` / `workflow` | `internal` |

Initial **advisory** policies are authored from `docs/73` §2, §3, and §5:
approved-provider list, AI decision rights, and model-change procedure. The
internal program's existing controls/evidence (human review gates, the
`ai_synthesis_runs` history) are **mapped in G2**, not faked in G1.

### 4.7 [GovernanceOS] Tests (G1 exit gate)

1. The **PRD §21 acceptance test**:
   - create a program for an existing account
   - link an engagement
   - register one engagement-sourced asset and one non-engagement asset
   - query posture
   - complete/unlink the engagement, and all governance state remains
2. Deleting a linked engagement **fails** (hold). After unlink + hold release, a
   delete succeeds and program, assets, and governance activity rows are intact.
3. Cross-workspace and non-member access fails **at RLS** for every `governance_*` table.
4. A client program is invisible to a workspace member who isn't a program member
   (once program-level RLS is on).
5. `program_kind` checks: a client without an account is rejected; an internal
   program with an account is rejected.
6. Policy versioning:
   - an active version's content can't be updated or deleted
   - activating vN supersedes vN-1 atomically
   - `gated`/`enforced` are rejected in G1
7. `approved` lifecycle is unreachable. `retired` is terminal.
8. Governance activity rows never carry `engagement_id`; they carry `governance_program_id`.
9. Import boundary: `lib/governance` isn't imported by ConsultOS code or
   `lib/platform` (lint rule).
10. `docs/69` Meridian smoke run is unchanged.

### 4.8 Isolation from the founder self-test

- G1 touches **no ConsultOS table, route, or component**, except the shared
  sidebar entry and additive nullable columns on the platform tables
  (`activity_events`, `ai_synthesis_runs`).
- It is developed and verified on a Supabase dev branch/local stack. Production
  migrations `0026`–`0029` are applied only after the self-test run is not in
  progress, or with the founder's explicit OK.
- The staged `0023` RLS swap is **not** coupled to G1.

---

## 5. Beyond G1 (unchanged in intent; held until self-test findings are incorporated)

| Sprint | Module | Scope (summary) |
|---|---|---|
| G2 | GovernanceOS | Risks (§3.8c), requirements + framework sources (§3.8d), controls, mappings, `governance_policy_rules`, AI mapping suggestions (`ai_synthesis_runs` with `module='governanceos'`), **Promote to GovernanceOS** from reviewed ConsultOS findings (snapshot lineage + retention hold). This is the first ConsultOS→GovernanceOS contract call. |
| G3 | GovernanceOS (+ platform files) | Evidence on `stored_files`, decisions (append-only), exceptions, actions. Unlocks `approved` lifecycle + `gated` mode. |
| G4 | GovernanceOS | Assessments, monitoring signals, incidents, review surface, first trusted gate caller (internal model-change check), enforcement events. |
| G5 | GovernanceOS + platform share engine | Governance reports as new resource types on the share/snapshot engine; governance-aware pre-delivery gate; counsel-reviewed disclaimers; NIST AI RMF pack, then an ISO 42001 reference pack; cross-program work queue. |

### 5.1 Commercial entry points (not replacements for the module)

| Motion | Enters GovernanceOS via |
|---|---|
| Governance signal in the scorecard/readiness funnel | ConsultOS scorecard (`data.governance`) → routing copy → an offer. No GovernanceOS state until a program is created. |
| **AI Governance Baseline** (fixed fee, NIST AI RMF-first) | A ConsultOS engagement linked to a new `client` program. Findings are promoted in G2. |
| **Governance Program as a Service** (recurring) | The durable `client` program operated by Saipien (G4 review cadence, G5 work queue). |
| **Governed Delivery** | BuildOS/FDE deliveries register assets (`source_system='buildos'|'integration'`) with approval decisions (G3+). |

---

## 6. Platform ↔ GovernanceOS ledger (G0 + G1)

Use this table to verify GovernanceOS stays a first-class product surface.

| Work item | Owner | Sprint | Why it's there |
|---|---|---|---|
| Auth exposure audit + config/code fix | **Platform** | G0 | Protects all modules. No governance semantics. |
| `workspace_memberships`, `is_workspace_member`, `has_workspace_role`, `requireWorkspaceMember()` | **Platform** | G0 | Shared authorization primitive |
| Existing-table RLS swap (`0023`) | **Platform** | G0 (apply post-self-test) | Fixes ConsultOS exposure |
| Retention holds + delete-guard triggers | **Platform** | G0 | Generic cross-module durability. Platform doesn't know why a hold exists. |
| `activity_events` / `notes` / `ai_synthesis_runs` decoupling (`module`, `engagement_ref`, set-null) | **Platform** | G0 | Durable audit/provenance for every module |
| `stored_files` + durable bucket + sha256 | **Platform** | G0 (used G3) | Durable file persistence for every module |
| Migration-sequence guard, vitest, DB test harness, negative RLS tests | **Platform** | G0 | Shared test foundation |
| Share/snapshot engine generalization | **Platform** | G5 (decision only now) | GovernanceOS reports become new resource types |
| Program ownership, policy versioning, risk vocabulary, licensing, lineage vocabulary (`docs/76`) | **GovernanceOS** | G0 (docs) | Governance-domain conventions |
| `docs/73` Saipien AI Governance Operating Standard | **GovernanceOS / Saipien ops** | G0 (docs) | Policy source for the internal program |
| `governance_programs`, program↔engagement links, program members | **GovernanceOS** | G1 | Domain model |
| `governed_assets` + lifecycle events + lineage | **GovernanceOS** | G1 | Registry |
| `governance_policies` + immutable versions + activation RPC | **GovernanceOS** | G1 | Policy representation |
| `governance_program_id` columns on `activity_events` / `ai_synthesis_runs` | **GovernanceOS** (on platform tables) | G1 | Module's use of platform audit. Platform tables never reference governance. |
| `lib/governance/*` (contracts, authorization, activity, retention, programs, registry, policies, posture) | **GovernanceOS** | G1 | Service layer + control-plane contracts |
| `/app/governance/**` routes, overview, registry, policies, activity, settings | **GovernanceOS** | G1 | Operator UX |
| Sidebar "GovernanceOS" group | **GovernanceOS** (one-entry edit to the shared shell) | G1 | First-class nav presence |
| Saipien internal program + registry + advisory policies | **GovernanceOS** | G1 | First real program |
| ConsultOS code changes | **none** | G1 | Isolation; the first ConsultOS→GovernanceOS call is G2 "Promote" |

---

## 7. Decisions still needed before coding

| # | Decision | Recommendation |
|---|---|---|
| Q-G0-1 | Run the §3.1 audit yourself (dashboard access), or grant access for Claude to read Auth settings via the Supabase MCP? | Founder runs it; Claude drafts the checklist + records results. |
| Q-G0-2 | Test database: local Supabase stack (Docker in WSL) or a Supabase dev branch? | Local if Docker is available (free, disposable). Otherwise a dev branch. Dev branches have a cost, so confirm before creating one. |
| Q-G0-3 | Add GitHub Actions CI to run `lint`, `build`, `test`, `check:migrations` on PRs? | Yes, but as a separate small item after G0 (DB tests stay local/manual until then). |
| Q-G0-4 | Apply the `0023` RLS swap immediately after the self-test, or bundle it with the first-client readiness pass? | Immediately after the self-test. It's a prerequisite for any external use, per your direction. |
| Q-G1-1 | `governance_program_members` enforced by RLS for client programs in G1, or only in the app layer until client users exist? | RLS in G1. It's cheap now and expensive to retrofit. |

---

## 8. Proposed doc set

| Doc | Owner | Sprint |
|---|---|---|
| `docs/72` (this) — integration plan | GovernanceOS | now |
| `docs/73` — Saipien AI Governance Operating Standard | GovernanceOS / Saipien ops | G0 |
| `docs/74` — Platform auth exposure audit | Platform | G0 |
| `docs/75` — Platform lifecycle-durability audit | Platform | G0 |
| `docs/76` — GovernanceOS domain conventions | GovernanceOS | G0 |
| `docs/77` — G0 acceptance audit; `docs/78` — G1 acceptance audit | both | G0 / G1 |
| `docs/09` entries (naming canon, boundary rule, deps, staged RLS), `docs/08` + `docs/10` updates, `docs/00` + `docs/39` amendment notes | canon | G0 |
