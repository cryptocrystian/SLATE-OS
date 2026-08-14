# Phase 1B · SOW Share Route Re-Eligibility Canon

**Sprint:** Sprint P7-A′ — SOW Share Route Re-Eligibility Decision
**Date:** 2026-08-14
**Doc number:** `docs/65`
**Author scope:** Documentation-only sprint. No source code, schema, migration, API route, package dependency, public route, storage bucket, PDF library, email pipeline, CRM integration, SOW share token table, e-signature integration, or `Send to Client` unlock is authored by this sprint. This canon amends the deferral posture set in `docs/28` and binds the implementation specs for a future Sprint P7-B; it authors no code.
**Decision:** **Conditional ship. Sprint P7-B (public SOW share route `/s/[token]`) is now AUTHORISED to build under the Option-A operator-mediated channel established by `docs/29`, gated on the hard prerequisites in § 4.** The blocking condition `docs/28` set — "defer until the Send to Client channel canon is authored" — has cleared: `docs/29` landed and chose the safest channel posture. This canon flips `docs/28`'s deferral to a conditional authorisation; it does not itself write P7-B.
**Status:** Recommended default.

---

## 0. Why this canon exists

`docs/28` (SOW Share Route Decision Canon) deferred the public SOW share route with a single, explicit re-eligibility condition:

> "the SOW share decision becomes re-eligible only after `docs/29` is accepted."

That condition has now been met:

- **`docs/29` — Send to Client Channel Canon** was authored and accepted. It chose **Option A: operator-mediated copy-link only.** SLATE never sends email, never pushes to CRM, never opens a `mailto:`, never invokes a third-party send API, and never touches an e-signature workflow. The operator copies a SLATE-minted link and hand-delivers it through their own channel; SLATE records a "sent" audit event only.
- **`docs/30`** accepted the Send-to-Client MVP for the **report** (`/r/[token]`) and **proposal** (`/p/[token]`) surfaces under that model. `docs/29 § 2` explicitly held SOW Drafts back as "a separate decision… not authorised by Sprint C1."

So the gating question `docs/28` could not answer — "what does Send to Client even look like?" — is answered. This canon is the deferred SOW-share decision, re-run with that answer in hand.

`docs/28`'s decision matrix, disclaimer strings, approval prerequisites, pricing rules, identity rules, and cascade-revoke contract remain the source of truth for *how* a SOW share route behaves. This canon changes only the ship/defer posture and layers in what Option A specifically enables and requires.

---

## 1. Has the `docs/28` blocking condition cleared?

**Yes.** `docs/29` is accepted and chose Option A. All three of `docs/28`'s stated deferral reasons are now addressed:

| `docs/28` deferral reason | Status under `docs/29` Option A |
|---|---|
| **Sequencing risk** — SOW route would constrain the channel canon rather than the reverse | Resolved. The channel canon landed first and set the posture; the SOW route now *inherits* it rather than pre-empting it. |
| **Acceptance risk** — a public SOW link before SLATE decided what "send" means | Resolved. "Send" is now defined: operator-mediated copy-link, SLATE does not deliver. The SOW share link is unambiguously the same class of artifact as the already-accepted report/proposal links, one legal tier heavier. |
| **E-signature confusion** — the surface reads like a sign-here page | **Materially reduced, not eliminated.** Option A guarantees SLATE never hosts a send or signature step; the operator hand-delivers. The residual risk is the recipient's own frame (see § 9). Mitigations remain mandatory. |

The e-signature-confusion risk was `docs/28`'s single largest deferral driver. Option A does not make the risk zero, but it removes the structural ambiguity: SLATE can now truthfully state on the surface that it provides no send and no signature workflow, because the channel canon guarantees exactly that.

---

## 2. The decision: ship, continue-defer, or defer-permanently

Three outcomes were on the table (mirroring `docs/28 § 0`):

1. **Conditional ship.** Authorise Sprint P7-B to build `/s/[token]` under Option A, gated on prerequisites.
2. **Continue-defer.** Keep SOW share deferred despite the channel canon landing.
3. **Defer-permanently.** SOW is internal-only forever; the operator hand-delivers a saved PDF by their own channel and SLATE never hosts a client-facing SOW surface.

**Recommended default: option 1 — conditional ship.**

Rationale:

- The one condition `docs/28` set for re-eligibility has been met.
- The lower-weight surfaces (report, proposal) already run the full public-share + Send-to-Client stack under Option A without incident (`docs/30`). SOW is the same architecture, one disclaimer tier heavier.
- The `docs/28` spec set (§ 4–§ 8) already defines every hard boundary; there is no unanswered design question blocking a disciplined build.
- Continue-defer no longer has a defensible *reason* — its only justification was the missing channel canon, which now exists.

**Why not defer-permanently:** the operator can already save the internal SOW to PDF and hand-deliver it out of band today (`docs/26`). A permanent-internal posture does not actually prevent client-facing SOW delivery; it only prevents SLATE from providing a *revocable, audited, disclaimer-wrapped* surface for it. A hosted `/s/[token]` with cascade-revoke, access logging, and mandatory disclaimer chrome is **safer** than the operator emailing a static PDF that can never be revoked and carries whatever chrome the PDF froze. This is the decisive argument: hosting the surface improves control, it does not weaken it.

**Conditional** is load-bearing. This canon authorises P7-B to *build*; it does not authorise minting a single SOW share token until every § 4 prerequisite holds in code.

---

## 3. What carries forward unchanged from `docs/28`

The following `docs/28` bindings are **unchanged** and remain hard requirements for P7-B. This canon restates the pointers rather than re-litigating them:

- **URL shape:** `/s/[token]` (`docs/28 § 2`).
- **Separate `sow_share_tokens` table** — never a `share_surface` column on `proposal_share_tokens` (`docs/28 § 3`).
- **Verbatim disclaimer strings** (`docs/28 § 4`) — header, body note, pricing notices, always-on legal-boundary notice, closing footer, and the public-only "SLATE provides no execution or signature workflow on this page" line.
- **Approval prerequisites** (`docs/28 § 5`) — see § 4 below, which elevates the SOW-side approval action to a named prerequisite.
- **Pricing rules** (`docs/28 § 6`) — hidden when `pricing_review_state='placeholder'`; "Estimated · subject to final approval. Not a binding quote." when approved; no totals, payment terms, invoice schedule, or discount math.
- **Identity model** (`docs/28 § 7`) — mandatory operator-only audience label, optional hashed recipient email, **no signatory identity collected**.
- **Cascade-revoke contract** (`docs/28 § 8`) — void of the SOW snapshot *or* its source Proposal Candidate revokes all active SOW tokens; generic-unavailable page on revisit.

Amendment note: `docs/28 § 10`'s doc-number reservation (which pencilled `docs/30` as the SOW Share MVP audit) is **superseded** — `docs/30` was consumed by the Send-to-Client MVP acceptance audit. The SOW Share MVP acceptance audit, if P7-B ships, takes the next free doc number at that time.

---

## 4. Hard prerequisites before any P7-B mint (binding)

P7-B may build the surface, but **no SOW share token may be mintable** until all of the following hold in code:

1. **`approveSowDraftSnapshotAction` exists.** A SOW Draft snapshot is born `approval_state='unreviewed'` (`docs/26`, `docs/54`) and there is no action to approve it. `docs/28 § 5` criterion 3 (SOW `approval_state='approved'`) is unsatisfiable without it. This action is the **first** unit of P7-B work and MUST land before the mint surface renders an enabled control. It reuses the existing 15-condition internal evaluator in `lib/proposals/sow-draft-eligibility.ts`.
2. **Source-proposal approval chain** (`docs/28 § 5` criterion 4) — the source Proposal Candidate snapshot must also be `approval_state='approved'`; voiding the source cascades (§ 3 → `docs/28 § 8`).
3. **Commercial guard `passed=true` at generation** (`docs/28 § 5` criterion 5) — already enforced by the SOW-finality guard family.
4. **Extra mint-time confirm dialog** (`docs/28 § 5` criterion 7) — unique to the SOW lane, not present on report/proposal.
5. **Mandatory audience label** (`docs/28 § 5` criterion 8, `§ 7`) — the mint surface must reject an empty audience label.
6. **Pre-delivery audit surface-awareness.** The S11 pre-delivery audit gate (`docs/55`) is currently surface-aware for `report` and `proposal` only. P7-B MUST extend it to the `sow` surface — the internal SOW eligibility evaluator (`docs/54`) governs generation; the share-mint gate is a distinct, additional check and must exist before the mint control is enabled.

Any P7-B implementation that renders an enabled SOW-share mint control before all six hold violates this canon.

---

## 5. What Option A specifically enables and requires

Option A (`docs/29`) is the operative channel. Its consequences for the SOW surface:

- **No SLATE send, ever.** The SOW mint surface produces a copy-link and records `sow_share_token_sent_to_client` on operator confirmation (mirroring the report/proposal `*_sent_to_client` events from Sprint C2). SLATE never transmits the bytes.
- **The public-only disclaimer becomes literally true and must be shown** (`docs/28 § 4`): "SLATE provides no execution or signature workflow on this page. Any approval, signature, or commencement of work happens through your separate contract process." Under Option A this is a factual statement about the system, not aspirational chrome — which is precisely why Option A was the prerequisite.
- **Send-to-Client for SOW is a distinct unlock.** `docs/29 § 2` shipped Send-to-Client for report and proposal only. Authorising the SOW *share route* (this canon) does not auto-unlock a SOW *Send-to-Client* consolidation panel; that follows the same "mint first, mark-sent second" sequence the other surfaces used, and inherits the SOW lane's extra confirm + mandatory audience label.

---

## 6. Does public SOW sharing still create e-signature confusion? (revisited)

**Reduced from `docs/28 § 9`, still non-zero.** The four mitigations `docs/28 § 9` named remain **mandatory** for P7-B:

1. The public-only disclaimer (§ 5) — now factually accurate under Option A.
2. The `draft_watermark` diagonal "DRAFT" stripe rendered on the public surface.
3. Zero action-feeling UI — no buttons, no acceptance affordance, no "next steps" control, no signature block or scaffold.
4. `noindex, nofollow` + `X-Robots-Tag` (inherited from `/r` and `/p`).

The residual risk is the recipient's learned frame ("SOW-shaped page ⇒ look for the signature block"). Option A cannot erase that frame, but it lets SLATE answer the recipient's implicit question truthfully and on-surface: there is no signature step here, by design. That is a coherent answer, which is what `docs/28` said was impossible before the channel canon existed. The risk is now an acceptable, disclosed residual rather than a structural ambiguity.

---

## 7. Decision matrix

| Question | `docs/28` position | `docs/65` position |
|---|---|---|
| Public SOW link before Send-to-Client channel canon? | Defer | N/A — condition cleared |
| Ship `/s/[token]` now? | Deferred | **Conditional ship — P7-B authorised, gated on § 4** |
| URL shape | `/s/[token]` | Unchanged |
| Separate `sow_share_tokens` table | Yes | Unchanged |
| Channel | (undecided) | **Option A — operator-mediated copy-link (`docs/29`)** |
| `approveSowDraftSnapshotAction` | Backlog carry-forward | **Hard prerequisite, first P7-B unit** |
| Disclaimers / pricing / identity / cascade | Bound in `docs/28 §§ 4–8` | Carried forward unchanged |
| Send-to-Client for SOW | Not addressed | Distinct later unlock; not auto-granted by this canon |
| E-signature confusion | Primary deferral driver | Reduced to disclosed residual; 4 mitigations mandatory |

---

## 8. Non-goals (binding)

This sprint **does not authorise or author**:

- Any `app/s/[token]/page.tsx` route.
- Any `sow_share_tokens` table, migration, or RLS change.
- Any `lib/proposals/sow-share-*` module set.
- Any `approveSowDraftSnapshotAction` (named as a P7-B prerequisite, not built here).
- Any `components/proposals/generate-sow-share-link-button.tsx`.
- Any change to `middleware.ts`, `next.config.mjs`, or the pre-delivery audit.
- Any `Send to Client` unlock for the SOW surface.
- Any email / CRM / e-signature / PDF-binary / storage-bucket / package-dependency work.

**No source code changes.** This sprint amends the `docs/` canon set only. It flips the `docs/28` posture and binds P7-B; the build is Sprint P7-B.

---

## 9. Acceptance criteria (this documentation sprint)

1. `docs/65_PHASE_1B_SOW_SHARE_REELIGIBILITY_CANON.md` exists with the structure above.
2. It explicitly records that `docs/28`'s re-eligibility condition (docs/29 accepted) has cleared.
3. It authorises Sprint P7-B conditionally and names the § 4 prerequisites as hard gates.
4. It carries forward the `docs/28 §§ 2–8` specs by reference without contradiction.
5. `git status --short` after the sprint: docs files only; zero source / schema / migration / route / middleware / config files touched.
6. `Send to Client` for the SOW surface remains locked.
7. No public SOW route, no `sow_share_tokens` table, no `sow-share` module set exists at the end of this sprint.

---

## 10. Recommended next sprint

**Sprint P7-B — SOW Share Route implementation**, sequenced as:

1. `approveSowDraftSnapshotAction` (+ any SOW-side approval UI) — the § 4.1 prerequisite. Nothing else can be exercised end-to-end without it.
2. `sow_share_tokens` table + RLS migration (mirrors `0016_proposal_share_tokens.sql`).
3. `lib/proposals/sow-share-{types,eligibility,queries,mappers,public,actions}.ts` — mirror the proposal-share module set; `evaluateSowShareTokenPublicAccess` re-runs the guard + eligibility at render time; `cascadeRevokeActiveSowShareTokensForSnapshot` implements `docs/28 § 8` incl. the source-proposal-void cascade.
4. `app/s/[token]/page.tsx` — public render (draft watermark, verbatim disclaimers, `noindex,nofollow`, generic-unavailable page for revoked/expired/unknown), reusing the elevated `SowDraftDocument` in a public mode that strips the operator-only banner and adds the public-only disclaimer.
5. `components/proposals/generate-sow-share-link-button.tsx` — mint UI with the mandatory audience label and the SOW-lane extra confirm dialog.
6. Pre-delivery audit (`docs/55`) extended to the `sow` surface.
7. A SOW Share MVP acceptance audit doc at the next free number.

Send-to-Client consolidation for the SOW surface, if wanted, follows P7-B as a separate mark-sent unlock — same "mint first, mark-sent second" sequence as report/proposal, inheriting the SOW lane's extra confirm and mandatory audience label.

---

_End of `docs/65`. This canon amends `docs/28` (deferral → conditional authorisation) and consumes `docs/29` (Option A) as the operative channel. Future Sprint P7-B agents must consume both `docs/28` (specs) and this canon (posture + prerequisites) as source of truth; deviations require canon amendment before code._
