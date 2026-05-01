
---

## `docs/11_VISUAL_UX_AUDIT_PROTOCOL.md`

```md
# SLATE Visual UX Audit Protocol

This protocol is used after each UI sprint to validate that SLATE remains aligned with its product and design canon.

## Purpose

SLATE is not just an internal tool. It is also a proof point of Saipien Labs’ design and development capabilities.

The UI must feel premium, product-grade, and visually aligned with the Saipien Labs website.

This protocol helps prevent visual drift.

---

# Required Viewports

Capture screenshots at:

- Desktop: 1440px wide
- Small desktop/tablet: 1024px wide
- Mobile: 390px wide

Use full-page screenshots where possible.

---

# Required States

For each implemented route, capture:

1. Default populated state
2. Empty state, if available
3. Loading state, if available
4. Error state, if available
5. Key hover/active state, if relevant
6. Drawer/modal state, if relevant

---

# Sprint 1 Required Screens

For Sprint 1, inspect:

- `/app`
- App shell
- Sidebar navigation
- Top bar
- Dashboard cards
- Review queue
- Active engagements panel
- Empty state components
- Mobile responsive layout

---

# General Visual Audit Checklist

## Brand Alignment

- Does the UI feel like SLATE?
- Does it visually align with the Saipien Labs website direction?
- Does it feel premium and technical?
- Does it avoid generic SaaS/admin template patterns?

## Dark Mode Quality

- Is the background rich and dimensional, not flat black?
- Are surfaces clearly layered?
- Are borders subtle but visible?
- Is text contrast strong enough?
- Are accent colors restrained?

## Layout and Hierarchy

- Is the main action clear?
- Is the page title clear?
- Is the content hierarchy obvious?
- Are sections grouped logically?
- Is there enough spacing?
- Does the layout avoid clutter?

## Component Quality

- Do cards feel polished?
- Are badges/chips consistent?
- Are buttons clear and well-styled?
- Are empty states useful?
- Are tables/lists readable?
- Do panels feel intentionally designed?

## Interaction Quality

- Are hover states subtle and premium?
- Are active states clear?
- Are transitions restrained?
- Does the UI feel responsive?
- Is motion purposeful rather than decorative?

## Content and Microcopy

- Is the copy human and clear?
- Does it avoid generic AI hype?
- Are labels useful?
- Are empty states action-oriented?
- Are recommendations specific?

## Responsive Behavior

- Does the UI work at 1440px?
- Does the UI work at 1024px?
- Does the UI work at 390px?
- Is navigation usable on mobile?
- Do cards/tables collapse gracefully?
- Is text still readable?

## Accessibility Basics

- Is text contrast acceptable?
- Are clickable elements large enough?
- Is focus state visible?
- Is semantic structure reasonable?
- Are icons supported by labels where needed?

---

# Canon Drift Checks

Flag any issue where the implementation:

- Looks like a generic admin dashboard
- Uses light-mode-first styling
- Overuses gradients or glows
- Uses cliché AI visuals
- Makes AI feel magical instead of practical
- Hides primary actions
- Uses unclear labels
- Overcrowds screens
- Adds modules outside MVP scope
- Introduces BuildOps/StudioOps prematurely
- Produces final AI outputs without review states

---

# Audit Scoring

Use this scoring rubric:

## 5 — Excellent

Fully aligned with canon. Premium, clear, polished, and usable.

## 4 — Good

Mostly aligned. Minor refinements needed.

## 3 — Acceptable

Functional, but visual quality or hierarchy needs improvement.

## 2 — Weak

Noticeable drift from canon. Requires redesign or significant cleanup.

## 1 — Unacceptable

Generic, confusing, off-brand, or not usable.

---

# Required Audit Output

Use this format:

```md
# SLATE Visual UX Audit

## Route / Screen
...

## Viewports Reviewed
- 1440px
- 1024px
- 390px

## Overall Score
...

## Summary
...

## What Works
...

## Issues Found
...

## Canon Drift
...

## Responsive Issues
...

## Accessibility Issues
...

## Priority Fixes
1. ...
2. ...
3. ...

## Screenshots
Attach or link screenshots.

## Recommendation
Approve / Approve with fixes / Rework required
