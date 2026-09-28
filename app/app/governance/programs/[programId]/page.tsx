import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleDashed } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProgram, listAssets, listEngagementLinks, listPolicies } from "@/lib/governance/queries";
import { computePosture, type AttentionItem } from "@/lib/governance/posture";
import { LABELS, LIFECYCLE_STATUSES, type SourceSystem } from "@/lib/governance/types";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Program overview · GovernanceOS" };
export const dynamic = "force-dynamic";

function attentionHref(programId: string, item: AttentionItem): string {
  const root = `/app/governance/programs/${programId}`;
  switch (item.kind) {
    case "asset_active_not_approved":
    case "asset_unclassified":
      return item.entityId ? `${root}/registry/${item.entityId}` : `${root}/registry`;
    case "policy_draft_pending":
      return item.entityId ? `${root}/policies/${item.entityId}` : `${root}/policies`;
    case "program_has_no_policies":
      return `${root}/policies/new`;
    case "program_has_no_assets":
      return `${root}/registry/new`;
    default:
      return `${root}/settings`;
  }
}

const SEVERITY_TONE = { high: "critical", medium: "warning", low: "neutral" } as const;

export default async function ProgramOverviewPage({ params }: { params: { programId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const [assets, policies, links] = await Promise.all([
    listAssets(program.id),
    listPolicies(program.id),
    listEngagementLinks(program.id),
  ]);
  const posture = computePosture({ program, assets, policies, links });
  const root = `/app/governance/programs/${program.id}`;
  const top = posture.attention.slice(0, 6);

  return (
    <div className="flex flex-col gap-8">
      {/* Decision-first (docs/64 #2): what needs a human now, before any scoreboard. */}
      <section aria-label="Needs attention" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-text-primary">What needs attention</h2>
        {top.length === 0 ? (
          <Card>
            <CardBody className="text-sm text-text-secondary">
              Nothing outstanding in the G1 scope. Risks, controls and evidence are not assessed yet — that is not the same as “no risk”.
            </CardBody>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {top.map((item, i) => (
              <li key={`${item.kind}-${item.entityId ?? i}`}>
                <Link
                  href={attentionHref(program.id, item)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-bg-surface p-3 transition-colors hover:border-border-strong"
                >
                  <span className="flex items-center gap-3">
                    <AlertTriangle
                      className={
                        "h-4 w-4 shrink-0 " +
                        (item.severity === "high" ? "text-status-critical" : item.severity === "medium" ? "text-status-warning" : "text-text-muted")
                      }
                      aria-hidden
                    />
                    <span className="text-sm text-text-primary">{item.title}</span>
                  </span>
                  <Badge tone={SEVERITY_TONE[item.severity]} variant="outline">
                    {item.severity}
                  </Badge>
                </Link>
              </li>
            ))}
            {posture.attention.length > top.length ? (
              <li className="px-1 text-[11px] text-text-muted">+ {posture.attention.length - top.length} more</li>
            ) : null}
          </ul>
        )}
      </section>

      <section aria-label="Posture summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Governed assets" value={String(posture.assets.live)} hint={`${posture.assets.total - posture.assets.live} retired`} tone="info" />
        <MetricCard
          label="Running, not approved"
          value={String(posture.assets.activeNotApproved)}
          hint="Approvals arrive with decision records (G3)"
          tone={posture.assets.activeNotApproved > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="High / critical assets"
          value={String(posture.assets.highOrCriticalLive)}
          hint={`${posture.assets.unclassifiedLive} unclassified`}
          tone={posture.assets.highOrCriticalLive > 0 ? "risk" : "neutral"}
        />
        <MetricCard
          label="Active policies"
          value={String(posture.policies.activeAdvisory)}
          hint={`All advisory · ${posture.policies.draftsPending} draft${posture.policies.draftsPending === 1 ? "" : "s"} pending`}
          tone="success"
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">Registry by lifecycle</h3>
            <ul className="flex flex-col gap-1.5 text-xs">
              {LIFECYCLE_STATUSES.map((s) => (
                <li key={s} className="flex items-center justify-between">
                  <span className="text-text-secondary">{LABELS.lifecycle[s]}</span>
                  <span className="font-mono text-text-primary">{posture.assets.byLifecycle[s]}</span>
                </li>
              ))}
            </ul>
            <h3 className="pt-2 text-sm font-semibold text-text-primary">By origin</h3>
            <ul className="flex flex-wrap gap-1.5">
              {Object.entries(posture.assets.bySource).map(([src, n]) => (
                <li key={src}>
                  <Badge tone="neutral" variant="outline">
                    {src === "unsourced" ? "No lineage" : LABELS.sourceSystem[src as SourceSystem]} · {n}
                  </Badge>
                </li>
              ))}
              {posture.assets.total === 0 ? <li className="text-xs text-text-muted">No assets registered.</li> : null}
            </ul>
            <Link href={`${root}/registry`} className="mt-1 w-fit">
              <Button variant="ghost" size="sm" trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                Open registry
              </Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">Governance loop coverage</h3>
            <p className="text-xs leading-relaxed text-text-muted">
              Honest status of each stage. Unbuilt stages are shown as not assessed — never as zero.
            </p>
            <ul className="flex flex-col gap-2 text-xs">
              {[
                ["Register", `${posture.assets.total} asset${posture.assets.total === 1 ? "" : "s"}`, true],
                ["Policies", `${posture.policies.total} (advisory)`, true],
                ["Engagements linked", `${posture.engagements.linkedActive} active · ${posture.engagements.linkedHistorical} past`, true],
                ["Risks", "Not yet assessed (G2)", false],
                ["Controls", "Not yet assessed (G2)", false],
                ["Evidence", "Not yet collected (G3)", false],
                ["Decisions / approvals", "Not yet recorded (G3)", false],
                ["Monitoring & review", posture.review.unscheduled ? "No review scheduled" : posture.review.overdue ? "Review overdue" : "Review scheduled", true],
              ].map(([label, value, live]) => (
                <li key={label as string} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-text-secondary">
                    {live ? null : <CircleDashed className="h-3.5 w-3.5 text-text-disabled" aria-hidden />}
                    {label}
                  </span>
                  <span className={live ? "text-text-primary" : "text-text-disabled"}>{value}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
