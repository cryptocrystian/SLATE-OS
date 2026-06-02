# Consulting Module Completion Roadmap

## Status

- **Date authored:** 2026-06-02
- **Sprint type:** Architecture / planning lock — no source code, no migration, no engagement mutation, no Sapient Digital interaction
- **Sprint identifier:** Consulting Module Completion Roadmap Lock
- **Branches at authoring:** `staging` and `persistence/step-0-1-auth-shell` both at `fa43925`
- **Authority:** This document is the controlling roadmap for finishing the SLATE Consulting module. Once locked, sprint sequence cannot be reordered unless an actual blocker forces it. Reactive side sprints are explicitly disallowed during the critical path. Backlog and expansion lanes are surfaced explicitly so they don't compete with critical-path scheduling.
- **Intended outcome:** A single locked sequence of sprints that takes the Consulting module from its current Phase 1B-validated state through one full real-client engagement (Sapient Digital), then through MVP completion. Reactive drift is the principal failure mode this document exists to prevent.

---

## 1. Current state inventory

### 1.1 Foundations (Phase 1A — landed)

- AdvisoryOps OS canon: dark-only operator workspace, lead → account → engagement entity model, 10-tone Badge system, MetricCard, EngagementContextCard, intake/findings/opportunities/roadmap/report/proposal page scaffolds.
- Lead creation paths: Free Audit (`/apply/ai-systems-review` → public scorecard submit → leads row), Scorecard, manual New Project (operator-initiated).
- Engagement promotion: "Start AI Opportunity Sprint" promotes a lead row into an engagement with deterministic stage state.
- Activity events: per-domain typed events with sanitized metadata; no PII; no raw answer text in metadata.
- Persisted storage (Persistence/Auth Steps 0–10): leads, engagements, stakeholder_intake_sessions, stakeholder_responses, input_assets, findings, opportunities, roadmap_items, report_sections, proposal_options, report_share_tokens, proposal_share_tokens, report_delivery_snapshots, proposal_delivery_snapshots, activity_events, and (since Sprint I2/I3) engagement_intake_documents. Sapient Digital lives in the real DB at engagement `76097653-fedb-42e5-9ef6-e89a0e97f802`.

### 1.2 Phase 1B Delivery Engine (landed + pilot-validated)

- Report share tokens `/r/[token]` — client-safe canon: cache-control `private, no-store, must-revalidate`; `x-robots-tag: noindex, nofollow`; `referrer-policy: no-referrer`; generic-unavailable on revoked / invalid / expired tokens.
- Proposal share tokens `/p/[token]` — same posture; canon disclaimers; four-denial footer; zero e-sign/contract/pay leak.
- SOW internal Draft (`/app/engagements/[id]/proposal/sow/[snapshotId]`) — operator-only; Draft SOW · not executed banner; voidable; never public.
- Public SOW route + SOW share tokens — explicitly **forbidden** in current canon (`/s` and `/sow` return 404 by guarantee).
- Send to Client modal — operator-mediated copy-link flow; canon-verbatim 3-ack; channel `operator_mediated_copy_link`; SLATE never sends email/CRM/e-sign.
- Audience labeling + recipient-hash workflows (recipient email optional + hashed at rest; never displayed).
- Pilot completed `2026-05-21` against `SLATE Pilot Test Client` on deployed staging — all 7 lanes canon-correct.
- Disclaimer pin script (`scripts/check-send-to-client-disclaimers.cjs`) guards canon copy against drift.

### 1.3 Stakeholder intake (landed)

- Mode A — Live-link intake: `/intake/[token]` token-gated public route, 21-day TTL, sha256 hash only; operator hand-delivers URL via own approved channel; "Email automation lands later" UI copy.
- Mode B/C — Offline intake (Sprint I1 canon → I2 data model + server actions → I3 operator UI → 2026-06-02 live walkthrough): operator-staged sessions + responses, `source_type` vocabulary, `response_status` lifecycle (`draft → ready_for_synthesis → superseded / voided`), `engagement_intake_documents` entity, sanitized activity events, deployed-verified on Sapient Digital with `client_visible=false` boundary held.

### 1.4 Findings / Opportunities / Roadmap / Report / Proposal (scaffolded; AI synthesis incomplete)

- Findings scaffolds: persisted findings table, approve/reject lifecycle, AI-synthesis tool hook surface.
- Opportunities scaffolds: quadrant UI, AI-drafting tool hook surface, scoring + selection lifecycle.
- Roadmap scaffolds: items with status transitions, AI drafting hook, sequencing UI.
- Report scaffolds: 12-section structure, per-section status transitions, AI section-drafting hook surface, PDF candidate generation pipeline (vector SVG-ready future-proof).
- Proposal scaffolds: options, recommended option, AI drafting hook, snapshot generation, snapshot approval lifecycle.

### 1.5 Deployed environment

- Production target: `https://slate-os-staging.vercel.app` (canonical alias).
- Vercel project: `slate-os-staging` (team `christians-projects-bb2d10a3`, project id `prj_wAjfR7dy9FTzIwOwxek7NJwuyZuu`).
- Supabase: project `SLATE OS` (ref `hhglrcvsmwaheikdvijw`) with migrations 0001-0017 applied.
- Latest Production deploy: `dpl_9wFmhoX4K5FcLkzxxPiUMuSUwTZT` from staging head `fa43925`.

---

## 2. What is complete

The following are **functionally complete and canon-validated** as of authoring date. They are NOT scheduled for further work in this roadmap.

| Capability | Verdict | Reference |
|---|---|---|
| Lead creation (Free Audit, Scorecard, manual New Project) | ✅ Complete | docs/05, docs/29 |
| Lead → Engagement promotion | ✅ Complete | docs/05 |
| Persisted multi-tenant data model under Workspace-scoped RLS | ✅ Complete (migrations 0001-0017) | docs/persistence/* |
| Stakeholder intake — live-link Mode A | ✅ Complete | docs/29 |
| Stakeholder intake — offline Mode B + C (operator UI, data model, server actions, deployed walkthrough) | ✅ Complete | docs/37, docs/38 |
| Activity events with sanitized metadata (no PII) | ✅ Complete | lib/activity/* |
| Report share tokens + `/r` public route + revoke | ✅ Complete | docs/29 |
| Proposal share tokens + `/p` public route + revoke | ✅ Complete | docs/29 |
| Internal SOW Draft (operator-only, voidable) | ✅ Complete | docs/29, docs/30 |
| Send to Client (operator-mediated copy-link, audience label, recipient hash, mark sent) | ✅ Complete | docs/29 § 13 |
| Public SOW route explicitly absent (`/s`, `/sow` → 404) | ✅ Complete (guaranteed by canon, verified by curl on every walkthrough) | docs/29, docs/34 |
| Vercel staging deployment + canonical alias + env vars | ✅ Complete | docs/33, docs/34 |
| Disclaimer pin script (canon copy drift guard) | ✅ Complete | scripts/check-send-to-client-disclaimers.cjs |
| Phase 1B Delivery Engine controlled pilot (`SLATE Pilot Test Client`) | ✅ Cleared | docs/34 |

---

## 3. What is incomplete

These capabilities are **scaffolded but not yet operationally complete**. They constitute the critical path defined in § 5.

| Capability | Gap | Scheduled in § 5? |
|---|---|---|
| **Online stakeholder intake quality + completion-rate audit** | Live-link Mode A is wired but never audited end-to-end against a real stakeholder; readiness gate (`docs/35` § 5) is operator discipline, not code-enforced. | Yes — Sprint S1 |
| **Meeting transcript / AI notetaker imports** | Completely absent. No source-type vocabulary entry beyond `transcript` text-paste; no actual transcript-file ingest, no AI-notetaker webhook, no Otter/Fireflies/Granola/Read.ai integration. | Yes — Sprint S2 |
| **CRM read context** | Absent. No CRM connector, no context-fetch tool. | Yes — Sprint S3 |
| **AI findings synthesis pipeline** | Hook surface exists; does not yet consume `response_status = 'ready_for_synthesis'` rows; does not yet treat live-link/offline/transcript/CRM as differentiated input lanes; does not yet enforce the readiness gate as a code-side guard. | Yes — Sprint S4 (Sprint I5 in prior naming) |
| **Findings approval surface polish** | Approve/reject lifecycle exists; needs end-to-end pass against real synthesis output. | Yes — Sprint S5 |
| **Opportunities AI drafting + quadrant approval** | Hook + scaffold exist; not exercised against real findings. | Yes — Sprint S6 |
| **Roadmap AI drafting + sequencing** | Hook + scaffold exist; not exercised against real opportunities. | Yes — Sprint S7 |
| **Report section AI drafting integration** | Hook + scaffold exist; not exercised against real findings + opportunities + roadmap. | Yes — Sprint S8 |
| **Proposal AI drafting + scope edits + recommended-option selection** | Hook + scaffold exist; not exercised against real report. | Yes — Sprint S9 |
| **Internal SOW Draft validated against real proposal scope** | Generation works; not yet exercised against a real client proposal scope. | Yes — Sprint S10 |
| **Pre-delivery Audit — code-side enforcement** | `docs/35` § 5 readiness gate currently canon-only (operator checklist); code does not block `/r` or `/p` mint when gate is unmet. | Yes — Sprint S11 |
| **Controlled `/r` + `/p` mint for Sapient Digital with FIRST CLIENT pilot audience labels** | Pilot pattern proven on `SLATE Pilot Test Client`; not yet executed on Sapient Digital. | Yes — Sprint S12 |
| **Sapient Digital Mark sent on both lanes** | Pattern proven on pilot; not yet executed on Sapient Digital. | Yes — Sprint S13 |
| **Document binary upload backend** (Sprint I4 candidate) | `engagement_intake_documents.storage_path` exists; no upload UI or storage backend wiring. | **Backlog** — not on critical path unless transcripts/binary attachments block Sprint S4 synthesis |
| **Email send for stakeholder invitations** | UI copy says "Email automation lands later"; no implementation. | **Deferred expansion** — § 7 |
| **CRM writeback / push** | None. | **Deferred expansion** — § 7 |
| **E-signature** | None. | **Deferred expansion** — § 7 |
| **Public SOW share** | Forbidden by current canon. Would require its own canon authorization sprint first. | **Deferred expansion** — § 7 |
| **SOW template library** | Single Draft template only. | **Deferred expansion** — § 7 |
| **Multi-client engagement queue UX polish** | Single-client cadence today. Multi-engagement triage UI absent. | **Backlog** — addressed after S13 if needed |

---

## 4. Canonical data hierarchy

Stakeholder discovery signal flows through SLATE in a strict priority order. AI synthesis MUST respect this order; the operator UI MUST make the source visible at every surface.

### 4.1 Primary — Online stakeholder intake forms

- `/intake/[token]` public token-gated route, Mode A in `docs/37`.
- Stakeholder typed the answer themselves; provenance is unambiguous.
- `source_type = 'live_link'`; `response_status` defaults `ready_for_synthesis` (stakeholder typed it).
- This is the **canonical** input. AI synthesis weighting and quality assumptions key off this lane.

### 4.2 Secondary — Meeting transcript / AI notetaker imports

- Otter, Fireflies, Granola, Read.ai, manual transcript upload, etc.
- Stakeholder spoke the answer; operator (or a notetaker) captured it.
- `source_type = 'transcript'`; `response_status` defaults `draft` (operator must mark ready); `source_confidence` defaults `first_hand` when the speaker is directly quoted.
- **High priority** — feeds consulting quality because real stakeholder voice is preserved.
- Implementation lane: Sprint S2.

### 4.3 Secondary — CRM context

- Stakeholder context read from connected CRM (HubSpot, Salesforce, Attio, Pipedrive, etc.).
- Not stakeholder voice; account-level context (revenue, headcount, sales-stage, last-touch, deal value).
- Feeds engagement-context cards and informs scope, not findings directly.
- Implementation lane: Sprint S3.

### 4.4 Tertiary — Offline / manual operator entry

- The Sprint I3 path. Operator types or pastes content from notes, memory, or email threads.
- `source_type` ∈ {`operator_entered`, `meeting_notes`, `email_paste`, `document_upload`}; `response_status` defaults `draft`.
- **Tertiary** — useful when the primary or secondary paths can't reach a stakeholder, but never the preferred lane. The Sprint I3 walkthrough proved this lane works on deployed staging; further offline-intake polish is NOT scheduled in this roadmap unless it blocks a higher-priority lane (see § 9).

### 4.5 Synthesis weighting rule (canon)

When the AI findings synthesis pipeline (Sprint S4) lands, it MUST:

- Treat live-link and `first_hand` transcript responses as full-weight signal.
- Treat `second_hand` transcript and operator-entered with `first_hand` source-confidence as moderate signal.
- Treat `inferred` source-confidence as weak signal that should be surfaced as "needs validation" in findings.
- Discard `draft` and `voided` responses entirely.
- Treat CRM context as engagement-level, NOT stakeholder-level signal.

---

## 5. Frozen critical path to Sapient Digital real deliverable

This is the **locked** sprint sequence. Order may not be changed by reactive discovery unless a discovered blocker forces it (see § 11). Each sprint has a fixed scope; scope creep is the principal drift failure mode and is disallowed.

### Sprint S1 — Online Intake Flow Audit + Stakeholder Intake Readiness  *(NEXT)*

Scope:
1. End-to-end audit of the live-link `/intake/[token]` route from operator-side `Generate intake link` → URL hand-delivery → public route load → submit → operator-side response landing.
2. Readiness gate (`docs/35` § 5) wording review: convert from operator discipline to a code-side guard that blocks `/r` or `/p` mint if conditions unmet (this guard lands as preparation; enforcement lands in S11).
3. Verify question packet alignment between `docs/36` § 6 question packet IDs and the live-link `INTAKE_QUESTIONS` seed.
4. Optional fixes to live-link UX if the audit surfaces operator-blocking issues (only if blocking).

Non-goals: no email send, no automated invite, no offline-intake polish, no synthesis work, no `/r` or `/p` mint.

### Sprint S2 — Meeting Transcript / Notetaker Intake

Scope:
1. Canon authoring: add `transcript_import` source-type subset to canon (likely `docs/40`), define the file upload + per-segment ingestion shape, define the speaker-identification contract.
2. Implementation: file upload backend (uses the `engagement_intake_documents.storage_path` field; pulls Sprint I4 forward into this sprint because transcript ingest is the use case), per-segment extraction into `stakeholder_responses`, source attribution by speaker.
3. UI: "Import transcript" surface on the intake page; per-segment review + assign-to-stakeholder + assign-to-question.

Non-goals: no third-party notetaker webhook integration (Otter/Fireflies/Granola/Read.ai). Direct file upload + paste only. Webhook integration is a follow-on sprint if quality + adoption justify it.

### Sprint S3 — CRM Read Context

Scope:
1. Canon authoring: one connector at a time; pick the highest-leverage CRM for operator's actual book of business.
2. Implementation: read-only OAuth/API-key connector, account context fetch on engagement open, EngagementContextCard enriched with CRM fields.
3. Boundary: read-only — NO writeback in this sprint. Writeback is § 7 deferred.

Non-goals: writeback, two-way sync, multi-CRM support, deal-stage automation.

### Sprint S4 — AI Findings Synthesis Integration  *(formerly Sprint I5)*

Scope:
1. Consume `response_status = 'ready_for_synthesis'` rows from all three lanes (live-link, transcript, offline).
2. Honor the synthesis weighting rule from § 4.5.
3. Emit findings against the persisted `findings` table; mark each finding with `source_type` provenance from the underlying responses.
4. Operator approves/rejects via existing findings surface.

Non-goals: opportunities, roadmap, report, proposal — those are S6-S9.

### Sprint S5 — Findings Approval Surface Polish

Scope:
1. Validate the approve/reject lifecycle against real synthesis output from S4.
2. Surface source provenance ("this finding came from 3 transcript segments + 1 offline note from Sales Leader").
3. Operator-only quality flags (e.g., "needs validation" when synthesis weight was weak).

Non-goals: opportunities, roadmap.

### Sprint S6 — Opportunities AI Drafting + Quadrant Approval

Scope:
1. Consume approved findings (S5) and generate opportunities via the existing AI drafting hook.
2. Quadrant placement with operator override; scoring polish.
3. Selection / defer / reject lifecycle.

Non-goals: roadmap.

### Sprint S7 — Roadmap AI Drafting + Sequencing

Scope:
1. Consume selected opportunities (S6) and generate roadmap items.
2. Dependency sequencing; status lifecycle.

Non-goals: report.

### Sprint S8 — Report Section AI Drafting Integration

Scope:
1. Consume findings + opportunities + roadmap (S5-S7).
2. AI section-drafting for each of the 12 report sections.
3. Operator per-section approval; section status transitions.

Non-goals: PDF, share tokens.

### Sprint S9 — Proposal AI Drafting + Scope Edits + Recommended Option

Scope:
1. Consume report (S8); generate proposal options with AI drafting.
2. Scope edits; recommended-option selection.
3. Snapshot generation + approval lifecycle.

Non-goals: share tokens, SOW.

### Sprint S10 — Internal SOW Draft Validation

Scope:
1. Generate internal-only SOW Draft from approved proposal scope (S9).
2. Validate Draft SOW · not executed banner; voidability; operator-only access.

Non-goals: public SOW route, SOW share tokens, SOW template library — all deferred (§ 7).

### Sprint S11 — Pre-Delivery Audit Code-Side Enforcement

Scope:
1. Convert `docs/35` § 5 readiness gate from operator discipline to a code-side guard.
2. Gate blocks `/r` and `/p` mint attempts when any of the 15 readiness conditions fail.
3. Operator UI surfaces the gate state explicitly ("9 / 15 ready — N items remaining").
4. Bypass requires explicit operator override with audit-logged reason text.

Non-goals: minting any actual `/r` or `/p` link for Sapient Digital — that's S12.

### Sprint S12 — Sapient Digital Controlled `/r` + `/p` Mint

Scope:
1. Mint Sapient Digital report share token with `FIRST CLIENT PILOT 2026-XX-YY SAPIENT DIGITAL` audience label.
2. Mint Sapient Digital proposal share token with same audience label.
3. Validate both lanes render canon-correct.
4. Surface raw `/r` and `/p` URLs **once** to the operator for manual delivery via own approved channel.
5. **PAUSE** between mint + delivery; wait for operator delivery confirmation.

Non-goals: SLATE-side send; CRM push; e-sign.

### Sprint S13 — Sapient Digital Mark Sent + Engagement Closure

Scope:
1. After operator delivery confirmation, drive Mark Sent on both lanes via the Send to Client modal.
2. Record `sendCount = 1` on each token; channel `operator_mediated_copy_link`.
3. Capture operator feedback on the full flow.
4. Author `docs/41` (or whichever the next-numbered doc is) post-mortem against Sapient Digital end-to-end.

Non-goals: anything else.

**Critical-path sprint count: 13.** Each sprint should land in a single review cycle; if a sprint needs more, it must be split rather than allowed to drift.

---

## 6. Consulting MVP completion path after Sapient

After Sprint S13 closes Sapient Digital as the first real deliverable, the Consulting module is **MVP-complete** by canon definition. The following sprints harden + consolidate:

### Sprint S14 — Second Real Engagement Validation

Run the full S1-S13 cadence against a second real client. Validate consistency of AI synthesis quality, time-to-deliverable, and operator-experience friction.

### Sprint S15 — Time-to-Deliverable Optimization

Profile the S14 engagement against S1-S13 elapsed time. Identify the 1-2 slowest steps and tighten.

### Sprint S16 — Multi-Engagement Triage UX

Polish the operator-side multi-engagement queue UI. Useful once two or more engagements are running concurrently.

### Sprint S17 — Email Send for Stakeholder Invitations

The first deferred-expansion lane to land. Pre-conditions: Sprint S13 + S14 must both have proven the canonical flow works without email. Adds operator-side "Send via SLATE" affordance behind a clear policy doc.

### Sprint S18 — CRM Writeback (one connector)

Read-side already landed in S3. This sprint adds writeback for one CRM. Operator-confirmed per write.

### Sprint S19 — Findings Quality Feedback Loop

Operator labels each finding's accuracy post-engagement; signal feeds synthesis prompt-tuning. Required for the consulting product to keep getting better.

### Sprint S20 — Roadmap Status Tracking Post-Delivery

After delivery, client operator (or SLATE operator) tracks roadmap execution. Required to make the deliverable an ongoing asset rather than a one-shot PDF.

**MVP-complete consolidation sprint count: 7.** Total module sprint count: ~20 (13 critical-path + 7 consolidation), excluding deferred expansion lanes in § 7.

---

## 7. Deferred expansion lanes

These lanes are **canon-only**: scope is acknowledged, but no implementation sprint is scheduled until at least the MVP-complete consolidation (Sprint S20) is past. Adding any of these to the schedule before that point is a violation of § 9 governance.

| Lane | Why deferred | Pre-condition before scheduling |
|---|---|---|
| **Email send (SLATE-mediated stakeholder invites + reports)** | Operator-mediated copy-link Send-to-Client is the canon today and is sufficient for pilot + early real engagements. Adding email send adds compliance surface (CAN-SPAM, GDPR, suppression lists) before that surface is warranted. | Sprint S17 (after second real engagement validates the manual flow is the friction point) |
| **CRM writeback / push** | Read-side context is sufficient for synthesis-quality lift; writeback adds two-way-sync complexity that doesn't ship deliverable value during pilot. | Sprint S18 |
| **E-signature integration (DocuSign, HelloSign, AdobeSign)** | Proposal canon already explicitly denies e-sign-by-SLATE; signature happens in the operator's existing signature vendor. Internal SOW Draft + approved Proposal is the canon handoff. | After SOW templates land (next row) AND at least one engagement closes a real contract via the operator's own e-sign vendor |
| **Public SOW share route + SOW share tokens** | Currently **forbidden** by canon — `/s` and `/sow` return 404 by guarantee. Reversing this requires its own canon-authoring sprint that documents why a SOW must ever leave the operator's controlled chain of custody. | Operator decides this is worth the audit-surface cost; canon sprint precedes any implementation sprint |
| **SOW template library** (multiple template variants, conditional sections, pricing automation) | Single Draft template suffices for the first 1-2 real engagements. Building a template library before the operator has felt the friction of the single template is premature. | After Sprint S13 + S14; operator confirms the single template is the bottleneck |

These lanes are listed so operator + Claude both know the scope exists. They are NOT a backlog the next reactive sprint can pull from.

---

## 8. Sprint count estimate

| Phase | Sprints | Cumulative |
|---|---|---|
| Critical path to Sapient Digital deliverable (S1-S13) | 13 | 13 |
| MVP completion consolidation (S14-S20) | 7 | 20 |
| Deferred expansion lanes (canon-only; not scheduled in this roadmap) | 5+ | open |

**Estimated calendar cadence:** if each sprint is one operator-review cycle (typically 1-3 days of Claude execution + operator review), critical path lands in approximately 13 review cycles. Multi-week sprints are out of scope by canon; any sprint that exceeds two review cycles should be split.

---

## 9. No-side-sprint governance rule

This roadmap is the controlling sequence. The following operating rules apply until it is explicitly replaced by a successor document:

1. **No reactive side sprints.** A discovery during sprint Sn cannot spawn a new sprint Sn+1' inserted mid-sequence. If the discovery is a true blocker, see § 11.
2. **No scope creep within a sprint.** Each sprint has fixed scope as defined in § 5. Adding "while we're here, let's also fix X" expands the sprint surface and violates this rule. X becomes a backlog item.
3. **No revisiting completed capabilities** (§ 2) unless the active sprint surfaces a verified regression. "Polish opportunities" for completed capabilities are backlog, not sprints.
4. **No pulling deferred expansion lanes forward.** § 7 lanes are deferred for stated reasons; pulling them forward requires a new authoring sprint that supersedes this roadmap.
5. **No working in a vacuum.** Every sprint outcome must be documented in `docs/08` + `docs/10` + the relevant domain doc. Sprint outputs that exist only in commit history are invisible to future sessions.
6. **No premature optimization.** S15 (time-to-deliverable optimization) exists deliberately AFTER the first deliverable. Optimizing before observed friction is forbidden.
7. **No new third-party dependencies without a canon sprint.** The package.json surface is part of the auditable canon; new deps require explicit authorization.

---

## 10. Claude Code role

For the lifetime of this roadmap, Claude operates within the following bounds:

- **Implementer.** Claude writes the code, runs the migrations, drives the UI walkthroughs, and authors the docs for the active sprint.
- **Verifier.** Claude proves each sprint completes by running lint + build + boundary checks + (where applicable) live walkthroughs against deployed staging.
- **Surfacer of blockers.** Claude reports blockers as they emerge ("Sprint Sn cannot complete because dependency X is missing"). Blockers are routed per § 11.
- **Documenter.** Claude maintains `docs/08`, `docs/10`, the relevant domain doc, and (when applicable) authors successor docs (`docs/40`+).
- **Pinner of canon.** Claude runs the disclaimer pin script and any other drift guards on every sprint.

Claude does **NOT**:

- Re-architect the sprint sequence. Sprint order in § 5 is the operator's decision; Claude proposes adjustments only when a blocker forces it.
- Self-schedule expansion-lane work. The deferred lanes in § 7 are explicitly off the table.
- Mint `/r` or `/p` links for any real client before Sprint S11 + S12.
- Mutate any real client engagement except as the active sprint authorizes.
- Add new third-party dependencies without explicit authorization (rule 7 in § 9).

---

## 11. Architect decision rule

Discoveries during sprint execution must be classified and routed per the following table. Misclassification is the principal drift failure mode.

| Discovery class | Definition | Routing |
|---|---|---|
| **Blocker** | The active sprint cannot complete its acceptance criteria without addressing this. | Address in the **current sprint** with the minimum scope expansion necessary. Document the expansion in the sprint outcome doc. |
| **Critical-path dependency** | The active sprint can complete, but a later sprint (Sn+k) cannot start until this is addressed. | **Schedule** as its own sprint, inserted into the locked sequence in § 5 at the appropriate slot. Update this roadmap. |
| **Improvement** | A nice-to-have that does not block the critical path or any scheduled sprint. | **Backlog** — record in `docs/08` "Backlog" section or in the relevant domain doc. NOT scheduled as a sprint. |
| **Expansion** | A capability that belongs to a deferred lane in § 7. | **Canon only** — note the discovery in the relevant § 7 row. NOT scheduled as a sprint until § 7's pre-conditions are met. |

**Example applications:**

- Sprint S1 finds the live-link route returns 500 on stakeholder submit → **Blocker** → fix in S1.
- Sprint S2 finds that `engagement_intake_documents.storage_path` is unused and needs an upload backend → **Critical-path dependency** for S2's own transcript ingest → fold storage backend wiring into S2 (re-scope acknowledged in this roadmap text).
- Sprint S4 finds that operator wants finer-grained synthesis weight controls → **Improvement** → backlog.
- Sprint S8 finds the operator wants to share a Section-3-preview link with a stakeholder → **Expansion** → canon row in § 7 ("Section-level share tokens"), NOT scheduled.

The operator (Architect) is the only authority that can reclassify a discovery between these buckets. Claude proposes; operator decides.

---

## 12. Recommended next sprint after roadmap lock

**Sprint S1 — Online Intake Flow Audit + Stakeholder Intake Readiness.**

Rationale: the canonical primary input lane (§ 4.1) is the live-link `/intake/[token]` route. Sprint I3 + Live Walkthrough validated the tertiary offline lane works on deployed staging; the primary lane has not been audited end-to-end against a real stakeholder submission since `docs/29` landed. Before any AI synthesis sprint (S4) consumes responses, the primary lane must be confirmed canon-correct.

S1 acceptance:
1. Live-link audit completes with documented evidence of a successful end-to-end stakeholder submission against a controlled test fixture (NOT Sapient Digital).
2. Readiness gate wording finalized; code-side enforcement hook stubbed (enforcement lands in S11).
3. `docs/35` § 5 readiness gate definition reviewed and aligned with primary/secondary/tertiary hierarchy in § 4.
4. Any operator-blocking live-link UX issues fixed in-scope.
5. Update `docs/08` + `docs/10`; recommend Sprint S2 (transcript ingest) as next.

---

## 13. Files modified by this roadmap sprint

- `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` (this file — new)
- `docs/08_CURRENT_STATUS.md` (roadmap-lock block added at top)
- `docs/10_SESSION_HANDOFF.md` (Latest line replaced with roadmap-lock outcome + next-planned pointer to Sprint S1)

**Zero source code changes. Zero migration runs. Zero engagement mutations. Zero `/r` or `/p` mint. Zero send. Zero schema or package changes. Zero Sapient Digital interaction beyond reading existing state to ground § 1.**
