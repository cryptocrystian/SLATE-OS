import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AlarmBadge, DecisionClassBadge, ItemStatusBadge, OriginBadge, ProjectStatusBadge, RunBadge } from "@/components/build/badges";
import { ClearAlarmButton, ItemTransitions, ProjectTransitions } from "@/components/build/controls";
import { ago, until, usd } from "@/components/build/format";
import { CreateWorkItemForm } from "@/components/build/forms";
import { requireWorkspaceMember } from "@/lib/auth/authorization";
import { getProject, listAlarms, listDecisions, listRuns, listWorkItems, projectCosts } from "@/lib/build/queries";
import { LABELS, type BuildWorkItem, type WorkItemStatus } from "@/lib/build/types";

export const metadata: Metadata = { title: "Build project" };
export const dynamic = "force-dynamic";

const BOARD: WorkItemStatus[] = ["escalated", "held", "in_progress", "ready", "draft", "accepted", "superseded", "cancelled"];

function ItemRow({ item, keyOf, canOperate }: { item: BuildWorkItem; keyOf: Map<string, string>; canOperate: boolean }) {
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-text-primary">{item.itemKey}</span>
        <ItemStatusBadge status={item.status} />
        <span className="text-[11px] text-text-muted">{LABELS.workItemKind[item.kind]}</span>
        {item.canonRef ? <span className="font-mono text-[11px] text-text-muted">{item.canonRef}</span> : null}
        {item.attempts ? <span className="text-[11px] text-text-muted">· {item.attempts} attempt{item.attempts > 1 ? "s" : ""}</span> : null}
        {canOperate ? (
          <span className="ml-auto">
            <ItemTransitions itemId={item.id} status={item.status} />
          </span>
        ) : null}
      </div>
      <span className="text-sm text-text-secondary">{item.title}</span>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted">
        {item.bindings.length ? <span>Touches {item.bindings.join(", ")}</span> : null}
        {item.dependsOn.length ? <span>After {item.dependsOn.map((d) => keyOf.get(d) ?? "?").join(", ")}</span> : null}
        {item.status === "held" && item.holdReason ? (
          <span className="text-status-warning">
            {LABELS.holdReason[item.holdReason]}
            {item.holdUntil ? ` · retries in ${until(item.holdUntil)}` : " · waiting for an operator"}
          </span>
        ) : null}
        {item.consecutiveFailures > 1 && item.lastFailureClass ? (
          <span>
            {item.consecutiveFailures}× {LABELS.failureClass[item.lastFailureClass]}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export default async function BuildProjectPage({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [member, items, runs, decisions, alarms, costs] = await Promise.all([
    requireWorkspaceMember(),
    listWorkItems(project.id),
    listRuns(project.id, 30),
    listDecisions({ status: "open", projectId: project.id }),
    listAlarms({ projectId: project.id }),
    projectCosts(),
  ]);
  const canOperate = member.ok && (member.actor.role === "owner" || member.actor.role === "operator");
  const keyOf = new Map(items.map((i) => [i.id, i.itemKey]));
  const cost = costs.get(project.id);
  const closed = project.status === "closed";

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow={`BuildOS · ${project.projectKey}`}
        title={project.name}
        description={project.description ?? undefined}
        actions={canOperate && !closed ? <ProjectTransitions projectId={project.id} status={project.status} /> : null}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <OriginBadge kind={project.originKind} />
            <ProjectStatusBadge status={project.status} />
            <span className="font-mono">{project.repoUrl}</span>
            <span>· {project.defaultBranch}</span>
          </span>
        }
      />

      <section aria-label="Project settings" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {[
          ["Origin", project.originKind === "consultos_engagement" ? project.originNameSnapshot ?? "Engagement" : project.originRef ?? "Saipien Labs"],
          ["Isolation", project.isolationClass === "client" ? "Client · metered only" : "Internal"],
          ["Profiles", `${project.stackProfile} · ${project.canonProfile}`],
          ["Roster", `${LABELS.family[project.builderFamily]} builds · ${project.judgeFamilies.map((f) => LABELS.family[f]).join(", ")} judge`],
          ["Scheduling", `WIP ${project.wipLimit} · weight ${project.priorityWeight} · ${project.maxAttempts} attempts`],
          ["Spend", cost ? `${usd(cost.todayUsd)} today · ${usd(cost.last7dUsd)} 7d` : project.dailyBudgetUsd != null ? `cap ${usd(project.dailyBudgetUsd)}/day` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-bg-surface p-3">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
            <span className="text-xs text-text-primary">{value}</span>
          </div>
        ))}
      </section>

      {project.status === "intake" ? (
        <p className="rounded-lg border border-border-subtle bg-bg-surface p-3 text-xs text-text-secondary">
          Intake: add the work items from the canon package, then mark the project ready. Nothing is claimable until it is
          ready <em>and</em> active.
        </p>
      ) : null}

      {alarms.length ? (
        <section aria-label="Alarms" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-text-primary">Alarms</h2>
          <ul className="flex flex-col divide-y divide-border-subtle rounded-xl border border-status-critical/30 px-4">
            {alarms.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <AlarmBadge kind={a.kind} />
                <span className="text-xs text-text-secondary">{a.subject}</span>
                <span className="text-xs text-text-muted">{a.detail}</span>
                <span className="ml-auto text-[11px] text-text-muted">{ago(a.raisedAt)}</span>
                {canOperate ? <ClearAlarmButton alarmId={a.id} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {decisions.length ? (
        <section aria-label="Open decisions" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-text-primary">Open decisions</h2>
          <ul className="flex flex-col gap-2">
            {decisions.map((d) => (
              <li key={d.id}>
                <Link href={`/app/build/decisions#${d.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface p-3 text-sm hover:border-border-strong">
                  <DecisionClassBadge cls={d.class} />
                  <span className="font-mono text-xs text-text-muted">{d.itemKey}</span>
                  <span className="text-text-primary">{d.title}</span>
                  <span className="ml-auto text-[11px] text-text-muted">{ago(d.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Work items" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-text-primary">
          Work items <span className="font-normal text-text-muted">· {items.length}</span>
        </h2>
        {items.length === 0 ? (
          <EmptyState title="No work items yet" description="Add the journeys and foundations from the project's canon package." />
        ) : (
          BOARD.map((status) => {
            const group = items.filter((i) => i.status === status);
            if (!group.length) return null;
            return (
              <div key={status} className="rounded-xl border border-border-subtle bg-bg-surface px-4">
                <h3 className="border-b border-border-subtle py-2 text-xs font-semibold text-text-secondary">
                  {LABELS.workItemStatus[status]} · {group.length}
                </h3>
                <ul className="divide-y divide-border-subtle">
                  {group.map((i) => (
                    <ItemRow key={i.id} item={i} keyOf={keyOf} canOperate={canOperate && !closed} />
                  ))}
                </ul>
              </div>
            );
          })
        )}
        {canOperate && !closed ? (
          <CreateWorkItemForm projectId={project.id} items={items.map((i) => ({ id: i.id, itemKey: i.itemKey }))} />
        ) : null}
      </section>

      <section aria-label="Recent runs" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-text-primary">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-xs text-text-muted">No runs yet. Runs appear when a worker claims a work item.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Run</th>
                  <th className="px-3 py-2 font-medium">Outcome</th>
                  <th className="px-3 py-2 font-medium">Phase / class</th>
                  <th className="px-3 py-2 font-medium">Worker</th>
                  <th className="px-3 py-2 font-medium">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <Link className="font-mono text-text-primary hover:underline" href={`/app/build/${project.id}/runs/${r.id}`}>
                        {r.runKey}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <RunBadge status={r.status} verdict={r.verdict} />
                    </td>
                    <td className="px-3 py-2 text-text-muted">
                      {r.status === "running" ? r.phase ?? "starting" : r.failureClass ? LABELS.failureClass[r.failureClass] : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-muted">{r.workerName ?? "—"}</td>
                    <td className="px-3 py-2 text-text-muted">{ago(r.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
