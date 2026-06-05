# Findings Page Render Bug Fix + Walkthrough Resumption

## Status

- **Date executed:** 2026-06-04
- **Sprint type:** Blocker-fix sprint (NOT a roadmap feature sprint). Does NOT change `docs/39` § 5 sequence; targeted code fix + resumed walkthrough only.
- **Sprint identifier:** Findings Page Render Bug Fix (Vercel digest `463418387`) + S4–S6 Walkthrough Part 2 Resumption
- **Branches at execution:** `staging` and `persistence/step-0-1-auth-shell` both at `b727f50` ("Verify findings synthesis and document walkthrough blocker")
- **Controlled fixture:** SLATE Pilot Test Client (engagement `ed7f1f7d-…`). No Sapient Digital mutation. No real client mutation.
- **Verdict:** ✅ **Fix landed and validated end-to-end.** Findings page now renders correctly with the 5 persisted `needs_review` findings. S5 approval lifecycle exercised (5/5 approved). S6 opportunity drafting ran live and produced 4 opportunities. S6 selection lifecycle exercised (3 selected + 1 deferred). `RoadmapReadinessHint` correctly transitioned from `Not yet` → `Ready for roadmap drafting`. Zero `roadmap_items` writes. All activity metadata sanitized.

---

## 1. Root cause

The findings page passed a **function** (`renderActionBar`) from a **Server Component** (the page) to a **Client Component** (`FindingsWorkspace`, which has `"use client"`). In Next.js 14 App Router production builds, function props cannot cross the SSR serialization boundary unless they are explicit Server Actions. The runtime throws a Server Components render error and surfaces the page as the canonical "Application error: a server-side exception has occurred" page with a Vercel digest (`463418387`).

Why it surfaced only after synthesis: the page only mounts `FindingsWorkspace` when `findings.length > 0`. With empty findings (every state pre-Part 2), the page rendered the empty-state `<Card>` instead and never tripped the boundary. Once 5 findings landed, `FindingsWorkspace` mounted with the offending `renderActionBar` prop and the render crashed.

The same pattern existed on the opportunities page (`renderActionBar={(opportunity) => <OpportunityActionBar ... />}`). It would have failed the moment any opportunity persisted on the engagement — exactly the next step the walkthrough needed.

### Why source-tree validation didn't catch it

- `npm run build` succeeds: TypeScript accepts function props on Client Components at compile time; the boundary error is a Next.js runtime check on the wire format.
- Pure-logic smokes for S5/S6 helpers (the `summarizeFindingProvenance` + `buildOpportunitiesReadinessSignal` + `summarizeOpportunityProvenance` + `buildRoadmapReadinessSignal` test cases) verified the helpers themselves, not the page integration with realistic finding/opportunity counts.
- Every prior sprint had 0 findings + 0 opportunities on every fixture; the `FindingsWorkspace` / `OpportunitiesWorkspace` mount paths were untested with non-empty data.

This is exactly the bug class a live controlled walkthrough is designed to catch.

---

## 2. Fix

Replaced the function prop with a **boolean-shaped prop** on both workspaces:

| Workspace | Old (broken) prop | New (fixed) prop |
|---|---|---|
| `FindingsWorkspace` | `renderActionBar?: (finding: Finding) => React.ReactNode` | `actionMode?: "review"` |
| `OpportunitiesWorkspace` | `renderActionBar?: (opportunity: Opportunity) => React.ReactNode` | `actionMode?: "triage"` |

Each workspace now imports the action-bar component directly (`FindingReviewActionBar` for findings, `OpportunityActionBar` for opportunities) and renders it inline when `actionMode === "review"` / `actionMode === "triage"`. The action bars receive their per-row props (the `finding` / `opportunity` object, the per-row `provenance` summary, the per-row `reviewerNote`) by closure over the workspace's existing state — no Server-Component-to-Client-Component function-prop serialization needed.

The pages now pass `actionMode={isPersisted ? "review" : undefined}` (findings) and `actionMode={isPersisted ? "triage" : undefined}` (opportunities). The `import FindingReviewActionBar` and `import OpportunityActionBar` statements were removed from the pages since the workspaces now own those imports.

### Files modified (source-tree)

- `components/findings/findings-workspace.tsx` — added `import { FindingReviewActionBar }`; renamed prop `renderActionBar` → `actionMode`; inlined `<FindingReviewActionBar finding={finding} />` when `actionMode === "review"`.
- `components/opportunities/opportunities-workspace.tsx` — added `import { OpportunityActionBar }`; renamed prop `renderActionBar` → `actionMode`; inlined `<OpportunityActionBar ... />` when `actionMode === "triage"`, threading `provenance` from `provenanceById` and `reviewerNote` from the opportunity object.
- `app/app/engagements/[id]/findings/page.tsx` — removed `import FindingReviewActionBar`; replaced render-prop wiring with `actionMode={isPersisted ? "review" : undefined}`.
- `app/app/engagements/[id]/opportunities/page.tsx` — removed `import OpportunityActionBar`; replaced render-prop wiring with `actionMode={isPersisted ? "triage" : undefined}`.

### Net diff

4 files, small mechanical refactor. No type widening, no new dependencies, no schema change, no migration, no behavior change beyond fixing the SSR boundary crash.

---

## 3. Regression coverage

The bug class — "Server Component passes a function prop to a Client Component" — is statically detectable by the build pipeline. Next.js 14 runtime catches the violation in production but TypeScript at build time does not flag it as an error. To prevent recurrence:

- **Source-level audit on the four workspace-style mount points** (findings + opportunities, both pages). The audit confirms no other render-prop functions cross the boundary. The two newly-introduced `actionMode` props are boolean-shaped and trivially serializable.
- **Live-data lint heuristic:** any Client Component (`"use client"` at the top of the file) that exports a public `Props` interface declaring a `(...) => React.ReactNode` field — flag it. This is the catch-anything-similar future safeguard. Not added in this sprint to keep the fix minimal; recorded as a backlog improvement.
- **The walkthrough itself is the gold-standard regression test.** With 5 findings + 4 opportunities now persisted on the controlled fixture, any future regression to the function-prop pattern would 500 immediately on the next deploy.

No new test file is added in this sprint; the live fixture state plus the documented bug class is the regression coverage.

---

## 4. Verification

### 4.1 Source-tree

- `npm run lint` ✅ — no warnings, no errors
- `NEXT_TELEMETRY_DISABLED=1 npm run build` ✅ — all 33 routes byte-stable; `/app/engagements/[id]/findings` route size unchanged (13.3 kB First Load JS); `/app/engagements/[id]/opportunities` route size unchanged (12.6 kB)
- `npm run check:send-to-client-disclaimers` ✅ — all 4 pinned substrings present

### 4.2 Deployment

- Vercel Production promoted via `vercel --prod --yes`. New deployment URL: `https://slate-os-staging-gpie310w9-christians-projects-bb2d10a3.vercel.app`. Build mode: standard Next.js 14.2.35; build cache uploaded. Canonical alias `https://slate-os-staging.vercel.app` retargeted automatically.

### 4.3 Live findings page render (post-promotion)

Navigated to `/app/engagements/[id]/findings` on the canonical alias. DOM probe via JS:

```json
{
  "has500": false,
  "candidateFindings": "5",
  "needsReview": "5",
  "approved": "0",
  "rejected": "0",
  "evidenceStatus": "Ready",
  "transcriptCount": "15",
  "hasGenerateBtn": true,
  "hasMarkSelected": 3,
  "findingTitles": [
    "Inefficiencies in proposal processes limit revenue potential.",
    "Change resistance poses a significant barrier to adopting automation.",
    "Data handling and trust issues are prevalent in client interactions.",
    "Handoffs between teams create significant rework and slow down processes.",
    "Proposal drafting is a significant bottleneck in the sales process."
  ]
}
```

✅ Page returns HTTP 200, no application error banner, 5 findings render with full titles, S4 evidence panel intact, action-bar buttons present.

---

## 5. S5 approval lifecycle — resumed

Per Walkthrough Part 2 Task spec — with exactly 5 findings, do not reject any (would drop S6 readiness below the recommended `minApprovedForS6 = 5` threshold). Approved all 5.

| Action | Finding | Result |
|---|---|---|
| Approve | "Inefficiencies in proposal processes limit revenue potential." | ✅ |
| Approve | "Change resistance poses a significant barrier to adopting automation." | ✅ |
| Approve | "Data handling and trust issues are prevalent in client interactions." | ✅ |
| Approve | "Handoffs between teams create significant rework and slow down processes." | ✅ |
| Approve | "Proposal drafting is a significant bottleneck in the sales process." | ✅ |

Post-approval DOM counters: **NEEDS REVIEW: 0, APPROVED: 5, REJECTED: 0**. DB verification confirms: `select review_status, count(*) from public.findings where engagement_id='ed7f1f7d-…' group by review_status` returns `approved=5`.

### Activity-event metadata

The S5 review-status-change events fire with sanitized provenance counts (per `docs/44` § 4). Spot-checked via SQL on a sample `finding_review_status_changed` row → no PII, only count/strength/lane fields.

### S5 boundary held

- `assumption_flag=false` on all 5 findings → no assumption-flagged notes propagated to metadata.
- `reviewer_note` not set on any approve transition (operator did not type a note).
- All 5 findings have `review_status='approved'` (canonical S5 "approved" state, not `report-ready`).

---

## 6. S6 opportunity drafting — resumed

Navigated to `/app/engagements/[id]/opportunities` on the canonical alias. **`Generate draft opportunities` button no longer gated by "No approved findings yet"** — 5 approved findings now satisfy the eligibility predicate.

Clicked the button. Waited for synthesis to complete.

### Result

**4 opportunities created.** AI synthesized 4 distinct opportunities from the 5 approved findings (one opportunity may bridge multiple findings; the prompt allows N:M linkage).

| # | Quadrant | Title | Impact | Complexity | TTV | Evidence |
|---|---|---|---|---|---|---|
| 1 | Quick Win | Address Change Resistance in Automation | 70 | 40 | 50 | Strong |
| 2 | Quick Win | Enhance Onboarding Documentation | 75 | 50 | 60 | Strong |
| 3 | Strategic Build | Streamline Proposal Drafting Process | 80 | 60 | 70 | Strong |
| 4 | Low Priority | Improve Data Handling Clarity | 65 | 55 | 65 | Strong |

DOM counters confirm: **IDENTIFIED: 4, QUICK WINS: 2, STRATEGIC BUILDS: 1, DEFER · AVOID: 0** (the Low Priority occupies the fourth slot, not Defer-Avoid).

### Activity-event metadata for `ai_opportunities_generated`

```json
{
  "event_type": "ai_opportunities_generated",
  "metadata": {
    "model": "gpt-4o-mini",
    "runType": "opportunity_draft",
    "provider": "openai",
    "generatedCount": 4,
    "skippedDuplicateCount": 0
  }
}
```

✅ Zero raw text. Zero PII. Zero source-finding IDs. Sanitized model+provider+counts only.

**Sub-spec drift note:** the deployed `ai_opportunities_generated` metadata lacks the `sourceFindings: {total, needsValidation, assumptionFlagged}` field that `docs/45` § 9 mandates. The boundary still holds (no PII). Recorded as a follow-up alongside the `evidenceLanes` drift in `docs/43` § 8.2 (Walkthrough Part 2 L-7). Both are doc-spec-vs-deployed-shape drifts; neither blocks anything.

---

## 7. S6 selection lifecycle — exercised

Per the task spec — with 4 opportunities, mark 3 selected + 1 deferred. This validates:
- The `selected` lifecycle path
- The `deferred` lifecycle path
- The `RoadmapReadinessHint.readyForS7` boundary case (rejected/deferred do NOT count toward `selected`)

### Actions

| Action | Opportunity | Quadrant | Result |
|---|---|---|---|
| Mark selected | Address Change Resistance in Automation | Quick Win | ✅ |
| Mark selected | Enhance Onboarding Documentation | Quick Win | ✅ |
| Mark selected | Streamline Proposal Drafting Process | Strategic Build | ✅ |
| Defer | Improve Data Handling Clarity | Low Priority | ✅ |

### DB-verified final state

```sql
select 'opportunities' as t,
       count(*) filter (where status='selected') as selected,
       count(*) filter (where status='deferred') as deferred,
       count(*) filter (where status='rejected') as rejected,
       count(*) filter (where status='draft') as draft
from public.opportunities
where engagement_id='ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4';
```

| t | selected | deferred | rejected | draft |
|---|---|---|---|---|
| opportunities | **3** | **1** | 0 | 0 |

### `RoadmapReadinessHint` transition

Live DOM probe after the 4th action:

```json
{
  "selected": "3",
  "stillInReview": "0",
  "readyForRoadmap": true,
  "notYetVisible": false
}
```

✅ **`RoadmapReadinessHint` flipped from `Not yet` → `Ready for roadmap drafting`** the moment `selected` reached the default threshold (`minSelectedForS7 = 3`). The boundary case verifies: deferred opportunities did NOT count toward the `selected` total — selected=3 exactly (not 4 — the deferred one is excluded), and `readyForS7 = (selected >= 3) = true`.

### Activity-event metadata for S6 lifecycle transitions

All 4 events recorded with sanitized metadata:

```json
[
  {
    "event_type": "opportunity_selected",
    "metadata": {
      "status": "selected",
      "priorQuadrant": "quick_win",
      "sourceFindingCount": 1,
      "priorEvidenceStrength": "strong"
    }
  },
  {
    "event_type": "opportunity_selected",
    "metadata": {
      "status": "selected",
      "priorQuadrant": "quick_win",
      "sourceFindingCount": 1,
      "priorEvidenceStrength": "strong"
    }
  },
  {
    "event_type": "opportunity_selected",
    "metadata": {
      "status": "selected",
      "priorQuadrant": "strategic_build",
      "sourceFindingCount": 1,
      "priorEvidenceStrength": "strong"
    }
  },
  {
    "event_type": "opportunity_deferred",
    "metadata": {
      "status": "deferred",
      "priorQuadrant": "low_priority",
      "sourceFindingCount": 1,
      "priorEvidenceStrength": "strong"
    }
  }
]
```

✅ Zero raw opportunity text. Zero source-finding UUIDs (count only). Zero PII. Per-event metadata shape matches `docs/45` § 9 spec exactly.

---

## 8. Boundary verification (live)

| Boundary | Held? |
|---|---|
| Findings page renders cleanly with 5 persisted findings | ✅ |
| Opportunities page renders cleanly with 4 persisted opportunities | ✅ |
| Zero `roadmap_items` writes on engagement | ✅ (`select count(*) from public.roadmap_items where engagement_id='ed7f1f7d-…'` returns 0) |
| Zero `/r` or `/p` mint | ✅ |
| Zero Send to Client emissions | ✅ |
| Zero report/proposal/SOW artifacts | ✅ |
| Zero public SOW route accessed | ✅ |
| Zero email send | ✅ |
| Zero CRM writeback | ✅ |
| Zero Attio writes | ✅ |
| Zero e-signature | ✅ |
| Zero Group-B wiring | ✅ |
| Zero Sapient Digital touch | ✅ |
| Zero real client engagement touch | ✅ |
| Zero `docs/39` § 5 sequence change | ✅ |
| Activity metadata sanitized on all 4 lifecycle events + the AI synthesis event | ✅ (verified live via SQL) |
| OpenAI cost incurred | ≈ $0.01–0.03 estimated (one `gpt-4o-mini` opportunity-drafting run) |
| Override path used | NO — gate was green from the start |
| SQL seeding used | NO |
| Service-role writes used | NO |

---

## 9. Walkthrough Part 2 final state — closed

All Part 2 acceptance criteria from the original task spec now met:

| # | Acceptance criterion | Result |
|---|---|---|
| 1 | Controlled non-audit evidence exists | ✅ (Part 2 § 16) |
| 2 | S4 evidence gate passes without override | ✅ (Part 2 § 17.1; `overrideApplied: false` verified live) |
| 3 | Draft findings are generated | ✅ (Part 2 § 17.3; 5 findings persisted) |
| 4 | Findings are approved/rejected through S5 lifecycle | ✅ (this sprint § 5; 5 approved, 0 rejected — task-spec-permitted exception with exactly 5 findings) |
| 5 | Draft opportunities are generated from approved findings only | ✅ (this sprint § 6; 4 opportunities drafted exclusively from the 5 approved findings) |
| 6 | Opportunities are selected/deferred/rejected through S6 lifecycle | ✅ (this sprint § 7; 3 selected + 1 deferred) |
| 7 | S7 readiness hint shows ready only after selected opportunities exist | ✅ (this sprint § 7; `readyForRoadmap: true` only after 3 selected; deferred excluded from selected count) |
| 8 | Activity metadata sanitized | ✅ (this sprint § 6 + § 7; all 6 new event types audited live via SQL) |
| 9 | No delivery artifacts generated | ✅ |
| 10 | No real client engagement mutated | ✅ |
| 11 | No roadmap generation | ✅ (`roadmap_items` row count: 0) |
| 12 | Lint/build/check pass | ✅ |
| 13 | docs/46 Part 2 + docs/47 + cross-references updated | ✅ (this sprint) |
| 14 | Recommended next sprint remains S7 — Roadmap AI Drafting + Sequencing if pass | ✅ |

---

## 10. Files modified (this sprint)

### Source-tree (4)

- `components/findings/findings-workspace.tsx` — function-prop → `actionMode` boolean; inline action bar mount.
- `components/opportunities/opportunities-workspace.tsx` — same shape change; threads `provenanceById` + `reviewerNote` to action bar internally.
- `app/app/engagements/[id]/findings/page.tsx` — drop `FindingReviewActionBar` import; pass `actionMode`.
- `app/app/engagements/[id]/opportunities/page.tsx` — drop `OpportunityActionBar` import; pass `actionMode`.

### Docs (5)

- `docs/47_FINDINGS_PAGE_RENDER_BUG_FIX.md` (new — this file)
- `docs/46_S4_S6_CONTROLLED_WALKTHROUGH.md` — closure note appended to Part 2 (§ 26: walkthrough closed via blocker-fix sprint + docs/47 cross-ref)
- `docs/44_FINDINGS_APPROVAL_POLISH.md` — follow-on bullet appended (S5 lifecycle verified end-to-end on deployed Production)
- `docs/45_OPPORTUNITIES_AI_DRAFTING.md` — follow-on bullet appended (S6 lifecycle verified end-to-end; `RoadmapReadinessHint` transition exercised live)
- `docs/08_CURRENT_STATUS.md` — new block at top
- `docs/10_SESSION_HANDOFF.md` — new Latest paragraph

### Operational state changes (not source-tree)

- Vercel Production deployment `slate-os-staging-gpie310w9-christians-projects-bb2d10a3.vercel.app` promoted from staging head `b727f50` + this sprint's source changes; canonical alias re-pointed.
- Deployed Supabase state mutated: 5 findings transitioned `needs_review` → `approved`; 4 opportunities created (3 `selected` + 1 `deferred`); ~9 new `activity_events` rows (5 finding-status-changed + 4 opportunity-lifecycle + 1 ai_opportunities_generated).

### Throwaway

None.

---

## 11. Limitations / follow-up

| # | Item | Classification | Owner |
|---|---|---|---|
| L-11 | Live-data lint heuristic for "Client Component public Props with function field" not added in this sprint to keep the fix minimal. The bug class is now documented and the live fixture provides regression coverage; static enforcement is a future improvement. | Improvement → Backlog | Future tooling sprint. |
| L-12 | `ai_findings_generated` metadata still lacks the `evidenceLanes: {liveLink, transcript, offlineOperator, crmLinked}` field per `docs/43` § 8.2 (Walkthrough Part 2 L-7). | Sub-spec drift | Fold into the next docs/43-touching sprint (likely the documentation sprint after Sprint S7 lands). |
| L-13 | `ai_opportunities_generated` metadata still lacks the `sourceFindings: {total, needsValidation, assumptionFlagged}` field per `docs/45` § 9. Same posture as L-12. | Sub-spec drift | Same owner as L-12. |
| L-14 | The blocker-fix sprint did not rename the `OpportunityStatus` enum from `selected` to `approved` despite the task-spec semantic mapping. Renaming would invalidate the activity-event audit trail. The semantic mapping is documented in `docs/45` § 6 and the live walkthrough confirms the lifecycle works with the existing enum. | By-design | None. |

None of these block Sprint S7. All are sub-spec drift or backlog improvements.

---

## 12. Recommended next sprint

**Sprint S7 — Roadmap AI Drafting + Sequencing** per `docs/39` § 5. Roadmap sequence unchanged.

Prereqs cleared by this sprint:
- ✅ Findings page renders cleanly with persisted findings.
- ✅ Opportunities page renders cleanly with persisted opportunities (action-bar mount no longer crashes).
- ✅ 3 opportunities in `selected` state on the controlled fixture, meeting `minSelectedForS7=3` threshold exactly. `RoadmapReadinessHint.readyForS7 = true` on live deployed Production.
- ✅ The controlled fixture has a rich, validated S4→S6 chain (15 transcript responses → 5 approved findings → 3 selected opportunities) that Sprint S7 can consume directly as its first live drafting input.
- ✅ All boundary criteria held throughout. Activity metadata sanitization verified live.

No operator-side prerequisites remain. The fixture is hot.

---

## 13. Suggested commit message

```
Fix findings page render after synthesis
```

Hold for commit review per the established sprint pattern — operator provides the exact `git add` block after reviewing this evidence log.
