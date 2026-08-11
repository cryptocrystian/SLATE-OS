# docs/62 — SLATE UI/UX Audit + Screen Inventory

> **Audit type:** Full code-level UX/UI audit of the internal operator app (AdvisoryOps pipeline + shell). Conducted by reading source against the `docs/11` rubric and `docs/04` canon. **Not** a live-screenshot audit — the authenticated app + Supabase were not run this session, so responsive/motion scores are inferred from Tailwind classes and component structure, not captured pixels. A follow-up live screenshot pass (per `docs/11` §Workflow) should confirm responsive/contrast findings.
>
> **Date:** 2026-08-10 · **Branch:** `persistence/step-0-1-auth-shell` @ `82b9bc0` (= `staging`)
> **Trigger:** User verdict — current UI "feels like AI slop, coded on the fly." Redesign pass planned; this inventory is its baseline. See memory `ui-ux-redesign-pass-planned`.
> **Scope:** 27 operator surfaces across 6 areas + shared primitives. Public scorecard/apply/intake token flows and chart internals were out of scope for this pass.

---

## 1. Verdict

**Composite: ~3.5 / 5 — "competent and safe, not premium."**

The foundation is genuinely good and the problems are structural/compositional, not architectural. **The palette, tokens, security posture, and canon data-structures are sound; the surface layer (typography voice, depth, motion, feedback, workflow completeness, dead chrome) is unconsidered.** That is exactly the "coded on the fly" signature — and it's good news: this is a **composition + interaction redesign over a working engine, not a rebuild.**

### Axis averages (across 27 surfaces)

| Axis | Score | Read |
|---|---|---|
| Responsive | 3.9 | Strongest — grids/breakpoints are mostly sound (unverified live) |
| Canon alignment | 3.7 | Structural fidelity is high (matrix, 3-col, 30/60/90, 12-section) |
| Microcopy | 3.6 | Voice is calm/specific — **but polluted by dev-scaffolding leaks** |
| Hierarchy | 3.4 | Next-action often buried; flat card monotony |
| Premium feel | 3.4 | Mono-uppercase saturation + flat depth undercut it |
| Accessibility | 3.4 | Focus states + dialog semantics broadly missing |
| Information density | 3.3 | Weakest — mega-page scrolls, forms above work surfaces |

---

## 2. App-wide quantitative scan (hard counts, all 195 components/pages)

| Signal | Count | Verdict |
|---|---|---|
| Flat black / hardcoded hex in markup | ~1 each | ✅ Color discipline is good — **palette is not the problem** |
| `font-mono uppercase tracking` headers | **43 files / ~123 uses** | ❌ Default header voice is console/debug, not premium |
| `Card variant="elevated"` | 7 (vs 133 outline, 114 base) | ❌ Layered depth exists in tokens but is barely used → flat |
| `Card variant="interactive"` | **0** | ❌ Defined but unused; hover reinvented per-component |
| `framer-motion` / motion | **1 file** | ❌ Motion canon essentially unimplemented |
| Toast/notification system | **0** | ❌ No action-feedback layer |
| Route `loading.tsx` / `error.tsx` | **0** | ❌ No skeletons, no error boundaries |
| `focus-visible` styling | 13 / 195 files | ❌ Keyboard focus broadly missing (108 onClick handlers) |
| `aria-label` | 53 files | ~ Better than expected |
| Raw `<table>` | 0 | ✅ Not literal table-soup |

---

## 3. Systemic themes (the redesign backlog)

Ordered by leverage. These recur across most screens; fixing them at the system level fixes dozens of individual issues — **and absorbs the docs/58 pilot cautions C1–C5.**

### T1 — Dev/spec scaffolding leaks into production copy *(highest-leverage, near-free)*
"Sprint 5 · Mock data," "Persistence Step 8 · Live," "wiring lands in Sprints 5–7," "docs/35 § 5," "docs/42 § 12," "Email automation lands later," migration filenames, "Action stays mock for now." Present on nearly every screen. **The single biggest driver of the "AI slop" perception.** Mostly a find-and-replace/removal sweep.

### T2 — Dead & placeholder chrome
Fake command bar + ⌘K, notifications bell, top-bar review-queue button, dashboard "Open Library"/"Review New Leads," leads "Review High-Fit Leads," engagements "Review Active Sprints" — all no-op. Leads classify/convert/nurture/disqualify all `disabled`. Mock "Review actions" blocks render live-looking Approve/Edit/Regenerate buttons that do nothing (findings, report). Six of eight nav items padlocked. → Wire or remove; hide unbuilt nav instead of padlocking.

### T3 — Monospace-uppercase-muted eyebrow saturation
`font-mono uppercase tracking-[…] text-text-muted` is the default treatment for essentially every label, section header, field name, and card eyebrow — including client-facing deliverables. Reads as audit console. → Real type hierarchy: sans section headers; mono reserved for IDs/scores/eyebrows only, per canon.

### T4 — Human-guided-AI loop is half-wired: no Edit, no bulk actions
Persisted action bars (findings, opportunities, roadmap, report sections) offer approve/reject/note but **no Edit of the AI prose/scores and no per-item Regenerate** (the dead *mock* bars ironically show these). **No bulk approve/reject anywhere** — a 12-section report is ~24 clicks. This is the workflow core and the top power-user pain. Directly answers docs/58 cautions C2/C5. → Add inline edit + regenerate to every persisted bar; add multi-select + batch actions.

### T5 — Next-action is buried
On the engagement hub and intake, the recommended-action card sits in a right rail that reflows *below* a long main column. Canon: the next step must lead. → Promote recommended-action to a full-width band under the stage tracker / above capture forms.

### T6 — No progressive disclosure on dense workspaces
Hub renders all 6 stage panels always (mostly empty/locked); intake stacks all 3 capture lanes fully expanded with no mode switcher; findings/opps/roadmap stack generate+create+readiness cards *above* the actual work surface. → Collapse locked/downstream sections; segmented "Live · Offline · Transcript" lane control; lead with the work surface.

### T7 — Design system under-adopted / inconsistent
`Card interactive` unused (per-component hover with varying opacities /50 /60 /80 /85), two locked-button implementations, raw `bg-white/[0.0x]` alphas bypassing tokens, inconsistent focus (Button owns none, Input doubles up). Tokens themselves are excellent. → Standardize interactive surfaces on `Card interactive`; one locked pattern; branded focus ring on the Button primitive.

### T8 — Accessibility gaps (consistent, narrow to fix)
`focus-visible` missing on most custom controls; mobile drawer + send-to-client modal lack focus trap / Escape / dialog semantics; invalid `role="grid"` on the opportunity matrix; tablists without roving-tabindex/tabpanel; `window.prompt()` for void reasons; disabled controls without `aria-disabled`/reason. → Global focus ring, real dialog primitive, fix ARIA roles, replace `window.prompt`.

### T9 — No loading/error/feedback layer
Zero `loading.tsx`/`error.tsx`, no toast system, no per-section progress on long bulk drafts, text-only "Saving…". Query errors swallowed to console render as empty (masking failures). → Route skeletons + error boundaries + a toast/feedback layer + progress on long runs.

### T10 — Deliverables don't look like deliverables
Reports/proposals/candidates and the public `/r` `/p` are stacks of bordered cards with single-paragraph bodies, no cover/letterhead/numbering/TOC. Public client surfaces score **Premium 2**. Option tiering is flat; recommended emphasis is a 1px/30% ring or a small badge; disclaimers pile up 5+ deep (often with pricing hidden). → Designed document system: cover/letterhead, numbered sections with sub-structure, side-by-side good/better/best with the recommended tier featured + rationale, one confident disclaimer block.

### T11 — Guard/audit legibility *(docs/58 C2–C4, now code-confirmed)*
The commercial guard surfaces only counts ("N violations") or raw `{code} · {field}` — never the offending phrase or how to fix; the disabled Approve button dead-ends with no "view what failed." The correct pattern already exists (`PreDeliveryAuditCard` renders plain `shortLabel` + actionable `message`) but isn't reused. → Give every violation a plain-language record and reuse it across strips, panels, and buttons.

### T12 — Motion canon unimplemented
The specified subtle motion (panel reveals, hover elevation, score count-up, approval feedback) is absent (1 file). → Introduce a restrained motion layer during the redesign.

---

## 4. Per-screen inventory

Scores: `Premium · Canon · Hierarchy · Density · Responsive · A11y · Copy` (1–5).

### Area A — App shell + Dashboard
| Surface | Path | Score (P·C·H·D·R·A·Copy) | Headline issue |
|---|---|---|---|
| App shell | `components/layout/app-shell.tsx` | 4·4·4·3·3·2·4 | Mobile drawer not a real dialog (no focus trap/aria-modal) |
| Sidebar nav | `components/layout/sidebar-nav.tsx` | 3·3·4·4·4·3·3 | 6/8 items padlocked + hardcoded badges "6"/"5" |
| Top bar | `components/layout/top-bar.tsx` | 3·2·4·4·4·3·4 | Command bar/⌘K/notifications all dead — loudest slop signal |
| Page header | `components/layout/page-header.tsx` | 4·5·5·4·3·4·4 | Strongest primitive; meta row dropped on mobile |
| Overview dashboard | `app/app/page.tsx` | 3·2·3·2·4·3·3 | 6-up KPI scoreboard + roadmap/marketing copy baked in |
| Review queue | `components/slate/review-queue.tsx` | 4·4·4·4·4·3·5 | Only a 7×7 arrow is clickable, not the row |
| Active engagements | `components/slate/active-engagements-panel.tsx` | 4·4·4·4·4·4·4 | Most polished; reinvents Card interactive by hand |
| Recent activity | `components/slate/recent-activity-panel.tsx` | 4·4·4·4·4·4·5 | Clean; rows don't deep-link to source |
| UI primitives | `components/ui/*` | 4·5·4·4·4·3·4 | Excellent tokens; `interactive` variant unused, focus inconsistent |

### Area B — Leads
| Surface | Path | Score | Headline issue |
|---|---|---|---|
| Lead inbox (triage) | `app/app/leads/page.tsx` | 3·3·3·2·4·2·4 | Dead primary CTA; **no fit-score sort** despite the promise; tall low-density rows |
| Lead detail | `app/app/leads/[id]/page.tsx` | 4·4·4·3·3·2·4 | Classify/convert/nurture/disqualify all disabled; mock CTA |

### Area C — Engagement hub + Intake
| Surface | Path | Score | Headline issue |
|---|---|---|---|
| Engagement list | `app/app/engagements/page.tsx` | 4·4·4·4·4·3·2 | Dead "Review Active Sprints"; sprint-tracker copy |
| Engagement hub | `app/app/engagements/[id]/page.tsx` | 4·3·2·3·4·4·2 | Next-action buried in sidebar; stage stated 3× |
| Intake manager (A/B/C) | `app/app/engagements/[id]/intake/page.tsx` | 3·3·2·2·4·3·2 | 3 capture forms, no mode switcher; `window.prompt` for void reason |

### Area D — Findings + Opportunities
| Surface | Path | Score | Headline issue |
|---|---|---|---|
| Findings review | `app/app/engagements/[id]/findings/page.tsx` | 4·3·4·3·3·3·4 | Real bar lacks Edit/Regenerate; no bulk; workspace below fold |
| Opportunity matrix | `app/app/engagements/[id]/opportunities/page.tsx` | 4·4·4·3·4·3·4 | Correct 2×2 matrix; invalid `role="grid"`; 15-field create form |

### Area E — Roadmap + Report
| Surface | Path | Score | Headline issue |
|---|---|---|---|
| Roadmap builder | `app/app/engagements/[id]/roadmap/page.tsx` | 3·4·3·4·4·3·3 | Correct 30/60/90; no edit after create; mono-label saturation |
| Report builder | `app/app/engagements/[id]/report/page.tsx` | 3·4·2·3·4·4·3 | ~24 clicks to approve 12; no prose edit; mock buttons shipped |
| Report print preview | `app/app/engagements/[id]/report/print/page.tsx` | 3·4·3·4·5·4·4 | Print-robust but reads like a debug dump |
| Report PDF candidate | `app/…/report/pdf-candidate/[snapshotId]/page.tsx` | 3·4·3·4·5·4·4 | viewerMode split cleanly built; card-grid aesthetic ceiling |
| Past candidates panel | `components/reports/report-pdf-candidates-panel.tsx` | 3·4·3·3·4·4·4 | Dense operator log; noisy |

### Area F — Proposal + SOW + Delivery
| Surface | Path | Score | Headline issue |
|---|---|---|---|
| Proposal workspace | `app/app/engagements/[id]/proposal/page.tsx` | 3·3·3·3·4·4·3 | Flat tiering; weak recommended emphasis; UUID/sprint noise |
| Proposal candidate | `app/…/proposal/candidate/[snapshotId]/page.tsx` | 3·4·3·2·4·4·3 | Guard shows count only; client-preview drift; 5 stacked disclaimers |
| SOW draft | `app/…/proposal/sow/[snapshotId]/page.tsx` | 3·5·4·3·4·4·4 | Canon-exemplary; only guard-detail gap drags it |
| Public proposal `/p` | `app/p/[token]/page.tsx` | **2**·3·3·3·4·4·3 | Airtight security; **bare, not executive-grade**; flat options |
| Public report `/r` | `app/r/[token]/page.tsx` | **2**·4·3·4·4·4·4 | Safe and clean, still bare |
| Mint + Send-to-Client | `components/client-delivery/send-to-client-confirm-modal.tsx` + buttons | 4·4·4·3·4·3·3 | Best security UX; raw-code errors; modal no focus trap |

---

## 5. Strengths to preserve (do not regress in the redesign)

1. **Design tokens / layered-dark palette** — never flat black, no hardcoded hex; the strongest part of the codebase.
2. **Internal-vs-prospect separation (leads)** — locks, "never shown to prospect," read-only mirror badges. Canon requirement, genuinely well met.
3. **Canon structural fidelity** — real 3-column findings, semantically-correct 2×2 opportunity matrix, 30/60/90 roadmap board, 12-section report outline, tiered proposal shape.
4. **AI labeling / provenance / confidence / evidence** — above-average; provenance chips, needs-validation warnings, evidence→source tracing.
5. **Security & boundary discipline** — copy-once token UX, SOW watermark + no public route, generic-unavailable pages, hashed email, `PreDeliveryAuditCard` plain-language.
6. **viewerMode operator↔client split** — cleanly engineered (correct `"use client"`/server helper split).
7. **Empty states & microcopy voice** — thoughtful empties in many places; calm/specific voice where not polluted by scaffolding.

---

## 6. Recommended sequence

The themes fall into three natural phases for the redesign:

1. **Phase 0 — "Stop the bleed" (days, near-zero risk):** T1 (strip scaffolding copy), T2 (remove/hide dead chrome + padlocks). This alone kills most of the "AI slop" perception with no engine changes.
2. **Phase 1 — Design system pass:** T3 (typography), T7 (Card/interaction consistency), T8 (focus/dialog a11y), T9 (loading/error/toast), T12 (motion). Establishes the "intentional design" foundation.
3. **Phase 2 — Workflow + deliverable redesign:** T4 (edit + bulk actions), T5 (next-action leads), T6 (progressive disclosure + lane model), T10 (executive-grade deliverables), T11 (actionable guard). This is where "power-user-first, guided workflows" and client-grade output land.

**Guardrail:** keep server actions, synthesis, provenance, and audit gates intact — this is a surface/interaction redesign over a working, client-safe engine (see memory `advisoryops-human-review-by-design`).
