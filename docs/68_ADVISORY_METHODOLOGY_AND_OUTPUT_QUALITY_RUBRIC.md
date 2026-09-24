# docs/68 — Saipien AI Advisory Methodology & Output-Quality Rubric

## Status

- **Date:** 2026-09-22
- **Branch:** `persistence/step-0-1-auth-shell`
- **Type:** Methodology + quality canon. Consolidates the advisory method that was
  previously encoded *implicitly* across the AI synthesis pipeline
  (`lib/ai/*`), the deterministic derivation rules (`lib/opportunities`,
  `lib/roadmap`, `lib/proposals`), and the stage spine in `docs/59 §8`, and
  layers on the **qualitative output-quality bar** that has never been written
  down. Drafted from the code; **the founder is the authority on where the
  drafted-from-code method is thin** — see §7 (Gaps for founder review).
- **Why this exists:** `docs/58` scored *methodology alignment* (structure) as
  PASS and *output quality* as CAUTION, with the honest note that real-input
  quality "cannot be statically guaranteed — the first real pilot is the
  validation." Before that pilot (a founder-run realistic self-test), we need an
  explicit bar to review each artifact against at set checkpoints. This doc is
  that bar. It is also the labeling standard if we ever build a fine-tuning
  corpus.
- **Authority:** The *hard quantitative gate* remains `docs/35 §5` (code-enforced
  by `evaluatePreDeliveryAudit`). This doc adds the *qualitative* layer and the
  *review-checkpoint protocol*. Where this doc and a stage's domain doc
  (`docs/43/45/48/49/51/54`) disagree on a rule, the domain doc + code win and
  this doc is corrected.

---

## 0. How to read this doc

- **Part A — The Method.** What each pipeline stage does, the evidence it stands
  on, and the deterministic rules the code already enforces. This is the
  methodology made explicit.
- **Part B — The Output-Quality Rubric.** Five scoring dimensions applied per
  artifact, with concrete per-stage criteria and a pass bar.
- **Part C — The two gates.** Quantitative (counts) vs. qualitative (this rubric),
  and how they compose into a go/no-go.
- **Part D — The review-checkpoint protocol.** Where to pause during the self-test,
  what to score, and the decision at each stop.
- **§7 — Gaps for founder review.** The specific method choices only the founder
  can ratify.

---

# PART A — THE METHOD

## A.0 Shape of the pipeline

A linear chain of **operator-review-gated** synthesis stages. Every stage follows
the same skeleton:

1. a server-only `*-context.ts` builder assembles a **bounded, PII-redacted** JSON
   payload from the DB (RLS-scoped, auth-gated);
2. a `*-synthesis.ts` module builds the prompt, calls the provider at
   `temperature: 0.2` asking for **JSON only**, then validates against strict
   allowlists — **dropping malformed candidates rather than coercing them**;
3. a `*synthesis-actions.ts` server action **derives the deterministic fields**
   (status, priority, quadrant, position, provenance) and persists.

**The load-bearing invariant:** the model never sets status, priority, quadrant,
or provenance. The LLM produces bounded prose + raw 0–100 scores + grounding IDs
drawn from an **authoritative allowlist**; the server derives everything
consequential. A draft is never client-visible until a human approves it (this is
permanent canon — see `advisoryops-human-review-by-design`).

Each stage consumes only **operator-blessed** upstream output:

| Stage | Consumes upstream only when status is… |
|---|---|
| Findings | (from intake/scorecard/CRM/assets) |
| Opportunities | findings ∈ {approved, report_ready} |
| Roadmap | findings approved/report_ready · opportunities **selected** |
| Report sections | findings approved · opportunities selected · roadmap **ready** |
| Proposal options | + report sections **approved/final** |
| SOW draft | approved proposal candidate snapshot (non-LLM promotion) |

## A.1 Stage 1 — Findings

**Job:** turn gathered evidence into 3–7 draft findings a human consultant can
approve.

**Evidence lane hierarchy (the core input method — flag §7.1):**
- **PRIMARY — live-link intake:** stakeholders typed answers themselves →
  high-confidence first-hand signal.
- **SECONDARY — transcripts:** solid when the speaker is attributed
  (name + title); moderate otherwise.
- **SECONDARY ENRICHMENT — CRM (Attio):** framing/sector context ONLY. Never a
  stakeholder quote; a `brand`/`leadSource` value is never itself a finding.
- **TERTIARY — offline operator notes:** supporting signal that requires
  corroboration before it earns high confidence.

**Method rules the model must follow:** no invented quotes (only verbatim context
text); input assets are metadata-only ("never claim to have read file content");
every finding has ≥1 source ref **or** `assumptionFlag=true`; a finding supported
only by the tertiary lane **must** be `assumptionFlag=true` with a note.

**Source-ref strength scale:** strong = corroboration across ≥2 lanes; adequate =
single clear response in a primary/secondary lane; thin = inferred or tertiary-only;
missing = none.

**Deterministic rules (code):** 3–7 findings; 8-value category allowlist;
confidence ∈ {high, medium, low, needs_evidence}; `if (no sourceRefs && !assumptionFlag) → drop`;
field caps (statement 240, summary 600, impact 320…); source UUIDs validated.

## A.2 Stage 2 — Opportunities

**Job:** convert approved findings into 2–6 scored opportunities, each linked to
≥1 finding.

**The scoring→placement method (deterministic — flag §7.2):** the LLM emits six
raw 0–100 axis scores (businessImpact, complexity, risk, timeToValue,
adoptionLikelihood, strategicValue); **the server derives quadrant and priority:**
- **Risk override first:** `risk ≥ 85 → defer-avoid` (a fake "quick win" cannot
  slip past the operator filter).
- Then 2×2 on `HIGH_IMPACT = 70`, `HIGH_COMPLEXITY = 60`:
  high-impact/low-complexity → **quick-win**; high/high → **strategic-build**;
  low/low → **low-priority**; low-impact/high-complexity → **defer-avoid**.
- Priority is derived from quadrant (defer-avoid → defer).

**Provenance-aware evidence honesty:** if an opportunity links only to
`needsValidation`/`assumptionFlag` findings → `evidenceStrength='thin'`, raise
risk, and use conservative verbs ("investigate/validate/scope" not
"build/ship/automate"). `'strong'` is allowed only when **all** linked findings
have `needsValidation=false`.

**Deterministic rules:** 2–6 opportunities; 9-value category allowlist; scores
clamped 0–100 (non-finite → 50); linkedFindingIds must be real UUIDs in the
eligible set (else drop); title dedup.

## A.3 Stage 3 — Roadmap

**Job:** sequence selected opportunities into a 30/60/90 plan (2–6 items).

**Method rules:** only `selected` opportunities are eligible (scored-but-unselected
is draft-equivalent and excluded); `first_30` holds only work grounded in
already-selected opportunities; later phases hold evidence-supported follow-ons;
pricing from proposal options is **read-only context, never a generative driver**.
Language is proposed-sequence, never commitment.

**Deterministic rules:** phases ∈ {first_30, days_31_60, days_61_90}; priority
allowlist; **append-only** (`position = max(existing)+1` per phase; existing items
never modified); HTML rejected; **hard banned-claim scan** (financial + commercial-finality
+ roadmap-commitment → whole run fails on any hit).

## A.4 Stage 4 — Report sections (12)

**Job:** draft one section at a time, each doing its **distinct charter job**, in a
McKinsey/BCG/Bain register, grounded only in supplied context.

**The 12 section charters (the report methodology — flag §7.3):**

| Section | Charter (its distinct job) |
|---|---|
| executive_summary | The 3–5 things a CEO must know + the single recommended next move. **Synthesize, don't enumerate.** Stands alone if read in isolation. |
| business_context | The operating situation and what's at stake; frame the "why act now." Not a findings list. |
| systems_snapshot | Current-state systems/data landscape and where handoffs break. As-is architecture and its seams — not fixes. |
| readiness_assessment | A maturity verdict on AI adoption readiness (data, process, ownership, change capacity). Not a friction rehash. |
| workflow_friction | As-is landscape briefly, then the specific friction points and their downstream cost, with named systems/roles. |
| stakeholder_synthesis | What stakeholders actually said: themes, tensions, alignment across roles (from intake aggregates). Human voices, not a findings list. |
| opportunity_portfolio | Portfolio-level trade-offs on impact/complexity/evidence; reference Figure 01. Don't re-derive each opportunity. |
| priority_recommendations | The recommended priority ORDER + reasoning + governance/risk guardrails, closing on the single next action. Rationale, not a catalog. |
| governance_risk | Risks, dependencies, guardrails for acting responsibly. A risk lens. |
| roadmap | The 30/60/90 plan: phasing logic, owners, success criteria; reference Figure 03. |
| recommended_next_step | The single immediate next action and what it unblocks. One concrete ask. |
| appendix | Terse factual index of findings/opportunities/roadmap. The ONE section that may enumerate. |

**Voice method:** lead with the point; banned meta-openers ("This section…");
banned filler list (leverage, seamless, robust, holistic, delve, unlock, empower,
synergy, cutting-edge, world-class, "it is important to note"…); concrete
operational specifics over abstraction. `summary` = the one takeaway as a claim;
`draftPreview` = the supporting analysis (never restating the summary). Reader has
already read earlier sections (anti-repetition; predecessors' summaries are fed in
as an "ALREADY ESTABLISHED" message).

**Deterministic rules:** HTML rejected; grounded IDs validated against the
authoritative allowlist (model cannot invent provenance); **hard financial-claim
scan**; **copy-slop critique attached (soft, surfaced not gated)**; always demoted
to `needs_review` ("you do not approve your own draft").

## A.5 Stage 5 — Proposal options (3)

**Job:** draft one option at a time as a **buying-decision document**, each
visibly different in depth/commitment/outcome.

**The 3 option archetypes (the commercial method — flag §7.4):**

| Option type | Charter |
|---|---|
| quick-win-build | Smallest/fastest committed build — 1–2 high-confidence opportunities end-to-end in weeks. For a buyer who wants proof + momentum. Name the concrete thing that ships. |
| ai-workflow-system | The core engagement: a coherent phased system across priority opportunities with the client's team involved. **The option most buyers should land on.** |
| managed-ai-partner | Most comprehensive/ongoing: build + continued operation, iteration, enablement. For a buyer who wants Saipien to own outcomes over time. |

**Method rules:** `bestFitScenario` = a crisp "choose this when…" judgment;
`scopeNarrative` = what it does and how it's sequenced (not a deliverables re-list).
**Pricing is read-only** (`option.pricingPlaceholder`) — no dollar amounts, rate
cards, or pricing math from the model; option type/recommendation/position are
operator-set commercial levers the model must not touch.

**Deterministic rules:** HTML rejected; grounded IDs validated; **hard financial +
commercial-finality scan**; copy-slop attached (soft); the action ignores any
model-set recommendation flag.

## A.6 Stage 6 — SOW draft (deterministic, non-LLM)

**Job:** promote an approved proposal candidate snapshot into an internal SOW
draft. No LLM. Fields are derived: scope/timeline from the first included option;
deliverables/assumptions/dependencies deduped across included options; pricing +
legal notices are canon-curated boilerplate.

**Guard:** the commercial guard runs *before* eligibility over the largest banned
set (financial + commercial-finality + roadmap-commitment + proposal-finality +
SOW-finality — signatures, payment terms, governing law, indemnification,
warranties, binding language). **Boundary:** stays `draft_watermark=true` even
after approval; no public route, no share token, no send, no e-sign, no PDF binary.

---

# PART B — THE OUTPUT-QUALITY RUBRIC

The code guards (Part A) enforce *structure, grounding validity, and safety*. They
**cannot** judge *substance*. The rubric below is the human layer applied at each
checkpoint. Score every artifact on five dimensions.

## B.0 Scoring scale (all dimensions)

| Score | Meaning | Action |
|---|---|---|
| **4 — Strong** | A senior consultant would ship this as-is. | Approve. |
| **3 — Acceptable** | Sound; minor operator edit at most. | Approve (edit if quick). |
| **2 — Rework** | Right direction, wrong substance/specificity; redraft or edit. | Do not approve; redraft/edit. |
| **1 — Reject** | Generic, unfounded, off-method, or unsafe. | Reject; fix upstream input if needed. |

**Pass bar to approve an artifact:** no dimension below **3**. A single **2**
blocks approval until edited/redrafted; any **1** is a stop.

## B.1 The six dimensions

- **D1 — Grounding & truth.** Every claim traces to real supplied evidence; no
  invention; thin-evidence items are visibly hedged (assumption flag / conservative
  verbs / "subject to validation"). *(Code checks provenance validity; the human
  checks the claim actually follows from the cited evidence.)*
- **D2 — Specificity & data value.** Uses *this* client's named systems, roles,
  workflows, volumes, and words. The tell of failure: it could be pasted into any
  company's report. This is the anti-generic dimension.
- **D3 — Insight.** Non-obvious and decision-useful — it tells the client something
  they'd pay to learn, not something they already know. "So what?" is answered.
- **D4 — Methodology adherence.** The artifact does its *canonical job* in the
  *canonical shape* (its charter / scoring logic / archetype). Per-stage specifics
  in B.2.
- **D5 — Voice & polish.** Human-produced register; no AI-slop tells; right tone
  for a decision document. *(Copy-slop chip assists; the human confirms.)*
- **D6 — Commercial realism.** The scope, timeline, and pricing placeholder are
  something a real buyer in *this* client's situation would actually accept — the
  engagement is sellable and deliverable, not aspirational. Timelines are
  achievable, scope matches the evidenced need (not gold-plated or thin), and the
  recommended proposal option is the one a rational buyer here would pick. *(Ratified
  as a dimension by the founder, 2026-09-23. Fully human judgment — no code proxy.)*

## B.2 Per-stage D4 (methodology-adherence) specifics

**Findings** — 3–7; each mapped to a correct category; each either evidence-backed
or honestly assumption-flagged; tertiary-only findings flagged; statements are
specific claims, not restated questions.

**Opportunities** — 2–6; each links to ≥1 real finding; **the derived quadrant
matches intuition** (a "quick win" is genuinely low-complexity; nothing high-risk
is mislabeled); evidence-strength is honest against the linked findings; the set
covers the real opportunity space, not four variants of one idea.

**Roadmap** — `first_30` contains only work grounded in selected opportunities;
sequencing logic is defensible (dependencies respected); language is
proposed-sequence, never commitment.

**Report — the report-level checks (score once across the report):**
- Executive summary **synthesizes** (a decision + the 3–5 things that matter), does
  **not** enumerate findings.
- Each section does its **distinct** charter job; no two sections re-narrate the
  same material.
- The section **summaries read as one coherent executive story** in order.
- Only the appendix enumerates.

**Proposal** — the **3 options are visibly different** in depth/commitment/outcome
(not one scope reworded); each `bestFitScenario` is a real "choose this when…";
**the recommended option is defensible** given the findings/roadmap; no pricing
invented.

**SOW** — scope/deliverables faithfully reflect the included option(s); the draft
watermark + pricing/legal notices are present; nothing reads as binding.

## B.3 What is already guaranteed vs. what needs your eyes

| Concern | Enforced in code | Needs human judgment |
|---|---|---|
| No invented IDs / provenance | ✅ allowlist validation | — |
| No financial/benchmark/commercial-finality/binding claims | ✅ banned-claim scanners (hard fail) | — |
| Counts / categories / phases in range | ✅ allowlists + bounds | — |
| Quadrant/priority/position correctness | ✅ server-derived | Does the placement *feel* right? (D4) |
| Evidence-strength honesty | ⚠ prompt-instructed + provenance projection | Is thin evidence actually hedged? (D1) |
| Style slop | ⚠ copy-slop chip (soft) | Confirm it reads human (D5) |
| Insight, specificity, data value | ❌ | **All human (D2, D3)** |
| Methodology adherence (charter jobs, archetypes) | ⚠ prompt-instructed | **Confirm each artifact did its job (D4)** |
| Commercial realism (sellable scope/timeline/pricing) | ❌ | **All human (D6)** |

The rightmost column is what your checkpoints exist to catch.

---

# PART C — THE TWO GATES

An engagement is deliverable only when **both** gates pass:

1. **Quantitative hard gate** (`docs/35 §5`, code-enforced, blocks the mint):
   ≥3 of 6 roles invited · ≥2 substantive intake sessions · ≥1 document or explicit
   sign-off · ≥8 findings drafted / ≥5 approved · ≥3 scored opportunities / ≥1
   recommended · ≥3 linked roadmap items · ≥10 of 12 sections drafted / ≥8 approved
   (incl. Executive Summary + 3 exhibits) · approved proposal snapshot + commercial
   guard passed · disciplined audience label.

2. **Qualitative bar** (this rubric, human-enforced at checkpoints): every approved
   artifact scored **≥3 on all six dimensions**.

The hard gate proves the pipeline is *complete*; the rubric proves it is *good*. A
run can clear the counts and still fail the rubric — that is exactly the failure
mode the self-test is designed to surface.

---

# PART D — REVIEW CHECKPOINT PROTOCOL (for the founder self-test)

Run the realistic case straight through the pipeline, pausing at each checkpoint to
score the artifacts against Part B before approving and moving on. Do **not**
approve past a checkpoint with any dimension < 3 — fix the input or redraft, and
note *why* (that note is the raw material for the eventual findings-quality
feedback loop, i.e. the deferred S14–S20 work).

| # | Checkpoint | Score | Go/No-go |
|---|---|---|---|
| CP-0 | **Intake complete** | Enough substantive, attributed signal to support findings? (drives everything downstream) | Proceed only if intake is real, not thin. |
| CP-1 | **Findings approved** | Each finding on D1–D6 + B.2 findings checks | Approve only ≥3-all; flag generic/unfounded. |
| CP-2 | **Opportunities selected** | Each on D1–D6; **quadrant placement sanity** | Select only defensible, well-placed opportunities. |
| CP-3 | **Roadmap ready** | Sequencing logic + phase grounding | Ready only if `first_30` is genuinely grounded. |
| CP-4 | **Report sections approved** | Per-section D4 **and** the report-level checks (exec synthesizes; sections distinct; summaries cohere) | Approve section-by-section; hold the report to the narrative-coherence bar. |
| CP-5 | **Proposal approved** | 3-options-differ + recommended-defensible + no invented pricing | Approve only if the options are a real choice. |
| CP-6 | **SOW draft (optional)** | Faithful scope; watermark + notices present | Internal only. |
| CP-7 | **Pre-mint** | Both gates (Part C) | Only then is the run a valid greenlight data point. |

Capture a one-line quality note per artifact at each checkpoint. After the run,
the aggregate of those notes is the **output-quality verdict** — and the
first-ever evidence base for a greenlight decision on real clients.

---

## 7. Founder ratification (2026-09-23)

The six method choices drafted from code were reviewed and ratified by the founder.
Outcomes:

1. **Evidence lane hierarchy (A.1)** — **ratified as-is.** live-link > transcript >
   CRM-enrichment > offline-operator; CRM is framing-only, never a finding.
2. **Opportunity scoring thresholds (A.2)** — **ratified provisionally.** Impact ≥ 70,
   complexity ≥ 60, risk ≥ 85 auto-defer, and the six axes stand for now. The
   founder will **sanity-check the numbers during the self-test** (do opportunities
   land in the right buckets?) and we adjust thresholds then if they feel off.
3. **12-section report shape + charters (A.4)** — **ratified as-is** for the test;
   revisit only if a section reads redundant or missing against a real report.
4. **3 proposal archetypes (A.5)** — **ratified as-is.** quick-win-build /
   ai-workflow-system (default recommendation) / managed-ai-partner is the
   commercial model.
5. **Count bounds** — **ratified as-is.** 3–7 findings, 2–6 opportunities, 2–6
   roadmap items.
6. **The qualitative bar (Part B)** — **ratified with one addition:** the founder
   added **D6 — Commercial realism** (is the scope/timeline/pricing something a real
   buyer would accept?). Now folded into B.1, B.3, Part C (≥3 on all six), and the
   CP-1/CP-2 checkpoints.

No threshold or charter code changes were required by this ratification (item 2 is
a during-test observation, not a change). D6 is a human-only rubric dimension with
no code proxy.

---

## 8. Files this doc consolidates (no code changed)

- Method extracted from: `lib/ai/{findings,opportunities,roadmap,report-section,proposal-option}-synthesis.ts`
  + their `*-context.ts`; `lib/ai/claim-guard.ts`; `lib/opportunities/{helpers,synthesis-actions,actions}.ts`;
  `lib/roadmap/synthesis-actions.ts`; `lib/proposals/{sow-draft-actions,commercial-guard}.ts`;
  `lib/findings/provenance.ts`.
- Gates + spine: `docs/35 §5`, `docs/59 §8`, `docs/58` (Dimensions 3, 4, 8).
- Related canon: `docs/43` (findings), `docs/45` (opportunities), `docs/48` (roadmap),
  `docs/49` (report), `docs/51` (proposal), `docs/54` (SOW), `docs/55` (pre-delivery audit).

Zero source changes. Zero migrations. Zero engagement mutations.
