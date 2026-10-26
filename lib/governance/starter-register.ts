/**
 * Saipien starter register (docs/73 v0.2 §4 inventory + §2/§3/§5–§8 policies).
 * GOVERNANCEOS MODULE. Pure data — no I/O.
 *
 * Loaded into the INTERNAL program by a program admin with one click
 * (service.loadStarterRegister). It is a starting point prepared from the
 * evidence on 2026-10-26, not a set of decisions:
 *   - every system lands as `proposed` — the GOV 06 guard (0037) refuses
 *     `active` until a person completes the record (incl. the named approver,
 *     deliberately left blank here) and moves it with a written reason;
 *   - every policy lands as a v1 DRAFT — it is in force only after a person
 *     activates it with a reason (governance_activate_policy_version).
 * Everything is attributed to the person who loads it. Nothing here is
 * activated, approved or ratified by software.
 *
 * Facts below were verified 2026-10-24/26 against production (ai_synthesis_runs,
 * Vercel production env names, schema) and the repo. Where a fact needs the
 * founder, the field is left empty so the GOV 06 gate asks for it.
 */
import type { RegisterAssetInput } from "./validation";
import type { PolicyDomain } from "./types";

export const STARTER_REGISTER_VERSION = "docs/73 v0.2";

export interface StarterAsset {
  key: string; // stable lineage id: source_system='internal', source_entity_type='starter_register'
  input: Omit<RegisterAssetInput, "source" | "parentGovernedAssetId" | "externalRuntimeId">;
  parentKey?: string;
}

export interface StarterPolicy {
  policyKey: string;
  gov: string;
  name: string;
  policyDomain: PolicyDomain;
  statement: string;
  rationale: string;
}

const base = {
  criticality: null,
  externalVendor: null,
  modelProvider: null,
  modelIdentifier: null,
  prohibitedUses: [] as string[],
  businessOwnerName: null,
  technicalOwnerName: null,
  approverName: null, // GOV 06: a person names the approver when completing the record
  description: null,
  intendedUse: null,
  stopMechanism: null,
  deploymentEnvironment: null,
  clientImpact: null,
  autonomyLevel: null,
  humanOversightMode: null,
  dataSensitivity: null,
  toolsAndPermissions: [] as Array<{ tool: string; permission: string }>,
} satisfies Partial<RegisterAssetInput>;

export const STARTER_ASSETS: StarterAsset[] = [
  {
    key: "slate-synthesis-pipeline",
    input: {
      ...base,
      assetType: "ai_system",
      name: "SLATE AI synthesis pipeline",
      description:
        "Drafts findings, opportunities, roadmap items, report sections and proposal options from engagement intake (lib/ai/*). Every draft lands unapproved; a consultant approves before anything reaches a client.",
      intendedUse: "Drafting consulting artifacts for human review inside SLATE.",
      prohibitedUses: [
        "Sending anything to a client without a named consultant's approval",
        "Setting priority/quadrant or risk ratings directly (derived server-side)",
      ],
      criticality: "high",
      dataSensitivity: "confidential",
      autonomyLevel: "assistive",
      humanOversightMode: "human_in_the_loop",
      clientImpact: "direct",
      deploymentEnvironment: "production",
      modelProvider: "OpenAI",
      modelIdentifier: "gpt-4o-mini (findings default), gpt-4o, gpt-4.1",
      toolsAndPermissions: [
        { tool: "OpenAI chat completions API", permission: "send engagement context needed for the task; receive drafts" },
        { tool: "SLATE database (operator session)", permission: "insert drafts in unapproved states only" },
      ],
      stopMechanism:
        "Remove OPENAI_API_KEY from Vercel production (AI drafting switches off; the UI shows 'not configured'). Unapproved drafts can never reach a client because delivery requires named approval.",
    },
  },
  {
    key: "openai-api",
    parentKey: "slate-synthesis-pipeline",
    input: {
      ...base,
      assetType: "vendor_service",
      name: "OpenAI API",
      description: "Model provider for the SLATE synthesis pipeline (production key in Vercel).",
      externalVendor: "OpenAI",
      modelProvider: "OpenAI",
      dataSensitivity: "confidential",
      autonomyLevel: "none",
      humanOversightMode: "human_in_the_loop",
      clientImpact: "indirect",
      deploymentEnvironment: "production",
      toolsAndPermissions: [{ tool: "Chat completions endpoint", permission: "receives prompts; no tool calls" }],
      stopMechanism: "Revoke the API key in the OpenAI dashboard and remove it from Vercel.",
    },
  },
  {
    key: "wrj-writer-reviewer-judge",
    input: {
      ...base,
      assetType: "ai_system",
      name: "WRJ writer / reviewer / judge (flag-gated)",
      description:
        "Cross-family review of synthesis drafts: OpenAI writer, reviewer via OpenRouter (default an Anthropic model), judge via TypeSafe 'Jev'. Not configured in Vercel production as of 2026-10-24; runs only from a local machine. Must not process client data until its providers are approved under GOV 04.",
      dataSensitivity: "confidential",
      autonomyLevel: "assistive",
      humanOversightMode: "human_in_the_loop",
      clientImpact: "indirect",
      deploymentEnvironment: "development",
      modelProvider: "OpenRouter (Anthropic), TypeSafe Jev",
      toolsAndPermissions: [
        { tool: "OpenRouter chat completions", permission: "send draft + context for review" },
        { tool: "TypeSafe System One API", permission: "send draft + checks for judging" },
      ],
      stopMechanism: "Unset OPEN_ROUTER_API_KEY / JEV_API_KEY or SLATE_AI_SYNTHESIS_MODE; the orchestrator then skips review/judging.",
    },
  },
  {
    key: "client-delivery-engine",
    input: {
      ...base,
      assetType: "workflow",
      name: "SLATE client delivery engine (/r, /p, /s)",
      description:
        "Publishes approved report, proposal and SOW snapshots to clients through revocable share links. Gated by the pre-delivery audit; renders only approved, snapshot-pure content.",
      dataSensitivity: "confidential",
      autonomyLevel: "none",
      humanOversightMode: "human_in_the_loop",
      clientImpact: "critical",
      deploymentEnvironment: "production",
      toolsAndPermissions: [
        { tool: "Share tokens", permission: "mint (operator, after approval) and revoke" },
        { tool: "Public share routes", permission: "read-only render of an approved snapshot" },
      ],
      stopMechanism: "Revoke the share token (per link) or void the snapshot (cascades to its links).",
      prohibitedUses: ["Publishing an unapproved snapshot", "Public SOW without the docs/65 prerequisites"],
    },
  },
  {
    key: "buildos-factory-agents",
    input: {
      ...base,
      assetType: "agent",
      name: "BuildOS / software factory agents (builder, reviewer, architect)",
      description:
        "OMP coding agents in the factory lane (~/factory, VPS service arxus-factory) building Arxus under the governance ladder (builder → architect → PM → owner ruling). Daemon stopped since 2026-10-02 pending judge capacity. Model roster: OpenAI Codex, Google Gemini, xAI, OpenRouter, Anthropic.",
      dataSensitivity: "confidential",
      autonomyLevel: "conditional",
      humanOversightMode: "human_on_the_loop",
      deploymentEnvironment: "other",
      // clientImpact deliberately unset: depends on whether Arxus is client work (founder decision).
      toolsAndPermissions: [
        { tool: "Project git repository", permission: "branch, commit, open PRs; merge only after gates + owner ruling" },
        { tool: "Model provider subscriptions", permission: "send code and specs" },
      ],
      stopMechanism: "systemctl stop arxus-factory on the VPS (stopped as of 2026-10-02); revoke provider keys.",
    },
  },
  {
    key: "claude-code",
    input: {
      ...base,
      assetType: "agent",
      name: "Claude Code (engineering agent)",
      description: "Anthropic's coding agent used to build SLATE and client software; changes land through reviewed commits.",
      externalVendor: "Anthropic",
      modelProvider: "Anthropic",
      dataSensitivity: "confidential",
      autonomyLevel: "supervised",
      humanOversightMode: "human_in_the_loop",
      clientImpact: "indirect",
      deploymentEnvironment: "development",
      toolsAndPermissions: [
        { tool: "Local repositories", permission: "read/write working tree; commit/push only when asked" },
        { tool: "Supabase / Vercel CLIs and MCP", permission: "per-session permission prompts; production changes only with explicit approval" },
      ],
      stopMechanism: "End the session / revoke the tool permission; production credentials stay with the founder.",
    },
  },
  {
    key: "attio-crm",
    input: {
      ...base,
      assetType: "vendor_service",
      name: "Attio CRM integration",
      description:
        "Read-only CRM context for synthesis (lib/crm/attio) and, when enabled, Scorecard submission push via an outbox (lib/scorecard/attio-*). Production holds the Attio token; the outbox was empty on 2026-10-24.",
      externalVendor: "Attio",
      dataSensitivity: "confidential",
      autonomyLevel: "none",
      humanOversightMode: "human_on_the_loop",
      clientImpact: "indirect",
      deploymentEnvironment: "production",
      toolsAndPermissions: [
        { tool: "Attio API (companies, people, deals)", permission: "read for context; create/update for Scorecard push when the flag is on" },
      ],
      stopMechanism: "Turn off the Scorecard push flag; revoke ATTIO_ACCESS_TOKEN.",
    },
  },
];

export const STARTER_POLICIES: StarterPolicy[] = [
  {
    policyKey: "gov-01-human-authority",
    gov: "GOV 01",
    name: "Human authority",
    policyDomain: "human_oversight",
    statement:
      "AI drafts, classifies, maps and recommends. A named person approves anything consequential: client-facing output, production AI changes, risk acceptance and exceptions. SLATE refuses an approval with no signed-in person behind it (migration 0038).",
    rationale: "Extends the permanent SLATE rule in PRODUCT.md to every AI system Saipien runs.",
  },
  {
    policyKey: "gov-02-proportionality",
    gov: "GOV 02",
    name: "Proportionality",
    policyDomain: "autonomy",
    statement:
      "Controls scale with three readings taken per system: data sensitivity, autonomy and client impact. GovernanceOS derives each system's control tier (standard, elevated, high) from the readings and lists the controls that tier requires.",
    rationale: "Heavy controls on low-risk tooling waste effort; light controls on client-facing autonomy are unacceptable.",
  },
  {
    policyKey: "gov-03-evidence-first",
    gov: "GOV 03",
    name: "Evidence first",
    policyDomain: "other",
    statement:
      "Governance claims point at records, runs, files and decisions, never at assertion: AI runs are logged, approvals name their approver, lifecycle changes carry a reason, and policy versions are immutable once active.",
    rationale: "A claim no one can trace is not a control.",
  },
  {
    policyKey: "gov-04-approved-ai-tools",
    gov: "GOV 04",
    name: "Approved AI tools register",
    policyDomain: "model",
    statement:
      "No AI tool touches client work until it is on this program's register and approved here. Approved for client work: OpenAI API (SLATE synthesis); Anthropic Claude under commercial terms (engineering). Not yet approved for client data: OpenRouter, TypeSafe (Jev), Vercel AI Gateway, xAI, Google Gemini. No client data in consumer AI accounts.",
    rationale: "Edit the approved list to match the founder's decisions before activating (docs/73 v0.2 §9).",
  },
  {
    policyKey: "gov-05-model-provider-changes",
    gov: "GOV 05",
    name: "Model and provider changes",
    policyDomain: "change",
    statement:
      "A model or provider change is proposed with its cost and the data it affects, tested on a sample run (the Meridian fixture), approved by a senior leader, then made. The next live run is spot-checked. Local overrides that write to production data count as changes.",
    rationale: "2026-10-13: gpt-4.1 ran on production data from a local override with no record. This is the gap the procedure closes.",
  },
  {
    policyKey: "gov-06-before-go-live",
    gov: "GOV 06",
    name: "Before anything goes live",
    policyDomain: "deployment",
    statement:
      "Before any system goes live its record holds an owner, autonomy level, oversight mode, data sensitivity and client impact; its tools and permissions; a documented stop mechanism; and a named approver. GovernanceOS refuses the move to active until the record is complete.",
    rationale: "Applies to Saipien's own systems and to every system Saipien builds for a client (Governed Delivery).",
  },
  {
    policyKey: "gov-07-incidents",
    gov: "GOV 07",
    name: "Incidents",
    policyDomain: "other",
    statement:
      "When AI output or an AI system causes harm or a near miss: stop it (revoke links, switch off the path), record it, notify anyone affected, remediate and verify. The lesson becomes a control or a policy change, recorded here.",
    rationale: "docs/73 §6; incident records move into GovernanceOS at G4.",
  },
];
