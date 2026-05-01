# SLATE Visual UX Audit Protocol

This protocol defines how every SLATE sprint that ships UI is reviewed for visual quality, canon alignment, and responsive behavior. Run it at the end of each UI sprint before declaring the sprint complete.

---

## When to Run

- At the end of every sprint that ships or modifies user-facing UI.
- Before opening a pull request that materially changes layout, components, or design tokens.
- Whenever a design token, theme value, or layout primitive is introduced or modified.

Skip only when the sprint is purely backend, tooling, or docs.

---

## Required Reading Before Auditing

The auditor must read the following before opening the app:

1. `README.md`
2. `docs/04_SLATE_UX_UI_CANON.md` — visual canon
3. `docs/05_SLATE_IMPLEMENTATION_ARTIFACTS.md` — screen/component inventory
4. `docs/06_SLATE_BUILD_PLAN.md` — sprint scope and acceptance criteria
5. `docs/08_CURRENT_STATUS.md` — current implementation state
6. `docs/09_DECISION_LOG.md` — accepted decisions and tradeoffs
7. `docs/10_SESSION_HANDOFF.md` — design system cheat sheet and conventions
8. The sprint's own scope/acceptance criteria

The canon is the source of truth. Do not invent rules during the audit.

---

## Viewports

Capture each in-scope screen at all three:

| Viewport | Width × Height | Purpose |
| --- | --- | --- |
| Desktop | 1440 × 900 | Primary internal workstation experience |
| Tablet / small desktop | 1024 × 800 | Sidebar persistence boundary, dense reading |
| Mobile | 390 × 844 | Touch ergonomics, drawer behavior, fold readability |

For each viewport capture:

- Above-the-fold (viewport-only)
- Full page (scrolled)
- Any interactive state that materially affects layout (mobile drawer open, modal/drawer open, hover/active where relevant, empty states)

Use `scripts/capture-screenshots.cjs` (Chromium via Playwright at 2× DPR, `prefers-color-scheme: dark`). Save to `docs/screenshots/sprint-<n>/` with these filenames:

```
<viewport>-<width>-fold.png
<viewport>-<width>-full.png
<viewport>-<width>-<state>.png   e.g. 390-mobile-drawer.png
header-<width>.png               focused crops when needed
```

---

## Evaluation Rubric

Score each axis 1–5. The overall score is the simple average; round to one decimal.

### 1. Premium Feel

- Layered dark surfaces — never flat black
- Restrained accent use
- Typography hierarchy is clear (sans for UI, mono for scores/IDs/eyebrows)
- Borders are subtle; shadows are restrained
- No SaaS-template aesthetic, no bright gradients, no chatbot mascots

### 2. Canon Alignment

- Tokens, components, and copy match `docs/04_SLATE_UX_UI_CANON.md`
- Information architecture matches `docs/03_SLATE_INFORMATION_ARCHITECTURE.md`
- AI-generated content is clearly labeled (`Generated`, `Suggested by AI`, `Needs Human Review`)
- Confidence and evidence are surfaced where the canon requires
- Free scorecard never produces full roadmap, architecture, or SOW

### 3. Hierarchy & Clarity

- Primary action on every screen is unambiguous
- Page header reads cleanly: eyebrow / title / supporting copy / actions
- Cards, badges, and panels use consistent spacing and elevation
- Status and priority are communicated by more than color alone

### 4. Information Density

- Useful at first glance — a calm command center, not a wall of widgets
- Empty states guide the next action and use canon-aligned microcopy
- Long lists have a clear hierarchy of importance

### 5. Responsive Behavior

- 1440: desktop premium baseline
- 1024: persistent sidebar holds; multi-column layouts degrade gracefully
- 390: navigation collapses to drawer; primary CTAs remain visible; nothing is clipped off-screen

### 6. Accessibility Basics

- `:focus-visible` rings present and on-brand
- Icon-only controls have `aria-label`
- Active state uses color + a non-color cue (rail, weight, icon)
- Color contrast: body text ≥ 4.5:1, large/UI text ≥ 3:1
- Locked or disabled affordances are programmatically marked, not just visually dim

### 7. Microcopy

- Specific, human, calm — no generic AI hype
- Allowed: "Recommended next step," "Needs review," "Evidence available," "Likely opportunity," "Validate before implementation," "Ready for consultant review"
- Forbidden: "Unlock the power of AI," "Revolutionize," "Supercharge," "AI magic," "Next-gen transformation"

---

## Anti-Patterns (Automatic Score Reduction)

Any of the following knocks the relevant axis down by at least one point:

- Flat black background or admin-template chrome
- Light-mode default styling
- Chatbot mascot, sparkle spam, or cliché AI imagery
- Tables everywhere instead of focused workspaces
- Placeholder-looking UI in shipped sprints
- AI-generated content presented as final without a review affordance
- Free scorecard producing full roadmap, architecture, or SOW
- Premature BuildOps / StudioOps / ClientOps surfaces
- New design patterns introduced outside the design system

---

## Required Inspection Checklist

Walk every in-scope screen against this list:

**App shell**
- [ ] Sidebar renders correctly at ≥1024
- [ ] Mobile drawer opens, traps focus appropriately, closes on backdrop click and ESC
- [ ] TopBar shows page context; command-menu placeholder; review-queue indicator; notifications
- [ ] Active nav state uses color + rail (or equivalent non-color cue)
- [ ] Locked / future routes are non-interactive

**Page header**
- [ ] Eyebrow / title / description / actions / meta render cleanly at all viewports
- [ ] Primary CTA outranks secondary visually
- [ ] Action buttons never clip off-screen on mobile

**Content panels**
- [ ] Cards use consistent variants (base / elevated / interactive)
- [ ] Badges use the canon tones; status uses dot + label
- [ ] Empty states present with canon-aligned copy

**AI surfaces**
- [ ] Every AI-authored item is labeled (badge or actor)
- [ ] Approve / edit / reject / regenerate available where the canon requires
- [ ] Confidence and evidence surfaced

**Responsive**
- [ ] No horizontal scroll at 1440 / 1024 / 390
- [ ] Touch targets ≥ 36 px on mobile
- [ ] Mobile fold shows the title plus at least one piece of dashboard data

**Accessibility**
- [ ] Focus ring visible on every interactive element
- [ ] Icon-only buttons labeled
- [ ] Color contrast spot-checked on muted text

---

## Report Template

Audits are returned in this exact structure (also used to grade Sprint 1):

```md
# SLATE Sprint <n> Visual UX Audit

## Viewports Reviewed
- 1440 desktop
- 1024 tablet
- 390 mobile

## Overall Score
<x.x / 5>

## Summary
…

## What Works
…

## Issues Found
1. [High|Med|Low] …

## Canon Drift
…

## Responsive Issues
…

## Accessibility Issues
…

## Priority Fixes
1. …

## Screenshots
Paths under `docs/screenshots/sprint-<n>/`

## Recommendation
Approve | Approve with fixes | Rework required
```

Severity guide:

- **High** — blocks sprint sign-off; fix before next sprint
- **Med** — fix in the next polish window or alongside the next sprint
- **Low** — track in the decision log; fix opportunistically

---

## Workflow

1. Pull the latest commit on the sprint branch.
2. `npm install && npm run build` — no compile errors allowed at audit time.
3. `npm run dev`, then `node scripts/capture-screenshots.cjs` (or equivalent) for the in-scope screens.
4. Walk the inspection checklist with each screenshot.
5. Score each axis. Write the report from the template above.
6. Commit the screenshots to `docs/screenshots/sprint-<n>/` with the report referenced from `docs/08_CURRENT_STATUS.md`.
7. If the recommendation is "Approve with fixes," create a polish patch before starting the next sprint.

---

## Ownership

- Visual audit is owned by whoever closes the sprint. Self-audit is acceptable but a second-pass review is preferred for any sprint touching the design system.
- All audits and the artifacts they reference live in-repo. They are part of the project canon.
