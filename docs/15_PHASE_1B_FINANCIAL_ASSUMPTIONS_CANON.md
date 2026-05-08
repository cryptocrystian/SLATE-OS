# SLATE Phase 1B Financial Assumptions Canon

_This doc is canon. It governs how SLATE expresses financial claims — savings, ROI, payback, business-case confidence — in any chart, exhibit, report, proposal, or PDF artifact. It does not authorize building the **AI-Savings Waterfall** exhibit or the **ROI Bridge** exhibit — each requires its own sprint approval._

---

## Status

- **AI-Savings Waterfall is not built yet.** No exhibit code, no `chart-waterfall-bar` primitive, no preview-route entry.
- **ROI Bridge is not built yet.** No exhibit code, no `chart-projection-line` or `chart-band-area` primitives, no preview-route entry.
- **No financial model exists yet.** No tables, no migrations, no seed assumption files. SLATE has zero approved client-financial assumptions in code or in the database.
- **This doc is canon / scoping only.** It defines tiers, rules, and gates that any future financial work must satisfy. It is not approval to build.
- **No client-facing savings, ROI, payback, or financial-return claims may be made** — in reports, proposals, PDF exports, public-scorecard surfaces, or any artifact a client may see — until the underlying assumption set has reached the appropriate validation tier (defined below).
- **Illustrative preview data is allowed only inside `/app/charts-preview` or other clearly internal preview surfaces**, and only when the source note labels the data illustrative.

---

## Why This Exists

The Phase 1B chart/exhibit canon (`docs/13_PHASE_1B_CHART_EXHIBIT_CANON.md`) lists **AI-Savings Waterfall** and **ROI Bridge** as the next two exhibits after Benchmark Comparison Bars. Unlike the six exhibits that have already shipped — three of which read structurally from operator-entered or persisted SLATE data, and one of which (Benchmark Comparison Bars) is gated by `docs/14_PHASE_1B_BENCHMARK_DATA_CANON.md` — these two depend on **financial assumptions**: numbers that, when shown to a client, materially shape commercial expectations.

A waterfall that says "$X savings · $Y residual cost · $Z realized state" is a commercial claim regardless of whether SLATE wrote it, generated it, or imported it from a model. A line chart that climbs from "Y1 ROI 60%" to "Y3 ROI 240%" is a forecast regardless of whether anyone signed off on the assumptions behind those percentages. Once the visual is in front of a client, those numbers become anchors — and recovering from "the numbers were illustrative" is harder than not letting the wrong numbers ship in the first place.

This canon prevents fake-ROI optics. It defines the four tiers a financial assumption set must pass through before its numbers are eligible for client-facing artifacts, the data-shape contract those assumptions must satisfy, the source-note language each tier must wear, and the claim language each tier may use.

The same discipline as `docs/14` (benchmarks). The risk is the same kind. The damage from an unsupported ROI claim is at least as large as from an unsupported peer-benchmark claim — possibly larger, because the client typically reads ROI as a commitment, not just context.

---

## Definitions

### 1. Illustrative financial data

- **Static, fake, or sampled values** declared inline at the call site (the same pattern Sprints 1–5 used for their preview data).
- **Allowed only** inside `/app/charts-preview` or other clearly internal preview surfaces.
- **Forbidden** in `/app/engagements/[id]/report`, `/app/engagements/[id]/proposal`, `/scorecard/results`, PDF exports, downloadable artifacts, and any surface a client may see.
- Source note must read **exactly** `"Source: Illustrative sample data · not a financial model"`. The implementing sprint composes the full string into the SourceNote `text` field per the existing source-note primitive contract.
- Cannot be referenced in copy as if it represented a real assumption set, a real client baseline, or a real savings calculation.

### 2. Operator-estimated financial assumptions

- **Estimated by Saipien / operator** from discovery inputs (intake responses, document review, scoping conversations, prior-engagement priors).
- May be used for **internal planning / drafting only** — operator-only routes inside `/app/*` where the operator is preparing a draft, not the surface a client will see.
- **Must include** the operator's confidence label and the assumption owner. Cannot be represented as client-approved.
- Visible label or chrome must read "Operator-estimated" (or equivalent canon-compliant phrasing) so the audience reads the numbers as Saipien-internal estimates, not as a model the client has signed off on.
- Forbidden in client-facing outputs.

### 3. Client-validated financial assumptions

- **Reviewed and accepted by a client stakeholder** — typically a Saipien primary contact or operations / finance peer who confirms the assumption ranges fit their environment.
- May be used in **draft report and proposal surfaces** with caveats — the source note still flags the validation tier, and the visual must preserve the confidence/range labels.
- Still **not** automatically eligible for firm ROI / payback claims. "Client-validated" means the client has agreed the inputs are reasonable; it does not mean the client's finance organization has approved the financial output for commercial commitment.

### 4. Finance-approved financial model

- **Approved by an authorized client finance / commercial owner** — typically the client CFO, controller, FP&A lead, or equivalent designate. The signoff is recorded with timestamp + signer name + scope.
- The only tier eligible for **firm ROI / payback language in final client-facing PDFs and proposals**.
- Required before any "expected savings of $X" or "payback in N months" claim can ship in a final artifact.
- The transition from `client_validated` to `finance_approved` is **explicit**, not implicit. A client-validated set does not become finance-approved by getting older or by being shown to more people; it requires the explicit finance-side signoff.

---

## Required Financial Inputs

The future AI-Savings Waterfall and ROI Bridge exhibits cannot be real until the following inputs are defined per assumption set. Each input below specifies its meaning, its unit, its allowed range, its likely source, and the caveats that apply.

| Input | What it means | Unit / range | Likely source | Caveats |
| --- | --- | --- | --- | --- |
| `currentBaselineCost` | Annual run-rate cost (USD) of the current process being augmented or replaced. | USD; ≥ 0; finite. | Discovery interviews; client finance handoff; prior-engagement priors. | Must be apples-to-apples with the future state — allocation choices (loaded vs unloaded labor, vendor cost inclusion, capitalized vs operating) must match between baseline and post-state. |
| `currentBaselineHours` | Annual hours expended by people on the current process (approximate, scoped). | Hours; ≥ 0; finite. | Stakeholder intake responses; activity sampling. | "An hour" definition matters — a manager's hour is not a clerk's hour. Do not multiply by an average rate without disclosing the rate. |
| `hourlyCostAssumption` | Fully-loaded hourly cost (USD/hour) used to translate hours into dollars. Includes salary, benefits, overhead, taxes. | USD per hour; > 0; typical knowledge-work range $40–$300. | Client finance handoff; industry-standard fully-loaded rate; client HR. | Variance by role/region/seniority is large. Never extrapolate from public salary data. The rate must be approved by the client before becoming `client_validated`. |
| `implementationCost` | One-time cost (USD) of building, integrating, and rolling out the AI capability. Includes build, training, integration, change management. | USD; ≥ 0. | Saipien scoping estimate. | Often broken out by category for client review. Must include implementation risk buffer. |
| `recurringCost` (typed `recurringCostMonthly`) | Ongoing monthly cost (USD/month) — SaaS subscriptions, hosting, AI inference, support, monitoring. | USD per month; ≥ 0. | SaaS pricing; client cloud accounting; estimated AI inference. | AI inference costs are volatile with usage. Must include a usage-growth scenario, not just a flat per-month estimate. |
| `expectedAutomationRate` | Fraction of the baseline work the AI is expected to remove or compress. | 0–1 (e.g., `0.35` = 35%). | Saipien scoping; comparable-engagement priors. | Optimistic ranges are easy to write and frequently miss. Show ranges, not single points. |
| `expectedAdoptionRate` | Fraction of intended users who actually use the AI capability in steady state. | 0–1. | Change-readiness assessment; stakeholder coverage signal; comparable-engagement priors. | The single largest lever in most ROI calculations. Small-organization changes can underdeliver vs large enterprise rollouts; document the lineage. |
| `riskAdjustmentFactor` | Multiplier applied to expected savings to reflect implementation, adoption, governance, and integration risk. Lower = more conservative. | 0–1; typical 0.5–0.9. | Saipien scoping judgement. | Essentially a "haircut" on optimistic savings. Clients may want this broken out and explained — never bury it inside the savings number. |
| `timeToValueDays` | Days from project go-decision until measurable savings begin. | Days; ≥ 0. | 30/60/90 roadmap. | Distinct from "go-live" — true value start often lags go-live by weeks of warm-up. |
| `confidenceLevel` (typed `confidence`) | Operator-self-reported confidence in this assumption set as a whole. | `low \| medium \| high` enum. | Operator judgement at validation time. | Confidence is a meta-label, not methodology. "High confidence" without documented assumption lineage is empty — the doc must read on its own. |
| `assumptionOwner` | Name (or role) of the person accountable for this assumption set. | Free-text string. | Operator at validation time. | Required for `client_validated` and `finance_approved`; required so that re-validation has a known starting point. |
| `validationStatus` (typed `status`) | The validation tier (`illustrative \| operator_estimated \| client_validated \| finance_approved`). | Enum. | Validation workflow. | Tier is a one-way ratchet for the assumption set's eligibility; promotion to `finance_approved` requires explicit signoff, not just data accumulation. |
| `lastReviewedAt` | ISO-8601 timestamp (or `YYYY-MM-DD`) of the most recent validation event. | ISO-8601 date or full timestamp. | Validation workflow. | Stale assumptions revert tier eligibility — there is no auto-promotion through aging. The implementing sprint should surface a `stale: true` chip when `lastReviewedAt` is older than the configured staleness threshold. |

---

## Financial Data Shape

The future financial exhibits consume narrow input shapes (matching the SLATE chart-vocabulary pattern: exhibits know nothing about persisted shapes). The TS shapes below are the contract; the implementing sprint validates against them before any waterfall bar or ROI line renders.

```ts
type FinancialAssumptionStatus =
  | "illustrative"
  | "operator_estimated"
  | "client_validated"
  | "finance_approved";

type FinancialConfidence = "low" | "medium" | "high";

interface FinancialAssumptionSet {
  id: string;
  label: string;                       // human-facing display label
  status: FinancialAssumptionStatus;
  confidence: FinancialConfidence;
  currency: "USD";                     // fixed for now; multi-currency is a later canon
  currentBaselineCost: number;         // USD/year
  currentBaselineHours: number;        // hours/year
  hourlyCostAssumption: number;        // USD/hour, fully-loaded
  implementationCost: number;          // USD, one-time
  recurringCostMonthly: number;        // USD/month
  expectedAutomationRate: number;      // 0–1
  expectedAdoptionRate: number;        // 0–1
  riskAdjustmentFactor: number;        // 0–1
  timeToValueDays: number;             // ≥ 0
  assumptionOwner: string;             // required when status > illustrative
  lastReviewedAt: string;              // ISO-8601 date or timestamp
  notes?: string;
}

interface SavingsWaterfallContribution {
  label: string;
  deltaValue: number;                  // signed; positive = savings, negative = cost
  sign: "savings" | "cost" | "residual";
  confidence: FinancialConfidence;
  sourceAssumption: string;            // id reference to the FinancialAssumptionSet
}

interface RoiBridgePoint {
  period: "Y1" | "Y2" | "Y3";
  expectedValue: number;
  lowEstimate: number;
  highEstimate: number;
  confidence: FinancialConfidence;
}
```

### Validation rules

The implementing sprint MUST enforce all of the following before any chart renders:

1. **Money values must be finite.** `Number.isFinite(value) === true` for `currentBaselineCost`, `hourlyCostAssumption`, `implementationCost`, `recurringCostMonthly`, `expectedValue`, `lowEstimate`, `highEstimate`, and `deltaValue`. Reject the row otherwise — never silently coerce.
2. **Cost-track values must be non-negative**, with one exception: `SavingsWaterfallContribution.deltaValue` may be negative when `sign === "cost"`. In that case the implementing sprint sorts the sign separately from the magnitude. Other money fields are clamped to `≥ 0`.
3. **Rates clamped to `[0, 1]`** for `expectedAutomationRate`, `expectedAdoptionRate`, `riskAdjustmentFactor`. Out-of-range values are rejected, not silently clamped, because a 1.2 adoption rate is a programmer error, not data noise.
4. **`lowEstimate ≤ expectedValue ≤ highEstimate`** must hold for every `RoiBridgePoint`. Out-of-order ranges are rejected — never silently sorted.
5. **`implementationCost` and `recurringCostMonthly` cannot be omitted for ROI Bridge.** Both must be present and finite or the exhibit refuses to render the bridge for that assumption set.
6. **`currentBaselineCost` OR (`currentBaselineHours` AND `hourlyCostAssumption`)** must be present for AI-Savings Waterfall. The exhibit rejects the assumption set otherwise — there is no "savings" math without a baseline.
7. **`status` is required.** The exhibit refuses to render an assumption set with an undefined or unknown status — that prevents a Sprint-N implementation from accidentally falling through to `illustrative` chrome on an `operator_estimated` dataset.
8. **`confidence` is required.** Same reasoning.
9. **`currency` is fixed to `"USD"`** in this canon. A multi-currency canon is a later workstream.
10. **`illustrative` data MUST omit client / source approval metadata** in the rendered chrome — even if `assumptionOwner` and `lastReviewedAt` are present in the data, the exhibit renders neither for `status === "illustrative"`. The source note must say `"not a financial model"` and nothing more about ownership or freshness.
11. **`finance_approved` status requires `assumptionOwner` and `lastReviewedAt` to be present and non-empty.** The exhibit refuses to render `finance_approved` chrome without both fields.
12. **`status` is a one-way ratchet for eligibility, not for data.** The implementing sprint must not auto-promote a `client_validated` set to `finance_approved` based on data alone — promotion requires the explicit workflow signoff that this canon does not yet define.

---

## Source Note Rules

Every AI-Savings Waterfall and ROI Bridge instance — preview, draft, or final — MUST carry a source note with the language below. The strings are deliberate: each one tells the audience what tier of assumption stands behind the number and what may be inferred from it.

### Illustrative preview

```
Source: Illustrative sample data · not a financial model
```

- No confidence label. No vintage. No assumption owner. No `n=…`.
- Allowed only inside `/app/charts-preview` and other clearly internal preview surfaces.

### Operator-estimated

```
Source: Operator-estimated assumptions · internal draft · confidence <confidence>
```

- `<confidence>` ∈ `low | medium | high` from the assumption set's `confidence` field.
- Allowed only on operator-internal surfaces inside `/app/*`. **Never** inside a client-facing report, proposal, or PDF.

### Client-validated

```
Source: Client-validated assumptions · confidence <confidence> · reviewed <date>
```

- `<date>` matches the assumption set's `lastReviewedAt` (ISO date or timestamp).
- Allowed inside draft report / proposal surfaces, with the caveat that final ROI / payback claims still require `finance_approved`.

### Finance-approved

```
Source: Finance-approved model · confidence <confidence> · reviewed <date>
```

- The only tier permitted inside final client-facing PDFs, proposals, and report exports.
- Implies the client's authorized finance / commercial owner has signed off on the assumption set within the configured staleness window.

### Format note for implementers

The existing `ChartSourceNote` primitive composes the rendered string as `${text}${n ? " · n=" + n : ""}`. Achieving the canon's exact source-note format (with the `Source:` prefix and the `· confidence …` / `· reviewed …` segments in the order shown) requires the implementing sprint to compose the full string into the SourceNote `text` field and leave the structured `n` field unset. The primitive contract is unchanged; only the call-site composition shifts.

---

## Claim Rules

### Prohibited language (anywhere in client-facing output unless `finance_approved`)

The following phrases are forbidden unless the assumption set has reached `finance_approved` status AND the claim is substantively supported by the approved model:

- "guaranteed savings"
- "guaranteed ROI"
- "payback in X months"
- "will save $X"
- "will reduce cost by X%"
- "profit increase"
- "cash-flow positive by"
- "board-ready ROI"
- any language implying client finance organization has approved the result when the source set is below `finance_approved`
- definitive future-tense claims ("we will save…", "this delivers…") on `client_validated` or lower data
- any percentage / dollar claim attributed to "the client's model" when the model is operator-estimated

### Allowed language by tier

| Tier | Headline language | Body language |
| --- | --- | --- |
| `illustrative` | "Illustrative financial structure" | "for visual layout review only" · "not a financial model" · "no claim attached" |
| `operator_estimated` | "Operator-estimated savings scenario" | "Saipien-internal planning estimate" · "subject to client validation" · "ranges, not point estimates" |
| `client_validated` | "Client-validated planning scenario" | "planning estimate validated with stakeholder X" · "subject to finance approval before commitment" · "modeled scenario, not a guarantee" |
| `finance_approved` | "Finance-approved business case" | "approved by client finance owner X on date Y" · "modeled within a [low / expected / high] range" · "subject to reasonable adoption + implementation assumptions" |

The implementing sprint should prefer the most conservative language that still communicates the structure. When in doubt, drop a tier.

### Safer wording (always allowed when tier-appropriate)

- "potential savings"
- "modeled scenario"
- "planning estimate"
- "range-bound estimate"
- "subject to adoption and implementation assumptions"
- "based on operator-supplied baseline"

These phrases describe the visual / model honestly without overclaiming. They can appear in any tier including illustrative, as long as the source note already disambiguates which tier applies.

---

## AI-Savings Waterfall Rules

### Purpose

Show how the current cost / effort baseline breaks into AI-impacted savings, residual cost, implementation cost, recurring cost, and the realized state. Classic consulting savings-narrative exhibit, but credibility-sensitive.

### Allowed at Gate 0 (today's state)

- `/app/charts-preview` only.
- Illustrative data only (`status === "illustrative"`).
- Source note must read `"Source: Illustrative sample data · not a financial model"` exactly.
- The exhibit must not display a final net-savings number as a guarantee — even with illustrative data, the visual treatment must not look like a definitive savings claim.

### Required before client-facing use

- **Draft client review:** at least `client_validated` assumptions. Source note must say `client_validated`. Final ROI / payback wording is still forbidden.
- **Final ROI / payback claim in PDF / proposal:** `finance_approved` assumptions. Source note must say `finance_approved`. Claim language follows the allowed-by-tier table above.

### Implementation guidance for the future sprint

When AI-Savings Waterfall sprint is approved:

1. Build the exhibit using illustrative data only inside `/app/charts-preview`. Wiring into reports/proposals is a later, separate approval.
2. Include a confidence / range visual where possible — render contributions as ranges, not single deterministic bars, when the data supports it.
3. The total / final-state bar must visually disclaim certainty when status is below `finance_approved`. Suggested treatment: dashed outline + "modeled" caption.
4. The implementation cost and recurring cost must appear as clearly-labeled negative bars, never absorbed silently into the net-savings number.
5. The risk adjustment factor must appear as a visible bar (or visible caveat) — never hidden inside the optimistic savings.
6. Per-bar `<svg><title>` text must read neutrally — never "guaranteed savings", "payback", or implied-certainty language.

---

## ROI Bridge Rules

### Purpose

Show the projected ROI bridge across years (Y1 → Y2 → Y3) with low / expected / high sensitivity bands. Goes in the proposal commercial section once the underlying assumption set is at the right tier.

### Allowed at Gate 0 (today's state)

- `/app/charts-preview` only.
- Illustrative data only.
- Source note must read `"Source: Illustrative sample data · not a financial model"` exactly.
- The exhibit must NOT show a single deterministic line without sensitivity bands. Even in illustrative form, the visual must teach the audience that ROI is range-bound.

### Required before client-facing use

- **Draft proposal scenario:** `client_validated` assumptions, with caveats. The source note labels the tier; the visual emphasizes the range, not the expected value alone.
- **Final ROI / payback claim:** `finance_approved` assumptions. Only at this tier may the implementing sprint allow firm ROI percentages or stated payback months in body copy.

### Implementation guidance for the future sprint

When ROI Bridge sprint is approved:

1. Build with illustrative data first; use sensitivity bands not a single deterministic line.
2. Label values as "modeled estimates" unless `finance_approved`.
3. No payback claim, no break-even date, no "cash-flow positive in N months" copy unless `finance_approved`.
4. The visual band must extend honestly between `lowEstimate` and `highEstimate`. If the band collapses to a single point, the data is wrong (low ≤ expected ≤ high is required) — render a validation error, not a clean line.
5. No implied certainty in the chart chrome — no axis titles like "Guaranteed ROI" or "Confirmed payback."

---

## Data Readiness Gates

| Gate | Tier | Allowed surfaces | Source-note string | Required artifacts |
| --- | --- | --- | --- | --- |
| **Gate 0** — no model | `illustrative` | `/app/charts-preview` only. **No client-facing surfaces.** | "Source: Illustrative sample data · not a financial model" | None — illustrative inline data |
| **Gate 1** — operator-estimated | `operator_estimated` | Operator-only surfaces inside `/app/*`. **No client-facing surfaces.** | "Source: Operator-estimated assumptions · internal draft · confidence …" | `assumptionOwner` + `confidence` |
| **Gate 2** — client-validated | `client_validated` | Draft report / proposal surfaces with caveats. **No final ROI / payback claim.** | "Source: Client-validated assumptions · confidence … · reviewed …" | `assumptionOwner` + `confidence` + `lastReviewedAt` |
| **Gate 3** — finance-approved | `finance_approved` | Final client-facing reports, proposals, PDF exports. Firm ROI / payback wording allowed within approved assumptions. | "Source: Finance-approved model · confidence … · reviewed …" | All Gate 2 artifacts plus a documented client finance-side signoff event |

Each gate is a one-way ratchet: a set that has reached Gate 3 cannot regress to Gate 2 by accumulating staler reviews; it must be re-validated and re-approved. Conversely, a Gate 2 set cannot be silently promoted to Gate 3 just because more time passed.

---

## Exhibit Implementation Rules

When the **AI-Savings Waterfall** or **ROI Bridge** sprint is approved, the implementing work MUST:

1. **Build the component using illustrative data only inside `/app/charts-preview`.** A clearly-labeled preview is the only surface that ships in the first sprint for either exhibit.
2. **NOT wire the exhibit into `/app/engagements/[id]/report`, `/app/engagements/[id]/proposal`, or any client-facing surface** as part of the first sprint. Wiring into reports / proposals requires separate approval AND the underlying assumption set to be at the appropriate gate.
3. **NOT add database migrations, schema, tables, or seed data** in the first sprint. Persisting financial assumptions is a separate workstream, scoped after the implementing exhibit is visually accepted.
4. **Render a visible source note** that uses one of the four canonical strings. Default to the `illustrative` source note when status is undefined or unknown; never default to a higher tier.
5. **Use the future `chart-waterfall-bar`, `chart-projection-line`, and `chart-band-area` primitives.** Same architectural rule as every other Phase 1B exhibit: only chart primitives may import `@visx/*`; exhibits compose primitives.
6. **NOT use sample financial values in docs as if real.** README examples must be marked illustrative.
7. **NOT introduce AI-generated financial claims.** Future AI-synthesis sprints (Steps 3+) cannot draft savings or ROI numbers without explicit human approval and tier compliance — this canon supersedes any AI-generation feature work.
8. **Visually distinguish range from expected value.** Single-line ROI projections without sensitivity bands are forbidden by Gate 0+ regardless of tier.
9. **Visually disclaim certainty below `finance_approved`.** Dashed outlines, "modeled" captions, or equivalent affordances on the final-state bar / final-period point are required when status is not `finance_approved`.

---

## Non-Goals

This canon does not authorize, scope, or define any of the following. Each is governed by its own (later) sprint approval:

- Building the **AI-Savings Waterfall** exhibit.
- Building the **ROI Bridge** exhibit.
- Building the `chart-waterfall-bar`, `chart-projection-line`, or `chart-band-area` primitives.
- Creating financial-model tables in the database.
- Adding database migrations.
- Adding seed financial data files.
- Wiring the future exhibits into reports or proposals.
- Adding PDF / DOCX export.
- Building a finance-approval workflow (signoff capture, approver list, expiration policy).
- E-signature / commercial approval integration.
- AI-generated financial claims (any AI synthesis that produces savings or ROI numbers is itself out of scope and gated by this canon).
- Pricing calculator or quote builder.
- Invoicing or billing integration.
- Multi-currency support (this canon fixes `currency: "USD"` for now).
- Deciding the input list above is the *final* list — these are starting points subject to refinement when the model is actually scoped.

---

## Acceptance Criteria

This canon is accepted when it:

- Prevents fake ROI / savings optics from accidentally landing in client-facing artifacts.
- Defines the four financial-assumption tiers — `illustrative`, `operator_estimated`, `client_validated`, `finance_approved` — with crisp boundaries.
- Defines exact source-note strings for each tier.
- Defines the future TS data shapes (`FinancialAssumptionSet`, `SavingsWaterfallContribution`, `RoiBridgePoint`) and the validation rules they must satisfy.
- Defines the claim restrictions: which phrases are forbidden, which are allowed at each tier, and which safer phrases work across tiers.
- Defines the four readiness gates and which surfaces each gate unlocks.
- Sets implementation rules that the future AI-Savings Waterfall and ROI Bridge sprints must satisfy.
- Makes clear that **AI-Savings Waterfall and ROI Bridge are not built and remain unbuilt until separate sprint approvals**.

---

## Pointer-Forward

When the **AI-Savings Waterfall** or **ROI Bridge** sprints are later approved, the implementing agent should treat this canon as the source of truth for: data shapes, validation rules, source-note language, claim rules, surface eligibility, and gate semantics. Deviations from this canon must be raised as a canon amendment, not absorbed into a code change. Silent drift from this doc is the failure mode this canon exists to prevent.

— end of Phase 1B financial assumptions canon —
