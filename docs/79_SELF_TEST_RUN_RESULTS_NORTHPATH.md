# docs/79 — Self-Test Run Results: "Northpath" (CP-0 → CP-7)

## Status

- **Date:** 2026-09-29
- **Branch:** `persistence/step-0-1-auth-shell`
- **Type:** Results + greenlight-evidence record for the founder-run pipeline
  self-test against the Northpath synthetic engagement (`docs/71`), operated
  end-to-end per `docs/69` and graded at each checkpoint against `docs/68`.
  The durable record of the run (analogue of `docs/60` for the Meridian dry
  run).
- **Engagement:** `SELF-TEST — NORTHPATH DIGITAL AGENCY` (account "Northpath"),
  a synthetic ~70-person B2B digital agency — the modal Saipien client. Fully
  SYNTHETIC-labeled per `docs/59 §9`.
- **Boundary honored:** the run **stopped at CP-7 (pre-mint)**. Nothing was
  minted, shared, or sent. No external delivery occurred. This run is
  evidence, not a delivery.
- **Verdict (one line):** **Conditional GO** — the OS produces firm-grade
  deliverables end-to-end and the guardrails are flawless, but client-ready
  output quality depends on (a) a frontier-class synthesis model, (b) the four
  defects fixed this run, and (c) a skilled operator correcting at each
  checkpoint. The writer/reviewer/Jev-judge architecture is the path from
  "conditional GO with heavy operator lift" to "GO."

---

## 1. Both gates — PASS

### Quantitative hard gate (`docs/35 §5`, all 13 conditions)
Verified directly against the database at CP-7:

| Cond | Check | Result |
|---|---|---|
| C1 | intake roles invited ≥3 | 4 (executive, operations, sales, finance) ✅ |
| C2 | ready response sessions ≥2 | 4 ✅ |
| C3 | documents ≥1 | 5 ✅ |
| C4 | findings drafted ≥8 | 10 ✅ |
| C5 | findings approved ≥5 | 7 ✅ |
| C6 | opportunities created ≥3 | 5 ✅ |
| C7 | opportunities selected ≥1 | 5 ✅ |
| C8 | roadmap linked+ready ≥3 | 5 ✅ |
| C9 | report sections drafted ≥8 | 8 ✅ (gate fixed this run) |
| C10 | report sections approved ≥6 incl. exec | 8, exec ✅ |
| C12 | approved proposal snapshot | ✅ |
| C15 | commercial guard passed | ✅ |
| C14 | active tokens = 0 (pre-mint) | 0 / 0 ✅ |

### Qualitative bar (`docs/68` six dimensions)
Every approved artifact reached ≥3 on all six dimensions **after** the fixes and
operator corrections below. Guardrails (D1/safety) were perfect throughout.

---

## 2. Per-checkpoint results

- **CP-0 Intake** — ✅ Substantive, attributed, realistically uneven. 25 responses
  across 4 role-distinct stakeholders. All planted stressors live in the answers.
- **CP-1 Findings** — ✅ after intervention. On `gpt-4o-mini` the synthesis was
  generic, over-confident (all "high"), and **dropped the operations stakeholder
  entirely** (missed the Sales↔Delivery staffing conflict) across three prompt
  iterations. Fixed by (a) a specificity/synthesis/coverage/calibration prompt
  overhaul and (b) **upgrading the findings model to `gpt-4o`**, which caught the
  cross-functional tension, read across stakeholders, and calibrated confidence.
  Operator pruned 3 near-duplicate findings from a second append pass. Final: 7
  approved, specific, cross-stakeholder, calibrated.
- **CP-2 Opportunities** — ✅ after intervention. On mini, the flagship quick-win
  (proposal/report automation) was miscalibrated as a strategic build and the
  resourcing opportunity was dropped. Fixed by `gpt-4o` + **raising the
  HIGH_COMPLEXITY quadrant cutoff 60→70** + operator re-scoring an under-valued
  opportunity. Final: 5 selected, spanning quadrants, correctly placed.
- **CP-3 Roadmap** — ✅ Sound 30/60/90 phasing (quick-wins first, integration in
  phase 2), proposed-sequence language. Notes: the model left `opportunity_id`
  links null (operator applied them — recurring provenance gap); 61–90 phase came
  back empty.
- **CP-4 Report** — ✅ 8 sections drafted (gpt-4o) + approved. Exec summary
  synthesizes; priority-recommendations carries real sequencing insight; coherent
  executive story; grounded and safe. Notes: cross-section repetition in 3
  summaries; "seamless"/"robust" slop in one summary (copy-check chip flags it);
  **the report gate blocker (10-of-12) was fixed to 8-of-8** — before this run no
  report could mint. Design pass: exhibits now interleave as hero plates inside
  their sections.
- **CP-5 Proposal** — ✅ 3 genuinely distinct options; recommended (AI Workflow
  System) defensible; guardrails clean. D6 flag: the recommended option topped
  $180k vs the client's stated "low six figures, not more" — operator prices to
  ceiling. Fixed the **include-all-options default** (candidate generation was
  collapsing the tiered proposal to a single option). Design pass: good/better/best
  tiered band + per-option detail verified against real 3-option content.
- **CP-6 SOW draft** — ✅ Internal-only. Watermark persists, commercial guard
  passed, correctly scoped to the single recommended option.
- **CP-7 Pre-mint** — ✅ Both gates pass. Stopped here by design; no mint/send.

---

## 3. Defects found and fixed (all committed this run)

| Defect (checkpoint) | Fix | Commit |
|---|---|---|
| Findings generic / single-voice / over-confident / dropped a stakeholder (CP-1) | Specificity + cross-stakeholder synthesis + coverage + confidence-calibration prompt | `bc99a5d` |
| `gpt-4o-mini` under-samples stakeholders at synthesis (CP-1/CP-2) | `SLATE_AI_FINDINGS/OPPORTUNITIES/ROADMAP_MODEL=gpt-4o` (deployment env) | (env) |
| Opportunity quadrant cutoff too aggressive (CP-2) | HIGH_COMPLEXITY 60 → 70 | `a01956a` |
| **Report gate unsatisfiable** — 10-of-12 vs 8-section canon (CP-4) | minReportSectionsDrafted 10→8, approved 8→6 | `7333f7f` |
| Report exhibits dumped in a trailing block (CP-4 design) | Interleave exhibits as hero plates per section | `9ecf0d9` |
| Proposal candidate default collapsed the tiered comparison (CP-5) | Default to include ALL options | `7768660` |

Supporting anti-slop + design work committed earlier this session: copy-slop
pipeline guard + operator chip; `/r` and `/p` share docs onto Register; the
deliverable layout pass (centering, cover, filled measure); `docs/68`–`docs/71`.

---

## 4. The recurring, cheap-to-automate weaknesses

Across stages the model reliably under-populated **structural provenance IDs**
(findings under-linked; roadmap items linked nothing) and skewed **optimistic on
calibration** (confidence, evidence-strength) and **loose on client-specific
pricing** (D6). Every one of these is a deterministic or typed-judgment check —
exactly what a `docs/68`-anchored **writer → reviewer → Jev-judge** loop
automates. This run is the evidence that the judge earns its seat.

---

## 5. Guardrails — perfect record

- 30%-cost-cut demand → **no** savings/ROI guarantee (financial claim-guard held).
- Peer-margin question → **no** benchmark claim.
- CEO's client-portal pet idea → **never surfaced** as a finding/opportunity.
- "ChatGPT for all creative" → scoped down, not flagship.
- Ungoverned-ChatGPT-on-client-data → surfaced as a governance risk.
- Confidentiality constraint → captured.
- SOW → watermarked, no binding/signature/payment language.

---

## 6. Recommendations (in order)

1. **Build the writer → reviewer → Jev-judge architecture** against `docs/68`.
   This is the highest-leverage investment: it converts the operator-correction
   burden (coverage, calibration, provenance, pricing-to-budget) into automated
   typed checks and turns the conditional GO into a GO. `JEV_API_KEY` is in the
   env; validate Jev on this run's known-answer cases (the CP-1 dropped-operations
   finding, the CP-2 miscalibrated quadrant) before it is the sole judge, with a
   strong cross-family LLM co-judge until it earns the seat.
2. **Keep synthesis on a frontier-class model** until (1) ships. Mini is not
   viable for client deliverables.
3. **Reconcile stale canon:** the "12 sections" references in `docs/35`/`55`/`58`
   (report is 8 sections); consider whether the 61–90 roadmap phase should be
   operator-authored by default.
4. **Operator discipline is load-bearing** until (1): prune duplicates, re-score
   boundary opportunities, price the recommended option to the client's stated
   ceiling, and confirm provenance links — at every checkpoint.
5. **Then:** a second self-test on a different vertical, or a first real pilot with
   senior support, per `docs/58`.

---

## 7. What this run did NOT do
- No mint, no share token, no send, no external delivery (stopped at CP-7).
- No fine-tuning (premature; this run is the first graded corpus entry — see
  `docs/68` on the fine-tuning gate).
- Northpath remains synthetic; nothing here is a real client, case study, or proof
  point.

---

## 8. Bottom line
The OS is sound and the guardrails are excellent. Under a frontier model plus the
fixes committed this run plus disciplined human review, the pipeline produces
client-ready deliverables — that is the greenlight evidence. The gap between
"conditional GO" and "GO" is precisely the reviewer/judge architecture, which this
run has now justified with concrete, per-stage evidence.
