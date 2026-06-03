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
import { CreateStakeholderForm } from "@/components/intake/create-stakeholder-form";
import { OperatorUploadForm } from "@/components/intake/operator-upload-form";
import { PersistedSupportingInputs } from "@/components/intake/persisted-supporting-inputs";
import { StageOfflineStakeholderForm } from "@/components/intake/stage-offline-stakeholder-form";
import { OfflineIntakePanel } from "@/components/intake/offline-intake-panel";
import { OfflineIntakeReadinessHint } from "@/components/intake/offline-intake-readiness-hint";
import { TranscriptIntakePanel } from "@/components/intake/transcript-intake-panel";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import { EngagementRisksPanel } from "@/components/engagements/engagement-risks-panel";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getIntakeForEngagement } from "@/lib/intake/mock-intake";
import { getIntakeRecordForEngagement } from "@/lib/intake/queries";
import {
  getEngagementIntakeDocuments,
  getOfflineIntakeReadinessSummary,
  getOfflineSessionsForEngagement,
  type OfflineIntakeReadinessSummary,
  type OfflineStakeholderSession,
} from "@/lib/intake/offline-queries";
import { getOperatorAssetsForEngagement } from "@/lib/assets/server";
import { getFindingsForEngagement } from "@/lib/findings/mock-findings";
import { recommendedActionRoute } from "@/lib/engagements/recommended-action";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  EngagementIntakeDocument,
  IntakeRecord,
} from "@/lib/intake/types";
import type { OperatorAsset } from "@/lib/assets/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) return { title: "Intake not found" };
  return {
    title: `${loaded.engagement.companyName} · Stakeholder intake`,
  };
}

export default async function EngagementIntakePage({
  params,
}: {
  params: { id: string };
}) {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) notFound();
  const engagement = loaded.engagement;

  const findings = getFindingsForEngagement(engagement.id);
  const findingsHref =
    findings.length > 0 ? `/app/engagements/${engagement.id}/findings` : undefined;

  let intake: IntakeRecord | null = null;
  let trustWarning: string | undefined;
  let isPersisted = false;
  let persistedAssets: OperatorAsset[] = [];
  let offlineSessions: OfflineStakeholderSession[] = [];
  let offlineDocuments: EngagementIntakeDocument[] = [];
  let offlineReadiness: OfflineIntakeReadinessSummary | null = null;

  if (loaded.kind === "real") {
    [
      intake,
      trustWarning,
      persistedAssets,
      offlineSessions,
      offlineDocuments,
      offlineReadiness,
    ] = await Promise.all([
      getIntakeRecordForEngagement(engagement.id).then(
        (record) =>
          record ?? {
            engagementId: engagement.id,
            stakeholders: [],
            roleCoverage: [],
            supportingInputs: [],
            followUps: [],
            intakeRiskNotes: [],
          },
      ),
      loadTrustWarning(engagement.linkedLeadId),
      getOperatorAssetsForEngagement(engagement.id),
      getOfflineSessionsForEngagement(engagement.id),
      getEngagementIntakeDocuments(engagement.id),
      getOfflineIntakeReadinessSummary(engagement.id),
    ]);
    isPersisted = true;
  } else {
    intake = getIntakeForEngagement(engagement.id) ?? null;
    if (!intake) notFound();
  }

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
  const persistedReceived = persistedAssets.filter(
    (a) => a.status === "received" || a.status === "reviewed",
  ).length;
  const inputsReceived = isPersisted
    ? persistedReceived
    : intake.supportingInputs.filter(
        (d) => d.status === "received" || d.status === "reviewed",
      ).length;
  const inputsTotalCount = isPersisted
    ? persistedAssets.length
    : intake.supportingInputs.length;

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
              {isPersisted ? "Persistence Step 5 · Live" : "Sprint 5 · Mock data"}
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
            inputsTotalCount === 0
              ? "—"
              : `${inputsReceived}/${inputsTotalCount}`
          }
          hint={
            inputsTotalCount === 0
              ? "Document list opens with intake"
              : "Documents and evidence"
          }
          tone="info"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {isPersisted ? (
            <CreateStakeholderForm
              engagementId={engagement.id}
              trustWarning={trustWarning}
            />
          ) : null}

          {isPersisted ? (
            <section
              aria-label="Offline intake"
              className="flex flex-col gap-4"
            >
              <StageOfflineStakeholderForm engagementId={engagement.id} />
              <OfflineIntakePanel
                sessions={offlineSessions}
                documents={offlineDocuments}
              />
              <TranscriptIntakePanel
                engagementId={engagement.id}
                offlineSessions={offlineSessions}
              />
            </section>
          ) : null}

          {intake.roleCoverage.length > 0 ? (
            <RoleCoverageMap rows={intake.roleCoverage} />
          ) : null}

          {intake.stakeholders.length === 0 && isPersisted ? (
            <Card variant="base">
              <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  No stakeholders yet
                </span>
                <p className="text-xs leading-relaxed text-text-muted">
                  Invite stakeholders above. Each invite generates a unique
                  token-gated link that lets them complete intake without a
                  SLATE login.
                </p>
              </CardBody>
            </Card>
          ) : (
            <StakeholderList stakeholders={intake.stakeholders} />
          )}

          {isPersisted ? (
            <>
              <OperatorUploadForm engagementId={engagement.id} />
              <PersistedSupportingInputs assets={persistedAssets} />
            </>
          ) : (
            <SupportingInputsPanel inputs={intake.supportingInputs} />
          )}
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
          {(() => {
            const route = recommendedActionRoute(
              engagement,
              `/app/engagements/${engagement.id}/intake`,
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
          {isPersisted && offlineReadiness ? (
            <OfflineIntakeReadinessHint summary={offlineReadiness} />
          ) : null}
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
                report-ready. Offline-staged rows stay operator-only until you
                explicitly clear them through the readiness gate.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

async function loadTrustWarning(
  linkedLeadId: string | undefined,
): Promise<string | undefined> {
  if (!linkedLeadId) return undefined;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leads")
    .select("trust_status, trust_reasons")
    .eq("id", linkedLeadId)
    .maybeSingle<{
      trust_status: string | null;
      trust_reasons: string[] | null;
    }>();
  if (error || !data) return undefined;
  if (data.trust_status === "flagged" || data.trust_status === "rejected") {
    return "This lead was flagged during public scorecard submission. Confirm before sending stakeholder intake.";
  }
  return undefined;
}
