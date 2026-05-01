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
import { LeadNotesPanel } from "@/components/leads/lead-notes-panel";
import { OpportunityAreaCard } from "@/components/scorecard/opportunity-area-card";
import { RiskReadinessNote } from "@/components/scorecard/risk-readiness-note";
import { Card, CardBody } from "@/components/ui/card";
import { MOCK_LEADS, getLeadById } from "@/lib/leads/mock-leads";

export function generateStaticParams() {
  return MOCK_LEADS.map((l) => ({ id: l.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const lead = getLeadById(params.id);
  if (!lead) return { title: "Lead not found" };
  return {
    title: `${lead.companyName} · Lead`,
    description: `Internal lead review for ${lead.companyName}.`,
  };
}

export default function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lead = getLeadById(params.id);
  if (!lead) notFound();

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <LeadProfileHeader lead={lead} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <ScorecardSummaryPanel lead={lead} />

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

          <RiskReadinessNote notes={lead.riskNotes} />

          <QualificationSignalsPanel signals={lead.qualificationSignals} />

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
          <LeadActionsPanel />
          <LeadSourceCard lead={lead} />
          <LeadNotesPanel notes={lead.notes} />
        </aside>
      </div>
    </div>
  );
}
