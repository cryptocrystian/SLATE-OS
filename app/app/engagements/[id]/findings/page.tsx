import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import {
  FindingsWorkspace,
  ManualFindingPlaceholder,
} from "@/components/findings/findings-workspace";
import { CreateFindingForm } from "@/components/findings/create-finding-form";
import { GenerateFindingsForm } from "@/components/findings/generate-findings-form";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getFindingsForEngagement as getMockFindings } from "@/lib/findings/mock-findings";
import {
  getEvidenceCandidatesForEngagement,
  getFindingsForEngagementPersisted,
} from "@/lib/findings/queries";
import { buildEvidenceBundleForEngagement } from "@/lib/findings/evidence";
import {
  buildOpportunitiesReadinessSignal,
  summarizeFindingProvenance,
} from "@/lib/findings/provenance";
import { OpportunitiesReadinessHint } from "@/components/findings/opportunities-readiness-hint";
import { recommendedActionRoute } from "@/lib/engagements/recommended-action";
import { isAiConfigured } from "@/lib/ai/provider";
import type { Finding } from "@/lib/findings/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) return { title: "Findings not found" };
  return { title: `${loaded.engagement.companyName} · Findings review` };
}

export default async function EngagementFindingsPage({
  params,
}: {
  params: { id: string };
}) {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) notFound();
  const engagement = loaded.engagement;
  const isPersisted = loaded.kind === "real";

  let findings: Finding[];
  let candidates: Awaited<ReturnType<typeof getEvidenceCandidatesForEngagement>> = [];
  let evidenceBundle: Awaited<ReturnType<typeof buildEvidenceBundleForEngagement>> = null;
  if (isPersisted) {
    [findings, candidates, evidenceBundle] = await Promise.all([
      getFindingsForEngagementPersisted(engagement.id),
      getEvidenceCandidatesForEngagement(engagement.id),
      buildEvidenceBundleForEngagement(engagement.id),
    ]);
  } else {
    findings = getMockFindings(engagement.id);
  }

  const aiConfigured = isPersisted && isAiConfigured();
  const hasIntakeEvidence = isPersisted && candidates.length > 0;

  const counts = {
    total: findings.length,
    needsReview: findings.filter((f) => f.reviewStatus === "needs-review").length,
    approved: findings.filter((f) => f.reviewStatus === "approved").length,
    rejected: findings.filter((f) => f.reviewStatus === "rejected").length,
    reportReady: findings.filter((f) => f.reviewStatus === "report-ready").length,
    lowEvidence: findings.filter(
      (f) => f.confidence === "low" || f.confidence === "needs-evidence",
    ).length,
  };

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Findings"
        title="Findings review."
        description="Review findings before they become report-ready recommendations. Each finding is approved, edited, or rejected by a consultant — never auto-promoted to the report."
        actions={
          <Link href={`/app/engagements/${engagement.id}`}>
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back to engagement
            </Button>
          </Link>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              {engagement.companyName} · {engagement.engagementType}
            </Badge>
            <span className="text-text-muted">
              <Sparkles className="mr-1 inline h-3 w-3 text-practice-ai align-text-bottom" />
              {isPersisted
                ? aiConfigured
                  ? "AI draft + operator-authored · human approval required"
                  : "Operator-authored · AI synthesis available once configured"
                : "AI-drafted · awaits human approval"}
            </span>
          </>
        }
      />

      <section
        aria-label="Findings summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <MetricCard
          label="Candidate Findings"
          value={String(counts.total)}
          hint={isPersisted ? "Captured for this engagement" : "AI drafts in flight"}
          tone="info"
        />
        <MetricCard
          label="Needs Review"
          value={String(counts.needsReview)}
          hint="Awaiting consultant decision"
          tone={counts.needsReview > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Approved"
          value={String(counts.approved)}
          hint="Cleared by consultant"
          tone="success"
        />
        <MetricCard
          label="Rejected"
          value={String(counts.rejected)}
          hint="Not advancing this sprint"
          tone="risk"
        />
        <MetricCard
          label="Report Ready"
          value={String(counts.reportReady)}
          hint="Locked for the audit report"
          tone="info"
        />
        <MetricCard
          label="Low Evidence"
          value={String(counts.lowEvidence)}
          hint="Single-source or unverified"
          tone={counts.lowEvidence > 0 ? "warning" : "neutral"}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-9">
          {isPersisted ? (
            <>
              <GenerateFindingsForm
                engagementId={engagement.id}
                aiConfigured={aiConfigured}
                hasIntakeEvidence={hasIntakeEvidence}
                evidenceSummary={
                  evidenceBundle
                    ? {
                        totalReadyEvidence: evidenceBundle.totalReadyEvidence,
                        byLaneCounts: {
                          live_link: evidenceBundle.byLane.live_link.length,
                          transcript: evidenceBundle.byLane.transcript.length,
                          offline_operator:
                            evidenceBundle.byLane.offline_operator.length,
                        },
                        crmStatus: evidenceBundle.crm.status,
                        crmBrand: evidenceBundle.crm.brand,
                        coveredRequiredRoles:
                          evidenceBundle.roleCoverage.filter(
                            (r) => r.sessionsWithReadyResponses > 0,
                          ).length,
                        missingRequiredRoles:
                          evidenceBundle.readiness.missingRequiredRoles,
                        readinessReady: evidenceBundle.readiness.ready,
                        readinessReasons:
                          evidenceBundle.readiness.reasons.map((r) => r.message),
                        warnings: evidenceBundle.warnings.map((w) => w.message),
                        excludedByTestLabel:
                          evidenceBundle.sourceCounts.excludedByTestLabel,
                      }
                    : null
                }
              />
              <CreateFindingForm
                engagementId={engagement.id}
                candidates={candidates}
              />
              {/* Sprint S5 — Opportunities readiness signal. Read-only
                  hint; does not block S6 (S6 not yet built). */}
              <OpportunitiesReadinessHint
                signal={buildOpportunitiesReadinessSignal(
                  findings.map((f) => ({
                    reviewStatus: f.reviewStatus,
                    provenance: summarizeFindingProvenance(
                      f.sourceRefs,
                      Boolean(f.assumptionFlag),
                    ),
                  })),
                )}
              />
            </>
          ) : null}

          {findings.length === 0 && isPersisted ? (
            <Card variant="base">
              <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
                <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  No findings yet
                </span>
                <p className="text-xs leading-relaxed text-text-muted">
                  Add a manual finding from stakeholder intake evidence above,
                  or wait for AI-assisted synthesis in a later sprint.
                </p>
              </CardBody>
            </Card>
          ) : (
            <FindingsWorkspace
              findings={findings}
              actionMode={isPersisted ? "review" : undefined}
            />
          )}

          {isPersisted ? null : <ManualFindingPlaceholder />}

          <Card variant="base">
            <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
              <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Boundary reminder
              </span>
              <p className="text-xs leading-relaxed text-text-muted">
                Findings are always reviewed by a consultant before they
                become report-ready. AI synthesis, document parsing, and
                opportunity scoring activate in later sprints.
              </p>
            </CardBody>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-3">
          {(() => {
            const route = recommendedActionRoute(
              engagement,
              `/app/engagements/${engagement.id}/findings`,
            );
            return (
              <EngagementRecommendedActionCard
                engagement={engagement}
                href={route.href}
                lockedNote={route.lockedNote}
                selfReference={route.selfReference}
              />
            );
          })()}
          <EngagementContextCard engagement={engagement} />
        </aside>
      </div>
    </div>
  );
}
