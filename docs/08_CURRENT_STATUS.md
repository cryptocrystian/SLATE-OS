# SLATE Current Status

_Last updated: 2026-05-01 — End of Sprint 7 (MVP complete)_

## Sprint State

| Sprint | Title | Status |
| --- | --- | --- |
| 1 | Visual Foundation + App Shell | ✅ Complete (audit 4.4/5, polish patch applied) |
| 2 | Public Scorecard Flow | ✅ Complete (audit 4.7/5, fixes folded into Sprint 3) |
| 3 | Lead Dashboard + Qualification | ✅ Complete |
| 4 | Engagement Workspace | ✅ Complete (audit 4.8/5, fixes folded into Sprint 5) |
| 5 | Intake + Findings Review | ✅ Complete (audit 4.7/5, fixes folded into Sprint 6) |
| 6 | Opportunity Matrix + Roadmap | ✅ Complete (audit 4.8/5, fixes folded into Sprint 7) |
| 7 | Report + Proposal Builder | ✅ Complete |

The GrowthOps + AdvisoryOps MVP arc is now feature-complete. Next planned: **MVP Stabilization + End-to-End Polish**.

## Stack

- Next.js 14.2.x (App Router) — patched for security advisory
- React 18, TypeScript (strict)
- Tailwind CSS v3 with CSS variable–driven design tokens
- `lucide-react`, `clsx` + `tailwind-merge`
- Inter (sans) and JetBrains Mono (mono) via `next/font`
- No backend, no auth, no database, no AI integration — mock data only

## Implemented (Sprint 7 additions)

- `/app/engagements/[id]/report` — AI Opportunity Sprint report builder
  - PageHeader with eyebrow `AdvisoryOps · Report`, primary `Open Proposal Builder` (when ≥50% of sections approved/final), secondary `Back to engagement`, tertiary `Export Report` (locked mock)
  - 6 summary metrics (Sections / Needs Review / Approved / Evidence Links / Roadmap Items / Export Status)
  - `ReportWorkspace` (client) — three-pane: outline (filter tabs + numbered ordered list with status chips) / selected section preview (AI-drafted badge, confidence chip, summary, draft preview, linked-counts, optional reviewer note, optional needs-evidence warning, mock review action bar) / linked-context panel (typed back-references to findings, opportunities, and roadmap items, each with deep links)
  - Right rail: Recommended Action card (uses helper, supports `selfReference`), Engagement context, Recommended-next-step + consultant-notes panel
  - Empty state for engagements without report data: "Approve findings and score opportunities before report assembly begins" with deep links to findings + opportunities
- `/app/engagements/[id]/proposal` — Proposal & SOW option builder
  - PageHeader with eyebrow `AdvisoryOps · Proposal`, primary locked `Prepare Client Review`, secondary `Back to Report`
  - 6 summary metrics (Options / Recommended / Quick Wins Included / Strategic Builds / Dependencies / Implementation Credit)
  - `ProposalWorkspace` (client) — three side-by-side `ProposalOptionCard`s with `Recommended` badge + brand-tinted ring on the recommended option, plus a full `ProposalOptionDetail` below: scope summary, timeline, deliverables, included opportunities, linked roadmap items, dependencies, assumptions, risks, prominent pricing-placeholder block, two locked SOW actions (`Prepare SOW Draft`, `Send to Client`)
  - Right rail: Recommended Action card (helper-routed), `ImplementationCreditPanel` with eligible/not-eligible badge and explicit "commercial planning lever, not an automatic discount" copy, report-readiness card, commercial-assumptions card, engagement context
  - Empty state for engagements without proposal data: "Build the report and roadmap before proposal options are assembled" with deep link to report builder

## Sprint 6 Audit Fixes (folded in)

- **Matrix axis accessibility.** `OpportunityMatrix` grid container now sets `role="grid"` + `aria-describedby="opportunity-matrix-axis-x opportunity-matrix-axis-y"` pointing at the visible legend strips. The legends carry stable IDs.
- **Locked CTA primitive consistency.** New `components/ui/locked-action-button.tsx` (`LockedActionButton`) provides one place for every locked-CTA pattern. Reused on the roadmap header `Prepare Report` button (now locked or unlocked depending on roadmap presence), the report header `Export Report` button, the proposal header `Prepare Client Review`, and the in-detail `Prepare SOW Draft` / `Send to Client` actions.
- **Roadmap linked-opportunity titles.** `RoadmapCard` now accepts an `opportunityTitles` map and surfaces the actual linked-opportunity title inside the chip (e.g. `→ AI-drafted handoff briefs`). The roadmap page builds the lookup once and threads it through the phase columns.

## Recommended-Action Helper

`lib/engagements/recommended-action.ts` now resolves stages → routes for the full lifecycle:

- `setup`, `intake` → `/intake`
- `synthesis` → `/findings`
- `scoring` → `/opportunities`
- `report` → `/report`
- `proposal` → `/proposal`

With `currentPath`, the helper returns `selfReference: true` so the recommended-action card renders as `Current workspace · You are here` instead of looping. Used by all seven engagement-related pages (detail, intake, findings, opportunities, roadmap, report, proposal).

## Verified

- `npm run lint` — clean
- `npm run build` — clean. **51 routes prerender as static**: 5 engagement detail pages × 7 sub-routes (detail, intake, findings, opportunities, roadmap, report, proposal) plus leads (6), scorecard (3), apply, landing routes
- Sprint 7 screenshots captured at 1440 / 1024 / 390 to `docs/screenshots/sprint-7/` for: Quanta + Caldera report and proposal (mature), Helio + Meridian + Atlas report (empty/early), Helio proposal (empty/early), the Quanta engagement detail (Report panel CTA wired), and the Quanta roadmap (Prepare Report CTA wired).

## Lifecycle End-to-End

A Saipien Labs strategist can now follow the full advisory motion inside SLATE:

1. **Public scorecard** (`/scorecard*`) — directional diagnostic
2. **Lead inbox** (`/app/leads*`) — qualification with internal-only Saipien Fit Score
3. **Engagement command center** (`/app/engagements/[id]`) — stage tracker + six panels
4. **Stakeholder intake** (`/intake`) — role coverage, response quality, supporting inputs
5. **Findings review** (`/findings`) — AI-drafted findings with evidence panels and review action bar
6. **Opportunity matrix** (`/opportunities`) — Quick Wins / Strategic Builds / Low Priority / Defer · Avoid
7. **30/60/90 roadmap** (`/roadmap`) — phase columns with linked-opportunity titles
8. **Report builder** (`/report`) — 12-section assembly with linked findings/opportunities/roadmap
9. **Proposal builder** (`/proposal`) — three tiered SOW options with implementation credit

Evidence trail is intact end-to-end: every report section and proposal option points back to its source opportunities, findings, and stakeholder/document evidence.

## BuildOps Boundary

Reaffirmed: BuildOps remains documentation-only. No `/app/builds`, no BuildOps nav, no sprint manager / agent session / repo context UI, no related backend.

## Known Constraints

- All deliverable content is seeded mock data; no real AI synthesis, no production export, no real SOW execution, no e-signature, no billing.
- Review actions across findings / report / proposal are mock with explicit labeling.
- Workspace selection state is local-only and resets on navigation.

## Recommended Next Step

Run a final visual UX audit on Sprint 7, then begin **MVP Stabilization + End-to-End Polish**:

- Audit cross-sprint visual consistency
- Audit cross-sprint copy/microcopy consistency
- Audit cross-sprint accessibility
- Verify every CTA has a destination (or a labeled lock)
- Verify the lead → engagement → intake → findings → opportunities → roadmap → report → proposal trail at the highest fidelity for the canonical demo engagements (Quanta, Caldera)
- Decide which interactive states should persist beyond local UI (mock filter state, mock review actions)
