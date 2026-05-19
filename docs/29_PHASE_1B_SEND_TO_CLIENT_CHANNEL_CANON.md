# Phase 1B · Send to Client Channel Canon

**Sprint:** Sprint C1 — Send to Client Channel Canon
**Date:** 2026-05-18
**Doc number:** `docs/29`
**Author scope:** Documentation-only sprint. No source code, schema, migration, API route, package dependency, public route, storage bucket, email pipeline, CRM integration, e-signature integration, or `Send to Client` unlock is authored by this sprint.
**Decision:** **Option A — copy-link / operator-mediated only — for the first `Send to Client` unlock.** SLATE itself does not send email, push to CRM, or initiate any client-facing delivery. The operator copies a link surfaced by SLATE and delivers it through their own pre-existing channel (email client, CRM, Slack, in-person, etc.).
**Status:** Recommended default.

---

## 0. Why this canon exists

`docs/28` § Recommended Next Sprint pointed at this canon as the gating decision for the next eligible work block. Five locked `LockedActionButton` mount sites remain in the SLATE source tree; three actively render for persisted UUID engagements (`Send to Client` on the proposal-workspace, `Prepare Report` on the roadmap page, `Export Report` on the report page for mock paths) and `Send to Client` is canonically the last to unlock.

Five locked-state precedents matter for this canon:

1. **`Prepare Report` (mock-paths-only LOCKED).** Unlocked for persisted engagements via the existing report builder path; no public surface, no delivery action.
2. **`Export Report`.** Replaced for persisted engagements by `Generate PDF Candidate` (Sprint 4C-D); for mock paths the locked button remains.
3. **`Prepare Client Review` (Sprint P5 unlock).** Unlocked to an in-page anchor pointing operators at the per-snapshot `Generate Proposal Review Link` copy-once flow. **The first unlock was an in-page anchor, not an auto-send.**
4. **`Prepare SOW Draft` (Sprint P6-C unlock).** Same pattern — in-page anchor to the Past SOW Drafts panel where Generate SOW Draft lives. **Not a send action.**
5. **`Send to Client` (still LOCKED at the end of Sprint H1).** This canon is the gating decision for the eventual unlock.

The historical pattern of "unlock to operator-mediated surface, never auto-send" is the **strongest single argument** for Option A. The first unlock for both `Prepare Client Review` and `Prepare SOW Draft` was a non-send action by design; the same posture is canonically the safest default for `Send to Client`.

This canon answers 20 specific questions to bind any future Sprint C2+ implementation work.

---

## 1. What does "Send to Client" mean in Phase 1B?

**Send to Client = operator-mediated handoff of a SLATE-generated public share link to a named client recipient through the operator's existing communication channel.**

Specifically, in Phase 1B Send to Client means:

- The operator has already minted a share link (`/r/[token]` for reports, `/p/[token]` for proposal reviews) via the existing copy-once UI from Sprint 4D-B / P4.
- The operator clicks `Send to Client` to surface a **single copy-once panel** that consolidates: the URL, the expiry timestamp, the audience label (mandatory in this flow, optional on raw mint), and the recipient email hash (still optional).
- SLATE marks the surface "sent" in its own audit log — `report_share_token_sent_to_client` / `proposal_share_token_sent_to_client` activity events — when the operator confirms the handoff.
- The operator then delivers the link through their own channel (their email client, Slack, paste into CRM, hand off in a meeting). **SLATE does not deliver.**
- The recipient opens the link in a browser. The existing `/r/[token]` / `/p/[token]` public route renders the snapshot-pure artifact. Access logging fires as it does today.

**What Send to Client does NOT mean in Phase 1B:**

- SLATE never sends email.
- SLATE never pushes to CRM.
- SLATE never opens an external mail client via `mailto:` (no implicit transport involvement).
- SLATE never invokes a third-party send API (SendGrid / Postmark / Mailgun / Resend / etc.).
- SLATE never collects "from" addresses, "subject" lines, or message bodies. The operator's separate channel handles all of that.
- SLATE never tracks delivered / bounced / opened-by-recipient at the email layer. Access logging happens at the SLATE public route, not at the mail transport.
- SLATE never invites the recipient to a signature workflow. Signature is out of scope for Phase 1B (see § 7 below).

The boundary is sharp: Send to Client = **operator confirms intent + SLATE records the audit event + operator copies the link**. The bytes never leave SLATE's audit log surface and the operator's clipboard.

---

## 2. Which artifacts are eligible?

| Artifact | Eligible in first Send to Client unlock? | Rationale |
|---|---|---|
| **Report share link** (`/r/[token]`) | **YES** | Already shipped + accepted (Client Report Link MVP, `docs/23`). Lowest legal weight (advisory). Recipient experience is mature. |
| **Proposal Review Link** (`/p/[token]`) | **YES** | Already shipped + accepted (Proposal Review Link MVP, `docs/25`). Commercial-discussion artifact with full disclaimer chrome. |
| **SOW Draft** | **NO — deferred** | Per `docs/28` § 10 doc-number reservation chain, public SOW sharing is deferred until after this channel canon is accepted AND a separate Sprint P7-B is approved. **The Send to Client unlock for SOW Drafts is a separate decision and is not authorised by Sprint C1.** |
| **Engagement detail** | NO | Operator-only surface; no public route. |
| **Findings / opportunities / roadmap** | NO | Operator-only surfaces; no public routes. Content lands in the report or proposal artifact, never sent independently. |
| **Internal PDF candidate** (`/app/engagements/[id]/report/pdf-candidate/[snapshotId]`) | NO | Operator-only internal route. Send to Client targets the public share-link surface, not the operator-internal preview. |
| **Internal SOW Draft route** (`/app/engagements/[id]/proposal/sow/[snapshotId]`) | NO | Operator-only internal route. Public SOW share deferred per `docs/28`. |

**Sprint C1 binding:** the first `Send to Client` unlock surfaces ONLY the report-share-link and proposal-review-link flows. Any expansion to SOW Drafts requires `docs/28` to be amended AND a separate Sprint C2/P7-B sequence approved.

---

## 3. Recipient / audience model

Send to Client is **a flow, not an address book.** SLATE does not maintain a persistent client-contact directory; the operator's CRM / email client / address book is the system of record for recipient identities.

What the Send to Client flow captures:

- **Audience label** (text, max 80 chars, sanitized): **MANDATORY**. Unlike raw mint (where audience label is optional on report + proposal), Send to Client requires a non-empty audience label so the audit log can answer "who was this surface sent to?" without operator memory.
  - Recommended pattern: descriptor + role + scope, e.g. `"J. Patel (CFO, Acme Corp · pre-board read)"`.
  - The audience label is **operator-visible only** — it never renders on the public surface and never leaves the operator's audit context.

- **Recipient email** (text, max 254 chars): **OPTIONAL**. If supplied:
  - Hashed at rest via the existing `hashRecipientEmail(rawEmail)` helper (`sha256(lowercased-trimmed-email)` → 64-char hex).
  - Raw email NEVER reaches the DB.
  - Raw email NEVER reaches the activity feed (the existing activity-logger `FORBIDDEN_KEY_PATTERNS` strips any key matching `/email/i`).
  - The recipient email is used by the operator to remember "who did I send this to" — not by SLATE to send anything.

- **Linkage to a single existing share token.** Send to Client is not "mint + send" in one click. It runs against an existing `report_share_tokens` / `proposal_share_tokens` row that the operator has already minted in a separate step. This separation preserves the copy-once-mint guarantee and forces the operator to consciously pair an existing token with a named audience before the audit event fires.

What Send to Client does NOT capture:

- Multiple recipients in one flow (BCC / CC equivalents). Each Send to Client event targets exactly one audience label. Multi-recipient delivery is operator-side concatenation outside SLATE.
- Display names, titles, or company affiliations beyond what fits in the audience label.
- Phone numbers, postal addresses, calendar invites, or any other contact-modality data.
- Persistent recipient identities across multiple Send to Client events. Two events targeting the same person are two separate audit-log entries with two audience labels (possibly identical strings).

**Sprint C1 binding:** the audience-label-mandatory + recipient-email-optional-hashed-at-rest contract is the canonical recipient model for the first Send to Client unlock.

---

## 4. Required audit events

If Sprint C2 ships the unlock, the following activity event types are added to `lib/activity/types.ts`:

| Event type | When emitted | Required metadata (sanitized only) |
|---|---|---|
| `report_share_token_sent_to_client` | Operator confirms the Send to Client flow against an existing report share token | `{tokenId, snapshotId, reportId, audienceLabel, recipientHashPresent: boolean, sentAt}` |
| `proposal_share_token_sent_to_client` | Operator confirms the Send to Client flow against an existing proposal share token | `{tokenId, snapshotId, proposalId, audienceLabel, recipientHashPresent: boolean, sentAt}` |

Both events emit with `viaServiceRole: false` — the cookie-bound operator session is the source of truth. Both events MUST be visible on the engagement activity timeline with a distinct tone (recommended `brand` to match the copy-once-mint precedent) and label (recommended `"Report sent to client"` / `"Proposal sent to client"`).

**Metadata contract:**

- `audienceLabel` is operator-readable plaintext (max 80 chars after sanitization).
- `recipientHashPresent` is a boolean flag indicating whether the operator provided a recipient email at confirmation time (the hash is on the token row, not on the event).
- `sentAt` is ISO 8601.
- **No raw email. No raw token. No URL.** The activity logger's `FORBIDDEN_KEY_PATTERNS` strip catches accidental key shape regressions; this canon makes the prohibition explicit.

**Re-sending the same token to the same audience:** allowed. Each Send to Client event is an independent audit entry. The operator may have legitimate reasons (e.g. recipient lost the email, recipient asks for a refresher) to re-send. The audit log captures every confirmation; downstream queries can deduplicate by `(tokenId, audienceLabel, day)` if desired.

**Re-sending the same token to a different audience:** also allowed and intentional. Each call creates a new audit entry with the new audience label.

**Sending a revoked / expired token:** rejected at the action layer; emits NO `sent_to_client` event but DOES emit a sanitized failure event (`{eventType: 'report_share_token_send_failed' | 'proposal_share_token_send_failed', metadata: {tokenId, failureReason}}`) so the operator's audit trail captures the attempt without the surface re-running on a closed token.

**Sprint C1 binding:** the two `*_sent_to_client` event types + two `*_send_failed` event types are reserved in this canon for any future Sprint C2 implementation. The event-type strings are canonical and must not be renamed.

---

## 5. Delivery confirmation requirements

Because Send to Client = **operator confirms intent**, "delivery" is captured at the SLATE audit layer, not at the email/CRM transport layer. SLATE has zero visibility into whether the recipient's email server accepted, rejected, bounced, deferred, or filtered the message — and that's by design (Option A's first principle).

What the operator confirms in the flow:

1. The audience label is correct.
2. The recipient email (if provided) is correct.
3. The token is valid (eligible at confirmation time per existing eligibility evaluators).
4. The operator has copied the URL and intends to paste it into their channel.

What SLATE records on confirmation:

- The `*_sent_to_client` activity event with sanitized metadata.
- The token row's `metadata` jsonb gains a `lastSentToClientAt` ISO timestamp (no schema migration required — both `report_share_tokens` + `proposal_share_tokens` already carry the `metadata` jsonb column).
- The token row's `metadata` jsonb gains a `sendCount` integer counter incremented atomically.

What SLATE does NOT record:

- "Delivered" status (no transport visibility).
- "Opened" status outside the public-route access log (already recorded by the existing access-logging path).
- "Replied" status (no inbound channel).
- "Bounced" status (no SMTP visibility).

**Recipient access correlation:** the operator can correlate `*_sent_to_client` events with subsequent `*_share_token_accessed` events on the same `tokenId` to reason about engagement. SLATE does NOT auto-correlate; it leaves this to the operator's audit eye or to a future analytics view.

**Sprint C1 binding:** the operator confirmation + audit event + `metadata.lastSentToClientAt` + `metadata.sendCount` set is the canonical "delivery" model. SLATE does not extend into transport-layer visibility.

---

## 6. No e-signature boundary

**SLATE never invites a recipient to sign, accept, agree, authorise, execute, or otherwise commit to anything via a Send to Client flow.**

This boundary is hard:

- No signature collection on the public route (canon-enforced today for `/r/[token]` + `/p/[token]`; would be canon-enforced for any future `/s/[token]` per `docs/28` § 7).
- No `mailto:` link generation with a pre-populated body containing acceptance language.
- No "Accept" / "Sign here" / "I agree" UI affordances on the operator-side Send to Client flow.
- No automatic linkage to DocuSign / PandaDoc / HelloSign / Adobe Sign / Conga / Ironclad / similar.
- No "copy link with terms" affordance — the link is the artifact, not a wrapped contract.

The commercial-guard pattern families (financial 14 + commercial-finality 6 + roadmap-commitment 6 + proposal-finality 19 + sow-draft-finality 26 = 71 patterns, runtime) already prohibit the most dangerous language at generation time. The Send to Client flow does NOT introduce new patterns; it leans on the existing guard's affirmation that any minted token whose snapshot passed the guard at generation time can be confidently sent.

**Sprint C1 binding:** e-signature integration is out of scope for Phase 1B. Any future e-signature canon (recommended `docs/30` or later, NOT `docs/30` if SOW share lands first — slot is reserved per `docs/28` § 10) must define its own boundary BEFORE any signature surface ships. Send to Client cannot implicitly become a signature surface.

---

## 7. No contract / execution boundary

Related to but distinct from the e-signature boundary:

**Send to Client never delivers a contract, never delivers an executable agreement, never delivers a SOW, never delivers a binding offer, never delivers a quote with a price commitment.**

The artifact eligibility list in § 2 above is enumerated specifically to exclude these. Specifically:

- Report share links carry the canon-required "This report is advisory only. It is not a SOW, not a binding quote, not a financial guarantee, and not a contract." footer.
- Proposal review links carry the canon-required four-denial footer ("not a contract, not an executed SOW, not a financial guarantee, not acceptance of work").
- SOW Drafts are explicitly excluded from the first Send to Client unlock (§ 2).

If a future operator workflow needs to deliver an executable agreement, the path is:

1. Operator authors the agreement in their own contract platform (DocuSign / etc.).
2. Operator delivers the agreement via their own channel.
3. SLATE captures the workflow only at the metadata level (e.g. a future "contract status: executed" badge on the proposal, no contract bytes hosted by SLATE).

**Sprint C1 binding:** SLATE does not host execution artifacts. Send to Client is a thin operator-confirmation layer over already-public share links. Any expansion into hosted contract delivery requires a separate canon (recommended ≥ `docs/32`) that explicitly authorises that path.

---

## 8. Does SLATE send email?

**No. Recommended default: Option A — no SMTP / API send from SLATE.**

Three reasons:

1. **Compliance surface area.** Any system that sends email on behalf of users falls inside a meaningfully larger compliance envelope: SPF / DKIM / DMARC alignment on the sending domain, bounce-handling for deliverability hygiene, list-unsubscribe headers (RFC 8058 + the One-Click Unsubscribe rules that took effect in 2024), spam-complaint feedback loops, jurisdiction-specific regulatory frameworks (CAN-SPAM in US, CASL in Canada, GDPR in EU, etc.). The operator's existing email client is already inside their existing compliance envelope; SLATE's send pipeline would not be without significant authoring.

2. **Identity-confusion risk.** A SLATE-originated email is, from the recipient's mailbox view, a SLATE message that contains the operator's content. The recipient's relationship is with the operator's firm, not with SLATE. Sending SLATE-branded mail muddies that relationship and creates a path for the recipient to reply-to-sender and reach SLATE rather than the operator.

3. **Operator workflow simplicity.** The operator already has an email client. Adding "let SLATE send for me" introduces a third workflow — operator UI to SLATE UI to recipient inbox — when the recipient is one paste away from the operator's existing client. The marginal time savings is small; the surface-area cost is large.

**Sprint C1 binding:** the first Send to Client unlock is operator-mediated copy-link only. SLATE does not author, format, send, queue, retry, or track email at any layer.

**Future:** if operator demand for SLATE-sent email materialises, a separate canon (recommended `docs/31` if it lands before SOW share, OR a later slot if not) authorises the path with explicit decisions on: provider choice (SendGrid / Postmark / Resend / Amazon SES / similar), sending domain (operator's own vs SLATE-provided), DKIM key management, bounce-handling visibility, message template authoring, and the compliance-envelope items above.

---

## 9. Does SLATE use CRM integration?

**No. Recommended default: Option A — no CRM integration in the first Send to Client unlock.**

Two reasons:

1. **Operator's CRM is the operator's system of record.** The operator's HubSpot / Salesforce / Pipedrive / Attio / Close / Affinity / etc. is already where they track recipients, contacts, accounts, deal stages, and follow-ups. Layering SLATE on top of any one CRM forces a per-CRM build-out (each has its own auth, contact model, custom-field shape, rate-limit posture) and creates per-customer integration debt.

2. **Loose coupling beats tight coupling at Phase 1B maturity.** The operator can paste a SLATE share URL into a CRM activity log as a one-line entry without any SLATE-side integration. The URL itself is self-describing (the audience label and access timestamps live on the SLATE side); the CRM gets a hyperlink reference. This pattern works against every CRM without per-CRM authoring.

**Sprint C1 binding:** the first Send to Client unlock does not auth into any CRM, does not push contact records, does not pull contact records, does not subscribe to CRM webhooks, and does not export to CRM-specific file formats.

**Future:** a per-CRM integration canon (one per CRM, recommended slot `docs/32`+ depending on which CRM lands first) would author the path. Each CRM gets its own decision because each has its own auth + data-shape posture.

---

## 10. Failure / revoke behavior

**At Send to Client confirmation time:** the action re-runs the existing eligibility evaluator (`evaluateReportShareEligibility` / `evaluateProposalShareEligibility`) AND the token-status check (must be `active`, must not be past `expires_at`). If either fails, no audit event fires; a sanitized `*_send_failed` event with `failureReason` is emitted (per § 4 above).

**After Send to Client confirmation, if the token is later revoked:**

- The existing cascade-revoke paths (`cascadeRevokeActiveProposalShareTokensForSnapshot`, the report-side equivalent if added, plus the explicit `revokeShareTokenAction` / `revokeProposalShareTokenAction`) continue to behave exactly as they do today.
- The token row's `metadata.lastSentToClientAt` is preserved through revoke (it's an audit fact, not a token-state fact). The operator can see "this revoked token was sent to client at 2026-05-18T12:34Z" on the panel.
- A `*_share_token_revoked` event fires per existing semantics. No additional event fires "because the token had been sent" — the audit chain is the existing `*_share_token_created → *_sent_to_client → *_share_token_revoked` sequence.
- The operator is responsible for notifying the recipient that the link is no longer active. SLATE does not auto-notify.

**After Send to Client confirmation, if the token later expires naturally:**

- The existing `flip*ShareTokenExpired` paths fire on first post-expiry public access, exactly as today.
- The corresponding `*_share_token_expired` event fires. No additional event fires "because the token had been sent."

**After Send to Client confirmation, if the backing snapshot is voided:**

- The existing snapshot-void cascade revokes the token AND fires the `*_share_token_revoked` cascade event. The token row's `metadata.lastSentToClientAt` is preserved.

**Sprint C1 binding:** Send to Client is a thin audit layer; it does not modify token lifecycle. Existing cascade-revoke / expiry-flip / void semantics from Sprints 4D-C / P4 / P5 / P6-C remain authoritative.

---

## 11. Token expiry / reuse policy

**No change to the existing token policy.**

The current policy from the share-token canon (`docs/22`) + the Sprint H1 hardening:

- Default expiry: 14 days from mint.
- Maximum expiry: 30 days from mint (`MAX_SHARE_TOKEN_EXPIRY_DAYS` / `MAX_PROPOSAL_SHARE_TOKEN_EXPIRY_DAYS`).
- Production callers cannot set `expiryMinutes` (dev-only escape hatch per Sprint H1).
- Tokens are single-use-mint (raw token surfaced exactly once to the operator) but multi-use-access (the URL works for any viewer until expiry / revoke).
- Token hash is SHA-256 hex; raw token is 256-bit base64url.

**Send to Client interactions:**

- The flow does NOT change `expires_at`. Re-confirming Send to Client on the same token does not extend the expiry. If the operator wants a fresh expiry window they mint a new token.
- The flow does NOT change `status`. An `active` token stays active; a `revoked` token stays revoked (and re-confirmation fails).
- The flow does NOT reset `access_count` or `last_accessed_at`. Those track public-route reads; Send to Client tracks operator confirmations under `metadata.sendCount` / `metadata.lastSentToClientAt`.

**Re-use:** the same token may be Sent to Client multiple times (different audience labels, refresher to same audience, etc.). Each confirmation is a separate audit entry. The token's underlying expires-in-14-days window is unaffected by the operator's number of sends.

**Sprint C1 binding:** token expiry / reuse policy is unchanged. Send to Client adds two `metadata.*` audit fields and the two activity event types.

---

## 12. Required operator confirmation

The Send to Client unlock surfaces a **two-step confirmation modal** (not a single-click button), modelled on the Sprint P4 `VoidProposalCandidateButton` / Sprint H1 `RevokeProposalShareLinkButton` two-step pattern.

**Step 1 (modal open):** the operator clicks the surfaced `Send to Client` button on a specific share-token row in the Past Candidates / Past Proposal Candidates panel. The modal opens with:

- A heading: `"Confirm Send to Client"` (proposal lane) or `"Confirm Send Report to Client"` (report lane).
- The token's current state surfaced: created timestamp, expires timestamp, status, audience label (if previously set on mint).
- Two operator-facing fields:
  - **Audience label** (required, max 80 chars). Pre-populated from the token row if set, editable.
  - **Recipient email** (optional, max 254 chars). Pre-populated from `recipientHashPresent` indicator if previously set (cannot pre-populate the actual email — hashed at rest), editable.
- A copy-once URL field showing the `/r/<token>` or `/p/<token>` URL with a Copy button.
- A canon-required disclaimer paragraph (see § 13).
- A `Confirm send` button (disabled until the audience label is non-empty) + a `Cancel` button.

**Step 2 (confirmation):** the operator clicks `Confirm send`. The action layer:

1. Re-runs eligibility (token status + snapshot eligibility).
2. Updates `metadata.lastSentToClientAt` + `metadata.sendCount` on the token row.
3. Hashes the recipient email if newly provided (or unchanged if previously set).
4. Updates `audience_label` on the token row if the operator edited it (Sprint H1 already hashes the recipient email at the boundary).
5. Emits the `*_sent_to_client` activity event with sanitized metadata.
6. Revalidates the proposal / report page.
7. Closes the modal and surfaces a `"Marked sent."` success toast.

**Sprint C1 binding:** the two-step modal flow is the canonical UX shape. A single-click `Send to Client` button without a modal is not authorised — the audience-label-mandatory rule means a modal is structurally required.

---

## 13. Required disclaimers

The Send to Client confirmation modal MUST render the following copy verbatim above the `Confirm send` button:

**Report-side disclaimer:**

> Marking this report as sent records the operator's intent in SLATE's audit log. SLATE does not deliver this link by email, CRM, or any other channel. After confirming, copy the URL above and deliver it through your own channel (email client, CRM, or in person). SLATE does not track recipient delivery beyond access events on the SLATE public route.

**Proposal-side disclaimer:**

> Marking this proposal as sent records the operator's intent in SLATE's audit log. SLATE does not deliver this link by email, CRM, or any other channel. After confirming, copy the URL above and deliver it through your own channel (email client, CRM, or in person). This document is a commercial discussion artifact — not a contract, not an executed SOW, not a binding quote, and not acceptance of work. Final scope, pricing, and timeline require written approval.

These strings are **canon-verbatim**. Operators may not abbreviate, paraphrase, or restructure them without amending this canon.

The disclaimers are operator-facing (rendered inside the modal). They are NOT rendered on the public surface — the public surface keeps its existing canon-required disclaimer chrome.

**Sprint C1 binding:** the modal disclaimer copy above is the canonical text. Any future Sprint C2 implementation reproducing these strings inline in source must keep them byte-identical.

---

## 14. PII / privacy posture

The canonical privacy contract from `docs/22` / `docs/24` is preserved verbatim and extended for Send to Client:

- **Raw recipient email NEVER persisted.** The operator may type one into the modal; SLATE hashes via the existing `hashRecipientEmail` helper before persistence. The hash is the only artifact.
- **Audience label is operator-facing only.** It lives on the operator side (audit log + panel rendering) and never crosses the SLATE public boundary. Operators MUST NOT put PII beyond a short identifier in the audience label (e.g. `"J. Patel (CFO)"` not `"John Patel +1-415-555-1234, john.patel@gmail.com"`). The 80-char cap helps but does not prevent abuse — canon enforces.
- **Send timestamps are operator audit data.** `metadata.lastSentToClientAt` + `metadata.sendCount` + the activity event timestamps are visible to operators in the same workspace; never to the public surface; never to the recipient.
- **No raw token in any audit field.** Existing rule, restated.
- **No raw URL in any audit field.** New rule under Sprint C1: the activity event metadata MUST NOT include the `/r/<token>` or `/p/<token>` URL even though the operator just copied it. The token hash + `metadata.sendCount` + `metadata.lastSentToClientAt` are sufficient audit signal.

**Cross-workspace boundary:** RLS on `report_share_tokens` + `proposal_share_tokens` is already workspace-scoped + operator-full. Send to Client does not change this. An operator in a different workspace cannot see another workspace's `metadata.lastSentToClientAt` or `metadata.sendCount`.

**Sprint C1 binding:** PII / privacy posture is unchanged except for the explicit "no raw URL in audit fields" addition.

---

## 15. Channel security posture

Send to Client surfaces a copy-once URL inside a modal. The security posture inherits from the existing share-link infrastructure plus the operator-confirmation layer:

- **No new public route.** Send to Client adds no `/app/api/send-to-client/*` endpoint, no `/api/notifications/*` endpoint, no webhook endpoint, no inbound endpoint of any kind.
- **No new outbound network request.** The Send to Client action runs entirely against SLATE's own Postgres (Supabase) + activity log. No fetch to a third-party send provider, no fetch to a CRM API, no fetch to an analytics provider.
- **No new credentials / secrets.** No `SLATE_EMAIL_API_KEY`, no `SLATE_CRM_CLIENT_SECRET`, no per-workspace API tokens. The existing `SLATE_SHARE_TOKEN_ACCESS_PEPPER` (Sprint H1) and Supabase service-role keys remain the only sensitive env vars relevant to the share-link path.
- **CSP / Referrer-Policy / X-Robots-Tag** unchanged on the public routes (already enforced by `next.config.mjs` headers entry for `/r/:token*` + `/p/:token*`).
- **Audit-log RLS** unchanged — workspace-scoped operator-full read access.
- **Generic-rejection rule** preserved: every blocked Send to Client confirmation surfaces a sanitized error to the operator UI, never leaks to the public route, and never appears in the activity event in a recipient-derivable form.

**Sprint C1 binding:** the security posture adds zero new surfaces. The unlock is a thin operator-UI + audit-log layer.

---

## 16. Unlock prerequisites

Before any Sprint C2 implementation of `Send to Client` is authorised, the following must be in place:

1. **`docs/29` (this canon) accepted.** Sprint C1 is the precondition.
2. **Audience-label policy validated.** Sprint H1 already accepts an optional audience label on raw mint; Send to Client makes it mandatory. The eligibility evaluator must surface this requirement when the operator opens the modal without a pre-set audience label.
3. **Recipient-email hashing path validated.** Sprint H1 confirmed `hashRecipientEmail` works end-to-end on report + proposal mint paths. Send to Client re-uses the same path.
4. **Two-step modal pattern proven.** Sprint P4 / Sprint H1 already ship two-step confirms (`VoidProposalCandidateButton`, `RevokeProposalShareLinkButton`). The Send to Client modal is the same shape with additional fields.
5. **Activity-event taxonomy reserved.** `*_sent_to_client` + `*_send_failed` event types are reserved by this canon (§ 4). Sprint C2 will add them to `lib/activity/types.ts` + the timeline.
6. **No conflicting unlock state.** `Prepare Client Review` (Sprint P5) + `Prepare SOW Draft` (Sprint P6-C) must remain non-send actions. The Send to Client unlock is the FIRST send-shaped action SLATE surfaces.
7. **No SOW share dependency.** SOW share remains deferred per `docs/28`. The Sprint C2 implementation must NOT introduce SOW share affordances as a side effect.
8. **Lint + build clean** on the implementation commit.

**Sprint C1 binding:** the above 8 prerequisites must be satisfied before Sprint C2 ships. Any future agent attempting to implement Send to Client without one of these prerequisites must amend this canon first.

---

## 17. Proposed sprint sequence

```
docs/27 (SOW Draft Acceptance, LANDED)
        ↓
docs/28 (SOW share decision: DEFER, LANDED)
        ↓
docs/29 (this — Send to Client channel canon, RECOMMENDED ACCEPTANCE)
        ↓
        Operator decision point:
        ├─ Accept docs/29's Option A default → Sprint C2 (implement Send to Client unlock for report + proposal lanes)
        ├─ Amend docs/29 to Option B / C / D → re-author sub-canon → Sprint C2' under new option
        └─ Defer further → no Send to Client work; SOW share decision and channel canon both parked
        ↓
        If Sprint C2 accepted:
        ↓
docs/30 (Send to Client MVP Acceptance Audit — operator + send-failed + revoke-after-send live walkthrough)
        ↓
        Post-acceptance decision point:
        ├─ Re-open docs/28 SOW share decision → Sprint P7-B if approved
        ├─ Author per-CRM canon (docs/31+) if CRM integration is operator priority
        ├─ Author email-send canon (docs/31+) if SLATE-sent email is operator priority
        └─ Defer to next operator priority
```

**Sprint sequence binding (Option A path):**

- **C1** — this canon (decision: Option A).
- **C2-A** — implementation foundation: action layer + activity event types + recipient hashing path validation + modal scaffolding. No UI button rendered; no surface change.
- **C2-B** — operator surface: `Send to Client` modal + per-row button in panels + revalidation + audit-event emission. **At the END of C2-B: `Send to Client` UNLOCKED** for persisted UUID engagements on the report and proposal lanes only (not on the proposal-workspace's top `Send to Client` lock — that remains LOCKED unless explicitly authorised here; see § 18).
- **C2-Audit** — Send to Client MVP Acceptance Audit at `docs/30_SEND_TO_CLIENT_MVP_ACCEPTANCE_AUDIT.md`, mirroring `docs/23` + `docs/25` + `docs/27` shape.

**Sprint C1 binding:** the C1 → C2-A → C2-B → C2-Audit sequence is the canonical implementation path. Any other ordering requires canon amendment.

---

## 18. The `proposal-workspace.tsx:417` `Send to Client` lock

Important distinction: there are TWO `Send to Client` surfaces in the SLATE source tree:

1. **`components/proposals/proposal-workspace.tsx:417` `<LockedActionButton label="Send to Client">`** — sits next to the per-option detail card on the proposal builder. This is the historic "send the whole proposal" affordance from MVP days. It is currently LOCKED.
2. **A future per-share-token `Send to Client` button** — would live inside the per-row `<ShareTokenRow>` in the Past Proposal Candidates panel + the Past PDF Candidates panel. This is what Sprint C2-B authorises.

**Sprint C1 binding:** the **per-token** Send to Client button is what unlocks in C2-B. The **per-option `proposal-workspace.tsx:417` button** REMAINS LOCKED because:

- It targets the proposal-option-level "send whole proposal" semantic that doesn't map cleanly to share-token-mediated delivery (the operator might want to send only specific options, only specific snapshots, only specific audiences — the per-option button can't express that nuance).
- Replacing the proposal-workspace `Send to Client` with an in-page anchor to the Past Proposal Candidates panel (mirroring the Sprint P5 `Prepare Client Review` + Sprint P6-C `Prepare SOW Draft` pattern) is a separate UX decision that should NOT happen as a side effect of Sprint C2-B.
- A future canon may re-author the per-option `Send to Client` button (recommended slot `docs/32`+ depending on appetite); until then it serves as a visible "you have to use the per-token flow" marker for operators trained on the historic UI.

**The lock matrix after C2-B (if Option A path holds):**

| Control | State after C2-B | Notes |
|---|---|---|
| `Send to Client` per-share-token (report panel) | UNLOCKED | New per-row modal button |
| `Send to Client` per-share-token (proposal panel) | UNLOCKED | New per-row modal button |
| `Send to Client` per-option (proposal-workspace.tsx:417) | LOCKED | Unchanged; see § 18 above |
| `Prepare Report` (roadmap page) | LOCKED | Unchanged |
| `Export Report` mock paths | LOCKED | Unchanged |
| `Prepare SOW Draft` mock paths | LOCKED | Unchanged for mock; unlocked for persisted (Sprint P6-C) |
| `Prepare Client Review` mock paths | LOCKED | Unchanged for mock; unlocked for persisted (Sprint P5) |

Total `LockedActionButton` mount sites unchanged at 5; the per-token send buttons are NEW client components, not replacements for existing `LockedActionButton` instances.

---

## 19. Decision matrix

| Question | Recommended default | Binding | Reconsidered if/when |
|---|---|---|---|
| What does Send to Client mean? | Operator-mediated handoff of share link via operator's own channel | Hard | New canon authorising auto-send |
| Eligible artifacts | report + proposal review only | Hard | `docs/28` amended for SOW share + Sprint P7-B implementation acceptance |
| Recipient model | Audience-label-mandatory + email-optional-hashed-only | Hard | Canon amendment |
| Audit events | `*_sent_to_client` + `*_send_failed` event types reserved | Hard verbatim | Canon amendment |
| Delivery confirmation | Operator confirms; SLATE records audit + counter; no transport visibility | Hard | New canon authorising tracked send |
| E-signature | Out of scope for Phase 1B | Hard | Separate e-signature canon |
| Contract / execution | SLATE never hosts executable agreements | Hard | Separate execution canon |
| SLATE sends email? | No | Hard for first unlock | Separate email-send canon |
| CRM integration? | No | Hard for first unlock | Per-CRM canon |
| Failure / revoke | Inherits existing cascade-revoke + expiry-flip semantics; adds `*_send_failed` event | Hard | Canon amendment |
| Token expiry / reuse | No change to 14d default + 30d max + dev-only minutes | Hard | Canon amendment |
| Operator confirmation | Two-step modal with mandatory audience label | Hard UX shape | Canon amendment |
| Disclaimers | Verbatim copy in § 13 | Hard verbatim | Canon amendment |
| PII / privacy posture | Inherits from `docs/22` + `docs/24` + new "no raw URL in audit fields" rule | Hard | Canon amendment |
| Channel security posture | Zero new public surfaces; zero new outbound network requests | Hard | New canon authorising transport |
| Per-option `Send to Client` button at `proposal-workspace.tsx:417` | Stays LOCKED | Hard | Separate UX canon |

---

## 20. Open decisions

Twelve operator-decision items the canon does not bind hard:

1. **Toast vs banner on success.** Sprint C2-B may choose either; recommended toast for minimal disruption to the panel context.
2. **Default audience label value.** Could pre-populate from the token's existing `audience_label` if set. Recommended: pre-populate; operator edits.
3. **Default recipient email pre-population.** Cannot pre-populate the raw value (hashed at rest). Recommended: leave blank; operator re-types if they want to update.
4. **Per-row "Marked sent" badge.** Once a token has `metadata.sendCount > 0`, the panel could surface a `Sent N times` chip. Recommended: yes, soft-bind to Sprint C2-B authoring.
5. **Confirmation toast wording.** `"Marked sent."` is the recommended default. Operators may amend.
6. **Cooldown / debounce between confirmations.** Currently no cooldown; the modal can be re-opened immediately. Recommended: no cooldown (matches existing two-step confirms).
7. **Per-token `sendCount` ceiling.** Currently no ceiling. Recommended: no ceiling; the audit log captures every confirmation.
8. **Required audit visibility on the panel.** Recommended: show `metadata.sendCount` + `metadata.lastSentToClientAt` on each `<ShareTokenRow>` alongside the existing access count.
9. **Send to Client failure event metadata.** Recommended `{tokenId, failureReason: 'token_expired' | 'token_revoked' | 'snapshot_voided' | 'snapshot_ineligible' | 'audience_label_missing' | 'service_error'}`.
10. **Empty-state copy on the report / proposal panels.** Recommended: keep existing "No candidates yet" / "No proposal candidates yet" copy; add no Send to Client mention.
11. **Whether to allow Send to Client on a fully-expired token.** Recommended: no; the eligibility re-check rejects.
12. **Internal staff visibility.** A future "all sends across workspaces" admin view is out of scope for Sprint C2-B. Recommended slot: `docs/40`+.

---

## 21. Non-goals (binding)

This sprint **does not authorise**:

- A new `app/api/send-to-client/*` route.
- A new `lib/share-tokens/send-to-client.ts` action module (Sprint C2-A authors that).
- A new `components/reports/send-to-client-button.tsx` (Sprint C2-B authors that).
- A new `components/proposals/send-to-client-button.tsx` (Sprint C2-B authors that).
- Activity event types in `lib/activity/types.ts` (Sprint C2-A authors those).
- Activity-timeline labels / tones in `components/activity/activity-timeline.tsx` (Sprint C2-A authors those).
- Any unlock at `proposal-workspace.tsx:417` (`Send to Client` per-option button stays LOCKED).
- Any email pipeline.
- Any CRM integration.
- Any e-signature integration.
- Any PDF binary or storage bucket.
- Any package dependency.
- Any schema or migration change.
- Any RLS policy change.
- Any `middleware.ts` change.
- Any `next.config.mjs` change.
- Any `package.json` / `package-lock.json` change.
- Any AI synthesis change.
- Any Group-B wiring.
- Any public SOW route (deferred per `docs/28`).
- Any SOW share token (deferred per `docs/28`).

**No source code changes.** This sprint amends the canon set in `docs/` only.

---

## 22. Sprint C1 acceptance criteria

1. `docs/29_PHASE_1B_SEND_TO_CLIENT_CHANNEL_CANON.md` exists with the structure above.
2. `docs/08_CURRENT_STATUS.md` updated to reflect the Option A decision + next-planned pointer at Sprint C2-A.
3. `docs/10_SESSION_HANDOFF.md` updated with the Sprint C1 landed paragraph + next-planned pointer at Sprint C2-A.
4. `git status --short` after the sprint: 3 docs files modified (the two existing + the new `docs/29`); zero source / schema / migration / package-json / middleware / next-config / API-route / public-route / storage / PDF / email / CRM / e-sign / AI file touched.
5. Send to Client remains LOCKED at every existing site.
6. Per-token Send to Client button does not yet exist (Sprint C2-B scope).
7. SOW share deferral remains intact (`docs/28`).
8. No new package dependency.
9. No new event types in `lib/activity/types.ts` (Sprint C2-A scope).

---

## 23. Recommended next sprint

**Sprint C2-A — Send to Client foundation.**

Sprint C2-A authors the action layer + activity event types + recipient hashing path validation + modal scaffolding component WITHOUT mounting the per-token Send to Client button on any panel. The pattern mirrors Sprint P2 (proposal-delivery foundation, no UI mounted) → Sprint P3 (internal proposal candidate workflow, UI mounted): foundation lands first, surface lands second, acceptance audit follows.

After C2-A is accepted, Sprint C2-B unlocks the per-token Send to Client surfaces on the report + proposal panels. **At the END of Sprint C2-B, `Send to Client` is UNLOCKED for the per-token flow only.** The `proposal-workspace.tsx:417` per-option `Send to Client` remains LOCKED (§ 18).

After Sprint C2-B is accepted, `docs/30_SEND_TO_CLIENT_MVP_ACCEPTANCE_AUDIT.md` runs the canonical operator walkthrough (mint a token → confirm Send to Client → verify audit event + counter + audience label → revoke → verify failure-event-then-no-double-revoke → expire-and-re-confirm → verify failure event).

After the audit accepts, the doc-number reservation chain re-opens:
- `docs/28` SOW share decision becomes re-eligible.
- Per-CRM canon authoring becomes eligible (one per CRM, recommended `docs/31`+).
- Email-send canon becomes eligible (recommended `docs/31`+).
- E-signature canon becomes eligible (recommended `docs/32`+).
- Operator chooses which of those four directions to pursue next.

`Send to Client` for SOW Drafts remains a separate decision conditional on both:
1. `docs/28` re-opened and amended to authorise public SOW share, AND
2. Sprint P7-B implementing public SOW share, AND
3. A follow-up SOW-side Sprint C3+ extending Send to Client to the SOW lane.

**Sprint C1 binding:** Sprint C2-A is the next authorised sprint. Any other sequence (e.g. jumping to Sprint C2-B implementation without the foundation, or jumping directly to email-send authoring) requires canon amendment.

---

_End of `docs/29`. Future Sprint C2-A / C2-B / C2-Audit / docs/30+ agents must consume this canon as source of truth; deviations require canon amendment before code._
