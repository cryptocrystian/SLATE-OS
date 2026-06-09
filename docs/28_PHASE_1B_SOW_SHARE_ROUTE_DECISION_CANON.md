# Phase 1B · SOW Share Route Decision Canon

**Sprint:** Sprint P7-A — SOW Share Route Decision
**Date:** 2026-05-18
**Doc number:** `docs/28`
**Author scope:** Documentation-only sprint. No source code, schema, migration, API route, package dependency, public route, storage bucket, PDF library, email pipeline, CRM integration, SOW share token table, e-signature integration, or `Send to Client` unlock is authored by this sprint.
**Decision:** **DEFER public SOW share route until after the Send to Client channel canon (`docs/29`) is authored.** Implementation of any public SOW share surface is explicitly not authorised by Sprint P7-A. The earliest implementation slot would be Sprint P7-B, gated on a separate decision after `docs/29` lands.
**Status:** Recommended default.

---

## 0. Why this sprint exists

`docs/27` § Recommended Next Milestone identified Sprint P7-A as the next eligible sprint after SOW Draft MVP acceptance. `docs/26` § SOW Share Route Policy framed the question but stopped at "operator decision time at Sprint P7-A." This canon is that decision.

Three valid outcomes were on the table:

1. **Ship.** Build a public `/s/[token]` SOW share route in Sprint P7-B mirroring `/r/[token]` + `/p/[token]`.
2. **Defer-until-channel.** Postpone the SOW share decision until the Send to Client channel canon (`docs/29`) is authored. Channel canon decides what "send" actually means for SLATE — email, CRM, copy-link, hand-delivered, e-signature, etc. The SOW surface's posture follows from that choice rather than preceding it.
3. **Defer-permanently.** Conclude that SOW Drafts should NEVER have a public share route. SLATE's SOW path is internal-only forever; the operator hand-delivers SOW artifacts by their own channel.

Sprint P7-A canonically picks **option 2** as the recommended default.

This canon answers ten specific questions to make the deferral position defensible and to set the conditions under which option 1 (ship) becomes eligible later.

---

## 1. Should SOW Drafts ever have public links *before* Send to Client exists?

**No. Recommended default: defer.**

Three reasons:

1. **Sequencing risk.** The Client Report Link MVP and Proposal Review Link MVP both shipped public surfaces (`/r/[token]` and `/p/[token]`) *before* a Send to Client channel canon existed. That choice worked because the artifacts are **advisory** (report) or **commercial discussion** (proposal). A SOW Draft is positioned closer to **commercial finality**: it lists scope, deliverables, exclusions, assumptions, dependencies, responsibilities, and (when pricing is approved) explicit prices. Shipping a public SOW share surface before the channel canon defines how SLATE delivers commercial-final artifacts inverts the dependency: the SOW route would constrain the channel canon rather than the channel canon constraining the SOW route.

2. **Acceptance risk.** A client receiving a public SOW link before SLATE has decided whether that link represents a delivery, a draft-for-review, or simply a parking spot to view internal-only content creates legal and operator ambiguity. The Client Report Link MVP solved this with explicit non-binding language. Proposal Review Link MVP solved it with the four-denial footer. **SOW Drafts surface scope + deliverables + responsibilities + pricing notice + legal boundary notice all on one page** — the cumulative weight of those signals reads as "this is the document we're going to sign" even when the four-line footer says otherwise. Without a channel canon governing intent, SLATE cannot defensibly claim "this isn't a sent SOW" while simultaneously surfacing a URL that anyone with the link can open.

3. **E-signature confusion.** See § 9 below. A public SOW link visually resembles every other "review and sign" surface a recipient has seen in their professional life. Even with explicit "not for signature" copy, the surface invites the question. SLATE cannot answer that question coherently before the channel canon establishes how SLATE positions itself relative to execution and contract platforms.

If the operator explicitly authorises shipping before `docs/29` is authored, this canon must be amended. Sprint P7-A as written **does not authorise that path.**

---

## 2. If yes, should URL shape be `/s/[token]`?

Captured as a forward-looking decision for if option 1 (ship) is approved later.

**Recommended default URL shape (Sprint P7-B if approved): `/s/[token]`.**

Rationale (carried forward from `docs/26` § SOW Share Route Policy):

- Short — single character in the path, minimises copy/paste friction.
- Visually distinct from `/r/[token]` (report) and `/p/[token]` (proposal review). The recipient's browser tab title becomes a useful disambiguator.
- Low context leak in URLs that get pasted into Slack / email / Notion — `/s/...` doesn't telegraph "this is a SOW" the way `/sow/...` would, which is a privacy plus when the link circulates beyond the intended recipient.

**Alternatives considered:**

- `/sow/[token]` — more explicit; preferred if the operator wants the URL itself to communicate intent. Trade: leaks "SOW" to every system that logs URLs (proxies, browser history, email-scanner heuristics).
- `/p/[token]` with a `share_surface` switch — rejected. Public routes by surface keep the privacy posture, eligibility re-check, claim-guard family, and cascade-revoke semantics cleanly separated. Stuffing SOW behind the proposal URL would force the proposal route to gate every render against a SOW-vs-proposal branch.
- A short opaque prefix (e.g. `/x/`, `/d/`) — rejected as cute. `/s/` is short enough and reads as "share."

**Sprint P7-A binding:** if Sprint P7-B is later approved, the URL shape is `/s/[token]` unless explicitly amended. Implementation of that route is NOT authorised by this sprint.

---

## 3. Should SOW share tokens be separate from `proposal_share_tokens`?

Captured as a forward-looking decision.

**Recommended default (Sprint P7-B if approved): separate `sow_share_tokens` table.**

Rationale (carried forward from `docs/26` § SOW Share Route Policy + the report-vs-proposal separation precedent):

| Concern | Reused `proposal_share_tokens` | Separate `sow_share_tokens` |
|---|---|---|
| Eligibility re-check | Branch in `evaluateProposalShareTokenPublicAccess` | Independent evaluator (`evaluateSowShareTokenPublicAccess`) |
| Cascade-revoke semantics | Shared `cascadeRevokeActiveProposalShareTokensForSnapshot` would need a surface filter | Independent helper, narrower contract |
| Audit-event vocabulary | `proposal_share_token_*` would need a `surface` flag | `sow_share_token_*` events stand alone |
| Legal separation | Surface label inside one table | Surface separation by table |
| Renderer privacy posture | One privileged-lookup module | Two privileged-lookup modules — easier to reason about |
| Migration complexity | Add `share_surface` column + backfill + RLS update | New table, new RLS, isolated rollout |

The migration delta either way is small. **Separation wins on reasoning clarity and on the legal-separation criterion** — once SOW share lands, the operator must be able to point at a single table and say "these are SOW share artifacts." The proposal-share table mixing SOW rows would muddy that line for an auditor or operator-counsel reading the schema cold.

**Sprint P7-A binding:** if Sprint P7-B is later approved, the implementation uses a new `sow_share_tokens` table unless explicitly amended. Schema authoring is NOT authorised by this sprint.

---

## 4. What extra disclaimers are required?

If Sprint P7-B ships a public SOW share route, every render of `/s/[token]` MUST include the following copy verbatim (cumulative on top of what the internal route at `/app/engagements/[id]/proposal/sow/[snapshotId]` already renders):

**Header / banner:**

> Draft SOW · not executed · not authorisation to begin work

This is the SAME header copy as the internal route, with one addition: "not authorisation to begin work" must appear at the top of the page rather than only in the footer. The recipient sees the boundary before reading any scope detail.

**Body note (canon-required first paragraph below the H1):**

> This draft is for review and planning only. It is not a contract, not an executed SOW, and not authorisation to begin work. Final scope, pricing, timeline, and terms require written approval and execution by authorised parties.

**Pricing notice (when `pricing_review_state='placeholder'`):**

> Pricing is pending manual review and is intentionally omitted from this draft.

**Pricing notice (when `pricing_review_state ∈ ('manually_approved', 'workflow_approved')`):**

> Estimated · subject to final approval. Not a binding quote.

**Legal-boundary notice (always rendered, even when other content is sparse):**

> Legal terms (governing law, indemnification, liability, warranty, termination) are intentionally omitted from this draft. They will be provided separately during the execution review process.

**Closing footer (canon-required final paragraph):**

> Not a contract. Not an executed SOW. Not a binding quote. Not authorisation to begin work. Final scope, pricing, timeline, and terms require written approval and execution by authorised parties.

**Additional public-only disclaimer:**

> This document is for review by the named recipient. SLATE provides no execution or signature workflow on this page. Any approval, signature, or commencement of work happens through your separate contract process.

The "additional public-only disclaimer" is the new chrome required by Sprint P7-B if approved. It explicitly disclaims execution/signature workflow at the surface level, so a recipient who arrives at `/s/<token>` from a forwarded link cannot interpret the page as "the place where the SOW is signed."

**Sprint P7-A binding:** these disclaimer strings are the canonical text for any future public SOW share route. Operators may not abbreviate or restructure them without amending this canon.

---

## 5. What approval state is required before sharing?

If Sprint P7-B is approved, the SOW share eligibility evaluator MUST require:

1. `proposal_delivery_snapshots.delivery_surface = 'sow_draft_candidate'`
2. `proposal_delivery_snapshots.status != 'voided'`
3. `proposal_delivery_snapshots.approval_state = 'approved'`
4. **The source Proposal Candidate snapshot must also be `approval_state='approved'`** (defense-in-depth — voiding the source must invalidate any downstream SOW share).
5. SOW commercial guard `passed = true` at generation time.
6. Snapshot age within the canon's 14-day window (default; max 30 days via existing `MAX_PROPOSAL_SHARE_TOKEN_EXPIRY_DAYS` semantics or a future `MAX_SOW_SHARE_TOKEN_EXPIRY_DAYS`).
7. **At least one explicit operator confirmation step** — the SOW share-link mint button MUST render an additional confirm dialog ("This will create a public link to the SOW Draft. The recipient can view the document until you revoke the link. Continue?") that is not present on the report or proposal flows. The SOW lane is the only lane that warrants this extra friction because it carries the highest legal weight.
8. **Operator audit log entry on mint** with `audienceLabel` MANDATORY (not optional as on report / proposal). The mint surface must not allow minting a SOW share token without a non-empty audience label.

**Sprint P6-C did not ship a SOW-side approval action** — the SOW Draft snapshot starts at `approval_state='unreviewed'` and stays there unless a future sprint adds `approveSowDraftSnapshotAction`. **If Sprint P7-B is approved, the prior sprint must add that action** (Sprint P6-C carry-forward backlog item; per `docs/26` § Open Decisions item 8). Without SOW-side approval, criterion 3 above can never be satisfied and no SOW share token can be minted.

**Sprint P7-A binding:** SOW-side approval is a hard prerequisite for SOW share. Any Sprint P7-B implementation that bypasses the approval gate violates this canon.

---

## 6. Should pricing be allowed on the public SOW surface?

Two layered answers:

**Default (when `pricing_review_state='placeholder'`):**
**NO.** Pricing is hidden. The "Pricing is pending manual review and is intentionally omitted from this draft." notice replaces it (same as the internal route).

**When `pricing_review_state ∈ ('manually_approved', 'workflow_approved')`:**
**Estimated framing only.** Pricing renders with the canon-required "Estimated · subject to final approval. Not a binding quote." note immediately adjacent to every price string. No total. No payment terms. No invoice schedule. No "due on" dates. No discount language. No "fixed price" / "final price" / "all-in price" claims. The SOW commercial guard's 26 SOW-finality patterns enforce this prohibition at generation time.

**Forbidden under any state:**

- Payment terms (`net 30`, `due upon receipt`, etc. — already caught by SOW guard family `sow-draft-finality`)
- Invoice / billing schedule
- Currency conversion (the displayed currency is whatever the operator put in the snapshot; no implicit conversion)
- Discount math ("was $X, now $Y" framing)
- Total of all line items unless explicitly authored by the operator (no automatic summation — the SOW renderer never computes prices)

**Sprint P7-A binding:** pricing visibility on a future public SOW share route is permitted only with the "Estimated · subject to final approval. Not a binding quote." note, and only when the snapshot's `pricing_review_state` is non-placeholder. The SOW commercial guard's existing pattern set already enforces the absence of forbidden pricing claims at generation time — no additional pattern is required.

---

## 7. Should recipient / signatory identity be required?

**Audience label: MANDATORY** on any future SOW share-token mint. Unlike the report (`/r/[token]`) and proposal (`/p/[token]`) share-tokens — both of which accept the audience label as optional — the SOW lane requires it.

Rationale:

- The audit log must always answer "who was this SOW shown to?" without operator memory.
- A SOW share link in the wild without an attached audience label is operationally indistinguishable from a leak.
- The audience label is operator-visible only — it does NOT render on the public surface — so requiring it has no client-experience cost.

**Recipient email: OPTIONAL.** Same shape as report / proposal — hashed at rest via `hashRecipientEmail`, never persisted in raw form, never surfaced in the activity feed or on the public route.

**Signatory identity: NOT REQUIRED and NOT SOLICITED.** The SOW share route is a review surface, not a signature surface. Asking for signatory identity on a non-signature page invites the recipient to interpret the page as a signature page. Signature is out of scope for Sprint P7-B; the channel canon (`docs/29`) and a future Sprint P8+ e-signature canon decide that path.

**Sprint P7-A binding:** if Sprint P7-B is approved, the share-link mint surface MUST require a non-empty audience label and MUST NOT collect signatory identity in any form (no name field, no role field, no signature-block scaffold).

---

## 8. What happens when a SOW is voided?

The cascade-revoke pattern from Sprint P4 (`cascadeRevokeActiveProposalShareTokensForSnapshot`) is the canonical model. If Sprint P7-B ships a public SOW share route, voiding a SOW Draft snapshot MUST:

1. Flip every active SOW share token row pointing at that snapshot to `status='revoked'`.
2. Set `revoke_reason='snapshot_voided'` on each cascaded row.
3. Emit one `sow_share_token_revoked` activity event per cascaded token with `cascade: true` metadata.
4. Roll up the cascade count into the parent `sow_draft_voided` event's metadata (e.g. `cascadedRevokedTokenCount`, `cascadedFailedTokenCount`).
5. Revalidate the proposal page so the panel re-renders with the revoked tokens visibly marked.

**Re-visiting the public route after cascade-revoke MUST return the generic-unavailable page**, identical in shape to revoked / expired / unknown-token responses. Size-based diffing of the response must not reveal which condition fired.

Additional SOW-specific cascade rule:

- **Voiding the source Proposal Candidate snapshot MUST also cascade-revoke any active SOW share tokens whose `sourceProposalSnapshotId` matches.** Sprint P6-B captures the source proposal snapshot id under the SOW row's `source_context_snapshot.sowDraft.sourceProposalSnapshotId` (when added) OR via a denormalised column on `sow_share_tokens` itself (recommended for query efficiency). Without this rule, a voided proposal would leave its descendant SOW share tokens active — a coherency bug.

**Sprint P7-A binding:** the void→cascade contract above is the canonical specification for any future SOW share implementation. Departures require canon amendment.

---

## 9. Does public SOW sharing create e-signature confusion?

**Yes — this is the single largest reason for the deferral recommendation.**

A recipient receiving a `/s/<token>` link sees a page that looks like:

- A document with scope, deliverables, assumptions, dependencies, timeline.
- Pricing (when approved) with "Estimated" framing.
- A legal-boundary notice.
- A four-line "Not a contract" footer.

Every other SOW-shaped page that recipient has seen in their professional life — DocuSign, PandaDoc, HelloSign, Adobe Sign, Conga, Ironclad — ends with a signature block. The absence of a signature block on the SLATE surface is informative to a careful reader, but every other signal on the page primes the recipient to look for one. **The cognitive frame "this is a review surface" is fragile in a way the report (advisory) and proposal-review (commercial discussion) surfaces are not.**

Mitigations available to a future Sprint P7-B:

1. The mandatory public-only disclaimer in § 4 above ("This document is for review by the named recipient. SLATE provides no execution or signature workflow on this page...").
2. Visual chrome reinforcing draft-status (the existing `draft_watermark` flag would render a diagonal "DRAFT" stripe across the document).
3. Removing all `action`-feeling UI elements — no buttons, no acceptance affordances, no "next steps" controls.
4. A `noindex,nofollow` + `X-Robots-Tag` posture (already inherited from the `/r` and `/p` precedent).

**Even with all four mitigations,** the surface still ships before the channel canon defines what SLATE's relationship to the execution path is. **A clean answer requires `docs/29` first.** The channel canon may, for example, decide that SLATE never hosts client-facing SOW content at all and only ever provides operator-side "copy link to your DocuSign / PandaDoc / Ironclad" affordances. In that world, a `/s/[token]` route is dead code from day one.

**Sprint P7-A binding:** the e-signature-confusion risk is the recommended-default justification for deferring. The decision is reversible — Sprint P7-B remains eligible after `docs/29` lands — but reversing it before `docs/29` exists requires explicit operator authorisation and an amendment to this canon.

---

## 10. Should this be deferred until channel canon `docs/29`?

**Yes. This is the recommended default.**

**Doc-number reservation:**
- `docs/27` — SOW Draft MVP Acceptance Audit (landed)
- `docs/28` — **SOW Share Route Decision Canon (this document)**
- `docs/29` — Send to Client channel canon (to be authored; recommended next sprint)
- `docs/30` — SOW Share Link MVP Acceptance Audit (only if Sprint P7-B is later approved + implemented + acceptance-audited)
- `docs/31` — Reserved (post-channel-canon execution canon if applicable)

**Sequencing:**

```
docs/27 (SOW Draft Acceptance Audit, LANDED)
        ↓
docs/28 (this — SOW share decision: DEFER)
        ↓
docs/29 (Send to Client channel canon — RECOMMENDED NEXT SPRINT)
        ↓
        Operator decision point:
        ├─ "channel canon authorises public SOW share" → Sprint P7-B (implement /s/[token])
        ├─ "channel canon authorises operator-only share via external platform" → no /s route, only operator-side affordances
        └─ "channel canon defers Send to Client further" → SOW share also stays deferred
```

The Send to Client channel canon is the gating decision. Sprint P7-A cannot meaningfully answer "should SOW have public share" because the answer depends on "what does Send to Client even look like?" — and that question is the channel canon's scope.

**Sprint P7-A binding:** the next sprint is **`docs/29` — Send to Client channel canon**, not Sprint P7-B (SOW share implementation). The SOW share decision is re-eligible only after `docs/29` is accepted.

---

## Decision matrix

| Question | Recommended default | Hard binding | Reconsidered if/when |
|---|---|---|---|
| Public SOW link before Send to Client? | Defer | YES — until `docs/29` | `docs/29` authored |
| URL shape (if shipped) | `/s/[token]` | Soft — operator may amend | Sprint P7-B prompt |
| Separate `sow_share_tokens` table | Yes | Soft — operator may amend | Sprint P7-B prompt |
| Header banner | "Draft SOW · not executed · not authorisation to begin work" | Hard verbatim | Canon amendment |
| Body note copy | See § 4 | Hard verbatim | Canon amendment |
| Approval prerequisite | SOW-side `approval_state='approved'` + source Proposal Candidate also approved | Hard | Canon amendment |
| Pricing on public surface | Hidden when placeholder; "Estimated · subject to final approval" when approved | Hard | Canon amendment |
| Audience label on mint | Mandatory | Hard | Canon amendment |
| Recipient email | Optional, hashed-at-rest only | Hard — never raw | Canon amendment |
| Signatory identity | Not collected | Hard | Future e-signature canon |
| Cascade-revoke on snapshot void | Required | Hard | Canon amendment |
| Cascade-revoke on source-proposal void | Required | Hard | Canon amendment |

---

## Non-goals (binding)

This sprint **does not authorise**:

- A new `app/s/[token]/page.tsx` route.
- A new `sow_share_tokens` table or any other migration.
- A new `lib/proposals/sow-share-*` module set (eligibility, mappers, queries, public, actions).
- A new `components/proposals/generate-sow-share-link-button.tsx` or sibling.
- An `approveSowDraftSnapshotAction` server action.
- Any `Send to Client` unlock.
- Any email pipeline or CRM integration.
- Any e-signature integration.
- Any PDF binary or storage bucket.
- Any package dependency.
- Any AI synthesis change.
- Any Group-B wiring.
- Any update to `middleware.ts`, `next.config.mjs`, or RLS policies.

**No source code changes.** This sprint amends the canon set in `docs/` only.

---

## Sprint P7-A acceptance criteria

1. `docs/28_PHASE_1B_SOW_SHARE_ROUTE_DECISION_CANON.md` exists with the structure above.
2. `docs/08_CURRENT_STATUS.md` updated to reflect the deferral decision + next-planned pointer at `docs/29`.
3. `docs/10_SESSION_HANDOFF.md` updated with the Sprint P7-A landed paragraph + next-planned pointer at `docs/29`.
4. `git status --short` after the sprint: 3 docs files modified (the two existing + the new `docs/28`); zero source / schema / migration / package-json / middleware / next-config / API-route / public-route / storage / PDF / email / CRM / e-sign / AI file touched.
5. `npm run lint` clean (not required since no source changes; lint is preserved by inspection).
6. `npm run build` clean (same).
7. Send to Client remains LOCKED.
8. Prepare SOW Draft remains internal-anchor-only.
9. Public SOW route remains absent.
10. SOW share tokens remain absent.

---

## Recommended next sprint

**`docs/29` — Send to Client channel canon.**

The channel canon decides:

- Whether SLATE itself ever delivers client-facing artifacts (email / CRM / push), or whether the operator hand-delivers via their own channel (copy link, paste into email, paste into Slack, etc.).
- Whether the Send to Client unlock is binary (one button per surface) or per-recipient (audience-aware send).
- How SLATE positions itself relative to e-signature platforms (no involvement / link-out / hosted-but-not-signed).
- Whether the Send to Client unlock requires its own confirmation friction beyond the existing eligibility checks.
- How / whether the operator audits delivery completion (delivered / opened / acknowledged).

After `docs/29` lands and is accepted, the SOW share decision becomes re-eligible. Sprint P7-B is gated on that re-eligibility.

`Send to Client` remains LOCKED across every option in the channel canon until that canon explicitly unlocks it. The current locked-state is the recommended default until `docs/29` authorises otherwise.

---

---

## Sprint S12 first-mint reaffirmation (2026-06-09)

Sprint S12 ran the first controlled client-pilot mint attempt for Sapient Digital through the S11 pre-delivery audit gate. The gate refused both `/r` and `/p` mint attempts. Crucially, **S12 did not touch the SOW surface at all** — no `/s/[token]` route was created, no SOW share token was minted or attempted, no SOW Draft snapshot was generated, no SOW-side public route changes were made. The `/s/test` URL still returns 404 on the deployed canonical alias. SOW Drafts remain internal-only per the locked decision in this canon. The S11 gate is surface-aware (`report` and `proposal` only); SOW Draft has its own pre-existing 15-condition internal eligibility evaluator (`lib/proposals/sow-draft-eligibility.ts`, `docs/54`) and is unchanged. Full S12 evidence: `docs/56_SAPIENT_DIGITAL_CONTROLLED_MINT.md`. **The decision matrix in this canon is unchanged.**

---

_End of `docs/28`. Future Sprint P7-B / P8 / e-signature agents must consume this canon as source of truth; deviations require canon amendment before code._
