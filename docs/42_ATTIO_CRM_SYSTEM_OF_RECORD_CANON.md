# Attio CRM System-of-Record Canon

## Status

- **Date authored:** 2026-06-02
- **Sprint type:** Canon / planning sprint — no source code, no migration, no CRM connection, no engagement mutation, no Sapient Digital interaction
- **Sprint identifier:** Sprint S3-A — Attio CRM System-of-Record Canon
- **Roadmap split:** Sprint S3 in `docs/39` § 5 is split into **S3-A** (this canon doc — landed) and **S3-B** (Attio Read Context Implementation — recommended next sprint). The roadmap sequence past S3-B is unchanged: S4 — AI Findings Synthesis Integration follows.
- **Branches at authoring:** `staging` and `persistence/step-0-1-auth-shell` both at `bdcd8ee` ("Add transcript intake workflow").
- **Authority:** This document locks Attio as Saipien's first CRM system of record / relationship context source for SLATE engagement enrichment. The selection is final unless a blocker surfaces during S3-B implementation; in which case the architect decision rule (`docs/39` § 11) routes the discovery, not a re-litigation of this canon.

---

## 1. Decision summary

| Decision | Verdict |
|---|---|
| Should SLATE integrate a CRM as engagement-context input? | **✅ Yes** — per `docs/39` § 4.2 hierarchy, CRM is a secondary input lane (engagement-level only, never stakeholder-level) |
| Which CRM for Saipien's first connector? | **✅ Attio** |
| Should SLATE write to the CRM in Sprint S3? | **❌ No** — S3-B is read-only. Writeback is `docs/39` § 7 deferred-expansion (Sprint S18 at earliest) |
| Should SLATE support multiple CRMs in Sprint S3? | **❌ No** — Attio is the only connector. A provider-neutral internal shape (`CrmContext`) exists at the adapter boundary so a future migration is possible without re-architecture, but no second connector is built |
| Should SLATE replace itself with the CRM? | **❌ No** — SLATE remains the system of record for engagement execution. Attio is read-only context, never the source of truth for findings, opportunities, roadmap, report, or proposal |
| Should this canon authorize implementation? | **✅ Conditionally** — Sprint S3-B (Attio Read Context Implementation) is recommended next. Open operator decisions in § 16 must be answered before S3-B begins |

**Recommended default for the first build:** Sprint S3-B implements (1) a `lib/crm/attio/` connector module with read-only fetch helpers, (2) an internal `CrmContext` provider-neutral shape, (3) a single optional `attio_company_id` column on the SLATE `accounts` table (migration TBD per § 16), (4) EngagementContextCard enrichment for accounts that have a linked Attio company. Brand-tagging via Attio property; no separate workspace.

---

## 2. Why Attio was selected

Attio fits Saipien's operating posture for these specific reasons:

1. **Modern flat-object data model.** Attio's objects (Company / Person / Deal) are user-extensible without schema migrations on the CRM side — operator can add the Brand / Business Unit field, SLATE Account ID, SLATE Engagement ID, Known Pain Points, etc., without engineering work in Attio. This matches Saipien's lightweight cadence.
2. **API-first.** Attio exposes a clean REST + GraphQL API with stable IDs. The SLATE connector can be a thin read-only adapter rather than a sync engine.
3. **Designed for relationship context, not pipeline coercion.** Attio's defaults treat each Company / Person row as a node in a relationship graph — closer to how Saipien actually works (advisor-style engagements with a handful of high-touch accounts) than HubSpot's deal-pipeline-first model.
4. **Single-workspace multi-brand support via fields/tags.** Attio's property model lets a single workspace serve Saipien Labs Consulting, Venture Studio, Sapient Digital, Ventrys, Pravado, Aivery, and future brands without paying for multiple seats / instances. Brand becomes a property; filters become saved views.
5. **Sub-brand portability.** When a sub-brand spins out (e.g. Ventrys becoming its own entity with a dedicated team), Attio can export the relevant subset by filter without rebuilding the data model.
6. **Light onboarding cost.** A small team's CRM hygiene cost in Attio is materially lower than HubSpot's. Saipien's relationship-driven advisory motion does not benefit from HubSpot's marketing-automation layer.
7. **Pricing posture.** Attio's per-seat pricing scales linearly with the actual team size; HubSpot's tiered pricing forces feature commitments that don't match the read-only context use case.

Attio's risks (acknowledged, not blockers):

- Smaller vendor footprint than HubSpot — vendor risk is real, addressed in § 14 migration / exit strategy.
- API rate-limit posture (200 requests / minute / workspace per Attio's published limits as of authoring) — adequate for read-only engagement-context fetch at Saipien's scale; not adequate for high-frequency sync, but S3 doesn't sync.
- No public SOC 2 Type II report at authoring date (Attio is SOC 2 Type I as of this writing) — acceptable because SLATE never sends client data TO Attio. The data flow is one-way: Attio → SLATE for context.

---

## 3. Why HubSpot was NOT selected for S3

This section exists so the decision doesn't get re-litigated mid-sprint. HubSpot is a respectable CRM; it is not the right CRM for this use case at this scale.

| Dimension | HubSpot posture | Attio posture | Decision driver |
|---|---|---|---|
| Data model | Deal-pipeline-first; objects are extensible but heavy | Object-first; flat extensible properties | Attio matches Saipien's relationship-first motion |
| Multi-brand support | Multiple portals (paid per portal) OR pipeline-per-brand within one portal (clunky) | Single workspace + Brand property + saved views | Attio is materially cheaper + simpler for Saipien's sub-brand count |
| API surface | Mature, rate-limited (100 req/10s per private app); complex object hierarchy | REST + GraphQL; flat IDs | Attio is simpler for a read-only adapter |
| Marketing automation | Strong (sequences, workflows, ABM) | Minimal | Saipien doesn't use it — feature would be unused overhead |
| Pricing | Hub-based tiered pricing; feature lock-in | Per-seat | Attio is the cleaner fit |
| Vendor maturity / market footprint | Larger | Smaller | HubSpot wins on this dimension only — addressed in § 14 |
| Exit strategy | Export via API; well-trodden migration path | Export via API; less common but technically equivalent | Both are exit-able; SLATE's adapter boundary makes the choice reversible |
| First-class engagement / advisory object | None | None | Tied — both treat advisory as a Deal-shaped concept |
| Time-to-first-context-fetch (estimated) | 1-2 sprints + portal setup | 1 sprint + workspace setup | Attio is faster to S3-B value |

**HubSpot is not declined permanently.** If Saipien's customer base expands to where HubSpot's marketing-automation features are needed, a future sprint could add a second connector behind the same `CrmContext` shape (`docs/39` § 7 deferred lane). S3 picks the right tool for the immediate need; S18+ revisits if posture changes.

---

## 4. Why SLATE remains the system of record

SLATE owns the engagement execution surface. The CRM is read-only context, never the system of record. Three architectural reasons:

1. **Workflow ownership.** Findings synthesis, opportunity scoring, roadmap items, report sections, proposal options, internal SOW Draft, share-token mint, audit trail — none of these live in any CRM. They live in SLATE's Supabase. Building the contract such that SLATE depends on the CRM for execution data would force vendor lock-in on a CRM that can change.
2. **Vendor portability.** Saipien may switch from Attio to HubSpot to GHL to whatever-comes-next without rebuilding the consulting deliverable engine. The provider-neutral adapter in § 13 makes this possible; making SLATE the system of record makes it durable.
3. **Compliance posture.** SLATE's RLS-bound Supabase + signed audit events are the canonical trail. CRM data is enrichment, not evidence. Findings synthesis (`docs/39` § 4.5) treats CRM as engagement-level context; it never feeds the per-stakeholder weighting.

**Concretely:** if Attio goes down for 24 hours, SLATE engagements continue to work. Intake forms still submit. Offline + transcript intake still works. Findings synthesis (once it lands in S4) still runs on stakeholder-response data persisted in Supabase. Only the EngagementContextCard's CRM enrichment section degrades to "Unable to fetch CRM context" — every other surface is unaffected.

---

## 5. Attio's role as read-only engagement context

For Sprint S3-B and forward (until a writeback canon authorizes otherwise):

- **What Attio provides:** account-level relationship context — owner, last touch, deal stage, brand, known pain points (operator-curated in Attio), pipeline value, related person summary. These become read-only enrichment on the `EngagementContextCard` and possibly an "Account context" sidebar on the engagement detail page.
- **What Attio does NOT provide:** stakeholder-level signal for findings synthesis. Per `docs/39` § 4.5, CRM is engagement-level signal, not per-stakeholder. A stakeholder's response to "Where do handoffs slow down?" is canonical SLATE intake data; an Attio Person note saying "Casey mentioned the handoff pain on the May call" is engagement context that may bias the operator's framing, but does not feed synthesis weighting.
- **Trust posture:** CRM data is operator-curated free text in many fields. It is informative, not authoritative. Findings synthesis must NOT treat "Known Pain Points" in Attio as ground truth — it is one of many inputs the operator weights at the synthesis review step.
- **Refresh model:** S3-B fetches on engagement page load (cache-busting acceptable for the read-only path). No background sync. No webhook subscription. No write path.

---

## 6. CRM context hierarchy

Per `docs/39` § 4 hierarchy with explicit clarification:

| Hierarchy level | Lane | This canon's rule |
|---|---|---|
| Primary | Online live-link intake (`source_type='live_link'`) | Unaffected by CRM |
| Secondary | Meeting transcripts / notetaker imports (`source_type='transcript' | 'meeting_notes'`) | Unaffected by CRM |
| Secondary | **CRM read context** | **This canon's lane.** Engagement-level only. Never per-stakeholder. Never findings evidence unless explicitly promoted by operator with audit-logged reason. |
| Tertiary | Operator-typed offline (`source_type='operator_entered'`, etc.) | Unaffected by CRM |

**"Engagement-level only" means:**

- The CRM provides context that applies to the whole engagement (account name, brand, deal stage, owner, account-level pain points).
- The CRM never provides input that maps to a single `stakeholder_responses` row.
- A future operator-promotion path could exist (e.g. "Promote this Attio note to a transcript-source response") but it must:
  1. Be operator-initiated (not automatic).
  2. Create a real `stakeholder_responses` row with `source_type='operator_entered'` (tertiary), not `'live_link'` (primary).
  3. Cite the Attio source in `operator_notes` for provenance.
  4. NOT be implemented in S3-B. This is a `docs/39` § 11 Improvement → Backlog item.

---

## 7. Saipien single-workspace model

Saipien Labs operates ONE Attio workspace covering all current and future brands. This is the canonical model for the foreseeable future.

**Rationale:**

- All brands share the same operator pool (Saipien Labs partners and the small operating team).
- Per-brand workspaces would multiply per-seat cost without providing isolation that the team actually needs.
- Cross-brand reporting (e.g. "what is the combined pipeline across all Saipien brands?") is trivially possible in one workspace and hard across multiple.
- Sub-brand exits remain feasible — at exit, the workspace owner exports the subset by Brand property filter (§ 14).

**Workspace naming:** open operator decision (§ 16). Recommended: `Saipien Labs` or `Saipien Labs HQ`.

---

## 8. Brand / Business Unit tagging model

Every Attio Company, Person, and Deal MUST carry a `Brand` (or `Business Unit`) property. This single property + saved views replaces per-brand workspace separation.

### 8.1 Canonical brand value list (initial)

| Brand value | Description |
|---|---|
| `Saipien Labs Consulting` | AI Opportunity Sprints and follow-on advisory under the Saipien Labs Consulting brand |
| `Venture Studio` | Venture-studio activity (incubation, internal builds) |
| `Sapient Digital` | The Sapient Digital sub-brand engagements |
| `Ventrys` | Ventrys sub-brand engagements |
| `Pravado` | Pravado sub-brand engagements |
| `Aivery` | Aivery sub-brand engagements |
| `Future Brand` | Placeholder for sub-brands not yet named at canon authoring time; operator renames to the actual brand label when the sub-brand is added |

**New brands** are added by editing the property's allowed-value list in Attio. SLATE's adapter (S3-B) accepts any string value the operator picks; the SLATE-side rendering may color-code or sort known brands but never blocks unknown ones.

### 8.2 SLATE-side filtering

The `EngagementContextCard` shows the brand chip when present. SLATE engagement queries do not filter by brand internally — brand is enrichment, not a query primitive — but the operator can use Attio's brand-filtered saved views for cross-engagement reporting outside SLATE.

### 8.3 What this model does NOT do

- ❌ No separate Attio workspace per brand.
- ❌ No per-brand pipeline objects in Attio (pipeline stage is a property, not a pipeline-per-brand).
- ❌ No SLATE-side brand-scoped RLS (SLATE workspace_id remains the only tenant boundary).
- ❌ No SLATE engagement filter by brand in S3-B (brand visibility only, no filter UX).

Per-brand pipelines or per-brand workspaces are `docs/39` § 7 deferred-expansion lanes. Out of S3 scope.

---

## 9. Object mapping

Three top-level Attio objects map to SLATE entities for the read-only S3-B fetch:

### 9.1 SLATE Account ↔ Attio Company

- **SLATE side:** `public.accounts` row (one per real business entity SLATE engages with).
- **Attio side:** Attio Company object (one per real business entity Saipien tracks in CRM).
- **Linking:** `accounts.attio_company_id text null` column added in S3-B (per § 11 / § 16). Stored once at engagement creation time (or on first fetch); subsequent fetches do NOT rematch by domain — see § 9.5.
- **Direction:** read-only. SLATE never writes to Attio Company.

### 9.2 SLATE Contact / Stakeholder ↔ Attio Person

- **SLATE side:** Per-engagement stakeholder rows live in `stakeholder_intake_sessions` (not in a top-level Contact table). Whether to add an `attio_person_id` column on `stakeholder_intake_sessions` is deferred to S3-B (§ 16 open decision).
- **Attio side:** Attio Person object.
- **Direction:** read-only. SLATE never writes to Attio Person.
- **Use case:** S3-B may fetch the set of People linked to a Company to surface "Recent activity" or "Relationship owner" context.

### 9.3 SLATE Engagement / Opportunity context ↔ Attio Deal

- **SLATE side:** `public.engagements` row + (later) `public.opportunities` rows.
- **Attio side:** Attio Deal object (or Attio's equivalent — Attio's product calls them "Lists" historically; the modern object is "Deal" or operator-chosen object).
- **Linking:** Optional `attio_deal_id` on `public.engagements` for context enrichment. Not required for S3-B.
- **Direction:** read-only.

### 9.4 No tertiary object mapping

S3-B does NOT introduce:

- A SLATE↔Attio Workspace mapping (only one Attio workspace exists for Saipien).
- A SLATE↔Attio User mapping (operator owner names are display-only).
- A SLATE↔Attio Pipeline mapping (Attio Pipeline Stage is a property on the Deal object, fetched and rendered as a string).

### 9.5 Domain rematch is initial-linking only

When the operator first links an account to Attio, the connector MAY rematch by domain (account → Attio Company with the same primary domain) as a one-time convenience. **All subsequent fetches use `accounts.attio_company_id` for deterministic lookup.** This avoids:

- Drift when Attio Company records are merged or renamed.
- Performance cost of domain-search on every page load.
- Ambiguity when multiple Attio Companies share a domain (e.g. holding companies).

If the stored Attio company ID returns 404 at fetch time, the connector surfaces an "Attio link broken — re-link?" affordance on the EngagementContextCard. Re-linking is an operator action.

---

## 10. Required Attio fields / properties

The Attio workspace owner (Saipien) MUST create the following properties on the Attio Company object before S3-B can read meaningful context. Per-property notes describe how SLATE renders them.

| Attio property | Type | SLATE consumption |
|---|---|---|
| `Brand` (or `Business Unit`) | Single-select | Rendered as a chip on EngagementContextCard. § 8 canonical list. |
| `SLATE Account ID` | Text | Optional reverse-link; lets operator find SLATE from Attio. Not required for S3-B read. |
| `SLATE Engagement ID` | Text | Optional reverse-link. Stored on the Attio Deal record (if present), not on Company. Not required for S3-B read. |
| `Lead Source` | Single-select | Rendered as a chip ("Referral", "Inbound", "Outbound", etc.). Free-text fallback. |
| `Pipeline Stage` | Single-select | Rendered as the current deal-state chip. |
| `Deal Value` | Currency | Rendered as a number with currency code, when present. |
| `Last Touch` | Date / Datetime | Rendered as relative date ("3 days ago") in the context card. |
| `Relationship Owner` | User reference (Attio user) | Rendered as the owner's name + initials. SLATE never sends notifications to this owner — it's display only. |
| `Known Pain Points` | Long text | Rendered as a short preview (first ~280 chars). Full text behind a "View in Attio" link. NEVER fed into findings synthesis directly per § 5. |
| `Buying Timeline` | Single-select | Rendered as a chip ("This quarter", "Next quarter", etc.). |
| `Notes / Recent Activity pointer` | URL or text | Renders the most recent Attio note's preview + link to Attio. Read-only; no inline edit. |

Properties may have additional Attio-side semantics (workflows, automations, etc.) that SLATE does NOT consume in S3-B.

---

## 11. Required SLATE fields / properties

S3-B adds at most ONE new column to existing SLATE tables. Operator approval required (§ 16).

| Table | Column | Type | Required? | Purpose |
|---|---|---|---|---|
| `public.accounts` | `attio_company_id` | `text null` | Required for S3-B | Deterministic CRM lookup (§ 9.5) |
| `public.stakeholder_intake_sessions` | `attio_person_id` | `text null` | Optional, deferred | Per-stakeholder CRM cross-link; not needed for S3-B core flow |
| `public.engagements` | `attio_deal_id` | `text null` | Optional, deferred | Deal-level enrichment; not needed for S3-B core flow |

Migration posture:

- The `attio_company_id` column is additive (`add column if not exists`) per the project's established migration pattern.
- No CHECK constraints (Attio IDs are opaque strings — no vocabulary to enforce).
- No NOT NULL (existing accounts without an Attio link are valid).
- No RLS policy changes — the column is workspace-scoped automatically through the parent row.

Whether to land the migration in S3-B or split it into its own micro-sprint is open (§ 16). Recommendation: include in S3-B.

---

## 12. S3-B implementation scope

**The next sprint after this canon.** Implementation, not canon. Scope-locked here so S3-B doesn't drift:

1. **New module:** `lib/crm/attio/` containing:
   - `client.ts` — auth-aware Attio API client (auth posture per § 16 open decision).
   - `companies.ts` — read-only fetch helpers (`getCompanyById`, `findCompanyByDomain` for initial linking only).
   - `people.ts` — read-only fetch helpers for the linked-people summary.
   - `deals.ts` — read-only fetch for deal-level enrichment.
   - `mappers.ts` — translation from Attio's API shape to the internal `CrmContext` shape (§ 13).
   - `types.ts` — Attio-API-shaped TypeScript types.
2. **Internal contract:** `lib/crm/types.ts` exporting `CrmContext` shape — provider-neutral, used by all UI surfaces. UI never imports `lib/crm/attio/` types directly.
3. **Optional migration:** `supabase/migrations/0018_accounts_attio_company_id.sql` adding `attio_company_id text null` to `public.accounts` per § 11.
4. **Query layer:** `lib/crm/queries.ts` server-only fetcher that takes an engagement id + account id, reads `attio_company_id`, calls the Attio connector, returns a populated `CrmContext` (or null if not linked / fetch failed).
5. **UI surface:** `EngagementContextCard` extended with an "Attio context" section rendering brand, owner, last touch, pipeline stage, deal value, known-pain-points preview. Renders the "Link to Attio" affordance when `attio_company_id` is null and the operator has authority to link.
6. **Linking action:** `lib/crm/actions.ts` server action `linkAccountToAttioCompanyAction({accountId, attioCompanyId})` — cookie-bound auth, workspace-scoped write to the new column. **NO Attio writeback.**
7. **Activity event:** new event type `account_linked_to_attio` with metadata `{attioCompanyId}` only (no name, no domain, no Attio properties).
8. **Operator settings:** `Settings` surface or env var to configure the Attio API credentials per § 16.

S3-B non-goals:
- ❌ No writeback (Sprint S18+).
- ❌ No background sync.
- ❌ No webhook subscriptions.
- ❌ No lead push (Saipien's Free Audit / scorecard leads stay in SLATE only — see § 15 deferred).
- ❌ No multi-CRM support.
- ❌ No customer-facing CRM integration (this is internal-only).
- ❌ No CRM-triggered findings synthesis.
- ❌ No CRM-triggered automation of any kind.
- ❌ No promotion of Attio notes into stakeholder_responses (§ 6 future Backlog item).

---

## 13. Provider-neutral adapter boundary

The contract that makes Attio replaceable without re-architecture.

### 13.1 Internal `CrmContext` shape (Sprint S3-B will define this precisely)

```ts
// lib/crm/types.ts — illustrative; final shape lands in S3-B
export interface CrmContext {
  provider: "attio";            // string union; new providers extend this
  providerCompanyId: string;
  brand: string | null;
  leadSource: string | null;
  pipelineStage: string | null;
  dealValue: { amount: number; currency: string } | null;
  lastTouchAt: string | null;   // ISO
  relationshipOwner: { displayName: string; initials: string } | null;
  knownPainPointsPreview: string | null;  // first ~280 chars
  knownPainPointsFullUrl: string | null;  // link back to Attio
  buyingTimeline: string | null;
  recentActivityPreview: string | null;
  recentActivityUrl: string | null;
  fetchedAt: string;            // ISO; UI shows "as of N min ago"
}
```

### 13.2 Adapter boundary rules

- **UI imports `lib/crm/types.ts` only.** UI components NEVER import `lib/crm/attio/` directly. This is enforceable by ESLint pattern if it becomes a drift risk.
- **All Attio-specific mapping lives in `lib/crm/attio/mappers.ts`.** The mapper translates Attio's API response into `CrmContext`. Renaming properties or adding fields in Attio touches the mapper, not the UI.
- **`lib/crm/queries.ts` is the single read entry point.** It accepts an engagement-shaped input and returns `CrmContext | null`. Provider selection happens here (initially hard-coded to `"attio"`; a future second provider extends the union).
- **No provider switch / strategy pattern in S3-B.** Adding a second provider is out of scope. The neutral shape exists so it's *possible*, not so it's planned.

### 13.3 What this is NOT

- ❌ A customer-facing connector marketplace.
- ❌ A multi-CRM admin UX.
- ❌ A productized integration platform.
- ❌ A provider-strategy pattern with runtime selection.

It is an internal abstraction that buys exit optionality without taking on the cost of building an integration product.

---

## 14. Migration / exit strategy

Choosing Attio is a reversible decision. The path to exit is documented here so the decision feels safe.

### 14.1 What stays canonical in SLATE regardless of CRM

- Engagement lifecycle (intake, findings, opportunities, roadmap, report, proposal, SOW).
- Stakeholder data (`stakeholder_intake_sessions`, `stakeholder_responses`, `engagement_intake_documents`).
- All activity events.
- All share tokens and delivery snapshots.
- Workspace-bound RLS posture.
- Audit trail.

**None of these live in the CRM.** Switching CRMs leaves the engagement deliverable engine untouched.

### 14.2 What gets exported on exit

If Saipien migrates from Attio to HubSpot or another CRM:

1. **Attio export:** Saipien exports the Attio workspace as CSV (Company, Person, Deal, properties, notes). Attio's API + UI both support this. No Saipien-specific tooling needed.
2. **SLATE mapping:** Update the mapper module (`lib/crm/<new-provider>/mappers.ts`) to translate the new provider's API into `CrmContext`. Replace `attio_company_id` with `hubspot_company_id` (or a generic `crm_provider_id` + `crm_provider_name` pair).
3. **Migration script:** A one-time migration walks `accounts` and rewrites `attio_company_id` → `hubspot_company_id` using the CSV-mapped lookup. Operator-confirmed per row OR bulk by domain.
4. **UI swap:** The UI imports from `lib/crm/types.ts` only — no UI change needed if the new mapper preserves the shape.

### 14.3 Estimated exit cost

A future CRM migration is bounded by:

- The size of the Attio→new-CRM mapping table (Saipien's account count, currently small).
- The complexity of the new mapper module.
- One migration sprint to ship the column rename + lookup translation.

The exit is real and feasible. SLATE never becomes hostage to Attio.

---

## 15. Deferred items

The following are explicitly NOT in scope for S3-A or S3-B. They are listed so the operator + Claude both know the boundary:

| Item | Why deferred | Re-evaluate when |
|---|---|---|
| Writeback (SLATE → Attio) | Read-only S3 is sufficient for engagement-context enrichment; writeback adds two-way-sync surface that's not justified at Saipien's scale | Sprint S18 per `docs/39` § 7 |
| Lead push (Free Audit / scorecard leads → Attio) | Lead-to-CRM push is its own design conversation (qualification thresholds, duplicate handling, attribution); SLATE owns its lead funnel | After Sprint S20; operator may decide it doesn't belong in SLATE at all |
| Two-way sync (Attio ↔ SLATE) | Sync engines are a high-complexity, high-failure-mode surface; deferred indefinitely | Re-evaluate only if Saipien wants Attio to be the primary editing surface for any SLATE-owned data, which the SoR posture in § 4 explicitly rejects |
| Customer-facing CRM integrations | SLATE is an internal Saipien OS, not a SaaS product — no customer CRM integrations belong in scope | Never (per current product framing) |
| CRM-triggered automation | "When deal stage changes, trigger SLATE action X" is out of scope | After Sprint S20 |
| Email send via Attio sequences | SLATE never sends — manual-delivery posture stands | Sprint S17 (SLATE email send canon) is the venue, not Attio integration |
| Multi-brand pipelines beyond field/tag | Brand property + saved views is the model; multi-pipeline would be CRM-side complexity for no SLATE-side benefit | If brands materially diverge in pipeline shape, revisit at S20 |
| Multi-CRM connector marketplace | Out of scope per § 13.3 | Never (not a SLATE responsibility) |
| Promote Attio note → stakeholder_responses | Possible operator-initiated future affordance; deferred per § 6 | Backlog Improvement; reconsider when synthesis quality observability lands in S5 |

---

## 16. Operator decisions — resolved

The five open decisions identified during this canon authoring are RESOLVED below by the operator on 2026-06-02. Sprint S3-B may proceed using the answers in this section as canonical inputs. Each subsection includes the original question, the operator's resolution, and any constraint the resolution places on S3-B implementation.

### 16.1 Attio workspace name — **`Saipien Labs HQ`**

The canonical Attio workspace for Saipien's CRM context is named **`Saipien Labs HQ`**. S3-B configuration documents and any operator-visible labels reference this name. Sub-brand engagements live in this workspace via the Brand property (§ 8), not in separate workspaces.

### 16.2 Final Brand property values — **locked per § 8.1**

The Brand / Business Unit property's initial allowed-value list is locked at:

- `Saipien Labs Consulting`
- `Venture Studio`
- `Sapient Digital`
- `Ventrys`
- `Pravado`
- `Aivery`
- `Future Brand` (placeholder for sub-brands not yet named at canon authoring time; operator renames when the actual brand label is added)

§ 8.1 is updated to reflect this. New brand values are added by the operator editing the Attio property's allowed-value list; SLATE renders any string value the operator picks and never blocks unknown ones.

### 16.3 Custom-field creation timing — **operator creates fields manually before S3-B**

The Attio properties listed in § 10 (Brand, SLATE Account ID, SLATE Engagement ID, Lead Source, Pipeline Stage, Deal Value, Last Touch, Relationship Owner, Known Pain Points, Buying Timeline, Notes / Recent Activity pointer) are created by the operator in the Attio UI BEFORE Sprint S3-B kickoff. This is roughly a 30-minute operator-side setup task.

S3-B implementation still handles missing properties gracefully — any property absent at fetch time renders as `null` in `CrmContext` and the corresponding UI surface either omits the field or shows an "—" placeholder, without erroring. This makes S3-B robust to future Attio-side property additions or removals.

### 16.4 API auth posture — **server-only `ATTIO_API_KEY` env var**

Sprint S3-B uses an **Attio API key stored as a server-only environment variable** (`ATTIO_API_KEY`). The variable is set in Vercel Production + local `.env.local`; never bundled into client code; never echoed in logs; never written to any commit. The `lib/crm/attio/client.ts` module reads the env var server-side only.

OAuth is rejected for this sprint because the connector is internal-only against a single Saipien workspace and does not act on behalf of multiple Attio users. If a future multi-tenant or per-operator use case emerges (extremely unlikely for an internal OS), an OAuth lane can be added without changing the `CrmContext` shape.

S3-B never logs the API key. Activity events that record link operations include only the `attioCompanyId` semantic field — never auth material.

### 16.5 `attio_company_id` migration timing — **lands inside Sprint S3-B as `0018_accounts_attio_company_id.sql`**

Sprint S3-B ships the migration `supabase/migrations/0018_accounts_attio_company_id.sql` adding `attio_company_id text null` to `public.accounts`. The column is additive (`add column if not exists`), nullable, no CHECK constraint, no RLS policy change (parent-row workspace scope inherits). No `attio_person_id` or `attio_deal_id` columns ship in S3-B — those remain deferred per § 11.

This avoids sprint proliferation and keeps the canonical Attio context lane assembled in a single review cycle.

### 16.6 What is still NOT pre-decided

The above five resolutions cover every open question raised during canon authoring. Discoveries during S3-B implementation route through `docs/39` § 11's architect decision rule, not through this canon doc. Material discoveries that change S3-B's scope are surfaced to the operator for re-classification (blocker / critical-path / improvement / expansion) before any scope expansion lands.

---

## 17. Acceptance criteria

This canon sprint is complete when:

1. ✅ `docs/42_ATTIO_CRM_SYSTEM_OF_RECORD_CANON.md` is authored covering all 18 required sections in the task spec.
2. ✅ Attio is explicitly locked as the S3 CRM.
3. ✅ HubSpot comparison is included but does not re-open the decision (§ 3).
4. ✅ SLATE-as-system-of-record boundary is explicit (§ 4).
5. ✅ Read-only S3 boundary is explicit (§ 5, § 12).
6. ✅ `attio_company_id` requirement is captured (§ 11).
7. ✅ Brand / sub-brand tagging model is captured (§ 8).
8. ✅ Provider-neutral adapter boundary is captured without building multi-CRM (§ 13).
9. ✅ `docs/39` § 5 split into S3-A (this canon — landed) and S3-B (implementation — recommended next). No other sequencing changes.
10. ✅ `docs/08` + `docs/10` updated.
11. ✅ Zero source code changes.
12. ✅ Zero data mutations.
13. ✅ Zero Attio connection (no API key created, no OAuth flow initiated, no API request made).
14. ✅ Zero `/r` or `/p` mint. Zero Send to Client. Zero SOW exposure. Zero email/CRM/e-sign integration code.

---

## 18. Recommended next sprint

**Sprint S3-B — Attio Read Context Implementation.**

Operator inputs needed before kickoff (per § 16):
- Attio workspace name finalized.
- § 10 property list created in Attio.
- API key vs OAuth decision.
- Confirmation that `attio_company_id` migration ships inside S3-B (recommended) or as its own micro-sprint.

S3-B scope is the § 12 list above, scope-locked, no drift. Acceptance: lint + build clean; one migration applied to deployed Supabase; one Attio company can be linked to a SLATE account via the new action; EngagementContextCard renders Attio context for the linked account; all boundary checks (no writeback, no email, no /r or /p, no Sapient mutation) pass.

After S3-B: **Sprint S4 — AI Findings Synthesis Integration** per `docs/39` § 5. The roadmap sequence past S3-B is unchanged.

---

## Files modified by this canon sprint

- `docs/42_ATTIO_CRM_SYSTEM_OF_RECORD_CANON.md` (this file — new)
- `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` (S3 row split into S3-A canon + S3-B implementation; no other sequencing changes)
- `docs/08_CURRENT_STATUS.md` (Sprint S3-A block added at top)
- `docs/10_SESSION_HANDOFF.md` (Latest line replaced with S3-A outcome + next-planned pointer to S3-B)

**Zero source code changes. Zero migration runs. Zero engagement mutations. Zero `/r` or `/p` mint. Zero send. Zero schema or package changes. Zero Attio connection. Zero Sapient Digital interaction.**
