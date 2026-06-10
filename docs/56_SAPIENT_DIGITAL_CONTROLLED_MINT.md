# docs/56 — Sprint S12: Sapient Digital Controlled /r + /p Mint

> **Verdict:** ✅ **PASS** — sprint completed cleanly with the **canonically-correct outcome of zero mint**. The S11 pre-delivery audit gate refused the `/r` and `/p` mint for the Sapient Digital engagement on every applicable readiness condition. No token rows were created; no delivery snapshots were created; no public link was minted; no Sapient mutation occurred. The audit system worked exactly as designed on its first contact with a real, not-yet-ready client engagement.
>
> **Branch / commit:** `staging` / `5775e9a` — Enforce pre-delivery audit gate.
> **Deployed Production:** `slate-os-staging.vercel.app` serving the S11 build.
> **Audience label that would have been used:** `FIRST CLIENT PILOT 2026-06-09 SAPIENT DIGITAL`.

## 1. Sprint context

Sprint S12 is the first controlled client-pilot mint attempt per `docs/39` § 5. Sprint scope: attempt to mint `/r` and `/p` share tokens for Sapient Digital through the S11 code-side pre-delivery audit gate; if the gate passes, surface raw URLs once for operator manual delivery; if the gate blocks, do not bypass — document the block reasons and recommend the smallest readiness completion path.

S12 is **not** a feature sprint. No new source. No migration. No new dependency. The work is observational + documentary against the deployed Production build.

## 2. Pre-flight deployment verification

| Check | Result |
|---|---|
| Branch head | `5775e9a` (Enforce pre-delivery audit gate) ✅ |
| `staging` branch contains S11 enforcement | ✅ — fast-forwarded from `persistence/step-0-1-auth-shell` at S11 close |
| Vercel canonical alias serves S11 build | ✅ `slate-os-staging.vercel.app` |
| `/r/<bad-token>` returns 200 generic-unavailable | ✅ |
| `/p/<bad-token>` returns 200 generic-unavailable | ✅ |
| `/s/<token>` returns 404 (no public SOW route) | ✅ |
| Lint clean | ✅ `✔ No ESLint warnings or errors` |
| Production build clean | ✅ `next build` succeeds, 33-route table byte-stable vs S11 |
| Send-to-Client disclaimer check | ✅ all 4 canonical pins present |

## 3. Sapient Digital canonical engagement

Read-only verification via Supabase MCP against project `hhglrcvsmwaheikdvijw` (SLATE OS).

| Field | Value |
|---|---|
| Engagement ID | `76097653-fedb-42e5-9ef6-e89a0e97f802` |
| Name | Sapient Digital — AI Opportunity Sprint |
| Status | `setup` |
| Current stage | `setup` |
| Engagement type | `ai_opportunity_sprint` |
| Account | `Sapient Digital` (`63ddab75-9fa0-4a1c-898d-29e42e445287`) |
| Contact | `c7aace71-5263-44b1-adcd-6a006dc362c9` |
| Linked lead | `fee3895a-7943-48d1-8a28-df98eafb74f2` |
| Created | `2026-05-06` |
| Target date | `2026-06-17` |
| Reports row | 1 (`status=draft`, id `08bdee36-…`) |
| Proposals row | 1 (`status=draft`, id `77031092-…`) |

Engagement is **unique**, **persisted**, **draft-stage**, **not** the SLATE Pilot Test Client fixture (`ed7f1f7d-…`). No new engagement created; no Sapient content mutated.

## 4. Pre-mint token / snapshot inventory

| Surface | Active (unexpired) | Total historical | Revoked |
|---|---|---|---|
| Report share tokens | **0** | 10 | 10 |
| Proposal share tokens | **0** | 4 | 4 |

| Snapshot table | Non-voided count | Notes |
|---|---|---|
| `report_delivery_snapshots` (engagement-scoped, voided_at IS NULL) | **3** | Legacy artifacts from pre-S1 testing. Not minted in S12. |
| `proposal_delivery_snapshots` (`delivery_surface='client_proposal_candidate'`, `approval_state='approved'`, voided_at IS NULL) | **2** | Both with `commercial_guard_result.passed = true`. Legacy artifacts from pre-S1 testing. Not minted in S12. |

Active share-token count is **0** on both surfaces — C13 (stale-token hygiene) is satisfied.

## 5. Source-of-truth readiness counts

Direct read from the deployed Supabase, mirroring the field set that `lib/engagement-readiness/pre-delivery-audit-loader.ts` resolves.

| Field | Sapient Digital value | docs/35 § 5 row | Required |
|---|---|---|---|
| `intakeRolesInvited` | **1** (executive only) | 1 | ≥ 3 |
| `intakeReadyResponseSessions` | **0** | 2 | ≥ 2 |
| `totalDocuments` | **0** | 3 | ≥ 1 OR ack |
| `draftedFindings` | **0** | 4 | ≥ 8 |
| `approvedFindings` | **0** | 5 | ≥ 5 |
| `createdOpportunities` | **0** | 6 | ≥ 3 |
| `recommendedOpportunities` | **0** | 7 | ≥ 1 |
| `readyRoadmapItemsLinked` | **0** (3 items exist all `status=planned`, `opportunity_id IS NULL`) | 8 | ≥ 3 |
| `draftedReportSections` | **1** (executive_summary in `needs_review`; 11 sections `not_started`) | 9 | ≥ 10 of 12 |
| `approvedReportSections` | **0** | 10 | ≥ 8 of 12 incl. ExecSummary |
| `approvedSectionsIncludeExecutiveSummary` | **false** | 10 | true |
| `hasFreshReportSnapshot` | **true** (3 legacy non-voided) | 11 | exists |
| `hasApprovedProposalSnapshot` | **true** (2 legacy approved + guard-passed) | 12 | exists |
| `proposalCommercialGuardPassed` | **true** | 15 | true |
| `activeShareTokensOnSurface` | **0** (both surfaces) | 13/14 | 0 |
| Audience label | `FIRST CLIENT PILOT 2026-06-09 SAPIENT DIGITAL` | 14 | no audit/walkthrough/test/controlled/sample/staging/dev/qa prefix → ✅ |

## 6. S11 pre-delivery audit verdict

Evaluator output produced by `artifacts/s12-sapient-audit-eval.mjs` (an inlined copy of the canonical `evaluatePreDeliveryAudit` consuming the source-of-truth counts above).

### 6.1 Report surface (`/r` mint)

```
ready    : false
severity : block
block n  : 10
  - intake_required_roles_missing       [observed 1 / required 3]
  - intake_substantive_responses_missing [observed 0 / required 2]
  - documents_not_uploaded_or_acked     [observed 0 / required 1]
  - findings_drafted_too_few            [observed 0 / required 8]
  - findings_approved_too_few           [observed 0 / required 5]
  - opportunities_created_too_few       [observed 0 / required 3]
  - opportunities_recommended_missing   [observed 0 / required 1]
  - roadmap_items_linked_too_few        [observed 0 / required 3]
  - report_sections_drafted_too_few     [observed 1 / required 10]
  - report_sections_approved_too_few    [observed 0 / required 8]
```

`report_snapshot_missing` is **not** in the block list — 3 legacy non-voided snapshots exist. `stale_active_share_tokens` is **not** in the block list — 0 active. `audit_only_label_leak` is **not** in the block list — the candidate audience label passes prefix discipline.

### 6.2 Proposal surface (`/p` mint)

```
ready    : false
severity : block
block n  : 8
  - intake_required_roles_missing       [observed 1 / required 3]
  - intake_substantive_responses_missing [observed 0 / required 2]
  - documents_not_uploaded_or_acked     [observed 0 / required 1]
  - findings_drafted_too_few            [observed 0 / required 8]
  - findings_approved_too_few           [observed 0 / required 5]
  - opportunities_created_too_few       [observed 0 / required 3]
  - opportunities_recommended_missing   [observed 0 / required 1]
  - roadmap_items_linked_too_few        [observed 0 / required 3]
```

`proposal_snapshot_not_approved` is **not** in the block list — 2 legacy approved snapshots exist. `commercial_guard_not_passed` is **not** in the block list — both legacy approved snapshots passed the commercial guard. `stale_active_share_tokens` is **not** in the block list — 0 active. `audit_only_label_leak` is **not** in the block list.

### 6.3 Verdict summary

Both surfaces **BLOCKED** on the cross-surface upstream chain (intake / docs / findings / opportunities / roadmap). The report surface additionally blocks on report-section completion. The proposal surface passes its surface-specific gates **only because of pre-existing legacy snapshots** from before the canonical content pipeline was built — those snapshots are not validated client-quality content, and if the proposal pipeline were to be reseeded properly, those snapshots should be voided and re-generated against the real Sapient findings / opportunities / roadmap. Per the strict non-goals (`no synthetic Sapient readiness data merely to force a pass`), we do not void / regenerate / re-mint anything in S12.

## 7. /r mint result

**SKIPPED — audit gate blocked.**

- No call made to `generateShareLinkAction`.
- No row inserted into `report_share_tokens`.
- No row inserted into `report_delivery_snapshots`.
- No `report_share_token_created` activity event emitted.
- No `pre_delivery_audit_blocked` activity event emitted (because the audit was not invoked through the server action; only the read-only evaluator was run for verdict computation).
- No raw `/r` URL surfaced.

## 8. /p mint result

**SKIPPED — audit gate blocked.**

- No call made to `generateProposalShareLinkAction`.
- No row inserted into `proposal_share_tokens`.
- No row inserted into `proposal_delivery_snapshots`.
- No `proposal_share_token_created` activity event emitted.
- No `pre_delivery_audit_blocked` activity event emitted (read-only evaluator only).
- No raw `/p` URL surfaced.

## 9. Public render validation

**N/A — no mint occurred.**

The deployed `/r/<token>` and `/p/<token>` routes are nonetheless verified to continue serving the generic-unavailable page (200 OK) for invalid tokens, and `/s/<token>` continues to return 404. Existing public-route behaviour is unchanged by S12. See `docs/32` § 4 for the canonical evidence battery; no regression delta.

## 10. Activity metadata safety

S12 introduces **zero** new activity events because no mint action was invoked. The pre-existing `pre_delivery_audit_blocked` event type (landed in S11) was not fired in S12 either — the read-only evaluator was used for verdict computation, not the server action.

Re-verification of the canonical S11 sanitization shape (no S12 change): `{surface, ready: false, severity, snapshotId, blockingReasonCodes[], warningCodes[], blockingReasonCount, evaluatedAt, audienceLabelPresent (bool)}`. Zero PII, zero raw audience label text, zero raw email, zero token bytes, zero answer text. See `docs/55` § 5 + § 6 for the source-side proof.

## 11. Boundary confirmation

| Rule | Status |
|---|---|
| No Send to Client | ✅ surface untouched |
| No email | ✅ no mail integration |
| No CRM writeback | ✅ Attio read-only context unchanged |
| No Attio writes | ✅ |
| No e-signature | ✅ |
| No SOW share link / `/s` route | ✅ `/s/test` still 404 |
| No Group-B public wiring | ✅ |
| No S11 audit bypass | ✅ — verdict respected; no `--override` path taken; no service-role insertion |
| No direct DB token insertion | ✅ |
| No synthetic Sapient readiness data | ✅ — no rows updated on the Sapient Digital engagement during S12; the evaluator ran as a pure read-only check |
| No real-client mutation outside intended mint | ✅ — no mint occurred |
| No SLATE Pilot Test Client used for Sapient mint | ✅ |
| No `docs/39` sequence change | ✅ — S13 still follows S12; S12 marked RAN with gate-blocked verdict |

## 12. Limitations

- **L-34 — CLOSED by Sprint S12-Fix (`docs/57`).** Loader contract restored — `.is("deleted_at", null)` filter dropped; `totalDocuments` now reads the real count from `input_assets` via the canonical pattern. Conservative null→0 posture preserved for genuine read errors. Pre-fix description retained for audit trail: `lib/engagement-readiness/pre-delivery-audit-loader.ts` filtered `input_assets` with `.is("deleted_at", null)` but no `deleted_at` column exists; PostgREST returned an error which `supabase-js` resolved to `null → 0`, forcing C3 (`documents_not_uploaded_or_acked`) to always block unless `documentsClearedOrAcknowledged === true`. Conservative failure mode — never falsely allowed a mint — but contract drift from the deployed schema. Closed in `5xxxxxx` (S12-Fix commit).
- **L-35 — Sapient Digital pipeline is empty.** Every cross-surface readiness condition fails at the root level (intake / docs / findings / opportunities / roadmap). The two existing legacy proposal snapshots and three legacy report snapshots are pre-S1 artifacts and should be voided + regenerated against real Sapient content before any future mint attempt. **Not addressed in S12.**
- **L-36 — No Chrome MCP live walkthrough of the mint UI on the deployed Sapient page.** Source-side audit verdict + direct Supabase state read are sufficient evidence for the gate-blocked outcome. A live UI walkthrough would only re-confirm the same verdict + emit one `pre_delivery_audit_blocked` activity row for the Sapient engagement; the operational cost / value isn't justified given the source-side proof is complete. The carry-over Chrome MCP synthetic-click workaround (L-25) still applies if a future walkthrough is desired.

## 13. Recommended next sprint

The user's S12 task spec instructs: *"If the gate blocks, do not bypass; document the block reasons and recommend the smallest readiness completion sprint."*

**Smallest readiness completion sprint** for Sapient Digital is:

### Sapient Stakeholder Intake Onboarding

Bring Sapient Digital's intake from `1 invited / 0 ready` to `≥3 invited / ≥2 ready` using the existing canonical lanes (`docs/37` Mode A live-link + Mode B operator-staged offline + Mode C transcript). Specifically:

1. Invite 2 additional canonical-role stakeholders (e.g. operations + finance) via the existing `Generate intake link` affordance. Reuse the operator-staged stakeholder slot UI from I2/I3.
2. Collect ≥2 `response_status='ready_for_synthesis'` rows via either the live-link route (`/intake/<token>`) submitted by the stakeholder, or operator-staged offline entry (`docs/37` Mode B), or transcript ingest (`docs/41` transcript intake panel).
3. Re-run the S11 pre-delivery audit. Expected result after intake onboarding: C1 + C2 clear; C3-C10 still block. Additional sprints would be needed to complete docs, synthesize findings, etc.

**This is the smallest unblock.** It does not change `docs/39` § 5 sequence; S13 remains "Mark Sent + Engagement Closure" and is structurally gated by S12 mint success, which is in turn gated by the upstream readiness chain. The recommendation is a *readiness completion* effort prerequisite to retrying S12, not a re-architecture of the roadmap.

The roadmap-level decision (whether to attempt full Sapient readiness completion now, or defer Sapient and validate the full Phase 1B engine on a second real client) is the operator's call. Either path preserves the canonical sequence.

## 14. Suggested commit message

```
Run Sapient Digital controlled mint
```

(Per task spec — body to be authored with the verdict-blocked narrative + cross-references.)
