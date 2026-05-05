"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivityEvent } from "@/lib/activity/log";
import {
  defaultDocumentStatus,
  defaultFindingsStatus,
  defaultIntakeStatus,
  defaultOpportunityStatus,
  defaultProposalStatus,
  defaultReportStatus,
  isUuid,
} from "./mappers";

/**
 * Authenticated-operator server action that opens or creates the AI
 * Opportunity Sprint engagement for a given lead.
 *
 * Behavior:
 *   1. UUID-validate the leadId.
 *   2. Resolve the authenticated session (RLS enforces this anyway,
 *      but we short-circuit early on no-session).
 *   3. If an engagement already exists with `linked_lead_id = leadId`,
 *      redirect to it.
 *   4. Otherwise, load the lead + account + contact + submission
 *      snapshot, create an engagement row, mirror lead status forward
 *      (`needs_review` / `high_fit` → `diagnostic_requested`; everything
 *      that isn't already terminal stays as is), and redirect.
 *
 * No engagement_status_event log table for now — that lands when the
 * activity timeline persistence ships in Step 9.
 */
export async function createOrOpenEngagementForLead(
  leadId: string,
): Promise<void> {
  if (!isUuid(leadId)) {
    redirect("/app/leads?error=invalid-lead");
  }

  const supabase = createSupabaseServerClient();

  // Auth presence check — RLS will deny anyway, but we want a clean
  // redirect to /login rather than a server error.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Already-existing engagement → reopen.
  const { data: existing, error: existingError } = await supabase
    .from("engagements")
    .select("id")
    .eq("linked_lead_id", leadId)
    .maybeSingle<{ id: string }>();
  if (existingError) {
    console.error("[engagements.actions] existing-lookup-failed", {
      name: existingError.name,
      code: existingError.code,
      message: existingError.message,
    });
    redirect(`/app/leads/${leadId}?error=engagement-create`);
  }
  if (existing?.id) {
    redirect(`/app/engagements/${existing.id}`);
  }

  // Otherwise, build a new engagement from the lead.
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      `
        id,
        workspace_id,
        account_id,
        contact_id,
        status,
        prospect_scores,
        recommended_action,
        submission_id,
        accounts:account_id ( name ),
        scorecard_submissions:submission_id ( classification )
      `,
    )
    .eq("id", leadId)
    .maybeSingle();

  if (leadError || !lead) {
    console.error("[engagements.actions] lead-lookup-failed", {
      name: leadError?.name,
      code: leadError?.code,
      message: leadError?.message,
    });
    redirect(`/app/leads/${leadId}?error=engagement-create`);
  }

  const leadRow = lead as unknown as {
    id: string;
    workspace_id: string;
    account_id: string;
    contact_id: string | null;
    status: string;
    prospect_scores: { ai?: number; friction?: number; systems?: number } | null;
    recommended_action: { headline?: string; detail?: string; cta?: string } | null;
    submission_id: string | null;
    accounts: { name: string } | null;
    scorecard_submissions: { classification: string | null } | null;
  };

  const accountName = leadRow.accounts?.name?.trim() || "AI Opportunity Sprint";
  const classification = leadRow.scorecard_submissions?.classification ?? null;

  // Choose a starting stage that mirrors how operators triage today.
  const initialStage: "setup" | "intake" =
    leadRow.status === "diagnostic_requested" ? "intake" : "setup";
  const initialStatus: "setup" | "active" =
    initialStage === "intake" ? "active" : "setup";

  const sourceSnapshot = {
    leadId: leadRow.id,
    submissionId: leadRow.submission_id,
    classification: prettyClassification(classification),
    ai: leadRow.prospect_scores?.ai ?? null,
    friction: leadRow.prospect_scores?.friction ?? null,
    systems: leadRow.prospect_scores?.systems ?? null,
    capturedAt: new Date().toISOString(),
  };

  // The scorecard summary card uses the snapshot's three numeric scores
  // plus a string classification. The mapper rejects partial shapes, so
  // we only persist the snapshot when all three are present.
  const scorecardSummary =
    typeof sourceSnapshot.ai === "number" &&
    typeof sourceSnapshot.friction === "number" &&
    typeof sourceSnapshot.systems === "number" &&
    sourceSnapshot.classification
      ? {
          ai: sourceSnapshot.ai,
          friction: sourceSnapshot.friction,
          systems: sourceSnapshot.systems,
          classification: sourceSnapshot.classification,
        }
      : null;

  const recommendedAction = {
    headline:
      initialStage === "intake"
        ? "Send role-based intake"
        : "Confirm stakeholder list and kick off",
    detail:
      initialStage === "intake"
        ? "Lead came in flagged for diagnostic. Send the role-based intake to all stakeholders today and target a 7-day intake close."
        : "Engagement created from a real lead. Confirm stakeholder coverage and account context before sending intake.",
    cta: "Manage Intake",
  };

  const insertPayload = {
    workspace_id: leadRow.workspace_id,
    account_id: leadRow.account_id,
    contact_id: leadRow.contact_id,
    linked_lead_id: leadRow.id,
    name: `${accountName} — AI Opportunity Sprint`,
    engagement_type: "ai_opportunity_sprint" as const,
    status: initialStatus,
    current_stage: initialStage,
    owner_profile_id: user.id,
    target_date: defaultTargetDate(),
    last_activity_at: new Date().toISOString(),
    next_milestone:
      initialStage === "intake"
        ? "Close intake within 7 days"
        : "Confirm stakeholder list and send role-based intake",
    recommended_action: recommendedAction,
    intake_status: { ...defaultIntakeStatus(), nextAction: recommendedAction.detail },
    document_status: defaultDocumentStatus(),
    findings_status: defaultFindingsStatus(),
    opportunity_status: defaultOpportunityStatus(),
    report_status: defaultReportStatus(),
    proposal_status: defaultProposalStatus(),
    risk_notes: [],
    dependencies: [],
    notes: [],
    source_snapshot: { ...sourceSnapshot, scorecardSummary },
  };

  const { data: inserted, error: insertError } = await supabase
    .from("engagements")
    .insert(insertPayload)
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted?.id) {
    // Race against the unique index on linked_lead_id — if a parallel
    // submission won, fall through to the existing engagement.
    if (insertError?.code === "23505") {
      const { data: raced } = await supabase
        .from("engagements")
        .select("id")
        .eq("linked_lead_id", leadId)
        .maybeSingle<{ id: string }>();
      if (raced?.id) {
        redirect(`/app/engagements/${raced.id}`);
      }
    }
    console.error("[engagements.actions] engagement-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    redirect(`/app/leads/${leadId}?error=engagement-create`);
  }

  await logActivityEvent({
    eventType: "engagement_created",
    entityType: "engagement",
    entityId: inserted.id,
    engagementId: inserted.id,
    leadId: leadRow.id,
    accountId: leadRow.account_id,
    contactId: leadRow.contact_id,
    title: `Engagement created · ${accountName}`,
    summary:
      initialStage === "intake"
        ? "Engagement opened in intake stage."
        : "Engagement opened in setup stage; awaiting stakeholder list.",
    metadata: {
      initialStage,
      initialStatus,
    },
  });

  // Move the lead status forward in the same flow.
  const nextLeadStatus =
    leadRow.status === "needs_review" ||
    leadRow.status === "high_fit" ||
    leadRow.status === "new"
      ? "diagnostic_requested"
      : null;
  if (nextLeadStatus) {
    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({
        status: nextLeadStatus,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", leadId);
    if (leadUpdateError) {
      // Non-fatal: the engagement already exists; status is best-effort.
      console.error("[engagements.actions] lead-status-update-failed", {
        name: leadUpdateError.name,
        code: leadUpdateError.code,
        message: leadUpdateError.message,
      });
    } else {
      await logActivityEvent({
        eventType: "lead_status_changed",
        entityType: "lead",
        entityId: leadRow.id,
        leadId: leadRow.id,
        engagementId: inserted.id,
        title: "Lead moved to diagnostic-requested",
        summary: "Lead status advanced after engagement creation.",
        metadata: { previousStatus: leadRow.status, nextStatus: nextLeadStatus },
      });
    }
  }

  redirect(`/app/engagements/${inserted.id}`);
}

function prettyClassification(id: string | null): string | null {
  if (!id) return null;
  switch (id) {
    case "not_ready":
      return "Foundations first";
    case "automation_ready":
      return "Automation-ready";
    case "quick_win":
      return "Quick-win candidate";
    case "audit_ready":
      return "Audit-ready";
    case "strategic":
      return "Strategic candidate";
    default:
      return id;
  }
}

function defaultTargetDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 42); // ~6 weeks
  return d.toISOString().slice(0, 10);
}
