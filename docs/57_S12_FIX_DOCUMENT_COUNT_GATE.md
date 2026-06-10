# docs/57 — Sprint S12-Fix: Repair Document Count Readiness Gate

> **Verdict:** ✅ **PASS.** Narrow blocker-fix sprint to close L-34 from S12. The S11 pre-delivery audit loader queried `input_assets` with `.is("deleted_at", null)`, but the deployed `input_assets` schema has no `deleted_at` column. PostgREST rejected the filter and `supabase-js` resolved the count to `null → 0`, which forced C3 (`documents_not_uploaded_or_acked`) to always block unless `documentsClearedOrAcknowledged === true`. The fix drops the spurious clause so the loader reads the real document count. No migration. No schema change. No delivery boundary moved.
>
> **Branch:** `staging` (will be fast-forwarded post-commit).
> **Smoke:** `artifacts/s11-pre-delivery-audit-smoke.mjs` extended with 4 new C3 regression cases — 53 / 53 PASS.
> **Lint + build:** PASS.
> **Disclaimer check:** PASS.

## 1. Root cause confirmation

`lib/engagement-readiness/pre-delivery-audit-loader.ts` shipped in Sprint S11 with this signature:

```ts
async function loadDocumentsCount(supabase, engagementId): Promise<number> {
  const { count } = await supabase
    .from("input_assets")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .is("deleted_at", null);
  return count ?? 0;
}
```

Direct schema inspection via Supabase MCP confirms the `input_assets` table has these columns: `id, workspace_id, engagement_id, session_id, title, asset_type, source, status, evidence_quality, linked_role, summary, metadata, created_at, updated_at, storage_bucket, storage_path, original_filename, mime_type, size_bytes, uploaded_by_profile_id, uploaded_by_user_id, uploaded_by_session_id, uploaded_at, download_count, last_downloaded_at, checksum_sha256`. **No `deleted_at` column.**

Tracing the canonical pattern: `lib/intake/queries.ts` (the operator-facing intake document loader) reads `input_assets` with `.eq("engagement_id", …).order("created_at", …)` and applies **no soft-delete filter** — confirming that `input_assets` has no soft-delete concept in the canon. Migrations 0005 (initial intake), 0010 (file storage extension), and 0017 (offline intake extensions) collectively define the schema; none introduces `deleted_at`. The `status` column is the canonical lifecycle.

**Conclusion: the S11 filter was speculative — added by analogy with `notes` (which does have `deleted_at` per migration 0009), but never grounded in the `input_assets` migration chain.**

## 2. Fix decision

Per the task spec, the smallest safe fix is **A: remove the `deleted_at` filter**. No migration. No new column. No new soft-delete concept. The loader now mirrors `lib/intake/queries.ts` verbatim for document presence.

Alternatives considered + rejected:

- **B: add a `deleted_at` column via migration.** Rejected. No canon support for soft-delete on `input_assets`. Would require a separate canon decision + UI affordance for "delete a document" which doesn't exist today. Pure scope creep.
- **C: use an existing archival field.** Rejected. `input_assets.status` carries lifecycle but the canon uses `status` to track upload/processing state, not archival. Re-purposing it as a soft-delete signal would conflate two contracts.

## 3. Exact source fix

`lib/engagement-readiness/pre-delivery-audit-loader.ts` — `loadDocumentsCount`:

```ts
async function loadDocumentsCount(supabase, engagementId): Promise<number> {
  // Sprint S12-Fix (L-34 closure) — drop the spurious .is("deleted_at", null)
  // filter; input_assets has no soft-delete column. Conservative null→0
  // posture preserved for any genuine read error.
  const { count, error } = await supabase
    .from("input_assets")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId);
  if (error) {
    console.error("[engagement-readiness.pre-delivery-audit] documents-count-failed", {
      name: error.name, code: error.code, message: error.message,
    });
    return 0;
  }
  return count ?? 0;
}
```

**Diff:** −1 line filter `.is("deleted_at", null)`, +6 lines (explicit error branch + conservative comment block). Net +5 lines of behavioural code + ~17 lines of canon-documentation comment.

## 4. Smoke / regression coverage

`artifacts/s11-pre-delivery-audit-smoke.mjs` extended with 4 new pure-logic regression cases under `-- S12-Fix C3 regression (L-34 closure) --`:

| Case | Setup | Expected |
|---|---|---|
| C3 #1 | `totalDocuments = 2`, ack=false | C3 NOT in block list ✅ |
| C3 #2 | `totalDocuments = 0`, ack=false | C3 blocks ✅ |
| C3 #3 | `totalDocuments = 0`, ack=true | C3 NOT in block list ✅ |
| C3 #4 | `/p` surface, `totalDocuments = 0`, ack=false | C3 blocks on /p too ✅ |

Cases #2 and #4 also document the **conservative loader-failure posture**: when the live query errors (e.g. transient connection drop), the loader returns `0`, and the evaluator interprets `0 + ack=false` as block — never falsely allowing a mint.

The full smoke now runs **53 / 53 PASS**:

```
=== Sprint S11 — Pre-Delivery Audit Smoke ===
…
-- S12-Fix C3 regression (L-34 closure) --
  PASS  C3 #1: totalDocuments>0 → C3 not in block list
  PASS  C3 #2: totalDocuments=0 + no ack → C3 blocks
  PASS  C3 #3: totalDocuments=0 + ack=true → C3 clears
  PASS  C3 #4: conservative failure → blocks /p too

-- Determinism --
  PASS  Same input → same evaluatedAt + reason codes

=== ALL PASS ===
```

The 49 pre-existing assertions are unchanged — no other gate weakened.

## 5. Live validation

Live read of `input_assets` for both engagements via Supabase MCP against project `hhglrcvsmwaheikdvijw`:

| Engagement | Real `input_assets` count | Pre-fix behavior | Post-fix behavior |
|---|---|---|---|
| Sapient Digital (`76097653-fedb-42e5-9ef6-e89a0e97f802`) | **0** | C3 blocked (via masked schema error) | C3 still blocks — but now on a **real** count, not a query failure |
| SLATE Pilot Test Client (`ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4`) | **0** | C3 blocked (same mask) | C3 still blocks — same real-value reasoning |

Both engagements have **0** documents in reality, so the verdict shape is identical pre-/post-fix. **What changed:** the gate now reasons from the deployed schema rather than masking a `42703` PostgREST error. The C3 block becomes an honest "no documents and no acknowledgement" verdict instead of a side-effect of a missing-column query failure.

Sapient audit verdict re-derivation (cross-surface chain unchanged):

- `/r` — `ready=false, severity=block, 10 codes` (same as S12 §6.1; C3 still in the list)
- `/p` — `ready=false, severity=block, 8 codes` (same as S12 §6.2; C3 still in the list)

**No token minted. No snapshot inserted. No mint action invoked.** This sprint is read-only against the database; the source change rebuilds the evaluator's reading lens but does not flip any verdict.

SLATE Pilot Test Client verdict re-derivation: the historical S5-S10 fixture had `documentsClearedOrAcknowledged === true` passed via the UI affordance (or implicitly via the controlled-fixture entry path); with that flag the verdict shape for the fixture is unchanged. Without that flag, C3 would block — same real-world behavior as the pre-fix branch. No fixture-side regression.

## 6. Boundary confirmation

| Rule | Status |
|---|---|
| No /r mint | ✅ |
| No /p mint | ✅ |
| No SOW generation | ✅ |
| No SOW share link | ✅ |
| No Send to Client | ✅ |
| No email | ✅ |
| No CRM writeback / Attio writes | ✅ |
| No e-signature | ✅ |
| No public SOW route / `/s` route | ✅ |
| No Group-B public wiring | ✅ |
| No Sapient content mutation | ✅ — read-only Supabase MCP query only |
| No real-client delivery mutation | ✅ |
| No `docs/39` sequence change | ✅ — S12-Fix is a blocker-fix sprint slotted between S12 and the next readiness-completion sprint; the locked S13 row is unchanged |
| No package dependency change | ✅ (`git diff HEAD -- package.json package-lock.json` empty) |
| Existing token expiry/revoke/access-log/public-render behavior | ✅ untouched |

## 7. Quality gates

| Gate | Result |
|---|---|
| `npm run lint` | ✅ No ESLint warnings or errors |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | ✅ `next build` succeeds, 33-route table byte-stable |
| `npm run check:send-to-client-disclaimers` | ✅ all 4 canonical pins present |
| `node artifacts/s11-pre-delivery-audit-smoke.mjs` | ✅ 53 / 53 PASS |
| Live MCP read against deployed Supabase | ✅ both engagements return real `input_assets` count without error |

Route size impact: **zero**.

## 8. Limitations

- **L-34 — CLOSED by this sprint.** Loader contract restored. Future migrations that introduce a soft-delete pattern on `input_assets` will need to re-add a filter clause; until then, no filter applies.
- **L-35 (carry-over) — Sapient Digital pipeline still empty.** Not in this sprint's scope.
- **L-36 (carry-over) — no Chrome MCP live UI walkthrough.** Source-side audit verdict + live MCP read provide complete evidence for this fix; the UI rendering is unchanged.

## 9. Recommended next sprint

Per the user spec: **Path A Step 1 — Sapient Stakeholder Intake Onboarding**.

Bring Sapient Digital's intake from `1 invited / 0 ready` to `≥ 3 invited / ≥ 2 ready` using the existing canonical lanes:

- **Mode A (live link)** — `docs/37` § Mode A — generate intake links for 2 additional canonical-role stakeholders (operations + finance recommended) via the existing `Generate intake link` affordance on the engagement intake page; stakeholders submit through the public `/intake/<token>` route.
- **Mode B (operator-staged offline)** — `docs/37` § Mode B — stage stakeholders via the offline-intake panel + author responses operator-side; promote to `response_status='ready_for_synthesis'` when complete.
- **Mode C (transcript)** — `docs/41` § transcript intake panel — paste a stakeholder transcript (interview or meeting recording transcript) for segmentation + ingestion.

Any combination of the three lanes is canonical. The audit gate's C1 + C2 will clear once `intakeRolesInvited ≥ 3` (canonical roles) and `intakeReadyResponseSessions ≥ 2`. C3 through C10 will still block — additional readiness-completion sprints are needed before any future S12 retry. **Roadmap sequence unchanged.**

## 10. Suggested commit message

```
Repair document count readiness gate
```

(Per task spec — body to be authored with the L-34 closure narrative + cross-references.)
