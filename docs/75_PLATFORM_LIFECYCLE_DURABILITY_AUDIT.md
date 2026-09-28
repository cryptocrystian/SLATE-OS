# Platform Lifecycle-Durability Audit (G0)

## Status

- **Date:** 2026-09-28
- **Layer:** SLATE platform (G0, `docs/72 §3.4`)
- **Canon rule under test (Architect, 2026-09-25):** *No lifecycle event in one
  SLATE module may silently destroy or invalidate another module's history.*
- **Result:** fixed by `0024_platform_retention_holds_audit_durability.sql` and
  `0025_platform_durable_files.sql`. Verified in PGlite
  (`tests/platform/lifecycle-durability.db.test.ts`, 10 tests) and on a Supabase
  dev branch (real PG17 + Supabase schemas).

---

## 1. Delete paths in the application

There are **none.** No code in `lib/` or `app/` deletes an `engagement`,
`account`, `lead` or `contact`. Every cascade below fires only from SQL/dashboard
or from future code. That's why the fix is a database guard, not an app change.

## 2. Cascade inventory and classification

"Engagement-private" means the data exists only to serve that one ConsultOS
engagement, so cascading is correct. "Cross-module" means another module or
the audit trail may depend on the row after the engagement is gone.

| Table (migration) | FK → | Before | Class | After G0 |
|---|---|---|---|---|
| `stakeholder_intake_sessions`, `stakeholder_responses`, `input_assets` (0005) | engagements | cascade | Engagement-private (files: see §4) | unchanged |
| `findings`, `finding_source_refs` (0006) | engagements | cascade | Engagement-private* | unchanged |
| `opportunities`, `opportunity_finding_links`, `roadmap_items` (0007) | engagements | cascade | Engagement-private | unchanged |
| `reports`, `report_sections`, `report_section_*_links`, `proposals`, `proposal_options`, `proposal_option_*_links` (0008) | engagements | cascade | Engagement-private | unchanged |
| `report_delivery_snapshots`, `report_share_tokens`, `proposal_delivery_snapshots`, `proposal_share_tokens`, `sow_share_tokens` (0013–0016, 0021) | engagements | cascade | Engagement-private | unchanged |
| `engagement_intake_documents` (0017) | engagements | cascade | Engagement-private | unchanged |
| **`activity_events`** (0009) | engagements, leads | cascade | **Cross-module (audit)** | `on delete set null` + `engagement_ref` / `lead_ref` |
| **`notes`** (0009) | engagements, leads | cascade | **Cross-module (history)** | `on delete set null` + `engagement_ref` / `lead_ref` |
| **`ai_synthesis_runs`** (0011) | engagements | cascade, NOT NULL | **Cross-module (AI provenance)** | nullable, `set null`, `engagement_ref`, generic `subject_type/subject_id`, `module` |
| `contacts` (0002) | accounts | cascade | Cross-module when referenced (e.g. a governance owner) | guarded by retention hold |

\* Findings are engagement-private **as ConsultOS records**. When GovernanceOS
promotes a finding (G2), it snapshots the content into governance lineage and
places a hold on the engagement. The governance record never depends on the
finding row surviving.

## 3. Mechanisms

1. **Retention holds** (`public.retention_holds`). This is a generic platform
   primitive: a module records "I depend on entity X". `BEFORE DELETE` triggers
   on `engagements`, `accounts`, `contacts` and `leads` raise
   `retention_hold_active`. They fire for cascaded deletes too, and even for the
   superuser. Holds are released, never deleted. Release is recorded once and
   is immutable.
2. **Audit decoupling.** The three cross-module tables keep their rows when an
   engagement or lead is deleted. The FK nulls out and the `*_ref` column still
   names the original. A trigger fills `*_ref` on insert, so **no ConsultOS code
   changed**.
3. **Engagement-optional AI provenance.** `ai_synthesis_runs` rows can describe
   internal, venture or governance work (`subject_type/subject_id`). A check
   still demands every run names *something*.
4. **Durable file store.** `stored_files` + the private `slate-durable-files`
   bucket, with no engagement ownership. Files are **copied** in (never moved),
   with sha256 recorded NOT NULL (`lib/platform/files.ts`).

## 4. Files

`input_assets` rows (and their `engagement-documents` objects) remain
engagement-private and cascade as before. A module that must retain a file
copies it into the durable store (`source_kind = 'input_asset_copy'`,
`source_ref = input_assets.id`).

**Open item:** whether `input_assets.checksum_sha256` is populated today wasn't
verified, because it requires reading production rows during the self-test. It
doesn't matter for durability, since the durable store computes its own hash.

## 5. ConsultOS impact

- Reads: none. ConsultOS readers filter by a *specific live* `engagement_id`,
  so orphaned audit rows (`engagement_id is null`) never appear.
- Writes: none. The `*_ref` fields are trigger-filled, and `module` defaults to `consultos`.
- Behaviour: a manual engagement delete now leaves the audit/provenance rows
  behind instead of erasing them. A held engagement can't be deleted.

## 6. Verification evidence

| Check | PGlite | Supabase branch |
|---|---|---|
| Audit rows survive engagement delete with `engagement_ref` | ✓ | ✓ |
| Engagement-private rows still cascade | ✓ | ✓ |
| Held engagement delete refused (superuser and member) | ✓ | ✓ |
| Released hold → delete allowed, hold history kept | ✓ | ✓ |
| Holds immutable, not deletable by members | ✓ | n/a (same DDL) |
| `ai_synthesis_runs` subject check | ✓ | — |
| Guard still fires after `EXECUTE` revoked from API roles | — | ✓ |
