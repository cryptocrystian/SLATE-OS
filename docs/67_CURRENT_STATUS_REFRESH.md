# SLATE — Current Status Refresh ("You Are Here")

## Status

- **Date:** 2026-08-18
- **Branch:** `persistence/step-0-1-auth-shell`
- **Type:** Status snapshot / orientation doc. No source code, no migration, no
  engagement mutation. Built from the canon (`docs/00`–`docs/66`) cross-checked
  against the code (app routes, migrations `0001`–`0021`) and the live Supabase
  engagement roster.
- **Why this exists:** `docs/08` (Current Status) was last appended `2026-06-18`
  and does not reflect the last ~two months of work; `docs/39` (the roadmap)
  predates the SOW-share reversal and still lists that lane as forbidden. The
  canon's own "where are we" surface had drifted out of date. This doc is the
  authoritative current snapshot as of the date above; `docs/08` + `docs/10`
  are updated in the same pass to point here.
- **Authority:** Snapshot only. It does **not** re-architect the roadmap
  (`docs/39` remains the controlling sequence) — it records true state and
  reconciles the two canon docs that had gone stale.

---

## 1. There are two finish lines (they are not the same)

| Finish line | Defined by | State |
|---|---|---|
| **Product MVP** — `Scorecard → Lead → AI Opportunity Sprint → Audit Report → Proposal/SOW`, premium feel, mandatory human review | `docs/02` | **Feature-complete** — every in-scope capability exists in code and has been exercised on synthetic fixtures. |
| **Consulting module "MVP-complete"** — locked critical path S1→S13 (through *one real client delivered end-to-end*), then S14–S20 consolidation | `docs/39` | **Critical path is ~92% built, but its terminal milestone — a real client delivered — is NOT reached.** |

The distance between these two is the entire reason progress "feels endless":
the machine is built; it has not yet been *used for a real client once*.

---

## 2. You are here (one line)

**The pipeline and all three client delivery surfaces are built, hardened, and
verified on synthetic fixtures; the operator app has been redesigned; what
remains is (a) taking a first *real* client through delivery, (b) a premium
visual pass on the client-facing *documents*, and (c) the S14–S20 repeatability
consolidation.**

---

## 3. What is built and verified

| Area | State | Evidence |
|---|---|---|
| Full pipeline: intake → findings → opportunities → roadmap → report → proposal → SOW, with AI drafting + mandatory human-approval gates | **Done** (Sprints S1–S10) | `docs/39` §2; `docs/43`–`docs/54`; migrations `0005`–`0016` |
| Client delivery surfaces `/r` (report), `/p` (proposal), `/s` (SOW) — share tokens, revoke, cascade-revoke, disclaimers, `noindex`/`no-store`/`no-referrer` headers, generic-unavailable on revoked/expired/invalid | **Done + hardened** | `docs/23`, `docs/25`, `docs/66`; migrations `0014`/`0016`/`0021` |
| Pre-delivery audit gate — refuses a mint when the upstream chain is incomplete; now surface-aware for `report` / `proposal` / `sow` | **Done** (S11) + extended to `sow` | `docs/55`; `docs/66` |
| Send-to-Client (operator-mediated copy-link; audience label; hashed recipient; mark-sent) for report + proposal | **Done** | `docs/29`, `docs/30` |
| Intake lanes: live-link (Mode A), offline (Modes B/C), transcript paste (S2), CRM read context via Attio (S3) | **Done** | `docs/37`, `docs/41`, `docs/42` |
| **Operator app UI redesign** — Phase 0 (dead-chrome sweep) + Phase 1 (design system: sans typography, surface/interaction consistency, focus/dialog a11y, filter tabs) | **Done + QA-approved** (~4.2/5; "AI-slop signature gone from operator surfaces") | `docs/62`, `docs/63`, `docs/64` |
| Content anti-slop: client-copy sanitizer + `viewerMode` redaction, section/option prompt overhaul, deliverable presentation pass | **Done** | `docs/61`; commits this session |
| SOW share route `/s` — approval action, mint (mandatory audience + extra confirm), eligibility, both void cascades, public render de-leaked + disclaimers aligned to `docs/28` §4 verbatim | **Done + acceptance-audited (P7-B)** | `docs/28`, `docs/65`, `docs/66` |

---

## 4. What remains — in priority order

1. **Deliver to a first *real* client** (roadmap terminal, Sprint S13). **Not
   done — live-confirmed** (see §5). Every engagement to date is
   synthetic/internal. This is the single biggest distance to "MVP-complete,"
   and it is gated as much on a **go-to-market decision (select + sign a pilot
   client)** as on code. `docs/58` verdict: **GO WITH CAUTIONS**; Sapient
   Digital is explicitly *not* the first pilot; first pilot client not yet
   selected.
2. **Client-facing deliverable *document* redesign** (Phase 2 / theme **T10**).
   The operator app got its premium pass; the documents a client actually
   receives (`/r` `/p` `/s` renders + PDF — cover, letterhead, tiered option
   cards, visual hierarchy) did **not**. Only content-correctness/anti-slop was
   addressed. Source: `docs/63` §2 (scope boundary), `docs/64` issue #5.
3. **Consolidation Sprints S14–S20** — second real engagement, time-to-deliverable
   tightening, multi-engagement triage UX, findings-quality feedback loop,
   post-delivery roadmap tracking. This is what turns "delivered once" into a
   *repeatable* product. Not started. Source: `docs/39` §6.
4. **Phase 2 operator UX polish** — decision-first hierarchy (retire the 6-up KPI
   scoreboards as page leads), forms-vs-workspace layout, dense-mobile scroll.
   Non-blocking. Source: `docs/64` issues #2–#4.
5. **Deferred expansion lanes (canon-only, intentionally unscheduled)** —
   SLATE-sent email invites, CRM writeback, e-signature, SOW template library.
   Source: `docs/39` §7 (note the "public SOW share" row is now superseded —
   see §6).

---

## 5. Live engagement roster (grounds §4.1)

Queried against production Supabase (`hhglrcvsmwaheikdvijw`) on the snapshot date.
**All three engagements are internal/synthetic; none is a real external client
taken through delivery.**

| Engagement | Nature | Notes |
|---|---|---|
| Meridian Field Services | **Synthetic ICP QA fixture** (labeled as such in `docs/59`/`docs/60`; must never appear in real client comms) | 8 findings, 1 approved proposal candidate; the fixture this session's P7-B E2E ran against |
| SLATE Pilot Test Client | **Internal test fixture** | 8 findings, 3 approved proposal candidates |
| Sapient Digital | Intended first real client; **never progressed past setup** | 0 findings; S12 mint correctly gate-blocked (`docs/56`) |

---

## 6. Canon reconciliation (drift fixed here)

Two controlling docs had gone stale; recording the corrections so future sessions
don't hit contradictory canon:

- **`docs/39` on public SOW share is superseded.** `docs/39` §1.2 / §3 / §7
  (authored 2026-06-02) state the public SOW share route is *forbidden* and a
  deferred-expansion lane. That was reversed: `docs/65` flipped `docs/28`'s
  deferral to a conditional authorization, and P7-B **built and acceptance-audited**
  `/s/[token]` (`docs/66`). The controlling canon for the SOW-share lane is now
  `docs/28` + `docs/65` + `docs/66`, **not** `docs/39` §7.
- **`docs/39` first-client target is revised.** `docs/39` §5 names Sapient
  Digital as the first-real-deliverable target (S13). `docs/58` supersedes that:
  Sapient is *not* the first pilot; the first pilot client is to be selected per
  `docs/58` §10–11.
- **`docs/08` was stale.** Last appended 2026-06-18; the Meridian synthetic pilot
  run, the operator UI redesign (Phases 0/1), and the entire P7-B SOW-share build
  were not logged there until this refresh.

---

## 7. What is authoritative going forward

- **Roadmap / sprint sequence:** `docs/39` (except the two supersessions in §6).
- **Current status snapshot:** this doc (`docs/67`), as of its date.
- **Per-lane canon:** the domain doc for each lane (`docs/28`/`65`/`66` for SOW
  share; `docs/29`/`30` for Send-to-Client; `docs/55` for the pre-delivery audit;
  `docs/62`–`64` for the UI redesign).
- **Rigor caveat:** "Done" for the pipeline stages rests on the acceptance-audit
  docs plus synthetic-fixture walkthroughs — **not** a real-client end-to-end run
  (none has occurred). Treat the first real engagement as the true validation.

---

## 8. Recommended next moves

1. **Business, not code:** select the first real pilot client per `docs/58` §10;
   that unblocks the roadmap terminal (S13) and converts the built machine into a
   delivered outcome.
2. **Bounded design pass:** Phase 2 / T10 — the client-facing deliverable document
   redesign. This is the highest-leverage *code* work: it's what the client sees.
3. **Keep the status surface fresh:** update this doc (or its successor) at the end
   of each substantive sprint so the fog does not reassemble. Per `docs/39` §9
   rule 5, every sprint outcome belongs in `docs/08` + `docs/10` + its domain doc.

---

## 9. Files touched by this refresh

- `docs/67_CURRENT_STATUS_REFRESH.md` (this file — new)
- `docs/08_CURRENT_STATUS.md` (catch-up entry prepended for 2026-06-18 → 2026-08-18; pointer to this doc)
- `docs/10_SESSION_HANDOFF.md` (Latest pointer updated to this doc)

Zero source code changes. Zero migrations. Zero engagement mutations. Zero mint/send.
