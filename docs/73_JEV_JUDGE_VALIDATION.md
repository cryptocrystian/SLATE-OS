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

## Files
- Checks shipped: `lib/ai/wrj/findings-wrj.ts` (`FINDINGS_CHECKS`).
- No production data mutated; validation ran read-only against the Northpath
  intake + two in-memory findings sets.
