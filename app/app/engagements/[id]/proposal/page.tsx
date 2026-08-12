import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FileSignature, Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LockedActionButton } from "@/components/ui/locked-action-button";
import { PastSowDraftsPanel } from "@/components/proposals/past-sow-drafts-panel";
import { ProposalCandidatesPanel } from "@/components/proposals/proposal-candidates-panel";
import { ProposalWorkspace } from "@/components/proposals/proposal-workspace";
import { ProposalStatusChip } from "@/components/proposals/proposal-status-chip";
import { ImplementationCreditPanel } from "@/components/proposals/implementation-credit-panel";
import { InitializeProposalForm } from "@/components/proposals/initialize-proposal-form";
import { SowReadinessHint } from "@/components/proposals/sow-readiness-hint";
import { GenerateAllProposalOptionsButton } from "@/components/proposals/generate-all-proposal-options-button";
import { PreDeliveryAuditCard } from "@/components/engagement-readiness/pre-delivery-audit-card";
import { loadPreDeliveryAudit } from "@/lib/engagement-readiness/pre-delivery-audit-loader";
import { getLatestProposalDeliverySnapshotForProposal } from "@/lib/proposals/delivery-snapshot-queries";
import {
  buildSowReadinessSignal,
  isCommercialGuardPassed,
} from "@/lib/proposals/readiness";
import { buildProposalReadinessSignal } from "@/lib/reports/readiness";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getProposalForEngagement } from "@/lib/proposals/mock-proposals";
import { getProposalForEngagementPersisted } from "@/lib/proposals/queries";
import { getOpportunitiesForEngagement } from "@/lib/opportunities/mock-opportunities";
import { getOpportunitiesForEngagementPersisted } from "@/lib/opportunities/queries";
import { getRoadmapForEngagement } from "@/lib/roadmap/mock-roadmap";
import { getRoadmapForEngagementPersisted } from "@/lib/roadmap/queries";
import { getReportForEngagement } from "@/lib/reports/mock-reports";
import { getReportForEngagementPersisted } from "@/lib/reports/queries";
import {
  recommendedActionLabel,
  recommendedActionRoute,
} from "@/lib/engagements/recommended-action";
import { isAiConfigured } from "@/lib/ai/provider";
import type { Proposal } from "@/lib/proposals/types";
import type { Report } from "@/lib/reports/types";
import type { Opportunity } from "@/lib/opportunities/types";
import type { RoadmapItem } from "@/lib/roadmap/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) return { title: "Proposal not found" };
  return {
    title: `${loaded.engagement.companyName} · Proposal & SOW options`,
  };
}

export default async function EngagementProposalPage({
  params,
}: {
  params: { id: string };
}) {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) notFound();
  const engagement = loaded.engagement;
  const isPersisted = loaded.kind === "real";

  let proposal: Proposal | null | undefined;
  let opportunities: Opportunity[];
  let roadmap: RoadmapItem[];
  let report: Report | null | undefined;

  if (isPersisted) {
    [proposal, opportunities, roadmap, report] = await Promise.all([
      getProposalForEngagementPersisted(engagement.id),
      getOpportunitiesForEngagementPersisted(engagement.id),
      getRoadmapForEngagementPersisted(engagement.id),
      getReportForEngagementPersisted(engagement.id),
    ]);
  } else {
    proposal = getProposalForEngagement(engagement.id);
    opportunities = getOpportunitiesForEngagement(engagement.id);
    roadmap = getRoadmapForEngagement(engagement.id);
    report = getReportForEngagement(engagement.id);
  }

  // Sprint S9 — fetch the most-recent proposal candidate snapshot so
  // the SowReadinessHint can render the approval-state +
  // commercial-guard verdict. Snapshot pipeline is persisted-only.
  const latestSnapshot =
    isPersisted && proposal
      ? await getLatestProposalDeliverySnapshotForProposal(proposal.id)
      : null;
  const aiAvailable = isAiConfigured();

  // Sprint S11 — pre-delivery audit (code-side enforcement of
  // docs/35 § 5) for the proposal surface. Surfaces near the mint
  // controls so the operator can see exactly why /p mint is blocked.
  // The mint action itself independently re-evaluates the audit so
  // this card is purely advisory display.
  const preDeliveryAudit = isPersisted
    ? await loadPreDeliveryAudit(engagement.id, { surface: "proposal" })
    : null;

  // Sprint S9 — derive S10 readiness signal from already-loaded data.
  // The S8 readiness signal (`buildProposalReadinessSignal`) gives us
  // the "S8 chain intact" advisory; we re-use it instead of duplicating
  // the required-sections logic.
  const reportSignal =
    isPersisted && report
      ? buildProposalReadinessSignal(report.sections)
      : null;
  const sowReadinessSignal =
    isPersisted && proposal
      ? buildSowReadinessSignal({
          proposal,
          options: proposal.options,
          hasApprovedSnapshot:
            (latestSnapshot?.approvalState ?? null) === "approved" &&
            !latestSnapshot?.voidedAt,
          commercialGuardPassed: isCommercialGuardPassed(
            latestSnapshot?.commercialGuardResult ?? null,
          ),
          hasRequiredReportSectionsApproved:
            reportSignal?.hasAllRequiredApproved ?? undefined,
        })
      : null;

  const reportHref = `/app/engagements/${engagement.id}/report`;
  const recAction = recommendedActionRoute(
    engagement,
    `/app/engagements/${engagement.id}/proposal`,
  );

  const includedOpportunityIds = new Set(
    proposal?.options.flatMap((o) => o.includedOpportunityIds) ?? [],
  );
  const quickWinsIncluded = opportunities.filter(
    (o) => includedOpportunityIds.has(o.id) && o.quadrant === "quick-win",
  ).length;
  const strategicIncluded = opportunities.filter(
    (o) =>
      includedOpportunityIds.has(o.id) && o.quadrant === "strategic-build",
  ).length;
  const totalDeps =
    proposal?.options.reduce((sum, o) => sum + o.dependencies.length, 0) ?? 0;
  const recommendedOption =
    proposal?.options.find((o) => o.id === proposal?.recommendedOptionId) ??
    null;

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Proposal"
        title="Proposal / SOW options."
        description="Turn approved recommendations into clear implementation paths, assumptions, and next-step options."
        actions={
          <>
            <Link href={reportHref}>
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back to Report
              </Button>
            </Link>
            {/* Sprint S9 — bulk AI drafting button. Mounted only for
                persisted engagements with a proposal + the AI provider
                configured. Each draft preserves pricing /
                recommendation / option type / position; the operator
                must review before any client-facing action. The
                per-option AI control on `ProposalOptionActionBar`
                remains available for targeted drafts and re-drafts. */}
            {proposal && isPersisted ? (
              <GenerateAllProposalOptionsButton
                engagementId={engagement.id}
                aiAvailable={aiAvailable}
              />
            ) : null}
            {proposal && isPersisted ? (
              // Sprint P5 unlock — `Prepare Client Review` no longer
              // locked for persisted UUID engagements once the public
              // `/p/[token]` route exists. The button is an in-page
              // anchor that scrolls the operator to the Past Proposal
              // Candidates panel; the actual mint affordance is the
              // per-row `Generate Proposal Review Link` button shipped
              // in Sprint P4. This is a non-send action by design —
              // SLATE does not auto-email or push to CRM; the operator
              // copies the `/p/<token>` URL from the copy-once panel.
              // `Prepare SOW Draft` (proposal-workspace) + `Send to
              // Client` (proposal-workspace) remain locked verbatim.
              <Link href="#proposal-candidates-panel" scroll>
                <Button
                  variant="primary"
                  size="md"
                  leadingIcon={<Link2 className="h-4 w-4" />}
                >
                  Prepare Client Review
                </Button>
              </Link>
            ) : (
              <LockedActionButton
                label="Prepare Client Review"
                lockedNote="Locked"
              />
            )}
          </>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              {engagement.companyName} · {engagement.engagementType}
            </Badge>
            {proposal ? (
              <ProposalStatusChip status={proposal.status} />
            ) : null}
            <span className="text-text-muted">
              Pricing is placeholder · validate scope before quoting
            </span>
          </>
        }
      />

      <section
        aria-label="Proposal summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <MetricCard
          label="Options"
          value={proposal ? String(proposal.options.length) : "—"}
          hint={proposal ? "Tiered SOW options" : "Awaiting report"}
          tone="info"
        />
        <MetricCard
          label="Recommended"
          value={recommendedOption ? "1" : "—"}
          hint={
            recommendedOption?.title.split(" ").slice(0, 3).join(" ") ??
            "Once report is approved"
          }
          tone={recommendedOption ? "success" : "neutral"}
        />
        <MetricCard
          label="Quick Wins Included"
          value={proposal ? String(quickWinsIncluded) : "—"}
          hint="From the opportunity matrix"
          tone="success"
        />
        <MetricCard
          label="Strategic Builds"
          value={proposal ? String(strategicIncluded) : "—"}
          hint="Multi-phase scoping"
          tone="info"
        />
        <MetricCard
          label="Dependencies"
          value={proposal ? String(totalDeps) : "—"}
          hint="Resolve before send"
          tone={totalDeps > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Implementation Credit"
          value={
            proposal?.implementationCredit.creditEligible ? "Eligible" : "—"
          }
          hint={proposal?.implementationCredit.creditWindow ?? "Commercial lever"}
          tone={proposal?.implementationCredit.creditEligible ? "success" : "neutral"}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-9">
          {!proposal ? (
            isPersisted ? (
              <InitializeProposalForm engagementId={engagement.id} />
            ) : (
              <EmptyState
                icon={<FileSignature className="h-4 w-4" />}
                title="Build the report and roadmap before proposal options are assembled."
                description={
                  recAction.lockedNote
                    ? "Proposal options pull from approved opportunities and the 30/60/90 roadmap. The next step in this engagement isn't yet wired."
                    : recAction.href === reportHref
                      ? "Proposal options pull from approved opportunities and the 30/60/90 roadmap. Once the report is at least half-approved, the option workspace populates here."
                      : "Proposal options pull from approved opportunities and the 30/60/90 roadmap. The engagement is still earlier in the workflow — pick up where the work currently is."
                }
                action={
                  recAction.href ? (
                    <Link href={recAction.href}>
                      <Button
                        variant="primary"
                        size="md"
                        trailingIcon={<ArrowRight className="h-4 w-4" />}
                      >
                        {recommendedActionLabel(recAction.href)}
                      </Button>
                    </Link>
                  ) : null
                }
              />
            )
          ) : (
            <ProposalWorkspace
              proposal={proposal}
              opportunities={opportunities}
              roadmap={roadmap}
              // Plain JSON-safe props. The previous
              // `renderOptionActionBar` render-prop pattern created a
              // server-side closure that Next.js 14 forbids from
              // crossing the server → client boundary at runtime. The
              // action bar is now imported and rendered inside the
              // (client) workspace.
              engagementId={isPersisted ? engagement.id : undefined}
              isPersisted={isPersisted}
              aiAvailable={aiAvailable}
            />
          )}

          {/* Sprint S9 — operator-facing S10 (Internal SOW Draft)
              readiness signal. Advisory only; the actual S10 gate
              lives in `sow-draft-eligibility.ts`. Mounted only when
              a persisted proposal exists. */}
          {isPersisted && sowReadinessSignal ? (
            <SowReadinessHint signal={sowReadinessSignal} />
          ) : null}

          {/* Sprint S11 — pre-delivery audit (code-side enforcement of
              docs/35 § 5). Read-only card surfacing the canonical
              readiness gate so the operator can see exactly what's
              blocking a /p mint. The mint action independently
              re-evaluates the audit. */}
          {preDeliveryAudit ? (
            <PreDeliveryAuditCard audit={preDeliveryAudit} />
          ) : null}

          {proposal && isPersisted ? (
            <ProposalCandidatesPanel
              engagementId={engagement.id}
              proposalId={proposal.id}
            />
          ) : null}

          {proposal && isPersisted ? (
            // Sprint P6-C — Past SOW Drafts panel. Mounted only for
            // persisted UUID engagements (snapshot pipeline is
            // persisted-only). Anchored at `#past-sow-drafts-panel`
            // so the proposal-workspace `Prepare SOW Draft` unlock
            // can in-page scroll to it.
            <PastSowDraftsPanel
              engagementId={engagement.id}
              proposalId={proposal.id}
            />
          ) : null}

          {proposal ? (
            <Card variant="base">
              <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
                <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Boundary reminder
                </span>
                <p className="text-xs leading-relaxed text-text-muted">
                  Proposal options are illustrative SOW shapes for the
                  commercial conversation. Pricing is placeholder; final
                  pricing depends on systems access, data readiness, and
                  implementation assumptions. Implementation credit is a
                  commercial planning lever — not an automatic discount or a
                  legally binding term.
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-3">
          <EngagementRecommendedActionCard
            engagement={engagement}
            href={recAction.href}
            lockedNote={recAction.lockedNote}
            selfReference={recAction.selfReference}
          />

          {proposal ? (
            <ImplementationCreditPanel credit={proposal.implementationCredit} />
          ) : null}

          {report ? (
            <Card variant="base">
              <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
                <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Report readiness
                </span>
                <p className="text-xs leading-relaxed text-text-secondary">
                  {report.title} is currently{" "}
                  <span className="text-text-primary">{report.status}</span>.
                  Approved sections become the commercial conversation
                  anchors.
                </p>
                <Link
                  href={reportHref}
                  className="text-[11px] text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
                >
                  Open report
                </Link>
              </CardBody>
            </Card>
          ) : null}

          {proposal && proposal.assumptions.length > 0 ? (
            <Card variant="base">
              <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
                <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Commercial assumptions
                </span>
                <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
                  {proposal.assumptions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-warning"
                      />
                      {a}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <EngagementContextCard engagement={engagement} />
        </aside>
      </div>
    </div>
  );
}
