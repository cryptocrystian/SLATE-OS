# docs/52 — Sprint S9 Post-Deploy Proposal Drafting Walkthrough

> **Status:** ⚠ **PASS with one documented contract gap (L-31).** Sprint S9 end-to-end live-verified on deployed Production through all functional layers (bulk drafting, provenance allowlist, commercial guard, snapshot lifecycle). The `SowReadinessHint` flip is gated by a source-side over-strict contract that the deployed UI cannot satisfy because the proposal-row `approveProposal` action has no UI mount. Smallest fix documented in § 11.
> **Branch / commit:** `staging` / `28f2332` — Add proposal AI drafting.
> **Deployed Production build:** `slate-os-staging-lyogvylju-…`, canonical alias `slate-os-staging.vercel.app`.
> **Fixture:** SLATE Pilot Test Client · engagement `ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4`.

## 1. Deployment verification

| Check | Result |
|---|---|
| Local `persistence/step-0-1-auth-shell` head | `28f2332` ✅ |
| Local `staging` head | `28f2332` ✅ |
| Remote `origin/persistence/step-0-1-auth-shell` | `28f2332` ✅ |
| Remote `origin/staging` | `28f2332` ✅ |
| Vercel auto-built S9 staging-branch preview | `slate-os-staging-od1itjoqc-…` ✅ |
| Production promoted via `vercel promote` | `slate-os-staging-lyogvylju-…` (Status: ● Ready) ✅ |
| Canonical alias retargeted | `slate-os-staging.vercel.app` → `lyogvylju` ✅ |
| Proposal page renders for fixture | HTTP 200, page title `SLATE Pilot Test Client · Proposal & SOW options · SLATE` ✅ |
| `GenerateAllProposalOptionsButton` visible | "Draft all options" button mounted in header ✅ |
| `SowReadinessHint` visible | "SOW Draft readiness" card + initial "Not yet" badge ✅ |
| `npm run lint` | clean ✅ |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | clean ✅ |
| `npm run check:send-to-client-disclaimers` | clean ✅ |

## 2. Fixture state before proposal drafting

| Bucket | State |
|---|---|
| Approved findings (S5 chain) | **5** ✅ |
| Selected opportunities (S6 chain → S9 input) | **3** ✅ |
| Deferred opportunities (correctly EXCLUDED) | 1 ✅ |
| Scored opportunities (no leak risk) | 0 |
| Ready roadmap items (S7 chain → S9 input) | **3** ✅ |
| Approved/final report sections (S8 chain → S9 input) | **5** ✅ |
| Report sections needs_review | 7 |
| Proposal row exists | 1 (`status='draft'`) |
| Proposal options seeded | 3 (canonical taxonomy) |
| Pre-existing recommended option | 1 (`ai_workflow_system`) |
| **Pre-existing opportunity links across 3 options** | **0** ✅ confirms S9 closes the gap |
| **Pre-existing roadmap links across 3 options** | **0** ✅ confirms S9 closes the gap |
| Pre-existing snapshots | 3 (1 approved from prior tests, 1 voided, 0 unreviewed at start) |

## 3. Bulk drafting result

Operator clicked `Draft all options` (JS-dispatched click via Chrome MCP — same synthetic-click workaround documented in S8 walkthrough as L-25).

| Metric | Value |
|---|---|
| Options in taxonomy | 3 |
| Synthesis runs created | **3** |
| Synthesis runs completed | **3** |
| Synthesis runs failed | **0** |
| Synthesis runs still in-flight at final poll | 0 |
| OpenAI model used | `gpt-4o-mini` (default) |
| Wall-clock duration | ≈ 35 seconds for 3 sequential calls |

The orchestrator preserved every operator-set commercial lever per the per-option synthesis action's partial-field-update contract.

## 4. Generated options summary

| Option | Title (after AI refinement) | Scope len | Best-fit len | Timeline len | Deliverables | Assumptions | Dependencies | Risks |
|---|---|---|---|---|---|---|---|---|
| `quick_win_build` | Quick-Win Build for Proposal Drafting Automation | 657 | 99 | 20 | 4 | 3 | 0 | 3 |
| `ai_workflow_system` (**RECOMMENDED**) | AI Workflow System | 877 | 107 | 50 | 6 | 3 | 3 | 3 |
| `managed_ai_partner` | Managed AI Partner for Operational Efficiency | 876 | 107 | 43 | 8 | 4 | 0 | 4 |

Content is grounded in the actual upstream evidence (proposal-drafting automation, operational efficiency, AI workflow rollout — all matching the 3 selected opportunities + 5 approved report sections).

## 5. Recommended-option result

| Check | Result |
|---|---|
| Pre-walkthrough recommended | `ai_workflow_system` (Position 1) |
| Post-walkthrough recommended | **`ai_workflow_system`** ✅ unchanged |
| Pricing placeholder on AI Workflow System | `$120k–$180k · pricing placeholder for internal planning only` ✅ unchanged |
| Pricing placeholder on Quick-Win Build | `$30k–$60k · pricing placeholder for internal planning only` ✅ unchanged |
| Pricing placeholder on Managed AI Partner | `Retainer · $25k–$40k/month · pricing placeholder` ✅ unchanged |
| All 3 option_types preserved | ✅ |
| All 3 positions preserved | ✅ |
| Recommendation flag preserved (only 1 recommended option) | ✅ |

S9 per-option synthesis action's partial-field-update contract held verbatim: pricing / recommendation / option_type / position columns were NEVER touched by the AI synthesis.

## 6. Provenance verification

| Check | Result |
|---|---|
| `proposal_option_opportunity_links` rows after drafting | **7** (1 / 3 / 3) |
| `proposal_option_roadmap_links` rows after drafting | **7** (1 / 3 / 3) |
| % of opportunity links to `selected` opportunities | **100%** ✅ (7/7) |
| % of roadmap links to `ready` roadmap items | **100%** ✅ (7/7) |
| Links to the 1 `deferred` opportunity | **0** ✅ correctly excluded |
| Links to any `planned`/`deferred`/`rejected` roadmap item | **0** ✅ |
| Banned-phrase scan across scope/best-fit/timeline/deliverables/assumptions/risks | **0 hits** ✅ |
| HTML markers in scope summary | **0** ✅ |
| Pricing/dollar amounts in scope summary | **0** ✅ |

The `filterUuidList` validator (added in S9 source) successfully filtered every grounded ID to the upstream allowlist. The model cannot invent provenance — verified live on deployed Production across 14 link rows.

## 7. Commercial guard result

| Check | Result |
|---|---|
| Snapshot generated | `bcffa4cd-3e19-4086-b086-c5d4976b3157` ✅ |
| Snapshot status | `candidate` ✅ |
| Snapshot delivery_surface | `client_proposal_candidate` |
| Pattern count scanned | **45** (44 documented + 1 source drift; both reflect the combined financial + commercial-finality + roadmap-commitment + proposal-finality families) |
| Guard violations | **0** ✅ |
| `passed` verdict | **true** ✅ |
| Option count in snapshot | 3 (all 3 included) ✅ |
| Scan duration | sub-second ✅ |
| Draft watermark | `true` ✅ (Sprint P2 default) |

## 8. Proposal approval / snapshot result

| Action | Result |
|---|---|
| Snapshot approval (operator-clicked `Approve candidate`) | snapshot `bcffa4cd-…` → `approval_state='approved'` ✅ |
| Snapshot voided state | `voided_at=null` ✅ |
| Proposal-row `proposals.status` | **`draft`** ⚠ — proposal-level approve action exists server-side but has no UI mount on the deployed page (see L-31) |

## 9. SowReadinessHint result

**Hint badge: `Not yet`** (post-snapshot-approval).

Why: `buildSowReadinessSignal` requires **both** `proposalApproved===true` AND `hasApprovedSnapshot===true` AND `commercialGuardPassed===true`. The latter two flip green live, but `proposalApproved` is gated on `proposals.status === 'approved'` which the deployed UI cannot reach (no UI control surfaces the `approveProposal` server action).

This is **L-31** — a contract gap, not a runtime defect. See § 11.

## 10. Activity metadata safety result

| Event | Count in window | Sanitized fields | Raw text? | UUIDs? |
|---|---|---|---|---|
| `ai_proposal_option_drafted` | 3 | runType, optionType, **sourceReportSectionCount: 5**, **sourceFindingCount: 5**, **sourceOpportunityCount: 1/3/3**, **sourceRoadmapItemCount: 1/3/3**, provider, model | **None** | **None** |
| `ai_proposal_options_drafted` (bulk) | 1 | `{runType=proposal_options_bulk_draft, total=3, attempted=3, succeeded=3, failed=0, optionTypes=[3 entries — all 3 present, NO S8-style L-26 drift]}` | **None** | **None** |
| `proposal_snapshot_generated` | 1 | sanitized snapshot meta (no PII) | **None** | snapshot ID only |
| `proposal_snapshot_approved` | 1 | sanitized snapshot meta (no PII) | **None** | snapshot ID only |

100% sanitization across 6 new events. The bulk event's `optionTypes` array contains all 3 expected entries — no missing-entry drift like S8's L-26.

## 11. Boundary confirmation

| Boundary | Result |
|---|---|
| `/p` mint | **0** ✅ |
| `/r` mint | **0** ✅ |
| Send to Client | **0** ✅ |
| SOW generation | **0** ✅ (no `sow_draft_candidate` snapshot, no `sow_draft_generated` event) |
| New report share tokens | **0** ✅ |
| New proposal share tokens | **0** ✅ |
| Public report/proposal route changes | **0** ✅ |
| Email / CRM / e-signature | **0** ✅ |
| Attio writes | **0** ✅ |
| Group-B wiring | **0** ✅ |
| Sapient Digital mutation | **0** ✅ |
| Real client mutation | **0** ✅ |
| `docs/39` § 5 sequence change | **0** ✅ |
| Findings mutated | **0** ✅ |
| Opportunities mutated | **0** ✅ |
| Roadmap items mutated | **0** ✅ |
| Report sections mutated | **0** ✅ |
| Distinct activity event types in window | exactly 4 (`ai_proposal_option_drafted`, `ai_proposal_options_drafted`, `proposal_snapshot_generated`, `proposal_snapshot_approved`) — all S9 scope ✅ |
| Banned activity events (`*_share_token_*`, `sow_draft_generated`, `report_share_token_*`) | **0** ✅ |

OpenAI cost for the walkthrough ≈ $0.02–0.05 (3 sequential `gpt-4o-mini` calls + 1 commercial guard scan = sub-second).

## 12. Limitations

- **L-31 (CLOSED 2026-06-08 via S9-Fix · see `docs/53`) — `buildSowReadinessSignal` contract was over-strict relative to the deployed UI.** The signal requires both `proposalApproved===true` AND `hasApprovedSnapshot===true`. The deployed UI surfaces only snapshot-level approval (`approveProposalCandidateButton`); the proposal-row-level `approveProposal` server action exists in `lib/proposals/actions.ts` lines 300-304 but has **no UI mount** on the deployed page. Result: even with a successfully-approved snapshot whose commercial guard passed, the hint stays on "Not yet" forever.

  **The smallest fix** is a 4-line change to `lib/proposals/readiness.ts`. Two viable shapes:

  - **Option A (preferred):** Soften `proposalApproved` so it's `true` when `proposals.status === 'approved' || hasApprovedSnapshot === true`. Rationale: snapshot-approval is the operator-blessed gesture in the canonical S9 → S10 handoff (consistent with the existing `sow-draft-eligibility.ts` evaluator, which gates on the snapshot's `approval_state` not on `proposals.status`).
  - **Option B:** Add a small UI mount (e.g. an "Approve proposal" button in the proposal page header) that calls the existing `approveProposal` server action.

  **Recommendation:** Option A. Smaller surface, matches the canonical S10 entry contract, no new UI flow to validate, no proposal-row status semantics to debug. The pure-logic smoke (`artifacts/s9-readiness-smoke.mjs`) needs corresponding update — happy path becomes "snapshot approved is sufficient", and the proposalApproved-without-snapshot case stays a "not yet" advisory.

  This is the only finding that prevents acceptance criterion #10 (hint flip) from passing live. Every other layer of S9 — drafting, provenance, guard, snapshot lifecycle — works correctly on deployed Production.

- **L-25 (carried forward from docs/50) — Chrome MCP synthetic-click → React event delegation.** Workaround applied: `javascript_tool` dispatching native `MouseEvent`s on the same DOM node. Not a source bug.

## 13. Recommendation

**Pass with one documented contract gap.** The S9 drafting pipeline itself is fundamentally working — bulk drafting, provenance allowlist enforcement, commercial guard, snapshot lifecycle, sanitized activity metadata all green live.

**✅ S9-Fix LANDED 2026-06-08 — L-31 closed.** See `docs/53_S9_FIX_SOW_READINESS_CONTRACT.md`. The 4-line softening of `buildSowReadinessSignal.proposalApproved` (OR with `hasApprovedSnapshot`) aligns the operator-facing hint with the canonical `sow-draft-eligibility.ts` gate. Smoke 42/42 pass. Live hint-flip validation will land with the next post-commit deploy.

**Original recommended scope (now landed):**

1. Apply L-31 fix Option A — soften `buildSowReadinessSignal.proposalApproved` so snapshot-approval is sufficient.
2. Update `artifacts/s9-readiness-smoke.mjs` accordingly.
3. Re-run live walkthrough on deployed Production to verify hint flips `Not yet` → `Ready for SOW Draft`.
4. Author `docs/53_S9_FIX_NOTES.md` (one-page evidence log).
5. Update `docs/51` § 14 limitations + `docs/52` § 11 to mark L-31 closed.

**After S9-Fix lands:** Sprint S10 — Internal SOW Draft Validation — can proceed per `docs/39` § 5. Roadmap sequence unchanged. The SOW Draft scaffold (`lib/proposals/sow-draft-actions.ts` + `lib/proposals/sow-draft-eligibility.ts` + 70-pattern guard + 15-condition SOW eligibility evaluator + `PastSowDraftsPanel`) is hot and untouched by this walkthrough.

If the operator prefers to skip the S9-Fix and proceed directly to S10: the existing `sow-draft-eligibility.ts` evaluator does NOT depend on `proposals.status`; it depends on the source snapshot's `approval_state`. So S10 SOW Draft generation is functionally unblocked even with the L-31 contract gap intact. The hint flip is cosmetic — useful for the operator's at-a-glance status, but not a hard gate.

## 14. Suggested commit message

```
Verify proposal drafting walkthrough
```

(Per task spec.)
