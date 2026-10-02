import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { RunBadge } from "@/components/build/badges";
import { CancelRunButton } from "@/components/build/controls";
import { ago, shortSha, until, usd } from "@/components/build/format";
import { requireWorkspaceMember } from "@/lib/auth/authorization";
import { getProject, getRun } from "@/lib/build/queries";
import { LABELS } from "@/lib/build/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Build run" };
export const dynamic = "force-dynamic";

export default async function BuildRunPage({ params }: { params: { projectId: string; runId: string } }) {
  const [project, data, member] = await Promise.all([getProject(params.projectId), getRun(params.runId), requireWorkspaceMember()]);
  if (!project || !data || data.run.projectId !== project.id) notFound();
  const { run, item, events, costUsd } = data;
  const canOperate = member.ok && (member.actor.role === "owner" || member.actor.role === "operator");

  const pins: [string, string][] = [
    ["Base", shortSha(run.baseSha)],
    ["Canon", run.canonRefPin ?? "—"],
    ["Lane", run.laneVersion ?? "—"],
    ["Roster", run.rosterHash ? run.rosterHash.slice(0, 10) : "—"],
    ["Profiles", `${run.stackProfile} · ${run.canonProfile}`],
    ["Mode", run.mode],
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={`BuildOS · ${project.projectKey}`}
        title={run.runKey}
        description={item ? `${item.itemKey} — ${item.title}` : undefined}
        actions={canOperate && run.status === "running" && !run.cancelRequestedAt ? <CancelRunButton runId={run.id} /> : null}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/app/build/${project.id}`} className="underline">
              ← {project.projectKey}
            </Link>
            <RunBadge status={run.status} verdict={run.verdict} />
            {run.failureClass ? <span>{LABELS.failureClass[run.failureClass]}</span> : null}
            <span>· worker {run.workerName ?? run.workerId.slice(0, 8)}</span>
            <span>· started {ago(run.startedAt)}</span>
            {run.finishedAt ? <span>· finished {ago(run.finishedAt)}</span> : null}
            {run.status === "running" ? (
              <span>
                · phase {run.phase ?? "starting"} · lease {until(run.leaseExpiresAt)}
                {run.cancelRequestedAt ? " · cancel requested" : ""}
              </span>
            ) : null}
          </span>
        }
      />

      <section aria-label="Pins" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {pins.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-bg-surface p-3">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
            <span className="font-mono text-xs text-text-primary">{value}</span>
          </div>
        ))}
      </section>

      {run.summary || run.prUrl || run.branch ? (
        <section aria-label="Outcome" className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-bg-surface p-4 text-sm">
          {run.summary ? <p className="whitespace-pre-wrap text-text-secondary">{run.summary}</p> : null}
          <div className="flex flex-wrap gap-4 text-xs text-text-muted">
            {run.branch ? <span className="font-mono">branch {run.branch}</span> : null}
            {run.prUrl ? (
              <a className="underline" href={run.prUrl} target="_blank" rel="noreferrer">
                Pull request
              </a>
            ) : null}
            {run.mergeSha ? <span className="font-mono">merged {shortSha(run.mergeSha)}</span> : null}
            {run.resumableFromPhase ? <span>next attempt resumes at {run.resumableFromPhase}</span> : null}
            <span>spend {usd(costUsd)}</span>
          </div>
        </section>
      ) : null}

      <section aria-label="Run events" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-text-primary">
          Trace <span className="font-normal text-text-muted">· {events.length} events</span>
        </h2>
        {events.length === 0 ? (
          <p className="text-xs text-text-muted">No events reported yet.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {events.map((e) => (
              <li key={e.id} className="grid grid-cols-[88px_110px_1fr] gap-3 px-3 py-2 text-xs">
                <span className="font-mono text-text-muted">{new Date(e.ts).toISOString().slice(11, 19)}</span>
                <span
                  className={cn(
                    "font-mono",
                    e.kind === "gate" ? (e.passed ? "text-status-success" : "text-status-critical") : "text-text-secondary",
                  )}
                >
                  {e.kind}
                  {e.kind === "gate" ? (e.passed ? " ✓" : " ✗") : ""}
                </span>
                <span className="flex flex-wrap gap-x-3 text-text-secondary">
                  {e.phase ? <span>{e.phase}</span> : null}
                  {e.role ? <span className="text-text-muted">{e.role}</span> : null}
                  {e.model ? <span className="font-mono text-text-muted">{e.model}</span> : null}
                  {Object.keys(e.detail).length ? (
                    <span className="break-all font-mono text-[11px] text-text-muted">{JSON.stringify(e.detail).slice(0, 400)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
