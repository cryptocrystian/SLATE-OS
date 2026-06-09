# docs/53 — Sprint S9-Fix: Align SOW Readiness Hint with Approved Snapshot Gate (L-31)

> **Status:** Source-clean + lint-clean + build-clean + boundary-clean. Pure-logic smoke 42/42 pass. Live hint-flip validation deferred to post-commit per the established sprint pattern.
> **Branch:** `persistence/step-0-1-auth-shell` (work) · `staging` (deploy target)
> **Upstream base:** `9fa6894` (Verify proposal drafting walkthrough)
> **Sprint scope:** Blocker-fix for L-31 surfaced by the S9 post-deploy walkthrough (`docs/52`). Not a roadmap feature sprint. `docs/39` § 5 sequence unchanged.

## 1. Context

The S9 post-deploy walkthrough (`docs/52`) exposed **L-31** — a contract mismatch between the operator-facing `SowReadinessHint` advisory signal (`lib/proposals/readiness.ts`) and the canonical S10 entry gate (`lib/proposals/sow-draft-eligibility.ts`):

- `evaluateSowDraftEligibility` gates S10 SOW Draft generation on the source snapshot's `approval_state === 'approved'` + commercial-guard verdict — see `sow-draft-eligibility.ts` lines 216, 225.
- `buildSowReadinessSignal` required BOTH `proposals.status === 'approved'` AND `hasApprovedSnapshot === true`.
- The deployed UI surfaces only snapshot-level approval (the `Approve candidate` button on the Past Proposal Candidates panel); the proposal-row `approveProposal` server action exists but has no UI mount.

Result pre-fix: even with a successfully-approved snapshot whose commercial guard passed, the hint stayed on "Not yet" forever. The advisory misled operators that the proposal wasn't ready when S10 generation was already canonically eligible.

This S9-Fix sprint is a narrow contract alignment — no new features, no new UI flow, no roadmap re-sequencing.

## 2. Root cause confirmation

Reproduction on the controlled fixture (`ed7f1f7d-…`):

| Check | Live state (verified via Supabase) |
|---|---|
| `proposal_status` | `draft` ← the blocker |
| `option_count` | 3 ✅ |
| `recommended_count` | 1 (`ai_workflow_system`) ✅ |
| Latest snapshot ID | `bcffa4cd-3e19-…` |
| Latest snapshot `approval_state` | **`approved`** ✅ |
| Latest snapshot `voided_at` | `null` ✅ |
| Latest snapshot commercial guard `passed` | **`true`** ✅ |
| Recommended-option opportunity links | 3 ✅ |
| Recommended-option roadmap links | 3 ✅ |
| `SowReadinessHint` rendered badge | `Not yet` ⚠ (the bug) |

Every condition the canonical S10 entry gate cares about is satisfied. The hint is wrong.

Canonical SOW eligibility contract — `lib/proposals/sow-draft-eligibility.ts`:
- Line 175: `if (!input.sourceProposalSnapshot)` → blocks
- Line 197: `if (src.status === "voided")` → blocks
- Line 206: `if (src.deliverySurface !== "client_proposal_candidate")` → blocks
- Line 216: `if (src.approvalState !== "approved")` → blocks
- Line 225: `if (!src.commercialGuardResult.passed)` → blocks

**Zero check** on `proposals.status` anywhere in the canonical gate.

## 3. Source fix summary

The fix is a 4-line localized softening in `lib/proposals/readiness.ts`:

```ts
// Before (S9 contract, over-strict):
const proposalApproved = proposal?.status === "approved";

// After (S9-Fix, aligned with sow-draft-eligibility.ts):
const proposalRowApproved = proposal?.status === "approved";
const proposalApproved = proposalRowApproved || hasApprovedSnapshot;
```

Plus an inline boundary comment block explaining why and a one-line advisory copy update so the operator-facing message points to the canonical UI gesture (snapshot approval).

**What stays strict:**
- `readyForS10` still requires `hasApprovedSnapshot === true` (snapshot guard intact — no proposal-row-only readiness).
- `readyForS10` still requires `commercialGuardPassed === true` (strict null refusal).
- `readyForS10` still requires `hasRecommendedOption === true` (recommended-option requirement intact).
- `readyForS10` still requires `optionCount > 0` (options must exist).
- `readyForS10` still requires `hasProposal === true` (proposal row must exist).
- `recommendedHasProvenance` stays advisory-only (unchanged).

**What's not touched:**
- The proposal approval lifecycle (`approveProposal`, `markProposalNeedsReview`, `reopenProposal`).
- The snapshot approval lifecycle (`approveProposalCandidateAction`, `voidProposalCandidateAction`).
- The commercial-guard behavior (44-pattern proposal + 70-pattern SOW).
- `evaluateSowDraftEligibility` (the canonical hard gate).
- `generateSowDraftCandidateAction` (S10's action).
- `/p` share link behavior.
- The `SowReadinessHint` UI component itself (it just renders whatever the signal returns — no template change needed because the precondition checklist is built from booleans).

## 4. Files changed

**Source modified (1):**
- `lib/proposals/readiness.ts` — 4-line softening of `proposalApproved` derivation (`||` with `hasApprovedSnapshot`) + 1 inline boundary comment block + 1 advisory-copy update.

**Smoke updated (1):**
- `artifacts/s9-readiness-smoke.mjs` — synced smoke logic to source; updated Case 6 to assert the L-31 fix behavior; added Cases 12–15 explicitly covering the OR contract.

**Docs (5):**
- `docs/53_S9_FIX_SOW_READINESS_CONTRACT.md` (this file)
- `docs/52_S9_PROPOSAL_DRAFTING_WALKTHROUGH.md` — § 12/§ 13 marked **L-31 CLOSED**
- `docs/51_PROPOSAL_AI_DRAFTING.md` — § 14 limitations marked L-31 closed
- `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` § 5 — Sprint S9 row supplemented with S9-Fix landing note
- `docs/08_CURRENT_STATUS.md` + `docs/10_SESSION_HANDOFF.md`

No new files in `lib/`, `components/`, `app/`. No migration. No package change.

## 5. Smoke / regression result

`artifacts/s9-readiness-smoke.mjs` — **42/42 PASS** across 15 cases:

| # | Case | Behavior |
|---|---|---|
| 1 | no proposal | readyForS10=false |
| 2 | 0 options | readyForS10=false |
| 3 | none recommended | readyForS10=false |
| 4 | recommended w/o provenance, all approved | readyForS10=true (advisory) |
| 5 | happy path with provenance | readyForS10=true |
| **6** | **(S9-Fix L-31): proposal draft + approved snapshot + guard passed** | **readyForS10=true** ← the bug fix |
| 7 | snapshot not approved | readyForS10=false |
| 8 | commercial guard FAILED | readyForS10=false |
| 9 | guard verdict null | readyForS10=false (strict) |
| 10 | S8 chain degraded | readyForS10=true (advisory) |
| 11 | S8 chain intact | readyForS10=true, no advisories |
| **12** | **(S9-Fix): proposal approved + no snapshot** | **readyForS10=false** (snapshot guard intact — symmetric BOUNDARY) |
| **13** | **(S9-Fix): both paths satisfied** | **readyForS10=true** (sanity) |
| **14** | **(S9-Fix): neither path satisfied** | **readyForS10=false** + advisory mentions Approve snapshot |
| **15** | **(S9-Fix BOUNDARY): proposal draft + approved snapshot + guard FAILED** | **readyForS10=false** ← guard requirement NOT weakened by OR |

Case 12 is the symmetric BOUNDARY proving the snapshot guard isn't weakened. Case 15 is the symmetric BOUNDARY proving the commercial guard isn't weakened by the OR. Both are the explicit safeguards the spec required.

## 6. Live fixture result

**Live hint-flip validation deferred to post-commit per the established sprint pattern** ("Do not commit until review"). The deployed Production build serving `lyogvylju` runs against `28f2332` — the pre-fix source. Live validation requires a fresh deploy from the post-commit head.

Expected live sequence post-commit + Vercel build promotion:

1. Navigate to `/app/engagements/ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4/proposal` → page renders, no 500.
2. **Verify `SowReadinessHint` flips `Not yet` → `Ready for SOW Draft`** with no other action (the fixture already has the approved snapshot from the walkthrough — `bcffa4cd-…` — sitting hot).
3. Verify the precondition checklist now shows ✅ for "Proposal approved" because `proposalApproved` is true via the snapshot-OR path.
4. SQL audit confirms: no new synthesis runs, no new snapshots, no new share tokens, no new SOW Draft snapshots, no upstream mutations during the validation window — the fix is a pure-presentation-layer contract alignment, no server-side activity.

The fixture is preserved hot for the operator's first post-commit click: the same `bcffa4cd-…` snapshot will satisfy the (now-correct) precondition set without any further generate / approve gesture.

## 7. Activity metadata safety

This sprint emits no new activity events (pure-readiness-signal contract change). No source action layer was touched. All existing event-metadata sanitization from S9 + earlier sprints continues unchanged.

## 8. Boundary confirmation

| Boundary | Result |
|---|---|
| `/p` mint | Zero (no source touch) ✅ |
| `/r` mint | Zero ✅ |
| Send to Client | Zero ✅ |
| SOW generation | Zero ✅ |
| New report/proposal share tokens | Zero ✅ |
| Public report/proposal route changes | Zero ✅ |
| Email / CRM / e-signature | Zero ✅ |
| Attio writes | Zero ✅ |
| Public routes added | Zero ✅ |
| Group-B exhibit wiring | Zero ✅ |
| Sapient Digital mutation | Zero ✅ |
| Real client mutation | Zero ✅ |
| `docs/39` § 5 sequence change | Zero ✅ |
| Findings / opportunities / roadmap / report sections mutated | Zero ✅ |
| Proposal options / proposal row / snapshot rows mutated | Zero (source-only sprint) ✅ |
| Migration footprint | **Zero** ✅ |
| Override path used | No ✅ |
| Service-role writes used | No ✅ |
| New package dependencies | Zero ✅ |

## 9. Lint / build / check result

- `npm run lint` ✅ clean
- `NEXT_TELEMETRY_DISABLED=1 npm run build` ✅ clean — all 33 routes byte-stable
- `npm run check:send-to-client-disclaimers` ✅ clean
- `node artifacts/s9-readiness-smoke.mjs` ✅ **42/42 pass**

## 10. Recommended next sprint

**Sprint S10 — Internal SOW Draft Validation** per `docs/39` § 5. Roadmap sequence unchanged.

S10 entry conditions are now structurally satisfied on the deployed fixture:

- Approved + non-voided proposal candidate snapshot (`bcffa4cd-…`).
- Commercial guard passed (0 violations, 45 patterns).
- Recommended option `ai_workflow_system` with full provenance (3+3 links).
- S8 → S9 chain intact (5 approved report sections).

The SOW Draft scaffold (`lib/proposals/sow-draft-actions.ts` + `lib/proposals/sow-draft-eligibility.ts` + 70-pattern guard + 15-condition SOW eligibility evaluator + `PastSowDraftsPanel`) is hot and untouched by this fix.

Once the operator commits + deploys S9-Fix and verifies the hint flip, S10 can proceed against the same controlled fixture without any further preparation.

## 11. Suggested commit message

```
Align SOW readiness with approved proposal snapshot
```

(Per task spec.)

---

## 12. Follow-on — S10 consumed the readiness signal correctly (2026-06-09)

✅ The S9-Fix readiness contract was consumed by Sprint S10 (`docs/54`) live on deployed Production. The post-S9-Fix `SowReadinessHint` rendered `Ready for SOW Draft` on the controlled fixture, the operator clicked `Generate SOW Draft`, the action's defense-gate matched the readiness signal's expectations (snapshot approved + non-voided + commercial guard passed + recommended option present), and the SOW Draft snapshot `f6ed1fe5-c6e2-4a5c-a29e-5fbad6ab0574` was successfully generated with the 70-pattern SOW guard scanning 71 patterns across 5 families with 0 violations. The S9 → S9-Fix → S10 chain is end-to-end live-verified.

L-31 remains CLOSED.
