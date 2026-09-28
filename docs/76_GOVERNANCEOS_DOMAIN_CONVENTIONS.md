# GovernanceOS — Domain Conventions

## Status

- **Date:** 2026-09-28
- **Owner:** GovernanceOS (module canon, not platform)
- **Authority:** finalized in G0 per `docs/72 §3.8`. Binding on every
  GovernanceOS migration and every `lib/governance/*` module. Changes require a
  `docs/09` decision-log entry.

---

## 1. Program ownership — `program_kind`

| `program_kind` | Owner | DB constraint |
|---|---|---|
| `client` | `account_id` → `accounts` (`on delete restrict` + a platform retention hold) | `account_id is not null` |
| `internal` | the workspace itself (Saipien) | `account_id is null` (no fake CRM account) |
| `venture` | lineage: `venture_source_system = 'ventureos'`, `venture_source_id text` | `venture_source_id is not null`; `account_id` optional |

- Accountable people are stored as `owner_profile_id` (a Saipien operator) plus an optional
  **name snapshot** of the executive sponsor (`executive_sponsor_name`, optional
  `executive_sponsor_contact_id` with `on delete set null`). A deleted contact
  never erases who was accountable.
- Program lifecycle: `draft → active ⇄ paused → archived`. **There is no delete.**
  `archived` is terminal in G1.

## 2. Policy versioning — immutable, superseding

- `governance_policies` holds the **identity**: `policy_key` (stable, unique per program),
  `name`, `policy_domain`, owner.
- `governance_policy_versions` holds the **content**: `version` (1, 2, 3… per policy),
  `status draft → active → superseded | retired`, `activation_mode`, `statement`,
  `scope jsonb`, `supersedes_version_id`.
- A version is **editable only while `draft`.** A trigger rejects updates to content
  columns and any delete of a non-draft version.
- At most one `active` version per policy (partial unique index).
- Activation goes through a single server-side function
  (`governance_activate_policy_version`). It atomically marks the prior active
  version `superseded` and the new one `active`, stamps who and when, and is
  idempotent on retry.
- **Activation mode ladder:**

| Mode | Allowed from | Meaning |
|---|---|---|
| `advisory` | G1 | Surfaced to operators and systems; never blocks. |
| `gated` | G3 (needs decision records) | A human/system decision is required before the transition. |
| `enforced` | G4+ (needs a registered enforcement adapter) | A trusted runtime can technically block. **Never claimed without a real adapter.** |

G1 enforces this with a check constraint (`activation_mode = 'advisory'`),
which later migrations relax.

## 3. Risk-rating vocabulary (used from G2)

- **Fixed, queryable, cross-program:** `rating_tier in ('low','medium','high','critical')`.
  It's **derived server-side** from likelihood × impact through the program's matrix.
  AI never sets it; that follows the same principle as the opportunity quadrant
  (`docs/09`, 2026-05-06).
- **Fixed ordinal inputs:** `likelihood` 1–5 (rare, unlikely, possible, likely,
  almost certain); `impact` 1–5 (negligible, minor, moderate, major, severe).
- **Flexible per program:** the 5×5 → tier matrix lives in
  `governance_programs.risk_scale` (a Saipien default is supplied; thresholds
  are adjustable, validated server-side). Framework-specific labels and
  rationale are stored **alongside** the ordinal columns, never instead of them.

Default matrix (score = likelihood × impact): 1–4 `low` · 5–9 `medium` ·
10–16 `high` · 20–25 `critical`.

## 4. Licensed standards (used from G2)

`governance_framework_sources.license_class`:

| Class | Examples | What may be stored |
|---|---|---|
| `public_domain` | NIST AI RMF 1.0, NIST AI 600-1 | Verbatim text with attribution. |
| `licensed_reference_only` | ISO/IEC 42001, ISO/IEC 23894 | **Clause identifier + clause title + Saipien-authored guidance only.** `text_origin = 'saipien_paraphrase'`. A check forbids `verbatim`. |
| `client_proprietary` | A client's internal AI policy | Stored only inside that client's program; never reused elsewhere. |

## 5. Source lineage vocabulary

- `source_system in ('consultos','buildos','ventureos','integration','runtime','internal','external')`
- `source_entity_type text`, `source_entity_id text` (text, so external/runtime ids fit),
  `correlation_id text`.
- Uniqueness: one governed asset per `(program, source_system, source_entity_type,
  source_entity_id)` when a source is given. `registerGovernedAsset` is
  idempotent on that key.
- **Lineage is never an authorization input.** Holding a source id grants nothing.

## 6. Governed-asset lifecycle

`proposed → assessment → active → restricted → retired`.

- **`approved` is reserved.** It's unreachable until G3 decision records exist.
  An asset already running shows as **`active · not yet governance-approved`**.
- `retired` is terminal. There is no delete.
- Every transition writes an append-only `governed_asset_lifecycle_events` row
  and an activity event.

## 7. Activity and provenance

- Governance events use `module = 'governanceos'` and set
  `governance_program_id`. They **never set `engagement_id`**. An engagement
  reference goes in metadata as `sourceEngagementId` (and the platform
  `engagement_ref` stays null).
- Event type naming: `governance_<entity>_<past-tense verb>`, e.g.
  `governance_program_created`, `governance_asset_registered`,
  `governance_policy_version_activated`.
- AI runs (G2+): `module = 'governanceos'`, `subject_type = 'governance_program'`.

## 8. Program roles

`program_admin | governance_manager | reviewer | contributor | viewer`,
stored in `governance_program_members`.

- Internal programs: active workspace `owner`/`operator` members are implicit
  `program_admin`s.
- Client and venture programs: explicit membership is required (enforced in RLS).
  The creator is added as `program_admin`.
- Role logic lives only in `lib/governance/authorization.ts` and the matching SQL
  helper. The UI never decides authority.
