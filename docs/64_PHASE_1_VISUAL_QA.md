# docs/64 — Phase 1 Visual UX QA

> **Verdict:** ✅ **Approve.** The operator app now reads as intentional, premium, and calm — the "AI slop / coded on the fly" signature is gone from the operator surfaces. No launch blockers. One residual-scaffolding gap surfaced and was fixed in this pass. Remaining issues are all pre-scoped Phase 2 items.
>
> **Date:** 2026-08-11 · **Branch:** `persistence/step-0-1-auth-shell`
> **Method:** Live authenticated QA against real data. An operator session (`cdibrell@saipienlabs.com`) was minted via the Supabase admin API (`generate_link` → `verify`), serialized to the `@supabase/ssr` auth cookie, and injected into Playwright. Screenshots captured against the real **Meridian Field Services** engagement (full pipeline) on local dev at three viewports.
> **Screenshots:** `docs/screenshots/phase-1-qa/` (10 images).

## Viewports reviewed
- 1440 × 900 (desktop) — dashboard, leads, engagements, findings, opportunities, report, proposal
- 1024 × 800 (tablet) — dashboard
- 390 × 844 (mobile) — dashboard, findings

## Overall score: ~4.2 / 5 (baseline was ~3.5 in docs/62)

| Axis | Score | Note |
|---|---|---|
| Premium feel | 4 | Layered dark cards, sans hierarchy; no console voice on operator surfaces |
| Canon alignment | 4 | 3-column findings + 2×2 opportunity matrix intact; AI labels/provenance present |
| Hierarchy & clarity | 4 | Clean headers; 6-KPI scoreboard rows still lead (Phase 2) |
| Information density | 3 | Forms stack above the review workspace; long mobile scroll (Phase 2 / T6) |
| Responsive | 4 | Mobile collapses to one column, nothing clipped; tablet holds |
| Accessibility | 4 | FilterTabs keyboard nav, focus rings, dialog focus-trap in place |
| Microcopy | 4 | Scaffolding removed from headers + (this pass) deeper hints/boundaries |

## What works (verified visually)
- **Scaffolding gone from chrome + headers** — no "Sprint N", no roadmap-status aside, no dead ⌘K/notifications, no fake nav badges; unbuilt nav shows a quiet "Soon" tag.
- **Sans typography** throughout the operator app; mono reserved for IDs/scores.
- **Canonical layouts intact** — findings 3-column (list + FilterTabs → detail w/ real Approve/Reject/Reopen/Mark-ready bar → evidence); opportunities 2×2 matrix with both axes; mono scores with meters.
- **New FilterTabs** render with count badges across leads/engagements/findings/opportunities/report.
- **Layered, consistent cards**; interactive rows share one hover model.
- **Zero runtime errors** — only a benign `favicon.ico` 404 in the console across the whole session.
- **Responsive** — mobile findings collapses the 3-column workspace to a clean single column.

## Issues found
1. **[Fixed this pass] Residual scaffolding copy in deeper sub-components.** The Phase 0 phrase-sweep missed readiness-hint + boundary-reminder copy and some `lib/` blocker messages: "Sprint S6/S7/S8/S9/S10 …", "activate in later sprints", and `per docs/39 § 4` / `docs/35 § 5` / `docs/28 + docs/29` citations. All rendered instances reworded to evergreen operator copy (12 UI strings + 4 `lib/` messages). AI-prompt strings left intact (not user-facing).
2. **[Phase 2 / T6] Forms stack above the workspace** on findings/opportunities — generate/create/readiness cards push the review surface below the fold.
3. **[Phase 2 / T-hierarchy] 6-up KPI scoreboard rows** lead the dashboard, findings, and opportunities pages — scoreboard-y, not decision-first.
4. **[Phase 2] Long single-column mobile scroll** on dense workspaces.
5. **[Phase 2 / T10] Client deliverable documents** (report/proposal candidate render) were out of Phase 1 scope; their premium pass is T10.

## Console / errors
1 message total across the session: `favicon.ico` 404. **Zero real runtime errors.**

## Recommendation
**Approve.** Phase 1 (design-system pass) is complete and verified against real data. Proceed to Phase 2 (workflow T4–T6, deliverables T10, guard legibility T11).
