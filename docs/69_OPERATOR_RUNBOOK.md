# docs/69 — Operator Runbook (AI Opportunity Sprint, end-to-end)

## Status

- **Date:** 2026-09-23
- **Branch:** `persistence/step-0-1-auth-shell`
- **Type:** Operator-facing playbook. The single executable runbook for taking one
  engagement through the full AI Opportunity Sprint pipeline — intake → findings →
  opportunities → roadmap → report → proposal → SOW → delivery — without
  cross-referencing other docs in real time.
- **Supersedes:** the drafted runbook in `docs/58 §9` (promoted here and corrected).
  **Correction vs. `docs/58 §9`:** that draft stated the `/s` SOW public share route
  does not exist and that minting one is a canon violation. **That is superseded** —
  `docs/28`+`docs/65`+`docs/66` reversed the deferral and the `/s/[token]` route is
  built and acceptance-audited. SOW public share is now *conditionally authorized*
  (see Stage 9 / Stop conditions).
- **Pairs with:** `docs/68` (methodology + output-quality rubric). This runbook is
  the *how-to-operate*; `docs/68` is the *how-to-judge-quality*. Every stage below
  carries both a **count gate** (`docs/35 §5`, code-enforced) and a **quality
  checkpoint** (`docs/68` Part B/D).
- **First use:** the founder's realistic self-test. It is equally valid for the
  first real pilot. Where a step differs for the self-test, it's marked **[self-test]**.

---

## 0. Before you open the engagement (pre-run)

Collect, **outside SLATE**, before Stage 1:

- Client legal name / DBA → becomes `engagement.name`.
- Executive sponsor — name + role.
- Two more canonical-role stakeholders (operations / sales / finance / IT / frontline).
- Your pricing-range expectation (commercial judgment) — feeds the proposal options.
- Engagement window (4–8 weeks is typical).
- At least one supporting document (org chart / strategic plan / sales deck) **or**
  your explicit "no documents needed" decision.

**[self-test]** Build a realistic case from a real-world scenario you know well, so
you can judge whether the outputs ring true. Label every record so it can never be
mistaken for a real client engagement (follow the `docs/59 §9` synthetic-labeling
protocol: `SYNTHETIC —` / test prefixes on engagement name, stakeholder names,
asset titles; keep `client_visible=false` on offline-staged records).

**How to run the quality review:** at each checkpoint below, score every artifact
on the six `docs/68` dimensions (Grounding · Specificity · Insight · Methodology ·
Voice · Commercial realism), 1–4. **Do not approve past a checkpoint with any
dimension < 3.** Capture a one-line quality note per artifact — the aggregate is
your greenlight evidence base.

---

## Stage 1 — Engagement creation

1. Create a new `ai_opportunity_sprint` engagement (`/app/engagements/new` or the
   equivalent affordance).
2. Set `engagement.name` to the client's legal/DBA name.
3. Confirm it persists as a **UUID**, not a mock slug; verify `current_stage='setup'`.

---

## Stage 2 — Intake  → clears C1 + C2

Use any combination of intake modes (`docs/37`):

- **Mode A (live link):** `Generate intake link` per stakeholder; share the URL via
  *your* secure channel (never SLATE-side); stakeholder submits at `/intake/<token>`.
- **Mode B (offline):** `Stage offline stakeholder` per role; fill operator-collected
  answers; mark each `ready_for_synthesis`.
- **Mode C (transcript):** paste a real transcript into the transcript panel;
  segment + ingest.

**Count gate:** roles invited ≥ 3 · ready response sessions ≥ 2 (verify on the
Pre-delivery audit card).
**Quality checkpoint CP-0:** Is the intake *substantive and attributed*, not thin?
Everything downstream inherits intake quality — a thin intake cannot produce a good
report. If it's thin, collect more before proceeding.

---

## Stage 3 — Documents  → clears C3

Upload ≥ 1 supporting document, **or** explicitly acknowledge "no documents needed."

---

## Stage 4 — Findings  → clears C4 + C5

1. `/app/engagements/[id]/findings` → `Generate AI findings`.
2. If the readiness gate fires, resolve Stage 2/3 first. Use the operator override
   only with a written, logged rationale.
3. Review **every** finding. Approve ≥ 5; reject the rest.
4. Confirm each approved finding shows provenance chips (source-type + strength).

**Count gate:** drafted ≥ 8 · approved ≥ 5.
**Quality checkpoint CP-1** (score each finding, `docs/68` B.2-findings):
- Grounded in real evidence, or honestly assumption-flagged (tertiary-only ⇒ flagged)?
- Specific to *this* client (named systems/roles/volumes), not generic?
- A real insight, not a restated intake question?
Reject anything generic or unfounded even if the count is met.

---

## Stage 5 — Opportunities  → clears C6 + C7

1. `/app/engagements/[id]/opportunities` → `Generate AI opportunities` (from approved
   findings only).
2. Mark ≥ 3 `status=selected` (selection ≡ "recommended"); defer the rest.

**Count gate:** created ≥ 3 · recommended ≥ 1.
**Quality checkpoint CP-2** (score each, + placement sanity):
- Does the derived **quadrant match intuition** — is a "quick win" genuinely
  low-complexity; is nothing high-risk mislabeled?
- Is evidence-strength honest against the linked findings?
- Does the set cover the real opportunity space, not four variants of one idea?
- **Commercial realism:** would a real buyer find these worth doing?

---

## Stage 6 — Roadmap  → clears C8

1. `/app/engagements/[id]/roadmap` → `Generate AI roadmap items` (from selected
   opportunities).
2. Link each item to its source opportunity **and** flip status to `ready`.

**Count gate:** ready + linked ≥ 3.
**Quality checkpoint CP-3:** Is `first_30` genuinely grounded in selected
opportunities? Is the sequencing defensible (dependencies respected)? Are timelines
realistic (D6)?

---

## Stage 7 — Report sections  → clears C9 + C10

1. `/app/engagements/[id]/report` → `Generate all 12 sections`.
2. Review **every** section. Approve ≥ 8, **including Executive Summary**.
3. Generate a fresh (non-voided) report PDF candidate snapshot.

**Count gate:** drafted ≥ 10 · approved ≥ 8 (incl. Exec Summary + 3 exhibits) ·
fresh snapshot present.
**Quality checkpoint CP-4** — score per-section (D4 charter jobs) **and** the
report-level checks (`docs/68` B.2-report):
- Executive summary **synthesizes** (a decision + the few things that matter) — does
  **not** enumerate findings.
- Each section does its **distinct** job; no two re-narrate the same material.
- The section summaries **read as one coherent executive story** in order.
- Only the appendix enumerates.
This is the highest-stakes checkpoint — hold the report to the narrative bar.

---

## Stage 8 — Proposal  → clears C12 + C15

1. `/app/engagements/[id]/proposal` → `Generate all 3 options`.
2. Set the pricing placeholder for each option (your commercial judgment — the AI
   never sets pricing).
3. Set one option as `recommended_option_id`.
4. `Generate Proposal Candidate` → snapshot.
5. Verify commercial guard `passed=true`. If it fails, review each option's fields
   for banned language, re-author, regenerate. (If it fails **>2×** after
   re-authoring, that's a scope problem — see Stop conditions.)
6. `Approve candidate` → `approval_state='approved'`.

**Count gate:** approved proposal snapshot · commercial guard passed.
**Quality checkpoint CP-5** (`docs/68` B.2-proposal):
- Are the **3 options visibly different** in depth/commitment/outcome (not one scope
  reworded)?
- Is each `bestFitScenario` a real "choose this when…"?
- Is the **recommended option defensible** given the findings/roadmap?
- **Commercial realism (D6):** is the scope/timeline/pricing something a real buyer
  in this situation would actually accept?

---

## Stage 9 — SOW draft (internal; optional)

1. `Generate SOW Draft` → internal commercial-shape preview (deterministic promotion
   from the approved proposal candidate; no AI).
2. Review for internal alignment; void + regenerate if off.
3. **Boundary:** the SOW draft stays watermarked even after approval.

**SOW public share (`/s`) — conditionally authorized (corrected vs. `docs/58 §9`):**
the `/s/[token]` route now exists (`docs/28`/`65`/`66`). Minting an `/s` link is a
*deliberate* action gated by its own approval + eligibility + audience label — it is
**no longer a canon violation**. Only mint `/s` when you intend to share the SOW and
the SOW-share eligibility clears. It remains a draft on the public surface (watermark
persists); approval gates shareability, not execution. No e-signature exists.

---

## Stage 10 — Pre-delivery audit verification

1. Re-open the report page and the proposal page.
2. Read the Pre-delivery audit card on each — both must show **Audit passed**.
3. If blocking reasons remain, return to the relevant stage. **Never override the
   audit.**

---

## Stage 11 — Mint `/r` and `/p` (one-shot)

1. Audience label format: `PILOT 2026-Q3 ${ClientLegalName} ${RecipientRole}`. It
   **must not** begin with `audit / walkthrough / test / controlled / sample /
   staging / dev / qa`. **[self-test]** use a `SYNTHETIC …` label — which, note, the
   audit-label heuristic will *reject* for a real mint; for the self-test you are
   verifying the pipeline and outputs, not delivering, so stop at CP-7 (below) rather
   than minting to a real recipient.
2. `Generate share link` on the report side → copy the raw URL **immediately** into
   your secure storage (shown exactly once).
3. Repeat on the proposal side. Optionally `/s` per Stage 9.

**Quality checkpoint CP-7 (pre-mint):** both gates pass —
(a) every count in `docs/35 §5` cleared, **and**
(b) every approved artifact scored ≥ 3 on all six `docs/68` dimensions.
**[self-test] This is your greenlight decision point.** Tally the quality notes from
CP-0…CP-5. If the run is ≥3-across with no stop conditions hit, that is one real data
point toward greenlighting real clients. Do **not** mint/deliver to anyone in the
self-test.

---

## Stage 12–13 — Delivery + mark-sent (real pilot only)

12. Hand-deliver the `/r`, `/p` (and optional `/s`) URLs via *your* approved channel.
    **SLATE does not send.** Wait for the client to confirm receipt.
13. After confirmation, `Mark sent` on each token row (records recipient hash + channel;
    activity logs send-intent only).

---

## Stop conditions — STOP and get senior review

Stop immediately if any of these occur:

- Pre-delivery audit fires with reasons not on the `docs/35 §5` list.
- Commercial guard fails **> 2×** after re-authoring — a scope problem, not wording.
- A stakeholder withdraws intake mid-flow, or unexpected PII surfaces → revoke any
  active tokens at once.
- A client asks SLATE to send the link (canon = operator-mediated handoff only).
- A client asks for e-signature (SLATE has none; defer to an external tool).
- **Quality:** an artifact can't reach ≥3 on all six dimensions after a redraft, and
  the cause is upstream (thin intake / weak findings) — return to that stage rather
  than forcing the chain forward.
- You're unsure what to do at any stage.

---

## Quick reference — the count gate (`docs/35 §5`)

roles invited ≥ 3 · ready intake sessions ≥ 2 · ≥ 1 document or sign-off · findings
drafted ≥ 8 / approved ≥ 5 · opportunities created ≥ 3 / recommended ≥ 1 · roadmap
linked ≥ 3 · report sections drafted ≥ 10 / approved ≥ 8 (incl. Exec Summary + 3
exhibits) · approved proposal snapshot + commercial guard passed · disciplined
audience label. **The count gate is necessary, not sufficient — the `docs/68` quality
bar is the other half.**
