import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { LeadProfileHeader } from "@/components/leads/lead-profile-header";
import { ScorecardSummaryPanel } from "@/components/leads/scorecard-summary-panel";
import { InternalFitScorePanel } from "@/components/leads/internal-fit-score-panel";
import { QualificationSignalsPanel } from "@/components/leads/qualification-signals-panel";
import { RecommendedActionCard } from "@/components/leads/recommended-action-card";
import { LeadActionsPanel } from "@/components/leads/lead-actions-panel";
import { LeadSourceCard } from "@/components/leads/lead-source-card";
import { NotesPanel } from "@/components/notes/notes-panel";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { OpportunityAreaCard } from "@/components/scorecard/opportunity-area-card";
import { RiskReadinessNote } from "@/components/scorecard/risk-readiness-note";
import { Card, CardBody } from "@/components/ui/card";
import { getLeadById } from "@/lib/leads/queries";
import { getEngagementIdForLead } from "@/lib/engagements/queries";
import { getNotesForEntity } from "@/lib/notes/queries";
import { getActivityForLead } from "@/lib/activity/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const lead = await getLeadById(params.id);
  if (!lead) return { title: "Lead not found" };
  return {
    title: `${lead.companyName} · Lead`,
    description: `Internal lead review for ${lead.companyName}.`,
  };
}

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lead = await getLeadById(params.id);
  if (!lead) notFound();
  const [engagementId, notes, activity] = await Promise.all([
    getEngagementIdForLead(lead.id),
    getNotesForEntity("lead", lead.id),
    getActivityForLead(lead.id),
  ]);

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <LeadProfileHeader lead={lead} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <ScorecardSummaryPanel lead={lead} />

          {lead.opportunityAreas.length > 0 ? (
            <section className="flex flex-col gap-4">
              <header className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-practice-ai" />
                <h2 className="text-sm font-semibold tracking-tight text-text-primary">
                  Likely opportunity areas
                </h2>
              </header>
              <div className="flex flex-col gap-3">
                {lead.opportunityAreas.map((o, i) => (
                  <OpportunityAreaCard key={o.id} rank={i + 1} opportunity={o} />
                ))}
              </div>
            </section>
          ) : null}

          {lead.riskNotes.length > 0 ? (
            <RiskReadinessNote notes={lead.riskNotes} />
          ) : null}

          {lead.qualificationSignals.length > 0 ? (
            <QualificationSignalsPanel signals={lead.qualificationSignals} />
          ) : null}

          <Card variant="base">
            <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Boundary reminder
              </span>
              <p className="text-xs leading-relaxed text-text-muted">
                The prospect-facing scorecard is directional only. Findings,
                roadmap, and recommendations belong to the paid AI Opportunity
                Sprint and require human review before becoming
                client-facing.
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          <RecommendedActionCard lead={lead} />
          <InternalFitScorePanel lead={lead} />
          <LeadActionsPanel
            leadId={lead.id}
            engagementId={engagementId ?? undefined}
          />
          <LeadSourceCard lead={lead} />
          <NotesPanel
            entityType="lead"
            entityId={lead.id}
            notes={notes}
            emptyTitle="No notes yet"
            emptyDescription="Add an internal note to capture qualification context, follow-up details, or handoff decisions."
          />
          <ActivityTimeline
            events={activity}
            heading="Lead activity"
            emptyTitle="No activity yet"
            emptyDescription="Events will appear here as operators triage the lead and convert it into an engagement."
          />
        </aside>
      </div>
    </div>
  );
}
