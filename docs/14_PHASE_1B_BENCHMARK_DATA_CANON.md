# SLATE Phase 1B Benchmark Data Canon

_This doc is canon. It governs how SLATE expresses peer / benchmark comparisons in any chart, exhibit, report, or proposal artifact. It does not authorize building the **Benchmark Comparison Bars** exhibit — that requires its own sprint approval._

---

## Status

- **Benchmark Comparison Bars are not built yet.** No exhibit code, no `ChartPercentileBand` primitive, no preview-route entry.
- **No benchmark dataset exists yet.** Neither external nor SLATE-internal data has been assembled, validated, or stored. There are no migrations, no tables, no seed files.
- **This doc is canon / scoping only.** It defines categories, rules, and gates that any future benchmark work must satisfy. It is not approval to build.
- **No benchmark claims may be made in client-facing outputs** — reports, proposals, PDF exports, public scorecard surfaces — until a **validated** benchmark dataset (defined below) exists.
- **Illustrative preview data is allowed only inside `/app/charts-preview` or other clearly internal preview surfaces**, and only when the source note labels it illustrative.

---

## Why This Exists

The Phase 1B chart/exhibit canon (`docs/13_PHASE_1B_CHART_EXHIBIT_CANON.md`) lists **Benchmark Comparison Bars** as the next exhibit after the Roadmap Gantt. Unlike the four exhibits that have already shipped — all of which read structurally from data the operator has already entered or that derives deterministically from persisted SLATE rows — this exhibit depends on **external or accumulated benchmark data that does not yet exist**.

Benchmark comparisons make a credibility claim by their nature. When a client sees their score plotted against `p25 / p50 / p75` bands, they read it as "you are above / below your peers." If that comparison is fabricated, illustrative, or derived from an undocumented sample, SLATE undermines trust precisely on the surface where the deliverable's analytical authority is supposed to come from.

This doc exists to prevent fake-benchmark optics: to define what counts as illustrative, what counts as directional, what counts as validated, and what language can appear under each. The data-quality gate must be passed before any benchmark visual goes onto a client-facing artifact.

---

## Definitions

### 1. Illustrative benchmark data

- **Static, fake, or sampled values** declared inline at the call site (the same pattern Sprints 1–4 used for their preview data).
- **Allowed only** inside `/app/charts-preview` or other clearly internal preview surfaces.
- **Forbidden** in `/app/engagements/[id]/report`, `/app/engagements/[id]/proposal`, `/scorecard/results`, PDF exports, downloadable artifacts, and any surface a client may see.
- Source note must read **exactly** `"Illustrative sample data · not a benchmark"` (no `n=…`, no vintage). The primitive's `n` field must be omitted to avoid implying a real sample size.
- Cannot be referenced in copy as if it represented a peer population.

### 2. Internal directional benchmark data

- Aggregated from SLATE engagements, Saipien Labs–led assessments, or persisted SLATE rows where the population is internal-only.
- May be used for **internal / operator decision support only** — for example, on operator-only routes inside `/app/*`.
- **Must include** sample size and vintage in the rendered source note. Sample size below a threshold (TBD when the dataset is scoped) renders as a warning chip rather than as a benchmark.
- Cannot be called an "industry benchmark" or imply external population sourcing. The label must read "internal" or "directional" or "Saipien-internal" so the audience understands the population shape.
- Forbidden in client-facing outputs.

### 3. Validated benchmark dataset

- **Documented methodology** — the population, the measurement instrument, and the score normalization are written down somewhere SLATE can point to.
- **Defined population** — who is in the sample (industry, size, region, time window) is explicit and matches what the client would consider a peer.
- **Sufficient sample size** — the minimum required `n` per dimension is set when the dataset is scoped; comparisons cannot ship below it.
- **Stable dimension definitions** — the dimensions in the dataset map 1:1 to the dimensions the exhibit plots; renaming or redefining a dimension invalidates the dataset until the new definition is documented.
- **Vintage / date stated** — every comparison carries its dataset's vintage.
- **Approved for client-facing outputs** — only after the criteria above are satisfied AND the dataset has been reviewed by Saipien Labs leadership.

The transition from internal directional to validated is **explicit**, not implicit. A directional dataset does not become "validated" by accumulating more rows; it requires the documented methodology + population + threshold + sign-off.

---

## Required Benchmark Dimensions

The future Benchmark Comparison Bars exhibit should support these six dimensions. Each grounds in SLATE's existing advisory context (public scorecard, stakeholder intake, findings, opportunities, roadmap). External-dataset sourcing is **not** assumed.

### AI readiness

- **What it measures.** The organization's posture toward AI: tooling in use, hands-on experimentation, governance/policy, leadership intent, prior pilots.
- **Score range.** 0–100. Higher = stronger.
- **Likely source signals.** Public scorecard answers (the existing `prospect_ai_readiness` derivation), stakeholder intake responses about AI tooling / usage / governance, findings tagged `adoption_risk` or `governance_risk`.
- **Caveats.** Industry-dependent floor: regulated industries trail commercial software firms by definition. Benchmark must define population precisely or the dimension reads as a vague "vibes" score.

### Workflow friction

- **What it measures.** The amount of operational friction in current workflows — handoffs, manual reconciliation, swivel-chair work, rework loops.
- **Score range.** 0–100. **Higher = more friction**, which is **leverage**, not "bad." A high-friction org is a high-opportunity org. Benchmark visuals must communicate this asymmetry; the canon prohibits chart treatments that imply low friction is "good."
- **Likely source signals.** Public scorecard `prospect_workflow_friction`, stakeholder intake responses about handoffs / rework / reporting cadence, findings tagged `workflow_friction` or `back_office_efficiency`.
- **Caveats.** The "high friction is a leverage opportunity" frame is non-obvious and must be carried in copy; the visual alone risks reading inverted.

### Systems readiness

- **What it measures.** Maturity of the system stack — integration density, source-of-truth clarity, API/data accessibility, system age, vendor concentration.
- **Score range.** 0–100. Higher = stronger.
- **Likely source signals.** Public scorecard `prospect_systems_readiness`, input asset metadata (the supporting documents the operator already collected), stakeholder intake responses about systems / integrations, findings tagged `systems_gap`.
- **Caveats.** Systems landscape varies dramatically by industry and by company size; cross-industry comparisons require the population definition to be tight or the band reads as noise.

### Data readiness

- **What it measures.** Accessibility and hygiene of the data the AI work would consume — coverage, lineage, definitional clarity, refresh cadence, ownership, governance overlap.
- **Score range.** 0–100. Higher = stronger.
- **Likely source signals.** Stakeholder intake responses about data sources / quality, input asset metadata (data dictionaries, schemas, sample exports), findings tagged `data_readiness`.
- **Caveats.** Data maturity is heavily gated by industry context (SaaS vs services vs regulated finance). Comparisons across industries are misleading without population segmentation.

### Governance maturity

- **What it measures.** Policy, controls, risk posture, role clarity, audit trail, change management — the organizational scaffolding required to run AI safely.
- **Score range.** 0–100. Higher = stronger.
- **Likely source signals.** Stakeholder intake responses about controls / approvals / change management, findings tagged `governance_risk`, scorecard signals around oversight.
- **Caveats.** Regulated industries (finance, healthcare, public sector) operate at a higher baseline by definition; an unregulated SaaS firm scoring 35 on governance may be entirely fine for its risk profile. The benchmark must acknowledge industry context or the visual reads as a moral judgment.

### Adoption capacity

- **What it measures.** The organization's ability to absorb change at the pace the proposed roadmap demands — sponsorship strength, mid-management bench, operational slack, prior change-program track record.
- **Score range.** 0–100. Higher = stronger.
- **Likely source signals.** Stakeholder intake responses about change-readiness, the Stakeholder Coverage Matrix's overall coverage strength (a proxy for engagement depth), opportunity scores' `adoption_likelihood_score`, findings tagged `adoption_risk`.
- **Caveats.** Small samples are extremely unreliable for adoption capacity — it depends on individuals more than the other dimensions. Dataset must define minimum-sample thresholds before publishing.

---

## Benchmark Data Shape

The future chart consumes a narrow input shape (matching the SLATE chart-vocabulary pattern: exhibits know nothing about persisted shapes). The TS shapes below are the contract; the implementing sprint will validate against them before ever rendering a bar.

```ts
type BenchmarkDatasetStatus =
  | "illustrative"
  | "internal_directional"
  | "validated";

interface BenchmarkComparisonPoint {
  dimension: string;        // matches the six dimensions above; free-text but
                            // the exhibit may reject unknown dimensions
  clientScore: number;      // 0–100; the SLATE engagement's score on this dimension
  p25: number;              // 0–100
  p50: number;              // 0–100
  p75: number;              // 0–100
  sampleSize: number;       // n behind p25/p50/p75 for THIS dimension
  vintage: string;          // ISO date ("2026-01-15") or year-quarter ("2026-Q1")
  benchmarkLabel: string;   // human-facing label, e.g. "Mid-market SaaS, 2025–2026"
}

interface BenchmarkComparisonDataset {
  label: string;            // dataset display name
  methodology: string;      // human-readable methodology summary; required when
                            // status is "validated", optional otherwise
  vintage: string;          // overall dataset vintage (the latest of the points)
  sampleSize: number;       // overall n (max of point-level sampleSize values)
  points: BenchmarkComparisonPoint[];
  status: BenchmarkDatasetStatus;
}
```

### Validation rules

The implementing sprint MUST enforce all of the following before any bar renders:

1. Every score (`clientScore`, `p25`, `p50`, `p75`) must be a finite number; clamp to `[0, 100]` if outside the range — never "stretch" the axis to fit an outlier.
2. **`p25 <= p50 <= p75`** must hold for every point. Out-of-order percentiles are a programmer error and MUST be rejected with a typed validation failure rather than silently sorted.
3. `clientScore` is allowed to fall outside `[p25, p75]` — that is the entire point of the comparison. Render bands that extend to `[0, 100]` so the client position is never visually clipped.
4. **`sampleSize >= 1`** required for `internal_directional` and `validated`. Required at the point level AND the dataset level.
5. **`vintage`** required for `internal_directional` and `validated`. Format must be either ISO 8601 date (`YYYY-MM-DD`) or year-quarter (`YYYY-Q1` … `YYYY-Q4`). Free-text vintage strings are rejected.
6. **`methodology`** required for `validated`. Must be a non-empty string with at least one full sentence — a one-word "documented" placeholder is not validation.
7. `dimension` strings should match the six approved dimensions above; unknown dimensions render in a separate "Other" group (or are rejected, depending on the implementing sprint's preference) — but never silently treated as one of the canonical six.
8. `illustrative` datasets MUST omit `n` from the rendered source note even when `sampleSize` is present in the data, so the visual cannot accidentally imply a real sample.

---

## Source Note Rules

Every Benchmark Comparison Bars instance — whether on the preview route, an operator-internal report draft, or a client-facing artifact — MUST carry a source note with the language below, exactly. The strings are deliberate: each one tells a viewer what they are looking at and what they may infer from it.

### Illustrative preview

```
Source: Illustrative sample data · not a benchmark
```

- No `n=…`. No vintage. No methodology.
- Allowed only inside `/app/charts-preview` and other clearly internal preview surfaces.

### Internal directional

```
Source: Internal SLATE assessments · directional benchmark · n=<sampleSize> · vintage <vintage>
```

- `<sampleSize>` is the dataset's overall `n` (or per-point if the exhibit shows one dimension at a time).
- `<vintage>` matches the validated `YYYY-MM-DD` or `YYYY-Q1` format.
- Allowed only on operator-internal surfaces inside `/app/*`. Never inside a client-facing report, proposal, or PDF.

### Validated

```
Source: Saipien Labs benchmark dataset · n=<sampleSize> · vintage <vintage>
```

- Implies the dataset has passed the validated gate (defined methodology, defined population, sufficient `n`, leadership sign-off).
- The only source-note category permitted inside client-facing reports, proposals, PDF exports, and public-scorecard result surfaces.

### Format note for implementers

The existing `ChartSourceNote` primitive composes the rendered string as `${text}${n ? " · n=" + n : ""}`. Achieving the canon's exact `n=` placement (which sits **before** `· vintage …` in the prescribed strings) likely requires the implementing sprint to compose the full string into the `text` field and leave the structured `n` field unset. The primitive contract is unchanged; only the call-site composition shifts.

---

## Client-Facing Claim Rules

### Prohibited language (anywhere in client-facing output)

The following phrases are forbidden unless the dataset has reached the **validated** gate AND the population definition supports the claim:

- "industry benchmark"
- "peer benchmark" (unless the peer population is explicitly defined in the source note or surrounding copy)
- "above average" / "below average" (requires `p50` plus documented methodology)
- specific percentile claims like "in the top quartile" / "in the bottom decile" (require the corresponding percentile band to be in the dataset and the methodology to support the cut)
- any language implying SLATE sourced the dataset externally when in fact it is `internal_directional`
- any implication of **statistical significance**, **confidence interval**, or **p-value** unless the methodology document defines them

### Allowed language by tier

| Tier | Language |
| --- | --- |
| `illustrative` | "Illustrative comparison structure" · "For visual layout review only" · "Not a benchmark" |
| `internal_directional` | "Directional internal comparison" · "Saipien-internal directional benchmark" · "Internal directional reference, n=…" |
| `validated` | "Validated benchmark comparison" · "Client score vs Saipien Labs benchmark dataset" · "Validated peer-population comparison" |

The implementing sprint should prefer the most conservative language that still communicates the comparison. When in doubt, drop a tier.

---

## Exhibit Implementation Rules

When the Benchmark Comparison Bars sprint is approved, the implementing work MUST:

1. **Build the component using illustrative data only inside `/app/charts-preview`.** A clearly-labeled preview is the only surface that ships in that sprint.
2. **NOT wire the exhibit into `/app/engagements/[id]/report`, `/app/engagements/[id]/proposal`, or any client-facing surface** as part of that sprint. That is its own subsequent approval, gated on the dataset reaching the appropriate tier.
3. **NOT add database migrations, schema, tables, or seed data** as part of that sprint. Persisting benchmark data is a separate workstream, scoped after the validated dataset exists.
4. **Render a visible source note** that uses one of the three canonical strings above. The exhibit must default to the `illustrative` source note unless explicitly overridden.
5. **Use the future `ChartPercentileBand` primitive.** Same architectural rule as every other Phase 1B exhibit: only chart primitives may import `@visx/*`; exhibits compose primitives.
6. **NOT use sample values in docs as if real.** README examples must be clearly marked illustrative (e.g., a comment line `// illustrative — not real benchmark data`).
7. **Visually distinguish client score from `p25 / p50 / p75` bands.** The client score is the figure of interest; the bands are context. The visual hierarchy must reflect that.
8. **Remain useful even with illustrative data.** The first pass of the exhibit validates the visual structure, not the numerical claim. A well-designed Benchmark Comparison Bars exhibit can land usefully on the preview route long before any real data exists; that is intentional.

---

## Data Readiness Gates

| Gate | Allowed surfaces | Required artifacts | Source-note string |
| --- | --- | --- | --- |
| **Gate 0** — no dataset (today's state) | `/app/charts-preview` only | None — illustrative inline data | "Source: Illustrative sample data · not a benchmark" |
| **Gate 1** — internal directional | All operator-only surfaces inside `/app/*`. **No client-facing surfaces.** | `sampleSize` per dimension; `vintage`; defined data lineage to SLATE-internal sources | "Source: Internal SLATE assessments · directional benchmark · n=… · vintage …" |
| **Gate 2** — validated | All surfaces, including client-facing reports, proposals, PDF exports, and public scorecard results | Documented methodology; defined population; minimum-`n` per dimension; vintage; leadership sign-off | "Source: Saipien Labs benchmark dataset · n=… · vintage …" |

Each gate is a one-way ratchet: a dataset that has reached Gate 2 cannot regress to Gate 1 by accumulating noisier rows; it must be re-validated. Conversely, a Gate 1 dataset cannot be silently promoted to Gate 2 just because more rows arrived.

---

## Non-Goals

This canon does not authorize, scope, or define any of the following. Each is governed by its own (later) sprint approval:

- Building the **Benchmark Comparison Bars** exhibit.
- Building the **`ChartPercentileBand`** primitive.
- Creating benchmark tables in the database.
- Adding database migrations.
- Adding seed benchmark data files.
- Sourcing external industry benchmarks.
- Finalizing the statistical methodology (population definitions, minimum-`n` thresholds, normalization rules).
- Wiring the future exhibit into reports or proposals.
- Adding PDF export.
- AI-generated benchmark claims (Step-3+ AI synthesis is a separate workstream).
- Deciding the dimension list above is *the* final list — these are starting points subject to refinement when the dataset is actually scoped.

---

## Acceptance Criteria

This canon is accepted when it:

- Prevents fake benchmark optics from accidentally landing in client-facing artifacts.
- Defines the three benchmark categories — `illustrative`, `internal_directional`, `validated` — with crisp boundaries.
- Defines exact source-note strings for each category.
- Defines the future TS data shape (`BenchmarkComparisonPoint`, `BenchmarkComparisonDataset`) and its validation rules.
- Defines the client-facing claim rules: which phrases are forbidden and which are allowed at each tier.
- Defines the three readiness gates and which surfaces each gate unlocks.
- Makes clear that **Benchmark Comparison Bars are not built and remain unbuilt until a separate sprint approval**.

---

## Pointer-Forward

When the **Benchmark Comparison Bars** sprint is later approved, the implementing agent should treat this canon as the source of truth for: data shape, validation rules, source-note language, claim rules, and surface eligibility. Deviations from this canon must be raised as a canon amendment, not absorbed into a code change.

— end of Phase 1B benchmark data canon —
