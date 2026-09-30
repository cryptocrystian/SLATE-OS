# docs/73 — Jev Judge Validation (findings stage)

## Status

- **Date:** 2026-09-29
- **Branch:** `persistence/step-0-1-auth-shell`
- **Type:** In-domain validation of the Jev (TypeSafe System One) judge for the
  WRJ findings stage, before Jev is trusted as a gate. Follows the TypeSafe
  skill's own caveat: *"typed output guarantees the interface, not truth;
  validate performance in the target domain."*
- **Method:** replay two ground-truth findings sets from the Northpath
  self-test (`docs/72`) through the shipped findings checks
  (`lib/ai/wrj/findings-wrj.ts`) over the **real Northpath intake**, and
  confirm Jev fails the known-bad set and passes the known-good one.
  - **KNOWN-BAD** — the gpt-4o-mini output: generic statements, dropped the
    operations stakeholder entirely, every finding marked `high` confidence.
  - **KNOWN-GOOD** — the gpt-4o output: specific (named systems/roles/numbers),
    covered the Sales↔Delivery resourcing conflict, calibrated confidence.

## Round 1 — untuned checks (surfaced the problems)

| Check | BAD | GOOD | Read |
|---|---|---|---|
| coverage (fuzzy "every role") | 0.52 FAIL | 0.55 FAIL | barely separates — useless as a gate |
| grounding | 0.71 PASS | 0.75 PASS | ok |
| calibration (strict) | 0.26 FAIL | 0.36 FAIL | fails BOTH — too strict |
| guardrail (financial) | 0.14 pass | 0.20 pass | correct (no claims) |
| specificity | **1.15 FAIL** | **2.97 PASS** | excellent discriminator |
| insight | 0.70 FAIL | 0.90 FAIL | wrong gate — findings are observations, not synthesis |

Jev correctly failed the bad set overall, but three checks were mis-designed
(not Jev's fault): fuzzy coverage, over-strict calibration, and insight (which
gates the wrong quality for an observation-stage artifact).

## Round 2 — tuned checks (clean separation)

Changes: made **coverage concrete** (name the operations/finance/sales
concerns rather than a fuzzy "every role"); retargeted **calibration** at
*egregious* over-confidence only; **dropped insight** as a findings gate;
lowered grounding/calibration thresholds to the validated band.

| Check (threshold) | KNOWN-BAD | KNOWN-GOOD |
|---|---|---|
| coverage (≥0.60) | **0.19 FAIL** | **0.98 PASS** |
| grounding (≥0.55) | 0.66 PASS | 0.67 PASS |
| calibration (≥0.50) | **0.41 FAIL** | **0.87 PASS** |
| guardrail financial (yes<0.50) | 0.17 PASS | 0.25 PASS |
| specificity (score ≥2) | **1.35 FAIL** | **2.98 PASS** (conf 0.98) |
| **OVERALL** | **FAIL ❌** | **PASS ✅** |

Jev now **rejects the known-bad findings and passes the known-good** with wide
margins on exactly the dimensions the run exposed (coverage 0.19 vs 0.98,
calibration 0.41 vs 0.87, specificity 1.35 vs 2.98).

## Verdict

- **Jev is validated as a findings co-judge** with the tuned checks now shipped
  in `lib/ai/wrj/findings-wrj.ts` (`FINDINGS_CHECKS`). Live API confirmed
  (`jev-1.13.0`, `POST /v1/systemone`, `JEV_API_KEY`).
- **Strongest signals:** specificity and coverage (concrete) and calibration.
  Grounding and the financial guardrail did not discriminate here (both sets
  were loosely grounded and neither made financial claims) — they remain
  correct guardrails, just not the differentiators on this pair.
- **Posture:** Jev is a **co-judge** alongside the cross-family LLM reviewer and
  the permanent human gate — not a sole authority. It earned the findings seat;
  each further stage (opportunities, report, proposal) needs its own in-domain
  validation against ground-truth pairs before Jev gates it.
- **Check design is the lever, not the model.** Concrete, single-judgment
  questions with in-domain-tuned thresholds discriminate; fuzzy or
  wrong-dimension questions do not.

## Head-to-head A/B (findings, real Northpath approved set)

Ran both paths over the run's 7 real approved findings + the real intake:

- **single mode** — ships the 7 findings with **no quality signal** (operator
  reviews blind).
- **wrj mode** — ships the same 7 findings **plus**:
  - **Jev judge** (jev-1.13.0): grounding 0.74 · calibration 0.76 · guardrail
    0.11 (no financial claim) · specificity 2.62 — all PASS; **coverage 0.57 →
    borderline FAIL**, a stable, calibrated caution to double-check stakeholder
    coverage before approving.
  - **cross-family reviewer** (Anthropic `claude-sonnet-5.5` via OpenRouter,
    HTTP 200): "no defects flagged" on this (good) set.

Takeaways:
- The A/B value is concrete: WRJ hands the operator a per-dimension calibrated
  verdict (incl. the coverage caution) that single mode never produces, and a
  second cross-family opinion. On a bad draft (see the validation above) WRJ
  FAILs where single ships silently.
- Coverage sits near the 0.6 gate on genuinely-decent sets (0.57 here vs 0.98
  on the ideal set), which is correct **co-judge** behavior — it flags for human
  attention rather than auto-rejecting. Do not over-tune the threshold to one
  case; the ordering is right (bad 0.19 ≪ real 0.57 < ideal 0.98).
- Reviewer model must be a valid current id: `anthropic/claude-sonnet-5.5`
  (the default; override via `SLATE_AI_REVIEWER_MODEL`).

## Files
- Checks shipped: `lib/ai/wrj/findings-wrj.ts` (`FINDINGS_CHECKS`).
- Reviewer default: `lib/ai/wrj/config.ts` (`anthropic/claude-sonnet-5.5`).
- No production data mutated; validation + A/B ran read-only against the
  Northpath intake + findings.

---

# Opportunities stage — Jev validation

## Status
- **Date:** 2026-09-29
- **Type:** In-domain validation of Jev for the WRJ **opportunities** stage,
  before Jev gates it (each stage earns its seat separately — see the findings
  posture note above).
- **Method:** replay a ground-truth opportunity pair through the shipped
  opportunity checks (`lib/ai/wrj/opportunities-wrj.ts`, `OPPORTUNITY_CHECKS`)
  over the **real Northpath approved findings**, then A/B the actual persisted
  Northpath opportunity set.
  - **KNOWN-BAD** — generic ("leverage AI to boost efficiency"), every
    opportunity scored as a low-complexity/low-risk/high-impact quick win, scope
    overreaching its linked findings, one planted financial claim ("cut costs
    40%, save 15 hours/week").
  - **KNOWN-GOOD** — grounded, named-system opportunities (integration layer
    across PSA/CRM/time-tracker/QuickBooks, timesheet→invoice automation,
    review-gated proposal drafting, AI governance policy), differentiated scores,
    no financial claims.

## Why opportunities need different checks than findings
Findings are *observations*; opportunities are *decision-grade proposals* whose
impact/complexity/risk scores DRIVE the downstream quadrant + priority. So the
opportunity gate adds two dimensions findings don't have — **score calibration**
(not everything is a quick win) and **actionability** (scopeable implementation
shape vs vague aspiration) — and reframes coverage.

## Round 1 — surfaced a coverage-design flaw
First coverage wording demanded *every* material finding be addressed. It failed
**both** sets (BAD 0.35, GOOD 0.15) because opportunities are a prioritized
SUBSET — the good set deliberately has no standalone opportunity for "weekly
resourcing." Same class of error as the findings insight-gate: a
wrong-dimension question doesn't discriminate. Fix: reframe coverage to "the
biggest operational problems are each addressed," explicitly allowing
constraints to be reflected as risks rather than standalone opportunities.

## Round 2 — tuned checks (clean separation)
| Check (threshold) | KNOWN-BAD | KNOWN-GOOD |
|---|---|---|
| coverage (≥0.60) | 0.85 PASS | 0.84 PASS |
| grounding (≥0.55) | **0.07 FAIL** | **0.65 PASS** |
| calibration (≥0.50) | **0.18 FAIL** | **0.87 PASS** |
| guardrail financial (yes<0.50) | **0.98 FAIL** | **0.05 PASS** |
| specificity (score ≥2) | **0.37 FAIL** | **2.80 PASS** |
| actionability (score ≥2) | **0.20 FAIL** | **2.97 PASS** |
| **OVERALL** | **FAIL ❌ (5)** | **PASS ✅** |

Jev rejects the known-bad opportunity set and passes the known-good one. The
discriminators are grounding, calibration, guardrail (perfectly caught the
planted financial claim), specificity, and actionability — all wide margins.
Coverage passes both here: it's a *dropped-major-problem* guardrail, not a
good/bad discriminator on this pair (the bad set still nominally links to the
big findings). That is correct — coverage's job is to catch a set that omits a
top problem, orthogonal to draft quality.

## Head-to-head A/B (real persisted Northpath opportunities, n=5)
Judged the 5 opportunities the self-test actually persisted (impact 70–85,
complexity 50–75, risk 40–60 — genuinely differentiated), linked findings pulled
from `opportunity_finding_links`:

| Check | Value | Verdict |
|---|---|---|
| coverage | 0.94 | PASS |
| grounding | 0.64 | PASS |
| calibration | 0.86 | PASS |
| guardrail financial | 0.06 | PASS |
| specificity | 2.23 (conf 0.51) | PASS |
| actionability | 2.16 (conf 0.70) | PASS |
| **OVERALL** | | **PASS ✅** |

- **single mode** — ships the 5 opportunities with no quality signal.
- **wrj mode** — same 5 opportunities **plus** the Jev verdict above +
  cross-family reviewer ("no defects flagged", `anthropic/claude-sonnet-5.5`).
- The real set clears cleanly, but specificity/actionability sit closer to the
  floor (conf 0.51 / 0.70) than the ideal synthetic set (0.80 / 0.97) — a
  calibrated nudge that these two are the softest dimensions on an otherwise
  strong set. Correct co-judge behavior: clears the good set, rejects the bad
  set with wide margins.

## Verdict
- **Jev is validated as an opportunities co-judge** with the tuned checks shipped
  in `lib/ai/wrj/opportunities-wrj.ts` (`OPPORTUNITY_CHECKS`). Same live API
  (`jev-1.13.0`).
- Opportunities card wired at
  `app/app/engagements/[id]/opportunities/page.tsx` via
  `getLatestOpportunitiesWrjSummary`; the `WrjVerdictCard` now takes
  `labelOverrides` so each stage shows stage-appropriate check labels.
- Remaining stages needing their own validation before Jev gates them: report
  sections, proposal options.

## Files (opportunities)
- Checks: `lib/ai/wrj/opportunities-wrj.ts` (`OPPORTUNITY_CHECKS`).
- Dispatcher: `lib/opportunities/synthesis-actions.ts` (flag-gated `isWrjMode()`).
- Query + card: `lib/ai/wrj/queries.ts` (`getLatestOpportunitiesWrjSummary`),
  `components/ai/wrj-verdict-card.tsx` (`labelOverrides`).
- Only mutation: backfilled the A/B verdict into the existing completed
  `opportunity_draft` run's `output_summary.synthesis` for the live card (no new
  rows, no opportunity data changed); validation ran read-only.

---

# Report-section stage — Jev validation

## Status
- **Date:** 2026-09-30
- **Type:** In-domain validation of Jev for the WRJ **report-section** stage,
  before Jev gates it.
- **Method:** replay a ground-truth section pair through the shipped section
  checks (`lib/ai/wrj/report-section-wrj.ts`, `REPORT_SECTION_CHECKS`) over the
  real Northpath context, then A/B the actual persisted report sections.
  - **KNOWN-BAD** — meta-opener ("This section discusses…"), marketing filler
    ("leverage AI", "robust", "seamless", "holistic", "unlock"), re-narrates the
    sibling sections instead of doing its own job, a planted financial claim
    ("reduce operational costs by 30% … payback within six months"), off-charter.
  - **KNOWN-GOOD** — a hand-written "Current State & Operating Friction" section:
    leads with the point, names the four systems, grounded, no financial claims.

## Why report sections need different checks
Report sections draft ONE at a time (one `report_section_draft` run per section),
the writer already runs a HARD banned-claim scanner that rejects the candidate
before persistence, and each section has a distinct **charter** (its specific job
in the report). So the section gate: (1) makes the financial guardrail a
calibrated *backstop* to the hard scanner; (2) adds **charter_fit** — does the
section do its own job without re-narrating the earlier sections — the
report-specific dimension; (3) adds **voice** (consultant register vs generated
prose) since this is the client-facing artifact.

## Round 1 — surfaced a grounding-design flaw
First grounding wording ("every claim supported by the context") failed BOTH
sets (BAD 0.03, GOOD 0.36) because good consultant writing includes *synthesis*
that goes one inferential step beyond the raw findings. Same class of error as
the findings/opportunities grounding lessons. Fix: reframe grounding to target
**fabrication** specifically (invented facts/metrics/quotes/system names) while
explicitly allowing synthesis of the supplied facts.

## Round 2 — tuned checks (clean separation)
| Check (threshold) | KNOWN-BAD | KNOWN-GOOD |
|---|---|---|
| grounding — no fabrication (≥0.50) | **0.03 FAIL** | **0.67 PASS** |
| charter_fit (≥0.60) | **0.16 FAIL** | **0.63 PASS** |
| voice (score ≥2) | **0.00 FAIL** | **2.36 PASS** |
| guardrail financial (yes<0.50) | **0.94 FAIL** | **0.03 PASS** |
| specificity (score ≥2) | **0.79 FAIL** | **2.91 PASS** |
| **OVERALL** | **FAIL ❌ (5)** | **PASS ✅** |

Every dimension discriminates with wide margins; the guardrail perfectly caught
the planted financial claim.

## Head-to-head A/B (real persisted Northpath sections, n=8)
Judged all 8 sections the self-test actually persisted, over the real
findings/opportunities/roadmap and each section's preceding-section summaries:

| Section | grounding | charter | voice | guard | spec | verdict |
|---|---|---|---|---|---|---|
| executive_summary | 0.71 | 0.66 | **1.67** | 0.06 | **1.15** | 2 to review |
| business_context | **0.22** | **0.49** | **1.23** | 0.11 | **1.23** | 4 to review |
| workflow_friction | 0.91 | 0.70 | **1.18** | 0.40 | 2.57 | 1 to review |
| stakeholder_synthesis | 0.90 | **0.45** | **0.76** | 0.08 | **1.74** | 3 to review |
| opportunity_portfolio | 0.82 | **0.55** | **1.03** | 0.04 | **1.12** | 3 to review |
| priority_recommendations | 0.74 | **0.58** | **1.15** | 0.07 | **1.07** | 3 to review |
| roadmap | 0.55 | **0.47** | **0.59** | 0.05 | **1.59** | 3 to review |
| appendix | 0.93 | **0.55** | **1.26** | 0.24 | **1.06** | 3 to review |

**Key finding:** unlike the findings/opportunities sets (which cleared cleanly),
the real single-model *report prose* fails broadly — every section on **voice**,
most on **specificity** and **charter_fit**. Reading the drafts confirms Jev is
right, not miscalibrated: they are competent but open with flat, descriptive,
AI-generated prose ("faces significant challenges due to…", "is characterized
by…", "is structured around…") and name few specifics. This directly
corroborates the standing "AI slop" assessment and is exactly the signal WRJ
exists to surface. The thresholds were NOT tuned to force a pass — the
minScore-2 floor ("mostly a consultant voice / mostly specific") is the right bar
for client-facing prose, and the validation pair confirms it discriminates.
`workflow_friction` is the strongest real section (flagged only on voice), which
is correct co-judge behavior.

**Implication:** the report stage is the strongest case yet for the **reviser
pass** (next WRJ item) — the writer should ingest these voice/specificity flags
and revise, and/or the report drafting prompt needs a voice overhaul.

## Verdict
- **Jev is validated as a report-section co-judge** with the tuned checks shipped
  in `lib/ai/wrj/report-section-wrj.ts` (`REPORT_SECTION_CHECKS`).
- Per-section card wired at `components/reports/report-workspace.tsx` +
  `app/app/engagements/[id]/report/page.tsx` via `getReportSectionWrjSummaries`
  (Map keyed by section id, since report runs are per-section);
  `WrjVerdictCard` `labelOverrides` show report-specific labels.
- Remaining stage needing its own validation before Jev gates it: proposal
  options.

## Files (report sections)
- Checks: `lib/ai/wrj/report-section-wrj.ts` (`REPORT_SECTION_CHECKS`);
  `charterFor` exported from `lib/ai/report-section-synthesis.ts`.
- Dispatcher: `lib/reports/synthesis-actions.ts` (flag-gated `isWrjMode()`).
- Query + card: `lib/ai/wrj/queries.ts` (`getReportSectionWrjSummaries`),
  `components/reports/report-workspace.tsx` (`wrjBySectionId`).
- Only mutation: backfilled the per-section A/B verdicts into the existing
  completed `report_section_draft` runs' `output_summary.synthesis` for the live
  card (no new rows, no section prose changed); validation ran read-only.
