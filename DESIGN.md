# DESIGN.md — SLATE Client Deliverables

> Durable visual decisions for the **client-facing deliverables** (report,
> proposal, SOW) and their `/r` `/p` `/s` share renders. The operator app
> (dark) has its own world; this file records the **light executive
> deliverable** world.
>
> **Source of truth:** the Saipien **"Register" v1.0** design system
> (`Saipien Design System.pdf`). This file records how Register is applied
> in code; where they differ, Register wins. Everything here lives under the
> `.slate-doc` scope in `styles/deliverable.css`, driven by `--doc-*` tokens
> so the brand skin is swappable.

## World

A light, warm-tonal executive **plate document** — "The Opportunity Brief."
A decision-journey structure: a committed warm-dark brand panel + contents
rail on the cover, then section pages in a consistent grammar, with data
exhibits presented as numbered figure plates. Restrained typographically,
confident in brand presence. Flat and matte — never glow, gradient, or halo.

Mode: **Read / executive** (a CFO/COO/CEO deciding on an AI-transformation
investment). Print/PDF-first; the on-screen `/r` `/p` `/s` renders are the
same artifact, responsive.

## Color (Register)

Warm-tonal ground, ONE two-tone mint accent. Tokens on `.slate-doc`:

| Token | Value | Role |
|---|---|---|
| `--doc-paper` | `#EFEDE7` | primary page ground |
| `--doc-paper-2` / `--doc-plate` | `#E7E4DB` | raised panels / exhibit plates |
| `--doc-ink` | `#17150F` | headings, body (13.7:1) |
| `--doc-ink-2` | `#57534A` | secondary text (6.2:1, warm) |
| `--doc-ink-3` | `#8A8477` | muted / mono labels |
| `--doc-rule` / `--doc-rule-2` | ink @ 14% / 26% | hairline seams |
| `--doc-accent` | `#1FBE85` | mint line — marks & strokes on light |
| `--doc-accent-text` | `#0B5A3E` | green — accent TEXT on light (AA) |
| `--doc-accent-bright` | `#A2FDCB` | mint — fills, on dark |
| `--doc-mint-ink` | `#06231A` | text on a mint fill |
| `--doc-dark` | `#131210` | committed brand panel / product surface |
| status | `#0E8A5C` / `#B47C21` / `#B24528` | good / warning / risk — never the accent |

**Accent discipline:** mint fills only on dark; mint-line for marks/rules on
light; green for accent *text* on light. Status colors are a separate
functional set, never reused as the accent, never gradient.

**Chart bridge:** `.slate-doc` re-maps the app `--color-*` tokens to this
palette so shared SLATE chart primitives render on-brand. The evidence scale
(strong/adequate/thin) maps to `success #0E8A5C` / `info→mint #1FBE85` /
`warning #B47C21` — validated distinguishable (normal ΔE 15.3, CVD 11.1) via
the dataviz palette check; the bright-mint low-contrast case is relieved by
numbered bubbles + legend labels.

## Type (Register)

- **Archivo** — display + reading voice. `--doc-sans: var(--font-archivo)`.
  Loaded self-hosted via `next/font` in `app/layout.tsx`. Display 800/700 at
  tight tracking (H1 -0.035em); body 400 at ~1.6, 68ch measure.
- **JetBrains Mono** — labels, figure numbers, metadata, measurement ONLY
  (mono as instrument, never costume). `--doc-mono: var(--font-mono)`.

## Components (`styles/deliverable.css` + `components/deliverables/doc-kit.tsx`)

- **Page** (`.doc-page`) — flat canvas, 56/60 padding, corner registration
  ticks (`.doc-reg`). No shadow (flat/matte).
- **Wordmark** — the Register typographic lockup: "Saipien" (Archivo 700) + a
  mint period. `--light` variant reverses to paper + bright mint on the dark
  panel. Placeholder for the final logo asset; swaps via the same slot.
- **Brand panel + rail** (`.doc-cover .doc-rail`) — on the cover the rail is a
  committed warm-dark panel bleeding to the page edges, carrying the wordmark,
  a mint document-id label, the contents (reversed), and a confidential foot.
  On content pages the rail is the light contents list with a mint-green
  active item.
- **Section head** (`.doc-sec-head`) — Archivo title led by a small mint tick;
  optional mono category note (dropped when it duplicates the title). No
  eyebrow-kicker above headings (Register ban).
- **Lede / body** — `.doc-lede` (Archivo 600, mint-green emphasis), `.doc-body`
  (68ch measure).
- **Exhibit plate** (`.doc-plate`) — warm plate, 12px radius, hairline; mono
  "Figure NN" in green, Archivo title, caption, optional mint "so what."
- **At-a-glance band** (`.doc-glance`), **tiered comparison** (`.doc-tiers` —
  good/better/best with a mint-tinted recommended tier), **gantt / maturity**
  primitives — all on the tokens above.
- **Footer** (`.doc-footer`) — non-binding disclaimer; canon-verbatim on the
  public SOW (docs/28 §4).

## Anti-slop (enforced)

No glow/gradient/halo. No eyebrow-kickers above headings. No rows of
identical icon-cards as page structure. No system font as display voice
(Archivo self-hosted). Mono only for data/labels/measurement. Headings carry
themselves. Client-safe: no operator metadata/UUIDs/scan text, and operator
pricing phrasing ("placeholder / for internal planning only") is stripped
before the client sees it.

## Responsive

Print/desktop use the two-column spread; below 720px the rail collapses to a
top strip and grids stack. Content is largely single-column so it reflows
cleanly.

## Open / follow-ups

- Final logo asset replaces the typographic wordmark (same slot).
- SOW public render currently gets a lighter Register skin (`.slate-doc`
  wrapper + Archivo); full cover/rail parity with report/proposal is a
  follow-up.
- Deeper per-exhibit dataviz art-direction beyond palette (optional).
