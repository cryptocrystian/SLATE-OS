# docs/59 — Synthetic ICP Pilot Packet: Meridian Field Services

> **Status:** ✅ **Synthetic ICP fixture packet — operator-ready.** This document is the canonical discovery packet for a clearly-labeled synthetic ICP-fit engagement to be run through the deployed SLATE workflow as an operational QA exercise. **Meridian Field Services is not a real company.** All people, financials, contracts, and operational details are fabricated for QA purposes only. The fixture must not be used in any client communication, testimonial, or case study.
>
> **Fixture label (mandatory on every record):** `SYNTHETIC ICP PILOT — MERIDIAN FIELD SERVICES`
> **Run doc (paired):** `docs/60_SYNTHETIC_ICP_PILOT_RUN.md` — operator runbook + verification protocol.

## 1. Why this packet exists

Per `docs/58` (Pilot Readiness Review), SLATE is **Go with cautions** for a real first pilot — but the controlled fixture (`SLATE Pilot Test Client`) is a small synthetic sandbox that does not exercise the workflow at realistic ICP complexity. This packet provides a **richer synthetic ICP-fit fixture** so the operator can validate real-deployment output quality end-to-end — intake → findings → opportunities → roadmap → report → proposal → SOW → pre-delivery audit → controlled mint — before exposing SLATE to a real client.

The packet is **operationally realistic** but **non-attributable**: the company profile, personas, and discovery answers are designed to fit Saipien Labs' / SLATE's ICP (operationally complex, workflow-heavy, B2B services, mid-market) without resembling any specific real prospect.

## 2. Synthetic company profile

| Field | Value |
|---|---|
| Company | **Meridian Field Services** (SYNTHETIC) |
| Industry | B2B field services — infrastructure inspection, maintenance, repair, project delivery |
| Founded | 2009 (synthetic — used to anchor methodology questions about "legacy systems" and "established processes") |
| Headcount | ~180 employees |
| Revenue | ~$38M annual revenue |
| Geography | Regional multi-location operator headquartered in Houston, TX; field operations across Texas, Oklahoma, Louisiana, New Mexico, Arkansas |
| Ownership | Privately held |
| Customer mix | Commercial (industrial site operators, commercial building owners) + municipal (water districts, utilities, parks/recreation) |
| Field discipline mix | Pipeline / tower / utility easement inspection; corrosion / valve / telemetry maintenance; emergency + scheduled repair; new-install + decommission project work |
| Current tech stack (synthetic) | Salesforce (CRM, partial adoption); Sage Intacct (financials); legacy in-house field-management tool (built ~2014); Excel/Google Sheets (ad-hoc reporting); paper field forms (still used by ~30% of crews) |
| Compliance posture | OSHA + DOT/PHMSA basics; no PHI / PCI / HIPAA exposure; FLSA/DOL labor audit posture |
| ICP fit signal | High — operationally complex, workflow-heavy, manual documentation burden, clear AI leverage, low heavy-regulatory burden, well-defined ROI hypothesis |

## 3. Stakeholder personas (4)

All four personas are fabricated. Names, tenure, prior-company references, quotes, and pain points are designed for ICP-realism, not attribution to any real individual.

### 3.1 Dana Mitchell — Chief Operating Officer

- **Role lane:** `executive` (canonical SLATE intake role per `docs/35` § 5)
- **Tenure:** 6 years at Meridian; prior 11 years at a larger Gulf Coast competitor where she ran operations for a $200M division
- **Accountable for:** P&L, delivery consistency, operational leverage, executive dashboards for the board
- **Perspective:** needs cross-geography visibility; margin protection through better job costing + dispatch; board-facing weekly KPI reporting cadence is too slow
- **Operating style:** data-driven, comfortable with technology adoption when ROI is clear
- **Synthetic pain quote:** "I can't tell at 10am Monday whether last week was profitable. By the time the numbers settle, the issues are already a week old."

### 3.2 Marcus Lee — Director of Field Operations

- **Role lane:** `operations` (canonical SLATE intake role)
- **Tenure:** 4 years at Meridian; 12 years total industry experience across two prior employers
- **Accountable for:** 14 crew teams across 4 hubs (Houston, Dallas, OKC, New Orleans), work order quality, rework rate, weekly scheduling
- **Perspective:** dispatchers need better tooling; field crews resist new tech if it slows them at the truck
- **Operating style:** pragmatic, field-experienced, skeptical of "AI" pitches that don't survive field conditions
- **Synthetic pain quote:** "Half my Monday morning is rebuilding the schedule because Friday's tickets weren't closed properly. Then Tuesday I'm chasing field reports that should already be in."

### 3.3 Priya Shah — VP of Client Growth

- **Role lane:** `sales` (canonical SLATE intake role)
- **Tenure:** 3 years at Meridian; prior 8 years in B2B SaaS sales leadership
- **Accountable for:** account expansion, contract renewals, custom quote turnaround, client-facing monthly reporting
- **Perspective:** quote-to-dispatch latency loses competitive deals; client reporting is a manual Excel exercise; renewal momentum is weak because account-management work is reactive
- **Operating style:** revenue-focused, comfortable advocating tech investment if it shortens sales cycles
- **Synthetic pain quote:** "I lose deals on >$50k custom RFQs because I can't turn around a quote in 48 hours. Competitors with better tooling are quoting in a day."

### 3.4 Elena Torres — Controller (optional 4th persona — recommended for full coverage)

- **Role lane:** `finance` (canonical SLATE intake role)
- **Tenure:** 5 years at Meridian; CPA; prior controller at a smaller services firm
- **Accountable for:** job costing, billing, AR aging, labor utilization, margin reporting
- **Perspective:** invoicing latency kills cash flow; field-report-to-invoice reconciliation is manual; DSO is significantly above industry benchmark
- **Operating style:** audit-conscious, careful about new system adoption, wants traceability
- **Synthetic pain quote:** "Our DSO is 56 days when the industry benchmark is 38. The bottleneck is field reports — we can't invoice until they're complete and reconciled."

## 4. Synthetic discovery responses (10 substantive answers, mapped to canonical universal questions)

Each response is **operator-authored synthetic** content designed to be substantive enough for AI findings synthesis. The operator records these per persona via Mode B offline intake (`docs/37` § 4 — operator-staged offline path). Every response should be entered through the deployed UI's `Stage offline stakeholder` + `Stage offline response` server actions. **Do not insert these directly via SQL.**

### Q1 — "Walk me through your current operating model — quote to delivery to invoicing."

- **Dana (executive):** "Sales lead enters CRM; Priya's team builds a custom quote using a template — for projects > $50k it takes 2–7 days. Accepted quotes become jobs in our legacy field-mgmt tool built in 2014. Marcus's team schedules and dispatches from one of four hubs. Crews perform the work. Field reports come back via mobile app or paper — about 30% are still paper. Ops admin reviews. Elena's team generates invoices 7–14 days after job completion because field reports lag. Customer monthly reporting is compiled manually by Priya's team. Lots of handoffs; not enough end-to-end visibility."
- **Marcus (operations):** "Dispatcher receives next week's jobs on Friday and starts building the schedule. Sunday night I re-route based on equipment availability. Monday 6am the crews do briefings at the hub. Work happens during the week. Jobs are closed at end of day via the mobile app — when it works. When it doesn't, paper. Schedule rebuild happens Tuesday morning because Monday's overruns push everything. My dispatchers spend half of Monday and most of Tuesday on this churn."
- **Priya (sales):** "Quote turnaround averages 4 days for custom RFQs over $50k. Win rate is around 32%. We lose maybe 1 in 4 deals because we're slower than competitors with newer quoting tools. Once the quote is accepted, the handoff to ops is mostly fine — but if the scope shifts in the field, I don't always know until the invoice question comes up."
- **Elena (finance):** "Invoices go out 7–14 days after job completion. Rework rate is around 5–10%, meaning we re-do work that was incomplete or wrong the first time. DSO is 56 days. The bottleneck is field reports — when they're late or incomplete, I can't invoice. Manual reconciliation between labor-hour codes and job codes takes 3–4 hours per week per controller-team member."

### Q2 — "Biggest pain points day-to-day?"

- **Dana:** "No real-time margin visibility. The board asks 'how did last week go' and the honest answer is 'we'll know in 4 days when the numbers settle.' That's not acceptable in our industry anymore. I need weekly margin trajectory at hand."
- **Marcus:** "Schedule churn. Every Tuesday morning we lose 4–6 hours rebuilding the next week because the previous week's jobs didn't close cleanly. If I could cut that in half, I'd add a meaningful chunk of dispatcher productivity."
- **Priya:** "Quote turnaround for custom RFQs. I'm averaging 4 days when industry leaders are at 24–36 hours. We lose deals on speed alone."
- **Elena:** "Invoicing latency. Every day a field report sits incomplete is a day longer the invoice waits. Cash flow lives or dies on this. Secondary pain: manual reconciliation of labor hours to job codes."

### Q3 — "Where do you spend time on work that feels lower-leverage?"

- **Dana:** "Weekly KPI deck assembly + board prep. It's 12 slides, all manually compiled in PowerPoint from 5 systems. 4–5 days to build it. The data is right; the assembly is the time-sink."
- **Marcus:** "Dispatcher schedule rebuild. It's deterministic work — equipment + skills + drive time + job window — and a human is doing it by hand."
- **Priya:** "Copy-pasting from job records into our monthly client reports. We have ~40 active customers; building each report is 4–6 hours. That's 200–240 hours a month across the account team. Highly mechanical."
- **Elena:** "Chasing field reports. Following up with field supervisors to close out tickets. And reconciling labor hours line-by-line against job codes."

### Q4 — "Where do you see AI opportunity?"

- **Dana:** "Weekly KPI synthesis from job + scheduling + financial systems → executive briefing in 24 hours instead of 5 days."
- **Marcus:** "Dispatch optimization. Drive time + skill matching + equipment availability is a textbook AI problem. If AI proposes the schedule and humans approve, we save the Tuesday morning rebuild."
- **Priya:** "Quote draft from past similar jobs + RFP intake. If 90% of the quote draft is auto-generated and the sales team only edits the remaining 10%, we get to 24-hour turnaround."
- **Elena:** "Field-report-to-invoice draft generation. Pull the closed field report, generate the invoice draft, route for human approval. And: AI-assisted AR collections nudging for accounts over 45 days."

### Q5 — "What's not on the table?"

- **Dana:** "Pricing decisions stay human. Customer-facing communications get human sign-off."
- **Marcus:** "Final scheduling approval stays human. Safety + DOT compliance won't be automated."
- **Priya:** "Contract terms stay human. AI can draft, but contracts get signed by people."
- **Elena:** "GL postings stay human. AI helps with field-to-invoice reconciliation only, not the journal entry."

### Q6 — "AI readiness — concerns?"

- **Dana:** "We need ROI within 6 months or the board won't fund a second phase. Show me payback math, not vibes."
- **Marcus:** "Field crews need to trust the tool or they'll route around it. If the AI proposes a schedule that ignores field reality, my dispatchers stop using it within a week."
- **Priya:** "Don't break client trust with weird AI-generated language. We have customer relationships going back 10 years; our voice matters."
- **Elena:** "An auditor will ask what data the AI saw and how decisions were made. We need that trail."

### Q7 — "Constraints?"

- **Dana:** "Budget envelope is roughly $200k–$400k all-in over 12 months for the first wave."
- **Marcus:** "Can't disrupt active operations during peak hurricane prep, June through August. That's our highest-revenue quarter."
- **Priya:** "Client renewals close September through December. Don't introduce changes that disrupt account-team workflow during that window."
- **Elena:** "Must preserve FLSA/DOL audit posture. Labor-hour-to-job-code traceability has to remain auditable."

### Q8 — "Desired outcomes?"

- **Dana:** "Weekly KPI deck within 24 hours of week close, instead of 5 days."
- **Marcus:** "50% reduction in Tuesday-morning schedule rebuild time."
- **Priya:** "Custom RFQ turnaround under 48 hours, down from 4 days average."
- **Elena:** "DSO from 56 days to under 42 days within 6 months."

### Q9 — "Top 3 workflows you'd prioritize?"

- **Dana:** "Weekly margin dashboard."
- **Marcus:** "Dispatch optimization."
- **Priya:** "Quote draft acceleration."
- **Elena:** "Field-report-to-invoice draft generation."

### Q10 — "What does success look like 12 months from today?"

- **Dana, Marcus, Priya, Elena (consolidated):** "Integrated job-cost-to-margin reporting available within 24 hours of week close. Dispatcher saves at least one day per week on schedule rebuild. Custom RFQ win rate up to 40%+ from 32% on speed alone. DSO at 40–42 days. Board confident in margin trajectory. Field crews adopted the new tools because they make Friday tickets close cleaner. Audit trail satisfies our compliance posture."

## 5. Synthetic evidence / document baseline (5 acknowledgements)

The operator should **acknowledge** these synthetic documents through the deployed UI's intake-document path (per `docs/37` § 4.5). These are pointer/summary entries — no fabricated binary file uploads. Each entry's `title` should carry the `SYNTHETIC ICP PILOT — ` prefix.

| # | Document title (operator enters this exact string) | Synthetic summary content (operator pastes/types) |
|---|---|---|
| 1 | `SYNTHETIC ICP PILOT — Current Workflow Map Summary` | 9-step quote-to-invoice workflow described from Marcus's perspective, with timing per stage. Captures: CRM lead → custom quote (2–7d) → job creation in legacy tool → Friday scheduling → Sunday re-route → Monday briefing → field work → ticket close → ops review → invoice (7–14d after completion). |
| 2 | `SYNTHETIC ICP PILOT — Sample Work Order Lifecycle Summary` | Anonymized lifecycle of 8 representative work orders across last 90 days. Timestamps for each stage. 5 of 8 closed cleanly, 2 of 8 had field-report delays, 1 of 8 required rework. Average cycle time 12 days. |
| 3 | `SYNTHETIC ICP PILOT — Customer Reporting Example Summary` | Describes a typical monthly client report — 3 pages, manually compiled, 4–6 hours per customer per month, 40 active customers, total ~200 hours/month account-team time. |
| 4 | `SYNTHETIC ICP PILOT — Quote-to-Dispatch Process Summary` | RFQ intake template + 4 example RFQ response timelines: $32k repair (1.5d), $68k inspection contract (4d), $145k project (6d), $42k retainer (2d). Win/loss notes. |
| 5 | `SYNTHETIC ICP PILOT — KPI / Margin Reporting Summary` | Describes the current KPI deck — 12 slides, manually built in PowerPoint, data assembled from Sage + Salesforce + legacy field tool + 3 Google Sheets, 4–5 days assembly time per week. |

These five acknowledgements satisfy C3 (`documents_not_uploaded_or_acked`) of the docs/35 § 5 readiness gate when entered via the operator's canonical acknowledgement affordance OR when ≥ 1 input_assets row exists for the engagement.

## 6. Desired outcomes (one-line per persona — operator records as needed)

| Persona | Desired outcome |
|---|---|
| Dana Mitchell (executive) | Weekly KPI deck within 24h of week close |
| Marcus Lee (operations) | 50% reduction in Tuesday-morning schedule rebuild time |
| Priya Shah (sales) | Custom RFQ turnaround < 48h (from 4d) |
| Elena Torres (finance) | DSO < 42 days (from 56) |

## 7. Constraints & risks

| Constraint | Source | Pilot relevance |
|---|---|---|
| Budget envelope $200k–$400k over 12 months | Dana | Anchors proposal option pricing |
| Hurricane prep ramp June–August | Marcus | Limits when implementation can land |
| Renewal season September–December | Priya | Limits when client-facing workflow changes |
| FLSA/DOL audit posture preserved | Elena | Constrains AI involvement in labor-hour data |
| Field-crew trust threshold | Marcus | AI must augment, not replace; field crews need a "why this is faster" story |

## 8. Methodology mapping — Saipien Labs / SLATE AI Opportunity Sprint canon

This packet maps cleanly to the canonical AI Opportunity Sprint stages:

| Stage | Synthetic fixture contribution |
|---|---|
| Stage 1 (Setup) | Account + engagement created with `SYNTHETIC ICP PILOT —` prefix |
| Stage 2 (Intake) | 4 personas + 10 substantive responses + 5 doc acknowledgements |
| Stage 3 (Findings) | Input substantive enough for 5–8 findings: friction patterns (manual KPI assembly, schedule churn, quote latency, field-report lag), AI-readiness signals (mid budget, ROI within 6mo), ROI hypotheses ($/hour, rework reduction, DSO compression) |
| Stage 4 (Opportunities) | 3–4 opportunities map cleanly: AI-assisted weekly KPI assembly (Quick Win + Strategic Build hybrid), dispatch optimization (Strategic Build), quote draft acceleration (Quick Win), field-to-invoice draft generation (Quick Win or Strategic Build) |
| Stage 5 (Roadmap) | 30/60/90 sequencing: 30d quote-draft pilot + KPI deck pilot, 60d dispatch optimization design, 90d field-to-invoice + integrated rollout |
| Stage 6 (Report) | 12 sections supportable; ExecSummary substantive; methodology + roadmap + recommendations all groundable |
| Stage 7 (Proposal) | 3 options: AI Workflow System (recommended — quote + KPI + field-to-invoice), Quick-Win Build (quote draft + KPI deck only), Managed AI Partner (12-month retainer with phased rollout) |
| Stage 8 (SOW Draft) | Internal-only; commercial guard should pass since synthetic pricing placeholders + no e-sign / signature / final-pricing language |
| Stage 9 (Pre-delivery audit) | All 15 conditions should clear: C1 ≥ 3 invited roles (4 personas) ✅; C2 ≥ 2 ready response sessions ✅; C3 ≥ 1 document or ack ✅; C4 ≥ 8 drafted findings — depends on AI synthesis output; C5 ≥ 5 approved findings — depends on operator approval; C6–C10 likewise depend on synthesis + operator approval; C12 + C15 depend on snapshot approval + commercial guard |
| Stage 10 (Mint /r + /p) | Audience label: `SYNTHETIC ICP PILOT 2026-06-10 MERIDIAN FIELD SERVICES` — passes audit-label heuristic (no `audit/walkthrough/test/controlled/sample/staging/dev/qa` prefix) |
| Stage 11 (Handle) | Operator-mediated copy-link; no SLATE-side send |

## 9. Synthetic labeling protocol — MANDATORY

Every record the operator creates as part of this fixture must carry the `SYNTHETIC` label in at least one of the canonical fields:

- `accounts.name` → `Meridian Field Services` (no prefix — the synthetic nature is documented; account name is left clean so the audit + reports read cleanly)
- `engagements.name` → `SYNTHETIC ICP PILOT — MERIDIAN FIELD SERVICES`
- `stakeholder_intake_sessions.stakeholder_name` → e.g. `SYNTHETIC — Dana Mitchell (COO)`
- `input_assets.title` → prefix every title with `SYNTHETIC ICP PILOT — `
- Mint audience label → `SYNTHETIC ICP PILOT 2026-06-10 MERIDIAN FIELD SERVICES`

If the operator's UI affordance does not surface a name/title field at every stage, the operator should still set `client_visible = false` on every offline-staged record per `docs/37` § 3.1.

## 10. What this packet is NOT

- ❌ A real-client engagement plan. Meridian Field Services is a fabricated company.
- ❌ A testimonial, case study, or proof point for SLATE marketing.
- ❌ A template the operator should copy-paste into a real client engagement.
- ❌ Authorization to send any artifact (`/r`, `/p`, SOW Draft) to any external party.
- ❌ A bypass of the S11 pre-delivery audit gate. The audit must clear before mint.

## 11. Paired run document

The operator-driven execution checklist + per-stage verification protocol + final results + audit + mint outcome live in `docs/60_SYNTHETIC_ICP_PILOT_RUN.md`. Both docs land in the same commit.

## 12. Suggested commit footprint

This packet doc (`docs/59`) lands together with `docs/60` and the four cross-ref updates (`docs/58`, `docs/39`, `docs/08`, `docs/10`). No source touch. No migration. No package change.
