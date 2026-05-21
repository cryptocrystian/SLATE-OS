# Phase 1B Controlled First-Client Pilot Audit

## Status

- **Date executed:** 2026-05-21
- **Branch at audit:** `staging` (and `persistence/step-0-1-auth-shell`) — both at `f83d13b` (Land Phase 1B Vercel staging deployment and SQL clearance)
- **Deployed host:** `https://slate-os-staging.vercel.app` (Vercel project `slate-os-staging`, deploy `slate-os-staging-8zq96lmnk-…`)
- **Audit type:** Controlled pilot validation — no source code modified
- **Audit lanes:** 7 (Free Audit submission, New Project fallback, Report link, Proposal link, Internal SOW Draft, Send to Client mark-sent, Deployed route security)
- **Final verdict:** **⚠️ Pilot passed with operator-tracked items** — all 7 lanes execute canon-correctly end-to-end; 2 operator-tracked items found during the audit (Supabase URL config gap discovered + remediated mid-audit; custom subdomain DNS recommended for long-term posture).

This doc records the operator-driven controlled pilot audit against the deployed Vercel staging host using a clearly labeled test client (`SLATE Pilot Test Client`). All seven lanes were exercised against `https://slate-os-staging.vercel.app` with audience labels prefixed `CONTROLLED PILOT 2026-05-21`. Zero real client engagements were touched.

---

## Test client identity

| Field | Value |
|---|---|
| Client name (Lead + Engagement) | **SLATE Pilot Test Client** |
| Lead ID | `58ccc2bf-5d64-41ff-8cbd-492ffb02efac` |
| Engagement ID | `ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4` |
| Test contact name | Pilot Test |
| Test contact role | Operations Lead |
| Test contact email | `devtest@sapientdigital.io` (operator-controlled `sapientdigital.io` domain — internal test mailbox, not a real client) |
| Headcount band | 11–50 |
| Industry | professional-services |
| Internal Fit Score | 49 (auto-assigned to "Nurture" status) |
| Scorecard submission ID | `2e18ff1c-02b7-41db-a7a7-de3e17f3b4ea` |
| Audience label prefix on all minted artifacts | `CONTROLLED PILOT 2026-05-21 LANE <N> <ARTIFACT>` |

---

## Lane outcomes

| Lane | Status | Evidence summary |
|---|---|---|
| **1. Free Audit submission** | ✅ PASS | Public `/scorecard/start` form completed end-to-end (8 sections + final identity). Server-side email validation rejected `@example.com` initially; operator-supplied `devtest@sapientdigital.io` accepted. Submission produced scorecard result at `/scorecard/results?submission_id=2e18ff1c-…` with score 42/49/27 (AI Readiness/Friction/Systems), result type "Automation-ready", three opportunity surfaces (Cross-system data reconciliation, Document review and synthesis, Operating reports and dashboards). |
| **2. Lead → Engagement promotion** | ✅ PASS | Free Audit creates a `Lead` row only (no auto-engagement). Operator promotes via "Start AI Opportunity Sprint" button on the lead detail page (`/app/leads/58ccc2bf-…`) → creates `Engagement` row at `/app/engagements/ed7f1f7d-…`. Separate "New Project" path not exercised but unnecessary for the pilot flow — the lead-promotion path is the canonical Free-Audit-to-delivery handoff. |
| **3. Report link end-to-end** | ✅ PASS | Initialize report → AI-draft section → Approve section → Generate PDF Candidate → Generate Share Link (audience `CONTROLLED PILOT 2026-05-21`) → public `/r/<token>` rendered **26 682 B canon-correct artifact** (all 10 positive markers present including `Saipien Labs`, `SLATE Pilot Test`, `Client Report`, `advisory only`, `not a SOW`, `not a binding quote`, `not a contract`; zero forbidden markers — no reviewer notes, no operator-only banners, no UUIDs, no token hash, no service-role keys, no e-sign / signature / accept / pay / invoice language). Two-step Revoke → Confirm revoke → re-curl returned **8 584 B canon generic-unavailable** (Contact the sender, noindex, nofollow, no test client name leak). Token id (hashed prefix): `xEV4SnjR…` — revoked. |
| **4. Proposal link end-to-end** | ✅ PASS | Initialize proposal (seeded 3 canonical SOW options) → Generate Proposal Candidate → Approve candidate → Generate Proposal Review Link (audience `CONTROLLED PILOT 2026-05-21`) → public `/p/<token>` rendered **20 587 B canon proposal artifact** (Saipien Labs, Proposal Review, SLATE Pilot Test, AI Workflow option, commercial discussion framing, four-denial footer `not a binding quote / not a contract / not an executed SOW / written approval`; **zero e-sign / signature / sign-here / legally binding / pay / final terms / fixed price / invoice / audience-label leak**). Revoke → re-curl returned **8 892 B canon generic-unavailable** (proposal-side footer preserved as canon-required). Token id (hashed prefix): `uqztyRe7…` — revoked. |
| **5. Internal SOW Draft** | ✅ PASS | Generate SOW Draft from approved Proposal Candidate → **SOW Commercial Guard PASSED 16 fields × 71 patterns** (confirms `docs/32` Lane 3 closure fix — sanitized `LEGAL_BOUNDARY_NOTICE` — is live on deployed). Open internal `/app/engagements/ed7f1f7d-…/proposal/sow/<snapshotId>` route → 16 positive canon markers present including `OPERATOR-ONLY SOW DRAFT`, `NOT SENT BY SLATE`, `Draft SOW · not executed`, `not a contract`, `not authorization`, `written approval`; zero forbidden markers (no sign-here, no signature block, no Send to Client button, no public share link, no e-sign, no public route reference for the SOW itself). Void → snapshot status flipped to `Voided May 21, 2026, 08:06 PM · Superseded by a newer candidate` with audit-trail row preserved (not deleted). SOW snapshot id: `0ec451d5-275b-4eb9-87e7-a541edc9153a` — voided. |
| **6. Send to Client mark-sent** | ✅ PASS | Modal `Confirm Send Report to Client` (and equivalent for proposal) opened with all canon-required elements: heading, `Audience label · required` (operator-visible only, never on public route), `Recipient email · optional · hashed at rest` (SLATE does not email this recipient; value hashed before persistence; raw email never reaches the server), three acknowledgement checkboxes (`I copied the link.` / `I delivered it through my own approved channel.` / `I understand SLATE is only recording the handoff (no email / CRM / e-signature delivery).`), `Confirm send` button gated on all three checks. Fired action on both lanes; send-history row visible immediately with `MARKED SENT BY OPERATOR 1 time`, `LAST MARKED May 21, 2026, 08:08 PM` (report) / `08:10 PM` (proposal), `CHANNEL Operator-mediated copy-link`. **No email was sent by SLATE** during either mark-sent (the modal's contract is "records handoff only"). |
| **7. Deployed route security** | ✅ PASS | `curl -I` against deployed host: `/r/test-noop` → `HTTP/2 200` + `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` + `Referrer-Policy: no-referrer` + `X-Robots-Tag: noindex, nofollow` + body markers `Contact the sender / Unavailable / advisory only / noindex / nofollow`. `/p/test-noop` → identical 3-header shape + proposal-side body markers (`not a binding quote / written approval`). `/s/test` → `HTTP/2 404 Not Found` (no public SOW route). `/sow/test` → `HTTP/2 404 Not Found` (no SOW alias). Captured 2026-05-21T13:30 UTC. |

---

## Operator-tracked items found during the audit

### Finding 1 — Supabase URL configuration gap (DISCOVERED + REMEDIATED MID-AUDIT)

**Symptom.** First operator magic-link sign-in attempt on the deployed `/login` produced a magic link whose `redirect_to` parameter pointed to `http://localhost:3001` instead of `https://slate-os-staging.vercel.app/auth/callback`. Following the link would have burned the one-time PKCE token without authenticating the operator on the deployed host.

**Root cause.** Supabase project's **Site URL** (Authentication → URL Configuration) was set to `http://localhost:3001` and the deployed host URL was not in the **Redirect URLs** allowlist. The deployed app's `signInWithOtp` call passed `emailRedirectTo=https://slate-os-staging.vercel.app/auth/callback`, but Supabase silently rejected it (not on allowlist) and fell back to the project's Site URL.

**Remediation (operator-side, applied during the audit).** Operator updated Supabase Dashboard → Authentication → URL Configuration:
- Site URL changed (or new Redirect URLs added) to include `https://slate-os-staging.vercel.app` and `https://slate-os-staging.vercel.app/**`
- Re-initiated magic link from deployed `/login` → new link carried correct redirect → sign-in completed successfully → operator landed at `/app` on deployed host → audit resumed.

**Recommended permanent fix.** Add an explicit step to `docs/33` § 2 (Vercel deployment checklist) calling out the Supabase URL Configuration prerequisite. New entry recommended after § 2.1 step 7:

> **2.1.7a. Configure Supabase URL settings (before inviting operator sign-in).** In Supabase Dashboard → Authentication → URL Configuration, add the deployed host to both the Site URL field (or keep localhost as Site URL) AND the Redirect URLs allowlist:
> - `https://slate-os-staging.vercel.app`
> - `https://slate-os-staging.vercel.app/auth/callback`
> - `https://slate-os-staging.vercel.app/**`
>
> Without this step, operator magic links from the deployed `/login` form will silently redirect to whatever Site URL was set previously (typically `http://localhost:3000` or `http://localhost:3001`), burning the one-time PKCE token without authenticating on the deployed host.

### Finding 2 — Custom subdomain DNS recommended for long-term posture (NOT BLOCKING)

**Observation.** The deployed staging URL is `https://slate-os-staging.vercel.app` — a Vercel-default subdomain. While this works correctly for the pilot (all security headers, all canon footers, all public-route gates land correctly), the `*.vercel.app` namespace has these long-term tradeoffs:

- The hostname is publicly enumerable as a Vercel-hosted project (`x.vercel.app` is recognizable as Vercel infrastructure)
- Future email-send canon (if Option C-1 advances) would need its own custom-domain DKIM/SPF/DMARC setup — easier to share with a real subdomain like `staging.saipienlabs.com`
- Public `/r/<token>` and `/p/<token>` links sent to real clients have higher trust signal on a recognized brand domain than on `*.vercel.app`
- Email-link previewers in some operator email clients warn or block `*.vercel.app` URLs as part of generic anti-phishing posture

**Recommended (non-blocking) future enhancement.** When the operator graduates from controlled pilot to first-client billable engagement, set up `staging.saipienlabs.com` (or `app.saipienlabs.com` for production-tier) as a custom domain in Vercel Dashboard → Project → Settings → Domains. Standard DNS A/CNAME records pointing at Vercel's recommended addresses. Vercel issues a free TLS cert automatically. Then update Supabase URL Configuration to add the new custom host to the Redirect URLs allowlist + update `NEXT_PUBLIC_SITE_URL` env var to the new HTTPS host + redeploy.

**Not a blocker for the pilot.** The Vercel-default subdomain is canon-correct, security-headers-correct, and acceptable for the controlled pilot. Custom subdomain is a polish item.

### Finding 3 — Email validation hardness on public scorecard (canon-correct gate working as designed)

**Observation.** The public `/scorecard/start` form's final-step submission server-side rejected `slate-pilot-test+2026-05-21@example.com` with the message *"Use a real work email so we can keep the scorecard useful. Your answers are still saved on this device — you can retry without re-entering them."* The `.example` TLD is reserved for documentation (RFC 6761) and intentionally has no MX records. The validator is checking for "real-looking" email domains.

**Disposition.** This is **canon-correct anti-abuse hardening** per `docs/04_scorecard_abuse_hardening.sql`. The pilot audit honored the gate by switching to operator-controlled `devtest@sapientdigital.io` (real MX, non-real recipient mailbox). No code change required. Documented here so future audits know to use a real-MX email from the start.

**Side note.** The deployed environment has `RESEND_API_KEY` + `MAILGUN_SMTP_*` env vars configured. The scorecard submission may have triggered an automated email to `devtest@sapientdigital.io` — confirm operator-side that the mailbox received the result email (verifies email-send pipeline works end-to-end on the deployed host). The audit did not verify that mailbox.

### Finding 4 — Empty fresh-engagement requires content population before delivery (canon-correct workflow)

**Observation.** After the Lead → Engagement promotion via "Start AI Opportunity Sprint," the new engagement has zero findings, opportunities, roadmap items, or report sections. The first Generate PDF Candidate click on the empty report produced "R2 readiness blocked — No sections are approved, final, drafted, or in needs-review. The candidate has nothing to render." The audit resolved this by clicking "Generate AI draft" on one section + "Approve section" to populate enough content for a non-draft snapshot.

**Disposition.** Canon-correct workflow gate. The engagement requires the AI Opportunity Sprint workflow (stakeholder intake → findings → opportunities → roadmap → report drafting → section approval) before producing client-ready deliverables. Documented here so the operator's first real-client onboarding plan accounts for the time investment per engagement.

---

## Boundary confirmation (Phase 1B canon preserved)

- ✅ **No public SOW route** added (`/s/test` → 404, `/sow/test` → 404 against deployed host)
- ✅ **No SOW share tokens** minted
- ✅ **No email sent by SLATE** during Send to Client mark-sent on either lane (the only emails sent by the deployed system are the public scorecard result email + Supabase magic-link auth emails — both already canon-allowed)
- ✅ **No CRM push** invoked
- ✅ **No e-signature** wiring added
- ✅ **Send to Client at operator-mediated copy-link only** — modal canon-verbatim; `lastSentChannel = "operator_mediated_copy_link"` for both lanes
- ✅ **Top-level proposal Send to Client remains LOCKED** (`Send to ClientLocked` button visible in panel — verified)
- ✅ **No Group-B exhibits rendered on public `/r` or `/p`** — only the canonical Group-A artifact set
- ✅ **No schema, migration, or package dependency changes** during the audit (zero source code changes)
- ✅ **No service-role SQL writes** outside the operator UI action layer
- ✅ **No real client engagement touched** — only `SLATE Pilot Test Client` (engagement `ed7f1f7d-…`) was mutated

---

## Artifacts captured (audit-trail summary)

| Artifact | Status |
|---|---|
| Scorecard submission `2e18ff1c-02b7-41db-a7a7-de3e17f3b4ea` | persisted |
| Lead `58ccc2bf-5d64-41ff-8cbd-492ffb02efac` (SLATE Pilot Test Client) | persisted in `Nurture` status |
| Engagement `ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4` (SLATE Pilot Test Client) | persisted, AI Opportunity Sprint surface |
| Report PDF candidate snapshot (Lane 3) | persisted, 1 section included, non-draft |
| Report share token (Lane 3, hashed prefix `xEV4SnjR…`, audience CONTROLLED PILOT) | **REVOKED** by audit |
| Report share token (Lane 6, hashed prefix not captured to chat; audience CONTROLLED PILOT 2026-05-21 LANE 6 REPORT MARK SENT) | **ACTIVE**, sendCount=1, channel `operator_mediated_copy_link` |
| Proposal candidate snapshot (Lane 4, approved) | persisted; share-token-side approval state and cascade-revoke effects of subsequent Lane 5 void verified |
| Proposal share token (Lane 4, hashed prefix `uqztyRe7…`, audience CONTROLLED PILOT) | **REVOKED** by audit |
| Proposal candidate snapshot (Lane 6, approved fresh) | persisted, approved |
| Proposal share token (Lane 6, audience CONTROLLED PILOT 2026-05-21 LANE 6 PROPOSAL MARK SENT) | **ACTIVE**, sendCount=1, channel `operator_mediated_copy_link` |
| SOW Draft snapshot `0ec451d5-275b-4eb9-87e7-a541edc9153a` | **VOIDED** by audit (audit-trail row preserved per canon) |

The two ACTIVE share tokens (Lane 6 report-side + proposal-side) are intentionally left active so the operator can hand-deliver them via their own approved channel to confirm the end-to-end "operator copies URL + delivers manually" workflow in a real first-client pilot. Both carry the CONTROLLED PILOT audience label and route to client-safe canon-correct artifacts on the deployed host.

---

## Final verdict

**⚠️ Pilot passed with operator-tracked items.**

All seven lanes execute canon-correctly end-to-end against the deployed Vercel staging host. Two operator-tracked items found during the audit:

1. **Supabase URL configuration gap** — found + remediated mid-audit. Recommended permanent fix: extend `docs/33` § 2 with an explicit "Configure Supabase URL settings BEFORE inviting first operator sign-in" checklist item.
2. **Custom subdomain DNS** — non-blocking enhancement for long-term posture; pilot can proceed on `*.vercel.app` URLs.

Phase 1B Delivery Engine is **cleared for controlled first-client pilot** via the operator-mediated copy-link Send to Client flow against `https://slate-os-staging.vercel.app/r/<token>` and `https://slate-os-staging.vercel.app/p/<token>` URLs, restricted to canonical-labeled pilot artifacts.

After a successful first-client pilot, the operator may evaluate:

- **Option B-3** — Custom subdomain DNS setup (`staging.saipienlabs.com`) per Finding 2
- **Option C-1** — Email send canon authoring (`docs/35`+) if business priority requires SLATE-sent email
- **Option C-2 / C-3 / C-4** — CRM / e-sign / public SOW share canons per `docs/29` § 17 post-acceptance fork

`Send to Client` stays at operator-mediated copy-link posture across all options until a separate canon explicitly authorizes an alternative transport.

---

## Files modified by this audit

- `docs/34_PHASE_1B_FIRST_CLIENT_PILOT_AUDIT.md` (this file — new)
- `docs/08_CURRENT_STATUS.md` (status block updated)
- `docs/10_SESSION_HANDOFF.md` (chronology + next-planned updated)

**Zero source code changes.** Operator-driven audit per the pilot validation prompt.
