"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dbOptionTypeFor,
  dbProposalStatusFor,
  isUuid,
} from "./mappers";
import type {
  ProposalOptionType,
  ProposalStatus,
} from "./types";

/**
 * Authenticated-operator server actions for proposals.
 *
 * Every action runs against the cookie-bound server Supabase client so
 * RLS evaluates with the operator's auth.uid().
 */

export type ProposalActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "invalid-engagement"
        | "invalid-proposal"
        | "invalid-option"
        | "engagement-not-found"
        | "proposal-not-found"
        | "option-not-found"
        | "service-error";
    };

export type InitializeProposalResult =
  | { ok: true; proposalId: string; created: boolean }
  | (Exclude<ProposalActionResult, { ok: true }> & { ok: false });

interface OptionSeed {
  type: ProposalOptionType;
  title: string;
  bestFit: string;
  scope: string;
  timeline: string;
  pricingPlaceholder: string;
  recommended: boolean;
  position: number;
}

const SEED_OPTIONS: OptionSeed[] = [
  {
    type: "quick-win-build",
    title: "Quick-Win Build",
    bestFit:
      "Best fit when the client wants to validate AI value on a single workflow before broader investment.",
    scope:
      "Pilot one prioritized opportunity end-to-end with a named human approver. Measured pilot, single business surface.",
    timeline: "30 days from kickoff",
    pricingPlaceholder:
      "$30k–$60k · pricing placeholder for internal planning only",
    recommended: false,
    position: 0,
  },
  {
    type: "ai-workflow-system",
    title: "AI Workflow System",
    bestFit:
      "Best fit when the client is ready to roll AI across the connected workflow with a recurring review cadence.",
    scope:
      "Roll AI across the prioritized workflow surfaces with named approvers and an adoption framework as a recurring SOW assumption.",
    timeline: "90 days from kickoff with quarterly review cadence",
    pricingPlaceholder:
      "$120k–$180k · pricing placeholder for internal planning only",
    recommended: true,
    position: 1,
  },
  {
    type: "managed-ai-partner",
    title: "Managed AI Partner",
    bestFit:
      "Best fit when the client wants Saipien Labs to remain the operating partner across a multi-quarter rollout.",
    scope:
      "All AI Workflow System scope plus a managed-partner posture across the first year of AI rollout.",
    timeline: "12 months with quarterly review and renewal",
    pricingPlaceholder:
      "Retainer · $25k–$40k/month · pricing placeholder",
    recommended: false,
    position: 2,
  },
];

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

export async function initializeProposalForEngagement(
  engagementId: string,
): Promise<InitializeProposalResult> {
  if (!isUuid(engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id, name, account_id")
    .eq("id", engagementId)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      name: string | null;
      account_id: string | null;
    }>();
  if (engagementError) {
    console.error("[proposals.actions] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagement?.id) return { ok: false, error: "engagement-not-found" };

  const { data: existing } = await supabase
    .from("proposals")
    .select("id")
    .eq("engagement_id", engagementId)
    .maybeSingle<{ id: string }>();
  if (existing?.id) {
    return { ok: true, proposalId: existing.id, created: false };
  }

  let companyName: string | null = null;
  if (engagement.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", engagement.account_id)
      .maybeSingle<{ name: string | null }>();
    companyName = account?.name?.trim() || null;
  }
  const display = companyName ?? engagement.name?.trim() ?? "Engagement";
  const title = `${display} · Implementation Proposal`;

  const { data: insertedProposal, error: insertError } = await supabase
    .from("proposals")
    .insert({
      workspace_id: engagement.workspace_id,
      engagement_id: engagement.id,
      title,
      status: "draft",
      next_step:
        "Validate scope assumptions, then review the recommended option with the client.",
      assumptions: [],
      dependencies: [],
      // credit_* columns default in the migration to the canonical copy.
      export_status: "locked",
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !insertedProposal?.id) {
    console.error("[proposals.actions] proposal-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  const optionRows = SEED_OPTIONS.map((s) => ({
    workspace_id: engagement.workspace_id,
    engagement_id: engagement.id,
    proposal_id: insertedProposal.id,
    option_type: dbOptionTypeFor(s.type),
    title: s.title,
    recommended: s.recommended,
    best_fit_scenario: s.bestFit,
    scope_summary: s.scope,
    timeline: s.timeline,
    deliverables: [],
    assumptions: [],
    dependencies: [],
    risks: [],
    pricing_placeholder: s.pricingPlaceholder,
    confidence: "medium",
    position: s.position,
  }));
  const { data: insertedOptions, error: optionsError } = await supabase
    .from("proposal_options")
    .insert(optionRows)
    .select("id, option_type");
  if (optionsError) {
    console.error("[proposals.actions] options-insert-failed", {
      name: optionsError.name,
      code: optionsError.code,
      message: optionsError.message,
    });
  }

  // Pre-set the recommended option to the AI Workflow System tier.
  const recommended = (
    (insertedOptions as Array<{ id: string; option_type: string }> | null) ??
    []
  ).find((o) => o.option_type === "ai_workflow_system");
  if (recommended?.id) {
    await supabase
      .from("proposals")
      .update({ recommended_option_id: recommended.id })
      .eq("id", insertedProposal.id);
    await supabase
      .from("proposal_options")
      .update({ recommended: true })
      .eq("id", recommended.id);
  }

  await bumpEngagement(supabase, engagement.id);
  revalidatePaths(engagement.id);
  return { ok: true, proposalId: insertedProposal.id, created: true };
}

// ---------------------------------------------------------------------------
// Proposal status changes
// ---------------------------------------------------------------------------

async function setProposalStatus(
  proposalId: string,
  status: ProposalStatus,
): Promise<ProposalActionResult> {
  if (!isUuid(proposalId)) {
    return { ok: false, error: "invalid-proposal" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("proposals")
    .select("id, engagement_id")
    .eq("id", proposalId)
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "proposal-not-found" };
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({
      status: dbProposalStatusFor(status),
      reviewed_by: user.id,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", proposalId);
  if (updateError) {
    console.error("[proposals.actions] proposal-status-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

export async function approveProposal(
  proposalId: string,
): Promise<ProposalActionResult> {
  return setProposalStatus(proposalId, "approved");
}

export async function markProposalNeedsReview(
  proposalId: string,
): Promise<ProposalActionResult> {
  return setProposalStatus(proposalId, "needs-review");
}

export async function reopenProposal(
  proposalId: string,
): Promise<ProposalActionResult> {
  return setProposalStatus(proposalId, "draft");
}

// ---------------------------------------------------------------------------
// Option editing
// ---------------------------------------------------------------------------

export interface UpdateProposalOptionInput {
  optionId: string;
  title?: string;
  bestFitScenario?: string;
  scopeSummary?: string;
  timeline?: string;
  deliverables?: string[];
  assumptions?: string[];
  dependencies?: string[];
  risks?: string[];
  pricingPlaceholder?: string;
  confidence?: "high" | "medium" | "low";
}

export async function updateProposalOption(
  input: UpdateProposalOptionInput,
): Promise<ProposalActionResult> {
  if (!isUuid(input.optionId)) {
    return { ok: false, error: "invalid-option" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("proposal_options")
    .select("id, engagement_id, proposal_id")
    .eq("id", input.optionId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      proposal_id: string;
    }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "option-not-found" };
  }

  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.bestFitScenario !== undefined)
    update.best_fit_scenario = trimOrNull(input.bestFitScenario);
  if (input.scopeSummary !== undefined)
    update.scope_summary = trimOrNull(input.scopeSummary);
  if (input.timeline !== undefined)
    update.timeline = trimOrNull(input.timeline);
  if (input.deliverables !== undefined)
    update.deliverables = cleanArray(input.deliverables);
  if (input.assumptions !== undefined)
    update.assumptions = cleanArray(input.assumptions);
  if (input.dependencies !== undefined)
    update.dependencies = cleanArray(input.dependencies);
  if (input.risks !== undefined) update.risks = cleanArray(input.risks);
  if (input.pricingPlaceholder !== undefined)
    update.pricing_placeholder = trimOrNull(input.pricingPlaceholder);
  if (input.confidence) update.confidence = input.confidence;

  if (Object.keys(update).length === 0) {
    return { ok: true };
  }

  const { error: updateError } = await supabase
    .from("proposal_options")
    .update(update)
    .eq("id", input.optionId);
  if (updateError) {
    console.error("[proposals.actions] option-edit-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

export async function markProposalOptionRecommended(
  optionId: string,
): Promise<ProposalActionResult> {
  if (!isUuid(optionId)) {
    return { ok: false, error: "invalid-option" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("proposal_options")
    .select("id, engagement_id, proposal_id")
    .eq("id", optionId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      proposal_id: string;
    }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "option-not-found" };
  }

  // Demote any other option then promote this one.
  await supabase
    .from("proposal_options")
    .update({ recommended: false })
    .eq("proposal_id", existing.proposal_id)
    .neq("id", optionId);

  const { error: promoteError } = await supabase
    .from("proposal_options")
    .update({ recommended: true })
    .eq("id", optionId);
  if (promoteError) {
    console.error("[proposals.actions] option-promote-failed", {
      name: promoteError.name,
      code: promoteError.code,
      message: promoteError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await supabase
    .from("proposals")
    .update({ recommended_option_id: optionId })
    .eq("id", existing.proposal_id);

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Implementation credit
// ---------------------------------------------------------------------------

export interface UpdateImplementationCreditInput {
  proposalId: string;
  creditEligible?: boolean;
  creditAmountPlaceholder?: string;
  creditWindow?: string;
  creditNotes?: string;
}

export async function updateImplementationCredit(
  input: UpdateImplementationCreditInput,
): Promise<ProposalActionResult> {
  if (!isUuid(input.proposalId)) {
    return { ok: false, error: "invalid-proposal" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("proposals")
    .select("id, engagement_id")
    .eq("id", input.proposalId)
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "proposal-not-found" };
  }

  const update: Record<string, unknown> = {};
  if (input.creditEligible !== undefined) {
    update.credit_eligible = Boolean(input.creditEligible);
  }
  if (input.creditAmountPlaceholder !== undefined) {
    update.credit_amount_placeholder = trimOr(
      input.creditAmountPlaceholder,
      "Up to 25% of AI Opportunity Sprint fee",
    );
  }
  if (input.creditWindow !== undefined) {
    update.credit_window = trimOr(
      input.creditWindow,
      "Applied if implementation starts within 60 days of report finalization",
    );
  }
  if (input.creditNotes !== undefined) {
    update.credit_notes = trimOr(
      input.creditNotes,
      "If the client proceeds into implementation within the agreed window, a portion of the AI Opportunity Sprint fee may be credited toward the implementation SOW. This is represented here as a commercial lever, not an automatic discount.",
    );
  }

  if (Object.keys(update).length === 0) return { ok: true };

  const { error: updateError } = await supabase
    .from("proposals")
    .update(update)
    .eq("id", input.proposalId);
  if (updateError) {
    console.error("[proposals.actions] credit-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Link management
// ---------------------------------------------------------------------------

export type ProposalOptionLinkKind = "opportunity" | "roadmap-item";

export async function linkProposalOption(
  optionId: string,
  kind: ProposalOptionLinkKind,
  refId: string,
): Promise<ProposalActionResult> {
  if (!isUuid(optionId) || !isUuid(refId)) {
    return { ok: false, error: "invalid-option" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("proposal_options")
    .select("id, workspace_id, engagement_id")
    .eq("id", optionId)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      engagement_id: string;
    }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "option-not-found" };
  }

  const tableByKind: Record<ProposalOptionLinkKind, string> = {
    opportunity: "proposal_option_opportunity_links",
    "roadmap-item": "proposal_option_roadmap_links",
  };
  const refColByKind: Record<ProposalOptionLinkKind, string> = {
    opportunity: "opportunity_id",
    "roadmap-item": "roadmap_item_id",
  };

  const insertRow: Record<string, unknown> = {
    workspace_id: existing.workspace_id,
    engagement_id: existing.engagement_id,
    proposal_option_id: existing.id,
  };
  insertRow[refColByKind[kind]] = refId;

  const { error: insertError } = await supabase
    .from(tableByKind[kind])
    .insert(insertRow);
  if (insertError && insertError.code !== "23505") {
    console.error("[proposals.actions] link-insert-failed", {
      kind,
      name: insertError.name,
      code: insertError.code,
      message: insertError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

export async function unlinkProposalOption(
  optionId: string,
  kind: ProposalOptionLinkKind,
  refId: string,
): Promise<ProposalActionResult> {
  if (!isUuid(optionId) || !isUuid(refId)) {
    return { ok: false, error: "invalid-option" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("proposal_options")
    .select("id, engagement_id")
    .eq("id", optionId)
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "option-not-found" };
  }

  const tableByKind: Record<ProposalOptionLinkKind, string> = {
    opportunity: "proposal_option_opportunity_links",
    "roadmap-item": "proposal_option_roadmap_links",
  };
  const refColByKind: Record<ProposalOptionLinkKind, string> = {
    opportunity: "opportunity_id",
    "roadmap-item": "roadmap_item_id",
  };

  const { error: deleteError } = await supabase
    .from(tableByKind[kind])
    .delete()
    .eq("proposal_option_id", existing.id)
    .eq(refColByKind[kind], refId);
  if (deleteError) {
    console.error("[proposals.actions] link-delete-failed", {
      kind,
      name: deleteError.name,
      code: deleteError.code,
      message: deleteError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function trimOrNull(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function trimOr(s: string | null | undefined, fallback: string): string {
  if (!s) return fallback;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function cleanArray(v: string[] | undefined): string[] {
  if (!v) return [];
  return v.map((s) => s.trim()).filter((s) => s.length > 0);
}

async function bumpEngagement(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
) {
  await supabase
    .from("engagements")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", engagementId);
}

function revalidatePaths(engagementId: string) {
  revalidatePath(`/app/engagements/${engagementId}/proposal`);
  revalidatePath(`/app/engagements/${engagementId}/report`);
  revalidatePath(`/app/engagements/${engagementId}`);
}
