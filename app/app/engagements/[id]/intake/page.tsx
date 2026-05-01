import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { RoleCoverageMap } from "@/components/intake/role-coverage-map";
import { StakeholderList } from "@/components/intake/stakeholder-list";
import { SupportingInputsPanel } from "@/components/intake/supporting-inputs-panel";
import { FollowUpQueue } from "@/components/intake/follow-up-queue";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import { EngagementRisksPanel } from "@/components/engagements/engagement-risks-panel";
import {
  MOCK_ENGAGEMENTS,
  getEngagementById,
} from "@/lib/engagements/mock-engagements";
import { getIntakeForEngagement } from "@/lib/intake/mock-intake";
import { getFindingsForEngagement } from "@/lib/findings/mock-findings";

export function generateStaticParams() {
  return MOCK_ENGAGEMENTS.map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const engagement = getEngagementById(params.id);
  if (!engagement) return { title: "Intake not found" };
  return {
    title: `${engagement.companyName} · Stakeholder intake`,
  };
}

export default function EngagementIntakePage({
  params,
}: {
  params: { id: string };
}) {
  const engagement = getEngagementById(params.id);
  if (!engagement) notFound();
  const intake = getIntakeForEngagement(engagement.id);
  if (!intake) notFound();

  const findings = getFindingsForEngagement(engagement.id);
  const findingsHref =
    findings.length > 0 ? `/app/engagements/${engagement.id}/findings` : undefined;

  const completed = intake.stakeholders.filter(
    (s) => s.status === "completed",
  ).length;
  const inProgress = intake.stakeholders.filter(
    (s) => s.status === "in-progress",
  ).length;
  const needsFollowUp = intake.stakeholders.filter(
    (s) => s.status === "needs-follow-up",
  ).length;
  const notStarted = intake.stakeholders.filter(
    (s) => s.status === "not-started",
  ).length;
  const invited = intake.stakeholders.length - notStarted;
  const missingRoles = intake.roleCoverage.filter(
    (r) => r.status === "missing" && r.required,
  ).length;
  const strongCount = intake.stakeholders.filter(
    (s) => s.responseQuality === "strong",
  ).length;
  const inputsReceived = intake.supportingInputs.filter(
    (d) => d.status === "received" || d.status === "reviewed",
  ).length;

  const totalStakeholders = intake.stakeholders.length;
  const ratio = (n: number) =>
    totalStakeholders === 0 ? "—" : `${n}/${totalStakeholders}`;

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Intake"
        title="Stakeholder intake."
        description="Track role coverage, stakeholder responses, and supporting inputs before findings are synthesized."
        actions={
          <>
            <Link href={`/app/engagements/${engagement.id}`}>
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back to engagement
              </Button>
            </Link>
            {findingsHref ? (
              <Link href={findingsHref}>
                <Button
                  variant="primary"
                  size="md"
                  leadingIcon={<Sparkles className="h-4 w-4" />}
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Review Findings
                </Button>
              </Link>
            ) : null}
          </>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              {engagement.companyName} · {engagement.engagementType}
            </Badge>
            <span className="text-text-muted">
              Owner {engagement.owner} · Target {engagement.targetDate}
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Sprint 5 · Mock data
            </span>
          </>
        }
      />

      <section
        aria-label="Intake summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <MetricCard
          label="Invited"
          value={String(invited)}
          hint={
            invited === 0 ? "Awaiting kickoff" : "Stakeholders engaged"
          }
          tone="info"
        />
        <MetricCard
          label="Completed"
          value={ratio(completed)}
          hint="Full responses"
          tone={completed === totalStakeholders && totalStakeholders > 0 ? "success" : "info"}
        />
        <MetricCard
          label="In Progress"
          value={ratio(inProgress)}
          hint="Currently active"
          tone="info"
        />
        <MetricCard
          label="Missing Roles"
          value={String(missingRoles)}
          hint="Required and uncovered"
          tone={missingRoles > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Strong Responses"
          value={ratio(strongCount)}
          hint="Quality flag"
          tone="success"
        />
        <MetricCard
          label="Inputs Received"
          value={
            intake.supportingInputs.length === 0
              ? "—"
              : `${inputsReceived}/${intake.supportingInputs.length}`
          }
          hint={
            intake.supportingInputs.length === 0
              ? "Document list opens with intake"
              : "Documents and evidence"
          }
          tone="info"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <RoleCoverageMap rows={intake.roleCoverage} />
          <StakeholderList stakeholders={intake.stakeholders} />
          <SupportingInputsPanel inputs={intake.supportingInputs} />
          <FollowUpQueue followUps={intake.followUps} />

          {needsFollowUp + notStarted > 0 ? (
            <Card variant="base">
              <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Synthesis-readiness check
                </span>
                <p className="text-xs leading-relaxed text-text-muted">
                  {needsFollowUp} stakeholder
                  {needsFollowUp === 1 ? "" : "s"} needs follow-up and{" "}
                  {notStarted} hasn&apos;t started. Findings synthesis can
                  begin on partial intake but will be re-validated once these
                  responses land.
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <EngagementRecommendedActionCard
            engagement={engagement}
            href={`/app/engagements/${engagement.id}/intake`}
          />
          <EngagementContextCard engagement={engagement} />
          <EngagementRisksPanel
            risks={intake.intakeRiskNotes}
            dependencies={engagement.dependencies}
          />
          <Card variant="base">
            <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Boundary reminder
              </span>
              <p className="text-xs leading-relaxed text-text-muted">
                Stakeholder responses and documents are evidence inputs to
                synthesis. AI-drafted findings appear in the findings workspace
                and require consultant approval before they become
                report-ready.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
