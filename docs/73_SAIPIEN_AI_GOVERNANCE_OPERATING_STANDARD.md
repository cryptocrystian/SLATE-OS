# Saipien AI Governance Operating Standard

## Status

- **Date:** 2026-09-28
- **Version:** 0.1 — **DRAFT for founder ratification**
- **Owner:** Saipien Labs (GovernanceOS / internal operations)
- **Applies to:** every AI system, model, agent, automation and AI-assisted
  workflow that Saipien Labs builds, operates or uses on client work.
- **System of record:** the "Saipien Labs — Internal AI Governance" program in
  GovernanceOS (`/app/governance`, `program_kind = 'internal'`). The policies
  in §2, §3 and §5 are encoded there as `advisory` policies in G1.
- **Items marked ⚑ need a founder decision before ratification.**

---

## 1. Scope and principles

1. **Human authority.** AI drafts, classifies, maps and recommends. A named
   human approves anything consequential: client-facing output, production AI
   changes, risk acceptance, exceptions. This extends the permanent SLATE rule
   in `PRODUCT.md`.
2. **Evidence first.** Governance claims point at evidence (records, runs,
   files, decisions), not at assertion.
3. **Proportionality.** Controls scale with data sensitivity, autonomy and client impact.
4. **We govern ourselves with our own product.** Saipien's AI footprint is
   GovernanceOS's first program. Anything we sell, we operate on ourselves first.

## 2. Approved AI providers and data handling

| Provider / tool | Status | Use | Data allowed |
|---|---|---|---|
| OpenAI API (`api.openai.com`), models per `SLATE_AI_*_MODEL` | **Approved — in production use** (SLATE synthesis) | Findings, opportunities, roadmap, report-section and proposal drafting | Client engagement content **needed for the task**. No credentials, no payment data, no special-category personal data. ⚑ Confirm the org account's data-retention/zero-retention setting. |
| Anthropic Claude (Claude Code, Claude apps) | **Approved — in use** for engineering and internal work | Code, docs, analysis | Repo content and internal docs. Client confidential material only inside an approved engagement workspace. ⚑ |
| Vercel AI Gateway, OpenRouter | **Configured, not in use** (keys present; no code path) | — | None until approved via §5. Remove unused keys or approve a use. ⚑ |
| Attio (CRM, read-only) | Approved vendor service | CRM context for synthesis | Account/deal context (`docs/42`). |
| Any other AI tool | **Not approved** until registered in GovernanceOS and approved per §3 | — | — |

**Rules:**
- No client data goes into consumer AI accounts.
- Provider keys live only in server-side env vars; never `NEXT_PUBLIC_`.
- Prompts and outputs aren't logged in activity metadata (the `sanitizeMetadata` rule).

## 3. AI decision rights

| Decision | Who decides | Record |
|---|---|---|
| Adopt a new AI provider or tool | Founder | GovernanceOS decision (G3+); until then, a `docs/09` entry + a registry asset |
| Change a production model or provider (any `SLATE_AI_*_MODEL`, provider swap) | Founder, or a delegated operator with founder sign-off | Same, plus a monitoring signal (G4) |
| Release client-facing AI output | The consultant on the engagement (existing SLATE approval gates) | SLATE approvals + pre-delivery audit |
| Deploy an AI system/agent to a client (Governed Delivery) | Engagement lead + founder | Registry asset + approval decision (G3+) |
| Accept a governance risk or grant an exception | Founder | GovernanceOS decision (G3+) |

## 4. Internal AI inventory (registry seed for G1)

| Asset | Type | Parent | Owner | Lifecycle (honest) |
|---|---|---|---|---|
| SLATE AI synthesis pipeline (`lib/ai/*`) | `ai_system` | — | Founder | active · not yet governance-approved |
| OpenAI chat-completions model(s) per `SLATE_AI_*_MODEL` | `model` | SLATE AI synthesis pipeline | Founder | active · not yet governance-approved |
| SLATE client delivery engine (`/r`, `/p`, `/s`) | `workflow` | — | Founder | active · not yet governance-approved |
| Claude Code / coding agents on SLATE and client builds | `agent` | — | Founder | active · not yet governance-approved |
| Attio CRM read integration (`lib/crm/attio`) | `vendor_service` | — | Founder | active · not yet governance-approved. ⚑ Currently non-functional in production (`0018` not applied; see `docs/77 §4`). |
| Internal MCP servers and automations | `agent` / `workflow` | — | Founder | ⚑ to be inventoried |

## 5. Model and provider change procedure

1. Propose the change: what, why, cost, and the data classes affected.
2. Register or update the asset in GovernanceOS; state the model/provider change.
3. Run the `docs/68` quality rubric on a fixture engagement (Meridian) with the new model.
4. Get approval per §3. Then change the env var.
5. Post-change: spot-check the next real run, and record the result as evidence (G3+).

## 6. AI output incident procedure

**What counts as an incident:**
- AI-generated content reaches a client with a factual error, fabricated claim,
  or leaked internal/other-client data
- a provider exposes data
- a model change degrades output in a way a client could see

**Steps:**
1. **Stop:** revoke affected share links (`/r`, `/p`, `/s` revoke), and pause the
   AI path if needed. The `docs/69` stop conditions apply.
2. **Record:** create a GovernanceOS incident (G4). Until then, a `docs/09` entry.
3. **Notify** the client if their data or deliverable was affected (founder decides the channel).
4. **Remediate** and verify. Record the lesson as a control or policy change.

## 7. Governed Delivery checklist (BuildOS / FDE client deployments)

Before any Saipien-built AI system, agent or automation goes live for a client:

- [ ] Registered in the client's GovernanceOS program: owner, `autonomy_level`,
      `human_oversight_mode`, `data_sensitivity`, `deployment_environment`.
- [ ] Tools, permissions and credentials listed. Least privilege confirmed.
- [ ] Escalation path and stop mechanism documented.
- [ ] Evaluation evidence attached (tests, sample outputs, known limits).
- [ ] Client approver named. Approval recorded (G3+ decision).
- [ ] Monitoring owner and review cadence set.

## 8. Review cadence

- **Quarterly internal governance review.** Registry changes, model/provider
  changes, incidents, policy updates. Run on the GovernanceOS review surface (G4).
  Until then, it's a dated note on the internal program.
- This standard is reviewed with that quarterly review.
