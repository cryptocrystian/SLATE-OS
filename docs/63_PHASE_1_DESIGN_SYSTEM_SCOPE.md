# docs/63 — Phase 1: Design System Pass (Scope)

> **Type:** Implementation scope / plan lock for the second phase of the UI/UX redesign.
> **Date:** 2026-08-11 · **Branch:** `persistence/step-0-1-auth-shell`
> **Basis:** `docs/62_UI_UX_AUDIT_INVENTORY.md` (themes T3, T7, T8, T9, T12). Phase 0 (T1 + T2, scaffolding + dead chrome) shipped in commits `f742d50` + `ad93e2f`.
> **Guardrail:** Presentation + interaction only. Server actions, synthesis, provenance, and audit gates are **not** touched. Human-review approval gates stay by design (see `docs/02`).

---

## 1. Goal

Turn SLATE's sound-but-underused token layer into an **intentional, enforced design system**, so Phase 2 (workflow + deliverable redesign) builds on primitives instead of ad-hoc styling. The foundation is already good — the surface is unconsidered. Phase 1 fixes the surface systemically.

**What's already good (preserve):** structured CSS-var color tokens (layered dark, never flat black), Inter + JetBrains Mono fonts, `card`/`elevated` shadows, `fade-up`/`pulse-soft` keyframes, semantic status colors, above-average AI-provenance surfacing.

---

## 2. Locked decisions

| Decision | Choice | Implication |
|---|---|---|
| **Typography direction (T3)** | **Sans hierarchy.** Fonts stay (Inter/JetBrains). Replace mono-uppercase eyebrows with a refined sans `SectionHeader`; reserve **mono strictly for IDs, scores, metadata**. | Defines the whole "premium vs console" feel. Largest migration surface. |
| **Scope boundary** | **Operator app only.** Build the system + migrate internal operator screens (shell + pipeline). | Client-facing `/r` `/p` + PDF document redesign (cover, letterhead, tiered options) is **deferred to Phase 2 / T10**. W1 fixes operator-app typography, not the client documents. |
| **Motion (T12)** | **CSS-first.** Tailwind keyframes/tokens for reveals, hover, feedback; `framer-motion` only for the few genuinely complex cases. | Lean bundle, matches the canon's "restrained motion" rule. |

---

## 3. Workstreams

### W1 — Typography system (T3) · effort L · risk low
**Objective:** eliminate the mono-uppercase "console" voice (~123 uses across 43 files).
**Build:**
- `components/ui/section-header.tsx` — sans, weighted title + optional description; the default section-heading primitive.
- `components/ui/eyebrow.tsx` — refined sans small-caps eyebrow for the few places a section-context label truly helps (muted, tight tracking — NOT mono-uppercase).
- `components/ui/label.tsx` (or extend existing) — consistent field/label treatment.
- Documented type scale (sizes/weights/line-heights) in `docs/04`-aligned tokens or a comment block.
**Migrate:** replace `font-mono uppercase tracking-[…] text-text-muted` headers across the 43 files with `SectionHeader`/`Eyebrow`. Keep mono ONLY for: UUIDs/short-ids, numeric scores, timestamps/metadata, kbd hints.
**Acceptance:** mono-uppercase *header* pattern count → near-zero (mono remains only on genuine IDs/scores). Every page header and card eyebrow uses the new primitives.

### W2 — Surface & interaction consistency (T7) · effort M · risk low
**Objective:** consistent, real depth; one interaction model.
**Build/adopt:** route the **19 components that hand-roll** `hover:bg-bg-elevated/{50,60,80,85}` onto `Card variant="interactive"` (already defined, currently unused). Standardize when to use `base` vs `elevated`. Replace raw `bg-white/[0.0x]` alphas (Badge neutral, MetricCard, StageTracker) with border/surface tokens.
**Acceptance:** `Card variant="interactive"` adoption > 0 and used by all clickable card rows; zero raw `bg-white/[0.0x]` in components; one hover model app-wide.

### W3 — Focus & dialog accessibility (T8) · effort M · risk medium (behavioral)
**Objective:** keyboard-grade the app.
**Build:**
- Branded `:focus-visible` ring on the `Button` primitive; fix the `Input` double-indicator (global outline + its own ring); consistent focus token across primitives.
- `components/ui/dialog.tsx` — focus-trap, Escape-to-close, initial focus, focus restore, scroll-lock, `role="dialog"`/`aria-modal`. Migrate the **2 consumers**: `send-to-client-confirm-modal.tsx` and the app-shell mobile drawer.
- Fix opportunity matrix invalid `role="grid"` → `role="group"` (or proper row/cell); add roving-tabindex + arrow keys to the filter tablists (leads, engagements, findings, opportunities).
- Consolidate the two locked-affordance implementations onto `LockedActionButton`.
**Acceptance:** every interactive element shows a visible focus ring; both dialogs trap focus + close on Esc/backdrop; no invalid ARIA roles; tablists keyboard-navigable.

### W4 — Feedback & state layer (T9) · effort M · risk low (additive)
**Objective:** perceived quality + real failure UX.
**Build:**
- Toast/notification provider (mounted in `app/app/layout.tsx`) for action feedback (approve/reject/mint success + error).
- Route-level `loading.tsx` (skeletons) + `error.tsx` (error boundaries) for the app shell and the engagement pipeline route dirs.
- Standardize the inline pending/success/error pattern used by client forms.
**Acceptance:** ≥1 `loading.tsx` + `error.tsx` per major route group; toasts fire on the primary server-action outcomes; query errors surface (not swallowed to console as empty).

### W5 — Motion (T12) · effort S · risk low
**Objective:** restrained, systemic motion — wired into primitives, not per-screen.
**Build:** global `prefers-reduced-motion` handling in `styles/globals.css`; use existing `fade-up`/`pulse-soft` + add a small reveal/hover/approval-feedback set; wire hover-elevation into `Card interactive` and reveal into `SectionHeader`/list items. `framer-motion` reserved for complex cases only.
**Acceptance:** `prefers-reduced-motion` respected globally; motion comes from the primitives; no janky/heavy effects.

---

## 4. Sequencing

**1a — Build the system (once, low-risk, do first):** Button focus ring · `Card interactive` conventions · `SectionHeader`/`Eyebrow`/`Label` · `Dialog` · toast provider · reduced-motion + motion tokens · `loading.tsx`/`error.tsx` templates.

**1b — Migrate onto it (mechanical, parallelizable):** the 43-file typography sweep · 19 hover→`Card interactive` · 2 dialog migrations · matrix/tablist a11y fixes · per-route loading/error. Good multi-agent fan-out candidate (independent files, clear before/after).

---

## 5. Out of scope (deferred)

- **Client-facing document redesign** (report/proposal `/r` `/p` + PDF candidate: cover, letterhead, tiered option comparison, recommended-tier emphasis) → **Phase 2 / T10**.
- **Workflow completeness** (Edit + Regenerate on action bars, bulk approve/reject, next-action-leads, intake lane model) → **Phase 2 / T4–T6**.
- **Guard legibility** (plain-language commercial-guard violations) → **Phase 2 / T11**.
- Any server action / synthesis / schema change.

---

## 6. Definition of done (measurable — re-run the docs/62 §2 scan)

| Metric | Phase 0 baseline | Phase 1 target |
|---|---|---|
| `font-mono uppercase tracking` header uses | ~123 / 43 files | mono only on IDs/scores/metadata (headers → 0) |
| `Card variant="interactive"` adoption | 0 | all clickable card rows |
| Raw `bg-white/[0.0x]` alphas | present | 0 in components |
| `focus-visible` coverage | 13 / 195 files | all interactive elements (via primitives) |
| Dialogs with focus-trap/Esc | 0 | 2 / 2 |
| Route `loading.tsx` / `error.tsx` | 0 | ≥1 per major route group |
| Toast/feedback system | 0 | present, wired to primary actions |
| `prefers-reduced-motion` handling | 0 | global |

Plus: lint clean, production build clean, send-to-client disclaimer guard clean; a live screenshot pass (per `docs/11`) against 1440/1024/390 once the app is runnable authenticated.

---

## 7. Execution model

Build 1a inline (small, foundational, sequential). Run 1b as a fan-out — independent files, mechanical transforms, each verifiable against the new primitives. Commit 1a and 1b separately so the "new primitives" diff stays reviewable apart from the mass migration.
