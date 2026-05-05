import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isUuid,
  mapProposalOptionRow,
  mapProposalRow,
  type DbProposalOptionLinkRow,
  type DbProposalOptionRow,
  type DbProposalRow,
} from "./mappers";
import type { Proposal, ProposalOption } from "./types";

/**
 * Server-only query layer for persisted proposals.
 */

const PROPOSAL_SELECT = `
  id,
  workspace_id,
  engagement_id,
  title,
  status,
  recommended_option_id,
  next_step,
  assumptions,
  dependencies,
  credit_eligible,
  credit_amount_placeholder,
  credit_window,
  credit_notes,
  export_status,
  reviewed_by,
  last_reviewed_at,
  created_at,
  updated_at
` as const;

const OPTION_SELECT = `
  id,
  workspace_id,
  engagement_id,
  proposal_id,
  option_type,
  title,
  recommended,
  best_fit_scenario,
  scope_summary,
  timeline,
  deliverables,
  assumptions,
  dependencies,
  risks,
  pricing_placeholder,
  confidence,
  position,
  created_at,
  updated_at
` as const;

const OPP_LINK_SELECT = `
  id,
  workspace_id,
  engagement_id,
  proposal_option_id,
  opportunity_id,
  created_at
` as const;

const ROADMAP_LINK_SELECT = `
  id,
  workspace_id,
  engagement_id,
  proposal_option_id,
  roadmap_item_id,
  created_at
` as const;

export interface ProposalStatusSummary {
  exists: boolean;
  status: string;
  options: number;
  recommendedOptionTitle: string | null;
  exportStatus: string;
  totalDependencies: number;
  creditEligible: boolean;
  creditWindow: string | null;
}

export async function getProposalForEngagementPersisted(
  engagementId: string,
): Promise<Proposal | null> {
  if (!isUuid(engagementId)) return null;
  const supabase = createSupabaseServerClient();
  const { data: proposalData, error: proposalError } = await supabase
    .from("proposals")
    .select(PROPOSAL_SELECT)
    .eq("engagement_id", engagementId)
    .maybeSingle();
  if (proposalError) {
    console.error("[proposals.queries] proposal-fetch-failed", {
      name: proposalError.name,
      code: proposalError.code,
      message: proposalError.message,
    });
    return null;
  }
  if (!proposalData) return null;
  const proposalRow = proposalData as unknown as DbProposalRow;

  const { data: optionsData, error: optionsError } = await supabase
    .from("proposal_options")
    .select(OPTION_SELECT)
    .eq("proposal_id", proposalRow.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (optionsError) {
    console.error("[proposals.queries] options-fetch-failed", {
      name: optionsError.name,
      code: optionsError.code,
      message: optionsError.message,
    });
  }
  const optionRows = (optionsData as unknown as DbProposalOptionRow[]) ?? [];

  let opportunityLinks: DbProposalOptionLinkRow[] = [];
  let roadmapLinks: DbProposalOptionLinkRow[] = [];
  if (optionRows.length > 0) {
    const optionIds = optionRows.map((o) => o.id);
    const [{ data: oppLinkData }, { data: roadmapLinkData }] =
      await Promise.all([
        supabase
          .from("proposal_option_opportunity_links")
          .select(OPP_LINK_SELECT)
          .in("proposal_option_id", optionIds),
        supabase
          .from("proposal_option_roadmap_links")
          .select(ROADMAP_LINK_SELECT)
          .in("proposal_option_id", optionIds),
      ]);
    opportunityLinks =
      (oppLinkData as unknown as DbProposalOptionLinkRow[]) ?? [];
    roadmapLinks =
      (roadmapLinkData as unknown as DbProposalOptionLinkRow[]) ?? [];
  }

  const options: ProposalOption[] = optionRows.map((row) =>
    mapProposalOptionRow(row, opportunityLinks, roadmapLinks),
  );

  return mapProposalRow(proposalRow, options);
}

export async function getProposalStatusSummary(
  engagementId: string,
): Promise<ProposalStatusSummary | null> {
  if (!isUuid(engagementId)) return null;
  const supabase = createSupabaseServerClient();
  const { data: proposalData, error: proposalError } = await supabase
    .from("proposals")
    .select(
      "id, status, recommended_option_id, export_status, dependencies, credit_eligible, credit_window",
    )
    .eq("engagement_id", engagementId)
    .maybeSingle<{
      id: string;
      status: string | null;
      recommended_option_id: string | null;
      export_status: string | null;
      dependencies: string[] | null;
      credit_eligible: boolean | null;
      credit_window: string | null;
    }>();
  if (proposalError) {
    console.error("[proposals.queries] status-summary-failed", {
      name: proposalError.name,
      code: proposalError.code,
      message: proposalError.message,
    });
    return null;
  }
  if (!proposalData) {
    return {
      exists: false,
      status: "draft",
      options: 0,
      recommendedOptionTitle: null,
      exportStatus: "locked",
      totalDependencies: 0,
      creditEligible: true,
      creditWindow: null,
    };
  }

  const { data: optionRows } = await supabase
    .from("proposal_options")
    .select("id, title, dependencies")
    .eq("proposal_id", proposalData.id);

  const opts =
    (optionRows as unknown as Array<{
      id: string;
      title: string;
      dependencies: string[] | null;
    }>) ?? [];

  const recommendedTitle =
    opts.find((o) => o.id === proposalData.recommended_option_id)?.title ??
    null;
  const proposalDeps = (proposalData.dependencies ?? []).length;
  const optionDeps = opts.reduce(
    (sum, o) => sum + (o.dependencies ?? []).length,
    0,
  );

  return {
    exists: true,
    status: proposalData.status ?? "draft",
    options: opts.length,
    recommendedOptionTitle: recommendedTitle,
    exportStatus: proposalData.export_status ?? "locked",
    totalDependencies: proposalDeps + optionDeps,
    creditEligible: Boolean(proposalData.credit_eligible ?? true),
    creditWindow: proposalData.credit_window ?? null,
  };
}
