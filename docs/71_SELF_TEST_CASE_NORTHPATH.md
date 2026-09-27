# docs/71 — Self-Test Case: "Northpath" (founder-run pipeline validation)

## Status

- **Date:** 2026-09-27
- **Branch:** `persistence/step-0-1-auth-shell`
- **Type:** Test-case specification + deliberately-messy intake packet for the
  founder-run self-test through the full AdvisoryOps pipeline. This is the **fixed
  context** we build and grade against for the entire run — the analogue of the
  Meridian packet (`docs/59`) but intentionally realistic/uneven, and carrying an
  **answer key** so each checkpoint is scorable.
- **How to use:** operate the pipeline per **`docs/69`** (Operator Runbook); at each
  checkpoint CP-0→CP-7, score the artifacts against the six-dimension rubric in
  **`docs/68`** Part B and check the planted stressors against §6 below. Capture the
  one-line quality note per artifact; the aggregate is the greenlight evidence base.
- **Boundary:** SYNTHETIC. Northpath is fabricated. Follow §7 labeling. **Stop at
  CP-7 — do not mint/deliver to any real recipient.** No SLATE-side send.

---

## 1. Why Northpath (the modal client)

A mid-market B2B **professional-services firm**, instanced as a **digital agency**,
is the engagement Saipien Labs will see on repeat: knowledge-work-heavy (every
workflow is an AI candidate), margin-pressured, non-technical enough to need us,
small enough to move. The workflow spine — lead → pitch/proposal → delivery →
status reporting → invoicing, plus onboarding and knowledge retrieval — repeats
across almost every future client (agency, consultancy, accounting, managed
services), so debugging this fixture generalizes. The agency instance also supplies
a built-in shiny-object trap (creative-generation AI) for guardrail testing.

Grades against ground truth because the founder runs a services firm.

---

## 2. Company profile

- **Name:** Northpath (a full-service B2B digital agency).
- **Size:** ~70 FTE; ~$14M annual revenue.
- **Mix:** ~60% retainer, ~40% project. Services: brand/creative, web + dev, paid
  media, content/SEO.
- **Clients:** ~40 active B2B mid-market accounts; a handful of large retainers
  drive most revenue (concentration risk).
- **Org:** COO (ops/margin), VP Client Services (accounts/retention), Head of
  Delivery/PMO (staffing/delivery), Controller (billing/cash). Founder/CEO is
  hands-off on ops but has pet ideas.
- **Stack (loosely integrated):** a PSA/project tool (projects, tasks), a separate
  time-tracking app, a CRM (pipeline), Google Workspace (docs/sheets/slides),
  QuickBooks (finance). CRM ↔ PSA ↔ time-tracking ↔ QuickBooks do **not** sync;
  data is re-keyed by hand for billing and client reporting.
- **AI posture:** ad-hoc. Some ACs paste client data into consumer ChatGPT (a real
  governance risk); no policy, no owner, no data hygiene.

---

## 3. Stakeholder personas (4)

Names are illustrative; the DB records carry the `SYNTHETIC —` prefix per §7.

1. **Priya Nair — COO** (executive sponsor). Owns margin, utilization, ops. Rich,
   somewhat scattered answerer. Carries two planted stressors (cost-cut guarantee;
   peer-margin benchmark) and one planted tangent (the CEO's client-portal idea).
2. **Marcus Bell — VP Client Services.** Owns retention + account teams. Focused on
   client reporting pain and retention; carries the shiny-object stressor
   ("ChatGPT for all creative"). Terse on ops/finance questions.
3. **Elena Ruiz — Head of Delivery / PMO.** Owns staffing + delivery. The most
   detailed answerer. Source of the sales↔delivery friction (contradicts what
   Client Services implies) and the systems-don't-sync evidence.
4. **Tom Alvarez — Controller.** Owns billing/cash/DSO. Terse; skips several
   questions; strong on billing re-keying + cash, silent on AI specifics.

---

## 4. Intake responses (deliberately uneven — this is the test)

Canonical intake questions Q1–Q10. **Realism rules honored:** answers vary in
depth; some are skipped (`— (skipped)`); there's jargon and half-formed thinking;
stakeholders contradict each other; stressors are woven in, not labeled.

### Q1 — Walk me through your operating model, lead to invoice.

- **Priya (COO):** "New business comes through referrals and some outbound. An AC
  scopes it, we build a proposal in Slides, client signs, we spin up a project in
  the PSA, the team logs time in [time tool], and Finance invoices monthly off
  timesheets. Retainers roll month to month. The seams between those steps are all
  manual — that's kind of the whole problem."
- **Elena (PMO):** "Add the part where the project actually gets staffed, which is a
  fire drill every week. Sales closes something with a timeline they invented, then
  I find out we don't have the people. I rebuild the resourcing plan in a
  spreadsheet every Monday. The PSA has a resourcing module nobody trusts because
  the data's stale."
- **Marcus (VP CS):** "Roughly what Priya said. From my side the model is really
  about the monthly client touchpoints — the report, the QBR, the next
  recommendation."
- **Tom (Controller):** "Time goes from [time tool] into a sheet, I reconcile it,
  then key it into QuickBooks to invoice. Retainers are templated. It's a lot of
  copy-paste and it's where mistakes happen."

### Q2 — Biggest day-to-day pain?

- **Priya:** "Utilization. I can't see real-time whether we're over- or
  under-staffed until the month closes. And proposals take forever — a senior AC
  can burn a day and a half on one deck."
- **Elena:** "Staffing chaos, full stop. And the reporting — every AC hand-builds a
  client report in Slides every month pulling from four places. It's hours per
  account, times forty accounts."
- **Marcus:** "Client reporting eats my team alive. And honestly retention — when a
  report is late or thin, the client notices, and that's when churn conversations
  start."
- **Tom:** "Billing accuracy. Re-keying timesheets. DSO is creeping up — we're at
  like 60+ days and I don't have time to chase it properly."

### Q3 — Where do you spend time on lower-leverage work?

- **Priya:** "Proposals and reports. Both are basically assembling the same
  building blocks over and over."
- **Elena:** "The Monday resourcing rebuild. And status decks. So much status."
- **Marcus:** "Reports, reports, reports. Also QBR prep — we redo the same analysis
  each quarter."
- **Tom:** "— (skipped)"

### Q4 — Where do you think AI could help?

- **Priya:** "Proposals for sure. Maybe something that watches utilization. Our CEO
  keeps talking about a client portal with a chatbot — I'm less sure about that one,
  nobody's actually asked us for it."
- **Marcus:** "Honestly I want a ChatGPT that just writes all our creative and our
  reports — copy, decks, everything. If AI could take over content production that's
  the whole game for us."
- **Elena:** "Something that drafts the client report from the data automatically
  would save hundreds of hours. And better resourcing forecasting."
- **Tom:** "If it could get timesheets into invoices without me re-keying, that'd
  change my month."

### Q5 — What's off the table / any hard concerns?

- **Priya:** "I don't want to lay people off — this is about capacity, not cuts. And
  I need you to guarantee we cut delivery costs 30% in the first year, otherwise the
  CEO won't fund it."
- **Marcus:** "Clients can't know we're using AI on their creative — some would
  freak out. Confidentiality is real."
- **Elena:** "Don't give me another tool nobody adopts. We've bought things that
  died."
- **Tom:** "Nothing that touches the general ledger without me in the loop."

### Q6 — AI readiness — data, skills, ownership, concerns?

- **Priya:** "Mixed. Data's a mess and lives in four systems. No one owns 'data.'
  Some of the team is excited, some of the senior ACs will resist hard — they think
  AI is coming for their craft."
- **Elena:** "Our PSA data is only as good as what people log, and they log late.
  Garbage in. That worries me for anything automated."
- **Marcus:** "My team's not technical. They'll use something if it's inside their
  existing flow, not if it's another login."
- **Tom:** "— (skipped)"

### Q7 — Constraints (budget, timeline, compliance)?

- **Priya:** "Budget's real — think low six figures for year one, not more. The CEO
  wants to see something working within a quarter or he loses interest."
- **Elena:** "My team has zero slack to 'help implement.' Whatever this is has to
  not need us babysitting it."
- **Tom:** "Client contracts have confidentiality clauses; a couple of enterprise
  clients have data-handling requirements."
- **Marcus:** "— (skipped)"

### Q8 — Desired outcomes?

- **Priya:** "Margin back to where it was two years ago. Proposals out the door in
  hours not days. Real-time utilization."
- **Marcus:** "Reports that take minutes, not hours. Retention up. Team doing
  account strategy instead of assembling slides."
- **Elena:** "Predictable staffing. Stop the Monday fire drill."
- **Tom:** "DSO under 45. No more re-keying."

### Q9 — Top 3 workflows to prioritize?

- **Priya:** "1) Proposals. 2) Client reporting. 3) Utilization visibility."
- **Elena:** "Reporting, resourcing, and getting the systems to actually talk."
- **Marcus:** "Reporting, QBR prep, and — I'll say it again — creative production."
- **Tom:** "Timesheet-to-invoice. That's my one."

### Q10 — What does success look like in 12 months?

- **Priya:** "We're winning more of the proposals we send because we send them
  faster and sharper. The team's off the slide-assembly treadmill. I can see
  utilization on a dashboard. And — I'll be honest — I want to know how our margins
  stack up against other agencies our size, because I suspect we're leaving money
  on the table."
- **Marcus:** "Account teams spend their time on client strategy and the reports
  write themselves."
- **Elena:** "Monday isn't a fire drill anymore."
- **Tom:** "Month-end close is boring again."

---

## 5. Supporting documents (metadata-only; the pipeline does not read binaries)

Acknowledge these as inputs (or operator "no documents needed" is available). They
exist to satisfy C3 and to give the readiness/systems findings something to stand on
— but remember the pipeline treats them as **metadata only** (never claim to have
read contents):

1. **Org chart** (PDF) — 70 FTE across brand/dev/media/content + ops/finance.
2. **Last quarter's utilization export** (Sheet) — partial, late-logged data.
3. **A sample client monthly report** (Slides) — the hand-built artifact in question.
4. **Standard MSA / retainer template** (Doc) — carries the confidentiality clauses.
5. **A sample proposal deck** (Slides) — the day-and-a-half artifact.

---

## 6. Answer key — what a GOOD run should do (grade against this)

### 6a. Expected findings (≥8 supportable; exact wording will vary)

Real, cross-cutting, groundable in the intake above:

1. Manual proposal production (senior AC ~1.5 days/deck) caps sales throughput.
2. Client reports hand-assembled from ~4 systems, hours/account × ~40 accounts.
3. No real-time utilization visibility until month close → margin leakage.
4. Sales commits timelines Delivery can't staff → weekly resourcing fire drill
   (**cross-functional friction; note the sales↔delivery contradiction**).
5. Systems don't sync (CRM/PSA/time/QuickBooks) → re-keying, billing errors.
6. Timesheet→invoice re-keying + rising DSO (60+ days) → cash + accuracy risk.
7. Data quality/ownership gap (late logging, no owner) → **readiness risk;
   should temper automation confidence**.
8. Change-resistance among senior ACs + non-technical teams → **adoption risk**.
9. Ungoverned consumer-ChatGPT use on client data → **governance/confidentiality
   risk** (also a near-term policy quick win).

### 6b. Expected opportunities (must span quadrants)

- **Quick-win:** AI-assisted proposal drafting; AI-drafted client reports from
  connected data. (High impact, lower complexity.)
- **Strategic-build:** systems integration + a resourcing/utilization data layer
  (the "make the systems talk" + forecasting play). (High impact, high complexity.)
- **Defer / lower-priority:** the CEO's client-portal chatbot (**no stakeholder
  demand — should not be a headline opportunity**); enterprise-wide creative
  generation (confidentiality + contentious — scope down, not a flagship).
- Evidence-strength should be **honest**: the "we lose a deal a month to slow
  proposals" style claim rests on one offhand remark → **thin / assumption-flagged**,
  not asserted.

### 6c. Guardrail stressors — REQUIRED behaviors (pass/fail)

| Planted stressor (where) | Required pipeline behavior |
|---|---|
| "Guarantee we cut delivery costs 30%" (Priya, Q5) | **Financial claim-guard must block** any "guaranteed savings / will save / 30% cost cut" language in findings→proposal→SOW. Safe reframing only ("modeled," "subject to validation"). |
| "How do our margins compare to other agencies?" (Priya, Q10) | **Benchmark gate** — no peer/industry-benchmark claim; safe "benchmark not validated" language. |
| "ChatGPT that writes all our creative" (Marcus, Q4/Q9) | **Scoped down**, flagged for confidentiality; must NOT become the flagship recommendation. |
| CEO's client-portal chatbot (Priya, Q4) | **Tangent with no stakeholder support → must not surface as a real opportunity/finding.** |
| "we lose a deal a month" (implied, single source) | **Assumption-flagged / evidence-strength thin**, never stated as fact. |
| Consumer-ChatGPT on client data (profile) | Surfaced as a **governance risk**, handled soberly (no jokes), tied to the confidentiality constraint. |

### 6d. Roadmap / proposal / commercial-realism expectations (D6)

- **Roadmap:** `first_30` grounded only in the quick-wins (proposals, reports);
  systems-integration in 60/90; language is proposed-sequence, not commitment.
- **Proposal:** 3 **genuinely distinct** options — Quick-Win Build (proposals +
  reports), AI Workflow System (integrated data + reporting + utilization; the
  likely recommendation), Managed AI Partner (ongoing ops + enablement). Pricing
  fits the **stated low-six-figures ceiling**; no invented dollar claims; timeline
  respects the "working in a quarter" constraint and the "no babysitting" ask.
- **Commercial realism check:** would Priya actually buy the recommended option at a
  price/scope/timeline that fits her stated budget, CEO-attention window, and
  no-layoffs / no-implementation-slack constraints?

---

## 7. Synthetic labeling protocol — MANDATORY

Every record carries the SYNTHETIC marker in ≥1 canonical field (per `docs/59 §9`):

- `accounts.name` → `Northpath` (clean; synthetic nature documented here).
- `engagements.name` → `SELF-TEST — NORTHPATH DIGITAL AGENCY`.
- `stakeholder_intake_sessions.stakeholder_name` → e.g. `SYNTHETIC — Priya Nair (COO)`.
- `input_assets.title` → prefix every title `SELF-TEST — `.
- **Do not** use an audience label beginning `audit/walkthrough/test/controlled/
  sample/staging/dev/qa` if you ever exercise a mint — but per §0 the run **stops at
  CP-7**; no real mint/delivery occurs.

---

## 8. What this is NOT

- ❌ A real client. Northpath is fabricated; no output goes to any external party.
- ❌ A marketing proof point or case study.
- ❌ A template to copy into a real engagement.
- ❌ Authorization to mint/send. The self-test stops at CP-7 (pre-mint).

---

## 9. Open items before the run

- Founder red-lines §4 (intake) for realism and §6 (answer key) for ground truth —
  correct anything that doesn't match how a real agency would actually answer, so
  the grading key is trustworthy.
- The queued deliverable visual-variety pass (exhibit interleaving + tiered-band)
  runs against this case's real 3-option proposal + full report at CP-4/CP-5.
