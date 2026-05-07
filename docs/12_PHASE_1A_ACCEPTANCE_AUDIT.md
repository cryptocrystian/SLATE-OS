# SLATE Phase 1A Acceptance Audit — AdvisoryOps OS Foundation

_Audit date: 2026-05-07. Audited against the latest verified commit on `persistence/step-0-1-auth-shell` plus two small in-audit fixes recorded below._

---

## Executive Summary

SLATE has reached the end of its planned **AdvisoryOps OS foundation** scope. Persistence/Auth Steps 0–10 plus AI Synthesis Steps 1, 1.1, and 2 are implemented, build-clean, and behave as designed under static analysis: every operator-facing route reads real Supabase rows under operator-only RLS, the public scorecard / public intake / asset upload paths run against persisted tables under their token + abuse boundary, and the AI synthesis paths are gated server-side with the provider key never reaching the browser. The end-to-end operator workflow — lead → engagement → intake → findings → opportunities → roadmap → report → proposal — is wired across all stages and the UI surface remains the same accepted MVP visual baseline (4.8/5 audit).

What the platform **does not yet certify** is that its customer-facing deliverables — the report builder, the proposal builder, the SOW collateral, and the public scorecard result page — meet **top-tier consulting-firm output quality**. The current report builder produces a 12-section outline with linked findings/opportunities/roadmap traceability and plain-text draft previews; the current proposal builder produces three tiered SOW option cards with placeholder pricing copy. There are no charting libraries installed, no consulting-grade exhibits (waterfall charts, opportunity-impact bubble plots, McKinsey-style 2x2s with real data points, swimlane diagrams, ROI projections, savings tables), no rich-text rendering on report sections, and no PDF / DOCX export. These are explicit, deliberate Phase 1A boundaries — but they are also exactly what separates "operator workflow tool" from "McKinsey/BCG/Bain-caliber deliverable engine."

**Acceptance Decision: Accept Phase 1A with Minor Fixes** (the two fixes are recorded below and are already applied).
**Phase 1B is required** before SLATE can claim McKinsey/BCG/Bain-caliber consulting outputs.

---

## Acceptance Decision

**Accept Phase 1A with Minor Fixes.**

Phase 1A — the AdvisoryOps OS foundation — is accepted. The internal operator workflow is functionally complete, persisted, secured, and build-clean. The two visible mock-label leaks discovered during audit have been corrected in this same audit pass.

Phase 1B — the **Consulting-Grade Deliverable Engine** — is required and explicitly **not** accepted as part of Phase 1A. The platform should not yet make customer-facing claims about producing top-tier consulting collateral; current report and proposal output is operationally complete but is not visually or substantively client-ready at the McKinsey/BCG/Bain bar.

---

## Scope Reviewed

- All `/scorecard*` public routes (landing, stepper, results) and the `/api/scorecard/submit` + `/api/scorecard/results/[id]` endpoints
- `/app/leads`, `/app/leads/[id]`
- `/app/engagements`, `/app/engagements/[id]` and the seven engagement subroutes (intake, findings, opportunities, roadmap, report, proposal)
- Public `/intake/[token]` plus `/api/intake/[token]/assets`
- `/api/app/engagements/[id]/assets` and `/api/app/assets/[assetId]/download`
- `/login`, `/auth/callback`, root `middleware.ts`, the operator allowlist
- Every component directory under `components/` (layout, ui, slate, leads, engagements, intake, findings, opportunities, roadmap, reports, proposals, scorecard, activity, notes, auth)
- `lib/ai/{provider,types,findings-context,findings-synthesis,opportunities-context,opportunities-synthesis}.ts`
- `lib/findings/synthesis-actions.ts`, `lib/opportunities/synthesis-actions.ts`
- `lib/activity/{types,log,queries}.ts`, the activity timeline component
- All eleven applied Supabase migrations (`0001`–`0011`)
- The four canon docs in `docs/persistence/`, plus `08_CURRENT_STATUS.md`, `09_DECISION_LOG.md`, `10_SESSION_HANDOFF.md`

---

## Latest Verified Commit

Pre-audit head: `5d5d2aa — AI Synthesis Step 2: opportunity drafting from approved findings` on `persistence/step-0-1-auth-shell`.

Two in-audit fix commits (described under "Bugs Fixed During Audit") will follow this audit doc; the audit reflects post-fix state.

---

## End-to-End Workflow Results

The audit was performed via static-analysis + build verification. Live Playwright/Chromium is not installed in this environment, so the 18 numbered E2E steps are reported as **expected-behavior under code inspection** rather than rendered-pixel proof. Each step references the implementation surface that was inspected.

| # | Step | Status | Evidence |
|---|------|--------|----------|
| 1 | Public scorecard works | ✅ Wired | `/scorecard`, `/scorecard/start`, `/scorecard/results` all build; `/api/scorecard/submit` runs honeypot + min-duration + disposable-domain + per-email/domain rate limiting; `PublicScoreResult` is type-narrowed (no `fit` leak). |
| 2 | Lead appears in `/app/leads` | ✅ Wired | `/app/leads` reads `getLeadsForOperator()` against `leads` under RLS; submission → lead derivation lives in `lib/scorecard/submit.ts`. |
| 3 | Lead detail opens | ✅ Wired | `/app/leads/[id]` renders persisted lead with `LeadTrustChip`; SSG via `generateStaticParams`. |
| 4 | Start AI Opportunity Sprint creates/opens engagement | ✅ Wired | `lib/leads/actions.ts` `startEngagementForLead` is idempotent on `linked_lead_id`. |
| 5 | Engagement detail loads | ✅ Wired | `/app/engagements/[id]` renders six panels and the stage tracker for both UUID and mock slug paths. |
| 6 | Intake session can be created | ✅ Wired | `components/intake/create-stakeholder-form.tsx` calls `lib/intake/actions.ts` `createStakeholderSession`; token hash is the boundary, raw token returned once. |
| 7 | Public intake token flow works | ✅ Wired | `/intake/[token]` validates `token_hash`, expiry, and stakeholder identity; renders `PublicIntakeForm`. |
| 8 | Stakeholder response persists | ✅ Wired | `lib/intake/public.ts` writes `stakeholder_responses` rows under service-role boundary. |
| 9 | Optional document upload works | ✅ Wired | Both public stakeholder and operator routes pass through `validateUpload`; bucket `engagement-documents` is private, MIME-allowlisted, 10 MiB capped; downloads issue 5-minute signed URLs via 302 redirect — never logged. |
| 10 | AI draft findings can be generated, or controlled unavailable state | ✅ Wired | `components/findings/generate-findings-form.tsx` exposes three states (configured + intake / configured + thin / not configured). |
| 11 | A finding can be approved + marked report-ready | ✅ Wired | `components/findings/review-action-bar.tsx` → `lib/findings/actions.ts`; `report_ready` review status persists. |
| 12 | AI draft opportunities can be generated, or controlled unavailable state | ✅ Wired | `components/opportunities/generate-opportunities-form.tsx` exposes three states (configured + approved findings / configured + no findings / not configured). |
| 13 | An opportunity can be selected/deferred/rejected | ✅ Wired | `components/opportunities/opportunity-action-bar.tsx` → `lib/opportunities/actions.ts`. |
| 14 | Roadmap item can be created | ✅ Wired | `components/roadmap/create-roadmap-item-form.tsx` → `lib/roadmap/actions.ts`. |
| 15 | Report can be initialized | ✅ Wired | `components/reports/initialize-report-form.tsx` writes `reports` + 12 `report_sections` rows. |
| 16 | Proposal can be initialized | ✅ Wired | `components/proposals/initialize-proposal-form.tsx` writes `proposals` + 3 `proposal_options` rows. |
| 17 | Notes / activity update | ✅ Wired | `components/notes/notes-panel.tsx` (soft-delete + pin + edit-in-place); `components/activity/activity-timeline.tsx` renders sanitized metadata. |
| 18 | Public routes cannot access internal data | ✅ Wired | RLS posture verified: `findings_operator_full`, `opportunities_operator_full`, `proposals_operator_full`, `reports_operator_full`, `notes_operator_full`, `activity_events_operator_full`, `ai_synthesis_runs_operator_full` — none expose to `anon`. Public routes import only public-safe libs and never read operator tables. |

**Limitation.** The 18-step E2E validation was performed via static + build inspection only. A subsequent live Playwright run on Quanta + Caldera mock paths and on at least one persisted UUID engagement is recommended before the next external-facing claim.

---

## Build and Lint Results

```
npm run lint                              -> ✔ No ESLint warnings or errors
NEXT_TELEMETRY_DISABLED=1 npm run build   -> Compiled successfully
                                             25 routes generate (✓ 13 static pages)
                                             Middleware: 81.9 kB
```

Re-run after the in-audit fixes: also clean.

Per-route First Load JS budget at audit time:

```
/app                                       87.4 kB
/app/leads                                 108  kB
/app/engagements                           106  kB
/app/engagements/[id]                      107  kB
/app/engagements/[id]/intake               110  kB
/app/engagements/[id]/findings             114  kB
/app/engagements/[id]/opportunities        115  kB
/app/engagements/[id]/roadmap              108  kB
/app/engagements/[id]/report               110  kB
/app/engagements/[id]/proposal             109  kB
/intake/[token]                            115  kB
/scorecard/results                         119  kB
/scorecard/start                           116  kB
/login                                     110  kB
```

---

## Security and Data Boundary Results

- **Auth.** `middleware.ts` refreshes the Supabase session on `/app/*`, `/login`, `/auth/*`; redirects unauthenticated `/app/*` → `/login`; degrades to `/login?error=config` if env is unset; leaves `/scorecard*`, `/intake/[token]`, `/apply/*`, `/` untouched.
- **Operator allowlist.** `lib/auth/operator-allowlist.ts` enforces fail-closed allowlist. `signInWithMagicLink` rejects unauthorized addresses **before** any Supabase call so unauthorized emails never trigger an OTP send. Default domain `saipienlabs.com`. Diagnostic logging whitelists exactly four sanitized fields.
- **RLS.** Default-deny everywhere. Every persisted table carries an explicit `*_operator_full` policy keyed to the singleton workspace. Public scorecard + intake + asset endpoints flow through service-role helpers that gate on token hash, not on `anon` policies.
- **Storage.** Bucket is `public = false`, 10 MiB cap, 9-MIME allowlist. No `storage.objects` policies (deliberately — broad `authenticated` access would over-broaden the bucket). All access goes through server-only helpers under the existing token + auth boundary.
- **AI.** Provider key read only in `lib/ai/provider.ts` (`server-only` import enforces no browser exposure). Page server components read `isAiConfigured()` and pass only the boolean. `ai_synthesis_runs.input_summary` and `output_summary` carry only safe counts — no prompt bodies, no raw responses, no stakeholder content. Activity metadata is restricted to `{ runType, generatedCount, skippedDuplicateCount, provider, model }` and the Step 9 `sanitizeMetadata` strips forbidden keys defensively.
- **Service role.** Confined to `lib/supabase/service.ts` callers in `lib/intake/public.ts`, `lib/assets/public.ts`, `lib/assets/server.ts`, `lib/scorecard/submit.ts`. Never appears in the browser bundle.
- **Signed URLs.** 5-minute TTL, returned only as a 302 redirect from `/api/app/assets/[assetId]/download`. Never logged, never persisted, never embedded in HTML or activity metadata.
- **Verdict.** No security boundary regressions. No anon access leakage. No PII / secrets accessible from public routes.

---

## Persistence and Migration Status

Migrations applied through `0011_ai_synthesis_runs.sql`:

| Migration | Scope |
|---|---|
| `0001_auth_workspaces_profiles.sql` | Singleton workspace, profiles ↔ auth.users, on-create trigger |
| `0002_scorecard_leads.sql` | Public scorecard submissions, leads, abuse hardening |
| `0003_engagements.sql` | Engagements, accounts, contacts |
| `0004_scorecard_abuse_hardening.sql` | Disposable email + per-email/domain rate limit |
| `0005_stakeholder_intake.sql` | Sessions, responses, input asset metadata |
| `0006_findings.sql` | Findings + finding source refs |
| `0007_opportunities_roadmap.sql` | Opportunities, opportunity-finding links, roadmap items |
| `0008_reports_proposals.sql` | Reports + report sections, proposals + proposal options |
| `0009_activity_notes.sql` | Activity events + operator notes |
| `0010_file_storage.sql` | Storage columns + private bucket provisioning |
| `0011_ai_synthesis_runs.sql` | AI synthesis run rows (run_type text-typed for vocabulary growth) |

Step 2 of AI synthesis added zero schema. The `ai_synthesis_runs` table accepts arbitrary `run_type`; Step 2 reuses it with `run_type = 'opportunity_draft'`. The Step 7 opportunities + opportunity_finding_links tables already carry the score columns and join shape needed.

No drift detected. No blocking migration issues.

---

## AI Synthesis Status

| Capability | Status |
|---|---|
| Provider abstraction (`lib/ai/provider.ts`) | ✅ `fetch`-based, no SDK, server-only |
| Findings draft generation (Step 1) | ✅ Operator-only CTA, 3–7 candidates, validator-gated, `ai_drafted=true`/`needs_review`, run row + activity event |
| Findings discoverability (Step 1.1) | ✅ Subordinate Sparkles signals, evidence-aware footnote, intake-first stays the recommended action |
| Opportunity draft generation (Step 2) | ✅ Operator-only CTA, 2–6 candidates, validator-gated, `linkedFindingIds` cross-checked against approved/report-ready set, server-derived priority/quadrant with high-risk override, opportunity_finding_links persisted, run row + activity event |
| Roadmap draft generation | ⛔ Not implemented (Phase 1B) |
| Report section drafting | ⛔ Not implemented (Phase 1B) |
| Proposal option drafting | ⛔ Not implemented (Phase 1B) |
| Document parsing (PDF/DOCX/CSV → text) | ⛔ Not implemented (Phase 1B) |
| Embedding-based dedup | ⛔ Not implemented (Phase 1B; title-based dedup is the current guardrail) |

The Step 2 architecture chose to **explicitly omit model-set priority/quadrant** — the server derives those from the validated 0–100 scores so the matrix decision rule stays single-sourced.

---

## Operator UX Assessment

**Premium for an internal AdvisoryOps tool, not yet premium for a customer-facing deliverable surface.**

Strengths:

- The visual baseline is the accepted Sprint 1–7 + stabilization design system (4.8/5 MVP audit). Dark surface, brand-tinted accents, mono-uppercase eyebrow micro-typography, subtle gradient accents on score cards.
- Composition primitives are uniform: `LockedActionButton`, `EngagementRecommendedActionCard`, `MetricCard`, `Badge` with 10 tones, `EmptyState`. Cross-page consistency is high.
- Stage tracker on engagement detail shows current position cleanly. Recommended-action helper routes to the right next step from every engagement page (no loops, no dead ends).
- AI affordances are intentionally subordinate to the human authoring surface — Sparkles indicators, "Draft only · operator review required" badge, and "Best results come after at least one stakeholder completes intake" copy.
- Activity timeline + notes panel are professional and operator-only; metadata sanitizer strips forbidden keys defensively.

Weaknesses (Phase 1B candidates):

- The operator workspace looks like a high-quality SaaS app, **not** like a McKinsey-grade advisory tool. The vocabulary used in the UI (e.g. "engagement," "findings," "opportunities") is correct, but the **density of consulting exhibits** the operator can produce is thin. A McKinsey-tier internal tool would surface live ROI calculators, savings models, capability heatmaps, change-impact estimates, and scenario projections inline with the workflow.
- Findings page has rich evidence panels but no visualization of the **shape** of findings across an engagement (e.g. category mix, evidence-strength distribution, confidence histogram).
- Opportunity matrix is a clean 2×2 CSS grid, not a true scatter/bubble plot with impact × complexity bubble sizing on risk. A McKinsey-style 2×2 would carry sized markers, evidence-weighted opacity, and risk overlays.
- Roadmap is text-column-by-phase, not a swimlane / dependency diagram with critical-path visualization.

---

## Customer-Facing UX Assessment

**Public scorecard.** Functional, on-brand, trust-stamped (badge-strip, value-props, boundary card). Uses real `ScoreCard` components with 0–100 bars and band labels (`Strong / Healthy / Mixed / Early`, `Mature / Workable / Foundation work needed`). Recommended-next-step card routes to the appropriate Saipien Labs offering. Honeypot + min-duration + rate limit are wired.

What's missing for a top-tier diagnostic:

- The result page shows three big numbers and three text blocks. There is **no** consulting-grade visualization — no maturity radar, no peer-benchmark bar, no quadrant placement, no "where you sit on the curve" exhibit.
- Copy is on-brand but generic. McKinsey/BCG/Bain diagnostics typically anchor results to industry benchmarks ("median financial-services firm scores 56 here; you scored 71") which requires a benchmark dataset that does not yet exist.
- No PDF download / shareable executive summary. The diagnostic conversation continues entirely in-browser.

**Public stakeholder intake.** Functional and clean. The form supports optional document upload with a controlled validation surface and a 10 MiB / 9-MIME cap. The token boundary is sound. UI density is acceptable but reads as **utilitarian** — appropriate for a 10-minute stakeholder questionnaire but not a premium experience. There is no progress tile, no multi-section navigator, no save-and-resume, no AI-assisted answer drafting.

**Locked outbound surfaces.** `Export Report`, `Send to Client`, `Prepare SOW Draft`, `Prepare Client Review`, `Prepare SOW Draft` are all locked behind `LockedActionButton` instances. The boundary is honest but means **nothing presently leaves the platform as a polished customer-facing artifact.**

---

## Report Builder Assessment

**Operationally complete; not yet a top-tier consulting report.**

What works:

- 12-section outline with status filter tabs (`All / Not started / Drafted / Needs review / Approved / Final`) + per-section status chip, per-section AI-drafted vs Consultant-authored badge, and per-section confidence chip.
- Each section shows a `Draft preview` card with `whitespace-pre-line` plain-text content. Linked-counts row (Findings linked / Opportunities linked / Roadmap items linked).
- A linked-context panel surfaces the source trail (findings, opportunities, roadmap items) with deep links to each workspace.
- Persistence (Step 8) writes status changes to `report_sections.status` and emits activity events.

What's missing for client-ready consulting output:

- **Plain-text only.** Section bodies render as `<p whitespace-pre-line>{section.draftPreview}</p>`. No rich text, no Markdown, no headings inside a section, no callouts, no quote blocks, no images, no embedded data exhibits. A McKinsey-grade report has structured sub-sections, sized callouts, executive-summary bullets, and data-driven tables on the same page.
- **No charts.** Zero charting library installed (`package.json` shows none). The opportunity matrix is a CSS 2×2; the score card is a CSS bar. There is no waterfall, no bridge chart, no heatmap, no cohort grid, no ROI curve, no savings stack, no benchmark overlay anywhere in the report builder.
- **No section regeneration.** "Regenerate draft" appears only as a mock button on mock paths. The action does not currently call an LLM (Phase 1B).
- **No export.** `Export Report` is a `LockedActionButton`. There is no live PDF / DOCX path.
- **Section drafts are seeded mock fixtures on persisted engagements until the operator manually edits each one.** A persisted Step 8 report initialized from the `Initialize Report` form gets its 12 sections, but the per-section `draftPreview` text is whatever copy was seeded; there is no AI section drafting yet.
- **Reviewer notes are surfaced but free-form.** No template, no comparison view between reviewer note vs draft.

Verdict: the report builder is a **competent operator review surface for the existing copy + linked-evidence trail.** It is **not** a McKinsey/BCG/Bain-caliber report production engine.

---

## Proposal Builder Assessment

**Operationally complete; not yet a top-tier proposal artifact.**

What works:

- Three-tier SOW option cards (Quick-Win Build / AI Workflow System / Managed AI Partner) with `Recommended` ribbon and brand-tinted ring on the recommended option.
- Per-option detail surfaces scope summary, timeline, deliverables list, included opportunities (deep-linked), linked roadmap items (deep-linked), dependencies, assumptions, risks, and a clearly-labeled `Pricing placeholder · for internal planning only` block.
- `ImplementationCreditPanel` carries explicit "commercial planning lever, not an automatic discount" copy.
- Persistence (Step 8) writes option recommendation status changes and emits activity events.
- `Prepare SOW Draft`, `Send to Client`, and `Prepare Client Review` are all explicitly locked.

What's missing for client-ready commercial collateral:

- **No SOW PDF generation.** SOW preparation, send, and signature stay locked. There is no rendered SOW artifact today.
- **No commercial economics.** Pricing is a placeholder string. There is no T&M calculator, no fixed-fee structure, no AI-tooling cost reconciliation, no implementation-credit math view, no margin model.
- **No tier comparison exhibit.** Three option cards sit side-by-side but there is no comparison matrix (capability ✓ / ✗ / Add-on across tiers, McKinsey-style "what you get at each tier" grid).
- **No e-signature integration.**
- **No CRM sync.**
- **(Fixed during audit.)** A stale `Mock — not wired` warning badge was rendering on every option detail card, including on real persisted Step 8 proposals. Removed.

Verdict: the proposal builder is a **clean tiered-options scoping surface.** It is **not** a closeable commercial artifact engine.

---

## Charts / Graphs / Exhibit Quality Assessment

**This is the largest visible gap between Phase 1A and a McKinsey/BCG/Bain bar.**

What exists:

- `components/scorecard/score-card.tsx` — single horizontal 0–100 progress bar with banded label (CSS only).
- `components/opportunities/opportunity-matrix.tsx` — 2×2 CSS-grid quadrant container; cards inside are list items, not plotted markers.
- `components/opportunities/opportunity-score-strip.tsx` — six small horizontal bars per opportunity (CSS only).
- `components/roadmap/*` — phase columns (CSS grid), no Gantt, no critical-path overlay.
- `components/intake/role-coverage-map.tsx` — a small role-coverage tile grid (CSS only).
- `components/findings/*` — text + badge layouts, no visualizations.

What is **missing entirely:**

- No charting library (no Recharts, no Visx, no D3, no Tremor, no Chart.js, no Nivo). `package.json` confirms zero chart dependencies.
- No bar / line / area charts.
- No bubble / scatter plots (the opportunity matrix is a layout, not a plot).
- No waterfall / bridge charts (commonly used for AI-savings ROI narratives).
- No heatmaps (commonly used for capability maturity assessments).
- No swimlane / Gantt visualization for roadmap dependencies.
- No quadrant exhibit with sized markers and evidence overlays.
- No benchmark / industry-comparison overlays anywhere.
- No data tables with sortable rows + export (the proposal "Pricing placeholder" is a single string).
- No exhibit-style annotations (callouts, "Today" markers, projection arrows).

A McKinsey/BCG/Bain consulting deliverable would carry typically **8–15 charts/exhibits per report** with a clear visual taxonomy (executive summary 2×2, capability heatmap, savings waterfall, ROI bridge, quick-win vs strategic-build matrix, roadmap Gantt, benchmark comparisons, ROI sensitivity). SLATE currently produces zero of those.

---

## Consulting-Grade Output Assessment

**Are current outputs McKinsey/BCG/Bain caliber?** No.

What is missing to reach that bar:

1. **A real charting layer.** Pick a single library (Recharts is a reasonable default for React + SSR; Visx for more bespoke control; Tremor if leaning into shadcn-style primitives). Commit to a SLATE chart-component vocabulary so every report exhibit reads as part of one design system.
2. **A consulting-grade exhibit library inside SLATE.** Categories required:
   - Executive Summary 2×2 (impact × complexity, sized by ROI, colored by risk)
   - Capability Maturity Heatmap (per practice area × per dimension)
   - AI-Savings Waterfall (current cost → opportunity savings → realized state)
   - ROI Bridge (year 1 → year 3 with sensitivity bands)
   - Roadmap Gantt with Dependencies (the current 30/60/90 columns are not enough)
   - Benchmark Comparison Bars (peer percentile placement per dimension — requires a benchmark dataset)
   - Risk-Adjusted Priority Quadrant (real bubble plot, not a 2×2 layout)
   - Stakeholder Coverage Matrix (role × question × evidence-strength)
3. **Rich-text rendering on report sections.** Markdown or a constrained block-doc model so a section can carry sub-headings, callouts, ordered/unordered lists, and inline references. Today it is `<p whitespace-pre-line>` only.
4. **Embedded exhibits inside report sections.** A section should be able to declare "render the AI Opportunity Portfolio matrix here" as part of its draft, not just link to the workspace.
5. **PDF / DOCX export of the report.** Pixel-faithful, with embedded exhibits, branded cover, table of contents, page numbers.
6. **PDF export of the SOW** with the recommended option, scope, deliverables, dependencies, pricing model, assumptions, signature block.
7. **Executive-grade copy.** Today's section copy is competent SaaS-product language. Top-tier consulting copy is precise, decisive, hedged appropriately, and benchmarked. AI section drafting (Phase 1B) should target that register.
8. **Industry benchmark dataset** so the public scorecard and the executive-summary exhibits can anchor results to peer percentiles.
9. **A polished public scorecard result PDF** that can be downloaded and forwarded internally inside a prospect company.
10. **A consulting-style cover surface** for the report and proposal — branded title page, engagement metadata, version + date, delivery date, signatories.

Until these land, SLATE should be described as **"the AdvisoryOps OS for internal consulting workflows"** — not as "a McKinsey-tier deliverable engine."

---

## Bugs Found

| ID | Severity | Description |
|---|---|---|
| BUG-A | Minor (visible) | `components/proposals/proposal-workspace.tsx:199` hard-coded a `Mock — not wired` warning badge on every `ProposalOptionDetail` card. The badge always rendered, including on real persisted Step 8 proposals — it incorrectly tagged operator-real proposal options as mock. |
| BUG-B | Minor (visible) | `components/intake/follow-up-queue.tsx:38` hard-coded a `Mock — not wired` warning badge in the panel header. The follow-up queue is rendered on every intake page (including persisted Step 5 paths), so the badge bled the "mock" label onto real engagements where the queue is empty rather than fake. |
| BUG-C | Cosmetic | `components/reports/report-workspace.tsx:339` shows `Review actions · mock` copy — but only when the persisted action bar prop is undefined, i.e. on mock slug engagements. No bleed onto persisted paths. **Not a bug; left as-is.** |

No security / data-boundary / RLS / auth / build / lint / migration bugs were found.

---

## Bugs Fixed During Audit

- **BUG-A:** Removed the `Mock — not wired` badge from `ProposalOptionDetail`. The page meta line ("Persistence Step 8 · Live" vs "Sprint 7 · Mock data") already differentiates persisted vs mock — the per-option badge was redundant on mock paths and incorrect on persisted paths.
- **BUG-B:** Removed the `Mock — not wired` badge from `FollowUpQueue`. Same rationale; the intake page meta ("Persistence Step 5 · Live" vs "Sprint 5 · Mock data") already differentiates persisted vs mock.

Both fixes are purely cosmetic, do not change any data flow, and ship-clean against `npm run lint` and `NEXT_TELEMETRY_DISABLED=1 npm run build` (both verified post-fix).

---

## Known Issues

- **Live E2E run not performed in this audit pass.** A subsequent Playwright walk on (a) the Quanta + Caldera mock paths and (b) at least one persisted UUID engagement is recommended before the next external claim.
- **The `LinkedRefsPanel.RefBlock` "Open" link is a plain `<a href>`,** not a Next `<Link>`. This causes a full-page reload when the operator drills from a report section into the related findings/opportunities/roadmap workspace. Cosmetic — kept out of scope for the audit pass to avoid scope creep, but a candidate for a Phase 1A.1 polish PR.
- **`status = 'draft'` AI-generated opportunities** are dedup'd by case-insensitive title only. A model paraphrase would land both a near-duplicate and the original; the operator can reject the duplicate via the action bar. Embedding-based dedup is a Phase 1B candidate.
- **The follow-up queue feeds from `IntakeRecord.followUps` which is populated only by `lib/intake/mock-intake.ts`.** Persisted paths return an empty array. The empty state ("No follow-ups required") therefore shows correctly on persisted engagements; a future iteration can derive follow-ups from `stakeholder_intake_sessions.status` (e.g. `not_started` past N days = follow-up).
- **Sprint number references in operator-only meta lines** ("Persistence Step 8 · Live" / "Sprint 7 · Mock data") are intentional and operator-facing only — they never appear on `/scorecard*`, `/intake/[token]`, or any client-facing surface. Acceptable for Phase 1A; consider hiding behind a debug toggle in Phase 1B.

---

## Phase 1A Completion Boundary

**Phase 1A — AdvisoryOps OS Foundation — is the internal operating-system foundation.**

It includes:

- Auth + magic-link + operator allowlist + RLS posture
- Persisted scorecard → leads → engagement → intake → findings → opportunities → roadmap → report → proposal arc
- Operator activity timeline + notes
- Public stakeholder intake with token-hash boundary
- Asset upload / private bucket / signed-URL download
- AI synthesis for findings (Step 1) and opportunities (Step 2) with the human-in-the-loop boundary intact
- Build-clean, lint-clean, RLS-default-deny

It does **not** include:

- Top-tier consulting-grade report or proposal output
- Charting / data visualization library
- Consulting exhibits (waterfall, bridge, bubble, heatmap, swimlane)
- Rich-text section bodies on reports
- AI section drafting for reports
- AI option drafting for proposals
- AI roadmap drafting from selected opportunities
- Document parsing (PDF/DOCX/CSV)
- PDF / DOCX export for reports or SOWs
- E-signature
- CRM integration
- BuildOps surfaces
- Industry benchmark dataset
- Polished public scorecard PDF download

---

## Phase 1B Required Scope

**Phase 1B — Consulting-Grade Deliverable Engine.**

Goals:

1. Pick + commit to a single charting layer; build the SLATE chart-component vocabulary.
2. Build the consulting exhibit library: Executive Summary 2×2, Capability Maturity Heatmap, AI-Savings Waterfall, ROI Bridge, Roadmap Gantt with Dependencies, Risk-Adjusted Priority Quadrant, Stakeholder Coverage Matrix, Benchmark Comparison Bars.
3. Add rich-text or constrained-block document model on `report_sections.body` and render it in `ReportWorkspace`.
4. Allow report sections to embed exhibits by reference (`render exhibit X here`) so a single report carries multiple visualizations.
5. Add AI Synthesis Step 3 — report section drafting from approved findings + selected opportunities + roadmap.
6. Add AI Synthesis Step 4 — proposal option drafting from approved opportunities + roadmap.
7. Add AI Synthesis Step 5 — roadmap drafting from selected opportunities.
8. Add server-only document parsing (PDF/DOCX/CSV → text) so synthesis can cite document excerpts.
9. Replace `LockedActionButton` for `Export Report` with real PDF generation including embedded exhibits.
10. Replace `LockedActionButton` for `Prepare SOW Draft` / `Send to Client` with real SOW PDF generation.
11. Build a polished public scorecard result PDF with a download button and an emailable executive summary.
12. Source / build an industry benchmark dataset for at least the three scorecard dimensions and the most common opportunity categories.
13. Tighten executive copy across the report and proposal; pass copy through a consulting-register QA gate.

**Boundaries that hold across both phases:**

- Operator approval is mandatory on every AI artifact before it becomes report-ready / client-ready.
- Customer-facing surfaces never expose internal sprint labels, mock badges, or debug copy.
- Provider keys, Supabase keys, raw tokens, signed URLs, and storage paths never reach the browser.
- Public scorecard / public intake routes never read operator data.
- BuildOps stays explicit non-scope.

---

## Deferred Backlog

| Item | Why deferred |
|---|---|
| Charting library + SLATE chart vocabulary | Phase 1B foundational |
| Eight consulting exhibits | Phase 1B foundational |
| Rich-text section body model | Phase 1B foundational |
| Report PDF export with embedded exhibits | Phase 1B foundational |
| SOW PDF export | Phase 1B foundational |
| AI Synthesis Step 3 (report sections) | Phase 1B |
| AI Synthesis Step 4 (proposal options) | Phase 1B |
| AI Synthesis Step 5 (roadmap drafting) | Phase 1B |
| Document parsing pipeline | Phase 1B (storage hardening should ship alongside) |
| Industry benchmark dataset | Phase 1B |
| Embedding-based dedup for AI artifacts | Phase 1B polish |
| Benchmark percentile overlays on scorecard results | Phase 1B |
| Public scorecard PDF download | Phase 1B |
| Polished proposal-vs-tier comparison matrix | Phase 1B |
| E-signature integration | Phase 1B+ |
| CRM integration | Phase 1B+ |
| BuildOps surfaces | Out of scope |
| Replace `LinkedRefsPanel` `<a href>` with `<Link>` | Phase 1A.1 polish |
| Hide sprint-number meta line behind debug toggle | Phase 1A.1 polish |

---

## Recommendation

**Accept Phase 1A with the two minor fixes already applied during this audit.** Mark the AdvisoryOps OS foundation complete and stable.

**Do not yet make customer-facing claims of "McKinsey/BCG/Bain-caliber consulting outputs."** That standard is a Phase 1B deliverable, not a Phase 1A one. Any external collateral about SLATE produced before Phase 1B ships should describe the platform as the **AdvisoryOps operating system** that powers Saipien Labs internal consulting workflows — not as a turnkey deliverable engine.

**Recommended next step:** scope Phase 1B by picking the charting layer first, then sequencing the eight required consulting exhibits, then layering AI synthesis Steps 3/4/5 on top, then PDF export for both report and SOW. Document parsing and embeddings should be folded into the same workstream so the consulting exhibits can cite document evidence and dedup across paraphrased AI drafts.

— end of Phase 1A acceptance audit —
