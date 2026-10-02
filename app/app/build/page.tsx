import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, Hammer, Inbox, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cardInteractiveClass } from "@/components/ui/card";
import { AlarmBadge, HealthBadge, OriginBadge, ProjectStatusBadge } from "@/components/build/badges";
import { ClearAlarmButton, EvaluateAlarmsButton } from "@/components/build/controls";
import { ago, usd } from "@/components/build/format";
import { requireWorkspaceMember } from "@/lib/auth/authorization";
import { listAlarms, listDecisions, listProjects, listProviderAccounts, projectCosts } from "@/lib/build/queries";
import { LABELS, MODEL_FAMILIES, type ModelFamily, type ProjectStatus } from "@/lib/build/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "BuildOS" };
export const dynamic = "force-dynamic";

const ORDER: ProjectStatus[] = ["active", "paused", "ready", "intake", "closed"];

export default async function BuildPortfolioPage() {
  const member = await requireWorkspaceMember();
  if (!member.ok) {
    return (
      <EmptyState
        icon={<Hammer className="h-4 w-4" />}
        title="Workspace membership required"
        description="BuildOS is available to active workspace members. Ask a workspace owner to grant membership."
      />
    );
  }
  const canOperate = member.actor.role === "owner" || member.actor.role === "operator";
  const [projects, alarms, decisions, accounts, costs] = await Promise.all([
    listProjects(),
    listAlarms(),
    listDecisions({ status: "open" }),
    listProviderAccounts(),
    projectCosts(),
  ]);

  // Capacity strip: per family, healthy accounts with free slots.
  const families = MODEL_FAMILIES.filter((f) => accounts.some((a) => a.family === f));
  const capacity = families.map((f: ModelFamily) => {
    const acc = accounts.filter((a) => a.family === f && a.status === "active");
    const healthy = acc.filter((a) => a.health === "healthy");
    const free = healthy.reduce((n, a) => n + Math.max(0, a.maxConcurrency - a.liveSlots), 0);
    return { family: f, total: acc.length, healthy: healthy.length, free };
  });

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="BuildOS · Portfolio"
        title="Governed software delivery."
        description="Every client, venture and internal build — what is moving, what is held, and what needs a human."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/app/build/decisions">
              <Button variant="secondary" size="md" leadingIcon={<Inbox className="h-4 w-4" />}>
                Decisions{decisions.length ? ` · ${decisions.length}` : ""}
              </Button>
            </Link>
            <Link href="/app/build/capacity">
              <Button variant="secondary" size="md" leadingIcon={<Gauge className="h-4 w-4" />}>
                Capacity
              </Button>
            </Link>
            {canOperate ? (
              <Link href="/app/build/new">
                <Button variant="primary" size="md" leadingIcon={<Plus className="h-4 w-4" />}>
                  New project
                </Button>
              </Link>
            ) : null}
          </div>
        }
        meta={<span>Agents propose, code disposes, people rule. A ruling never dispatches work by itself.</span>}
      />

      {alarms.length ? (
        <section aria-label="Open alarms" className="flex flex-col gap-2 rounded-xl border border-status-critical/30 bg-status-critical/[0.04] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-text-primary">Open alarms · {alarms.length}</h2>
            {canOperate ? <EvaluateAlarmsButton /> : null}
          </div>
          <ul className="flex flex-col divide-y divide-border-subtle">
            {alarms.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <AlarmBadge kind={a.kind} />
                <span className="font-mono text-xs text-text-secondary">
                  {a.projectKey ?? "workspace"}
                  {a.subject ? ` · ${a.subject}` : ""}
                </span>
                <span className="text-xs text-text-muted">{a.detail}</span>
                <span className="ml-auto text-[11px] text-text-muted">{ago(a.raisedAt)}</span>
                {canOperate ? <ClearAlarmButton alarmId={a.id} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {capacity.length ? (
        <section aria-label="Model capacity" className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {capacity.map((c) => (
            <div key={c.family} className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-bg-surface p-3">
              <span className="text-[11px] uppercase tracking-wider text-text-muted">{LABELS.family[c.family]}</span>
              <span className={cn("text-sm font-semibold", c.healthy === 0 ? "text-status-critical" : "text-text-primary")}>
                {c.healthy}/{c.total} healthy
              </span>
              <span className="text-[11px] text-text-muted">{c.free} free slots</span>
            </div>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={<Gauge className="h-4 w-4" />}
          title="No provider accounts yet"
          description="Nothing can be dispatched until the builder family and at least one judge family have a healthy account."
          action={
            <Link href="/app/build/capacity">
              <Button variant="secondary" size="sm">
                Set up capacity
              </Button>
            </Link>
          }
        />
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={<Hammer className="h-4 w-4" />}
          title="No build projects yet"
          description="Create a project for a venture, a client engagement's approved SOW, or internal work."
        />
      ) : (
        ORDER.map((status) => {
          const group = projects.filter((p) => p.status === status);
          if (group.length === 0) return null;
          return (
            <section key={status} aria-label={`${LABELS.projectStatus[status]} projects`} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold tracking-tight text-text-primary">
                {LABELS.projectStatus[status]} <span className="font-normal text-text-muted">· {group.length}</span>
              </h2>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {group.map((p) => {
                  const cost = costs.get(p.id);
                  const pct = p.counts.total ? Math.round((p.counts.accepted / p.counts.total) * 100) : 0;
                  return (
                    <li key={p.id}>
                      <Link href={`/app/build/${p.id}`} className={cn(cardInteractiveClass, "flex h-full flex-col gap-3 rounded-xl p-5")}>
                        <div className="flex flex-wrap items-center gap-2">
                          <OriginBadge kind={p.originKind} />
                          <ProjectStatusBadge status={p.status} />
                          {p.openAlarms ? <span className="text-[11px] font-medium text-status-critical">{p.openAlarms} alarm{p.openAlarms > 1 ? "s" : ""}</span> : null}
                          {p.openDecisions ? <span className="text-[11px] font-medium text-status-risk">{p.openDecisions} decision{p.openDecisions > 1 ? "s" : ""}</span> : null}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-base font-semibold tracking-tight text-text-primary">{p.name}</span>
                          <span className="font-mono text-xs text-text-muted">{p.projectKey}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                            <div className="h-full rounded-full bg-status-success" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] text-text-muted">
                            {p.counts.accepted}/{p.counts.total} accepted · {p.counts.inProgress} running · {p.counts.held} held
                            {p.counts.escalated ? ` · ${p.counts.escalated} escalated` : ""}
                          </span>
                        </div>
                        <span className="mt-auto text-[11px] text-text-muted">
                          Last accepted {ago(p.lastAcceptedAt)}
                          {cost ? ` · ${usd(cost.last7dUsd)} in 7 days` : ""}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {accounts.some((a) => a.health === "down") ? (
        <p className="text-[11px] text-text-muted">
          Accounts down: {accounts.filter((a) => a.health === "down").map((a) => a.label).join(", ")}. See{" "}
          <Link className="underline" href="/app/build/capacity">
            capacity
          </Link>
          . <HealthBadge health="down" />
        </p>
      ) : null}
    </div>
  );
}
