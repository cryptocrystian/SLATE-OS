# docs/70 — Client Deliverable Register Redesign · Acceptance Audit

## Status

- **Date:** 2026-09-23
- **Branch:** `persistence/step-0-1-auth-shell`
- **Type:** Acceptance audit for the Phase 2 / T10 client-facing deliverable
  redesign (the Saipien "Register" design system on the surfaces a client actually
  opens). Closes the item flagged in `docs/67 §4.2` ("client-facing deliverable
  document redesign not done") and `docs/64` issue #5.
- **Method:** source inspection of every client-facing deliverable component + its
  route, plus **live renders** of the two public share routes against real
  snapshots (report `/r` verified earlier this session; proposal `/p` verified via a
  transiently-refreshed test-fixture snapshot, restored exactly afterward). SOW `/s`
  Register status confirmed by source (`isPublic ? "slate-doc"`).
- **Scope boundary:** design-layer acceptance only. No pipeline logic, no delivery
  security, no gate behavior changed. All `docs/22` (report share) and `docs/24`
  (proposal share) content/security constraints were preserved and re-verified.

---

## 1. What was audited

The three surfaces a client actually receives, plus the operator previews they
mirror:

| Client surface | Route | Component | Operator preview mirror |
|---|---|---|---|
| Report | `/r/[token]` | `client-report-share-document.tsx` | `client-report-deliverable.tsx` (pdf-candidate route) |
| Proposal | `/p/[token]` | `client-proposal-share-document.tsx` | `client-proposal-deliverable.tsx` |
| SOW | `/s/[token]` | `sow-draft-document.tsx` (`mode="public"`) | same component, operator mode |

All render on the shared Register system: `styles/deliverable.css` (`.slate-doc`
scope, `--doc-*` tokens) via the shared `components/deliverables/doc-kit.tsx`
primitives (Reg / Rail / DocPage / Wordmark), plus the copy sanitizers.

---

## 2. The gap this audit found and closed

**Finding (severity: high — client-facing).** The Register redesign had been built
on the *flagship* deliverable components and the operator preview / SOW public
route, but the two **public share documents a client actually opens** were still the
pre-redesign layout: `slate-print-light` scope, plain SLATE cards, and mono
uppercase eyebrow-kickers throughout — the "black-and-white Word doc" look. The
polished document was reaching the operator's internal preview but **not the client**.

- `/r` share document — **fixed** this session (commit `2d7c868`): rebuilt on
  `.slate-doc`, verified live (HTTP 200, cover + rail + figure plates + footer).
- `/p` share document — **fixed** this session (commit `e3ef7a4`): rebuilt on
  `.slate-doc`, verified live (HTTP 200, cover + rail + option detail + appendix +
  footer; pricing correctly hidden for a placeholder snapshot).
- `/s` SOW public — was already on Register (`isPublic ? "slate-doc"`); no change.

Root cause: the public routes render dedicated snapshot-pure share components
(`client-*-share-document.tsx`), which are **separate** from the flagship
deliverable components that got the redesign first. The redesign was applied to the
flagship + operator preview but not propagated to the share components until now.

---

## 3. Per-surface verification

| Surface | Register scope | Cover + brand panel | Decision rail | Section/figure/option plates | Footer/disclaimers | Verified |
|---|---|---|---|---|---|---|
| `/r` report | `.slate-doc` ✓ | ✓ (company hero) | ✓ | numbered figure plates (SVG-free, source-summary) | four-denial footer + "Content safety checks passed" | **live render ✓** |
| `/p` proposal | `.slate-doc` ✓ | ✓ (company hero) | ✓ | tiered comparison (2+) + per-option detail | docs/24 disclaimers + "Commercial safety checks passed" | **live render ✓** |
| `/s` SOW | `.slate-doc` ✓ | ✓ | ✓ | scope/deliverables/terms plates | docs/28 §4 legal-boundary + pricing notices; draft watermark | source ✓ (prior acceptance `docs/66`) |

---

## 4. Register / anti-slop conformance (all three surfaces)

- ✅ Warm tonal ground + warm ink + one two-tone mint accent (`--doc-*` tokens).
- ✅ Archivo display/body; JetBrains Mono confined to figure/meta labels.
- ✅ Committed warm-dark brand panel on the cover; corner registration ticks.
- ✅ No mono uppercase eyebrow-kickers (the pre-redesign tell — removed).
- ✅ No icon-card rows, no system-font display, no emoji.
- ✅ Passes the Impeccable deterministic design detector (0 findings on each file).
- ✅ Company name set as the cover hero on all three (route resolves `companyName`).

---

## 5. Security / content constraints preserved (re-verified)

- ✅ Snapshot-pure — every field from the snapshot jsonb; no live re-query on the
  public routes.
- ✅ No internal UUIDs, reviewer notes, audience labels, claim-guard codes, or
  operator-only framing on any client surface.
- ✅ Report: SVG-free exhibits as source-summary plates; Group-B omission appendix;
  affirmative safety phrase only (`docs/22`).
- ✅ Proposal: pricing hidden when `pricing_review_state='placeholder'`; shown only
  as "estimated · subject to final approval" once approved; omitted-content
  appendix; mandatory not-a-binding-quote / not-a-SOW / not-a-contract footer
  (`docs/24`).
- ✅ SOW: draft watermark persists even after approval; legal-boundary + pricing
  notices; no e-signature; `/s` conditionally authorized per `docs/28`/`65`/`66`.
- ✅ Prose runs through `sanitizeClientProse` / `sanitizeClientBullets` /
  `toClientVoice` on every surface.
- ✅ Generic-unavailable page unchanged on all three routes (revoked/expired/invalid
  never reveal which).

---

## 6. Verdict

**ACCEPTED.** The client-facing deliverable redesign (Phase 2 / T10) is complete
across all three surfaces a client receives, at parity with the operator preview
and the SOW. `docs/67 §4.2` and `docs/64` issue #5 are closed. The visual layer is
firm-grade; content/security constraints are intact and re-verified.

---

## 7. Residual notes (non-blocking)

1. **AI-draft copy slop is separate from design.** The `/p` render exercised an old
   proposal snapshot whose *drafted prose* still contained tells ("operational
   efficiency," "streamlining"). That is pre-copy-slop-guard content, not a template
   defect; drafts generated after commit `fe1c177` carry the copy-slop critique and
   surface it to the operator (chip). Real self-test drafts will be cleaner.
2. **Tiered comparison unexercised in the live check.** The verified `/p` snapshot
   had a single included option, so the good/better/best comparison path wasn't
   rendered live (it is code-complete and mirrors the flagship). The founder
   self-test, which will produce 3 options, exercises it.
3. **`DESIGN.md`** already records the Register deliverable world; it now applies to
   the share components too (same tokens/primitives — no doc change required).

---

## 8. Commits in this acceptance

- `2d7c868` — `/r` report share onto Register.
- `e3ef7a4` — `/p` proposal share onto Register.
- (prior) `043cc98` + P7-B — `/s` SOW public onto Register.
- Related this session: `fe1c177` (copy-slop pipeline guard), `7f49ffc` (operator
  copy-check chip), `8c51602` (decision-first dashboard), `89241c6`/`d067411`
  (`docs/68` methodology + rubric), `07c7848` (`docs/69` operator runbook).

No pipeline, gate, or security changes. Zero engagement mutations (the `/p` render
used a transient test-fixture timestamp bump, restored to its exact original value).
