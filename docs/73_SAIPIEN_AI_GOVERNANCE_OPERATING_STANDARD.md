# Saipien AI Governance Operating Standard

## Status

- **Version:** 0.2 — **DRAFT for founder ratification** (v0.1: 2026-09-28)
- **Date:** 2026-10-26
- **Owner:** Saipien Labs (GovernanceOS / internal operations)
- **Applies to:** every AI system, model, agent, automation and AI-assisted
  workflow Saipien Labs builds, operates, or uses on client work.
- **System of record:** the "Saipien Labs — Internal AI Governance" program in
  GovernanceOS (`/app/governance`, `program_kind = 'internal'`). The starter
  register (§4) and the seven GOV policies (§1) load into it as proposals and
  drafts; **ratification = the founder activating each policy with a reason.**
- **Public version:** the controls GOV 01–07 are published on saipienlabs.com
  (Governance, "How we govern our own AI"). This document is the full internal
  standard behind them.
- **What changed from v0.1:** facts re-verified against production on
  2026-10-24/26; GOV 01–07 numbered to match the public site; Attio fixed
  (`0018`); WRJ, BuildOS/factory agents and `gpt-4.1` added to the inventory;
  GOV 02 and GOV 06 are now **enforced by SLATE** (migrations `0037`/`0038`);
  open decisions consolidated in §9.

---

## 1. The controls

| Tag | Control | What it requires | How SLATE makes it true |
|---|---|---|---|
| **GOV 01** | Human authority | AI drafts, classifies, maps and recommends. A named person approves anything consequential: client-facing output, production AI changes, risk acceptance, exceptions. | Client output can't be delivered without approval (pre-delivery audit). **`0038`: the database refuses any approval with no signed-in person and stamps the approver** on findings, opportunities, report sections, reports, proposals and proposal/SOW snapshots. Risk acceptance and exceptions get decision records in G3. |
| **GOV 02** | Proportionality | Controls scale with three readings per system: data sensitivity, autonomy, client impact. | **`0037`: the control tier is derived by the database** from the three readings (highest wins: standard / elevated / high). GovernanceOS lists the controls each tier requires and shows which are on record. |
| **GOV 03** | Evidence first | Claims point at records, runs, files and decisions, never at assertion. | AI runs logged (`ai_synthesis_runs`); approvals name the approver (`0038`); lifecycle changes carry a reason (DB-written history); policy versions immutable once active; durable file store with checksums. Evidence links per claim: G3. |
| **GOV 04** | Approved tools register | No AI tool touches client work until it is on the register and approved. No client data in consumer AI accounts. | The register is the internal program's registry; approval is the active **GOV 04 policy version** listing approved tools, activated by the founder with a reason. |
| **GOV 05** | Model and provider changes | Proposed with cost and data affected, tested on a sample run, approved, then changed. The next live run is spot-checked. | Procedure (§5) recorded against the **GOV 05 policy**; each change is a new asset record update or policy version with a reason. G4 adds monitoring signals for drift. |
| **GOV 06** | Before anything goes live | Owner, autonomy, oversight mode, data sensitivity (and client impact) recorded; tools and permissions listed; a stop mechanism documented; a named approver. | **`0037`: GovernanceOS refuses to mark a system `active` until every field is recorded**, naming what is missing. Applies to Saipien's systems and every system built for a client (Governed Delivery, `docs/80 §9`). |
| **GOV 07** | Incidents | Stop, record, notify, remediate. The lesson becomes a control or a policy change. | Procedure (§6); lessons recorded as policy versions with a reason. Incident records in GovernanceOS: G4. |

---

## 2. AI providers and data handling (verified 2026-10-24)

| Provider / tool | Where | Status | Data allowed |
|---|---|---|---|
| **OpenAI API** — `gpt-4o-mini` (findings default), `gpt-4o`, `gpt-4.1` (report sections + proposals since 2026-10-13) | SLATE synthesis; production key in Vercel | Approved — in production use | Client engagement content **needed for the task**. No credentials, payment data or special-category personal data. ⚑ §9-1 |
| **Anthropic Claude** (Claude Code; Claude apps) | Engineering on SLATE and client software | Approved — in use | Repo content and internal docs; client confidential material only inside an approved engagement workspace. ⚑ §9-2 |
| **OpenRouter** (reviewer, default an Anthropic model) and **TypeSafe "Jev"** (judge) | WRJ (flag-gated); **not configured in Vercel production**; runs only from a local machine | **Not approved for client data** | None until approved. ⚑ §9-3 |
| **Factory model roster** — OpenAI Codex, Google Gemini, xAI, OpenRouter, Anthropic | BuildOS / software factory (`arxus-factory`, stopped since 2026-10-02) | **Not yet registered/approved** | Code and specs of the project being built. ⚑ §9-4 |
| **Vercel AI Gateway** | Key in `.env.local` only; no code path | Not in use | None. ⚑ §9-3 |
| **Attio** (CRM) | Read context; Scorecard push (flag-gated outbox) | Approved vendor service | Account, contact and deal context; Scorecard submissions when the push is on. |

**Rules**
- No client data in consumer AI accounts (GOV 04).
- Provider keys live only in server-side environment variables, never `NEXT_PUBLIC_`.
- Prompts and outputs are not written into activity metadata (`sanitizeMetadata`).
- **A local override that writes to production data is a production change.**
  2026-10-13: `gpt-4.1` ran on production data from a local `.env.local`
  override with no record. Under GOV 05 that needs a proposal and approval.

## 3. Decision rights

| Decision | Who decides | Record |
|---|---|---|
| Approve a new AI provider/tool for client work | Founder | New GOV 04 policy version, activated with a reason |
| Change a production model/provider (env var, code default, or local override against production data) | Founder | GOV 05 procedure; asset record updated with a reason |
| Release client-facing AI output | The consultant on the engagement | SLATE approval (named, enforced by `0038`) + pre-delivery audit |
| Put a system live (Saipien or client) | The named approver on its record (client approver for client systems) | GOV 06 record complete; lifecycle → active with a reason |
| Accept a risk / grant an exception | Founder | GovernanceOS decision record (G3); until then a policy note with a reason |

## 4. Internal inventory — the starter register

Loaded with **"Load Saipien starter register"** on the internal program. Each
lands as `proposed`; the named approver is left blank on purpose so the GOV 06
gate requires a person to complete each record before it can be marked active.

| System | Type | Readings (sensitivity / autonomy / client impact) | Derived tier |
|---|---|---|---|
| SLATE AI synthesis pipeline | AI system | confidential / assistive / direct | elevated |
| ↳ OpenAI API | Vendor service | confidential / none / indirect | elevated |
| WRJ writer / reviewer / judge | AI system | confidential / assistive / indirect | elevated |
| SLATE client delivery engine (`/r`, `/p`, `/s`) | Workflow | confidential / none / critical | high |
| BuildOS / factory agents | Agent | confidential / conditional / ⚑ §9-4 | unclassified until §9-4 |
| Claude Code | Agent | confidential / supervised / indirect | elevated |
| Attio CRM integration | Vendor service | confidential / none / indirect | elevated |

Not AI, so not registered: the Scorecard (deterministic scoring, no model
calls). ⚑ §9-5 for the contact-form n8n workflow and internal MCP servers.

## 5. Model and provider change procedure (GOV 05)

1. **Propose:** what changes, why, cost, and which data classes it touches.
2. **Test:** run the Meridian fixture on the new model; score it against the `docs/68` rubric.
3. **Approve:** founder approval, recorded as an asset update with a reason (or a new GOV 04 version for a new provider).
4. **Change:** update the env var or code default. Never point a local override at production data.
5. **Spot-check** the next live run and record the result.

## 6. Incident procedure (GOV 07)

An incident is any of these:
- AI-generated content reaching a client with a factual error, a fabricated
  claim, or another client's data
- a provider data exposure
- a model change that degrades client-visible output
- an AI system acting outside its recorded permissions

1. **Stop:** revoke share links (`/r`, `/p`, `/s`), switch off the path (§4 stop mechanisms). The `docs/69` stop conditions apply.
2. **Record:** a dated entry against the GOV 07 policy (GovernanceOS incident records arrive in G4).
3. **Notify** anyone affected. The founder decides the channel.
4. **Remediate** and verify.
5. **Learn:** the lesson becomes a control or a policy change, activated with a reason.

## 7. Governed Delivery (client builds)

Before any Saipien-built system goes live for a client, its record in the
client's program must pass the GOV 06 gate:
- owner
- the three readings
- oversight mode
- tools and permissions
- stop mechanism
- the **client** approver, named

BuildOS registers the systems it builds through `registerGovernedAsset` (`docs/80 §9`).

## 8. Review cadence

A quarterly internal governance review covers registry changes, model and
provider changes, incidents and policy updates. It runs on the internal
program's next-review date, and this standard is reviewed with it.

## 9. Decisions needed to ratify (founder)

1. **OpenAI data controls:** confirm the organization's data-retention / zero-retention setting.
2. **Claude scope:** confirm the rule for client confidential material in Claude (approved workspaces only).
3. **OpenRouter, TypeSafe, Vercel AI Gateway:** approve for client data (and enable "no training" provider filtering on OpenRouter), or keep them off client data. If kept off, remove the unused Gateway key.
4. **Factory roster and Arxus:** is Arxus client work? That sets the factory agents' client-impact reading and whether Codex, Gemini, xAI and OpenRouter need GOV 04 approval before the daemon restarts.
5. **Other automations:** does the contact-form n8n workflow use an AI model? Which internal MCP servers or automations touch client data?
6. **Named approvers:** who approves go-live for each internal system (§4)?

Ratification means loading the starter register, completing each record,
editing the GOV 04 draft to match decisions 1–4, and activating the seven policies.
