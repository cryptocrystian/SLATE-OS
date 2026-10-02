import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { HealthBadge } from "@/components/build/badges";
import { AccountStatusButton, WorkerStatusButton } from "@/components/build/controls";
import { ago, until, usd } from "@/components/build/format";
import { ProviderAccountForm, WorkerForm } from "@/components/build/forms";
import { requireWorkspaceMember } from "@/lib/auth/authorization";
import { listProjects, listProviderAccounts, listWorkers, projectCosts } from "@/lib/build/queries";
import { LABELS } from "@/lib/build/types";

export const metadata: Metadata = { title: "Build capacity" };
export const dynamic = "force-dynamic";

export default async function BuildCapacityPage() {
  const [member, accounts, workers, projects, costs] = await Promise.all([
    requireWorkspaceMember(),
    listProviderAccounts(),
    listWorkers(),
    listProjects(),
    projectCosts(),
  ]);
  const isOwner = member.ok && member.actor.role === "owner";
  const canOperate = member.ok && (isOwner || member.actor.role === "operator");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="BuildOS · Capacity"
        title="Model capacity, workers and spend."
        description="Judge capacity is the binding constraint: a run is dispatched only when the builder family and a different judge family both have a healthy account with a free slot."
        meta={<span><Link href="/app/build" className="underline">← Portfolio</Link> · Secrets never live here — accounts name a secret held by the worker secret manager.</span>}
      />

      <section aria-label="Provider accounts" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-text-primary">Provider accounts</h2>
        {accounts.length === 0 ? (
          <p className="text-xs text-text-muted">No accounts yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] text-text-muted">
                <tr>
                  {["Account", "Family", "Billing", "Health", "Slots", "Secret ref", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {accounts.map((a) => (
                  <tr key={a.id} className={a.status === "disabled" ? "opacity-50" : undefined}>
                    <td className="px-3 py-2 text-text-primary">
                      {a.label} <span className="font-mono text-text-muted">· {a.provider}</span>
                    </td>
                    <td className="px-3 py-2">{LABELS.family[a.family]}</td>
                    <td className="px-3 py-2">{LABELS.billingClass[a.billingClass]}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <HealthBadge health={a.health} />
                        <span className="text-[11px] text-text-muted">
                          {a.healthCheckedAt ? `checked ${ago(a.healthCheckedAt)}` : "never checked"}
                          {a.cooldownUntil && new Date(a.cooldownUntil).getTime() > Date.now() ? ` · cooldown ${until(a.cooldownUntil)}` : ""}
                        </span>
                        {a.healthDetail ? <span className="max-w-xs truncate text-[11px] text-text-muted">{a.healthDetail}</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {a.liveSlots}/{a.maxConcurrency}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-muted">{a.secretRef}</td>
                    <td className="px-3 py-2">{isOwner ? <AccountStatusButton accountId={a.id} status={a.status} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isOwner ? <ProviderAccountForm /> : <p className="text-[11px] text-text-muted">Provider accounts govern spend — managed by the workspace owner.</p>}
      </section>

      <section aria-label="Workers" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-text-primary">Workers</h2>
        {workers.length === 0 ? (
          <p className="text-xs text-text-muted">No workers registered. Workers arrive in B2.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle px-4">
            {workers.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 py-2 text-xs">
                <span className="font-mono text-text-primary">{w.name}</span>
                <span className="text-text-muted">{w.substrate}</span>
                <span className="font-mono text-text-muted">{w.capabilities.join(", ")}</span>
                <span className="text-text-muted">last seen {ago(w.lastSeenAt)}</span>
                {w.status === "disabled" ? <span className="text-status-warning">disabled</span> : null}
                <span className="ml-auto">{canOperate ? <WorkerStatusButton workerId={w.id} status={w.status} /> : null}</span>
              </li>
            ))}
          </ul>
        )}
        {canOperate ? <WorkerForm /> : null}
      </section>

      <section aria-label="Spend by project" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-text-primary">Spend by project · billed</h2>
        <ul className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle px-4">
          {projects.map((p) => {
            const c = costs.get(p.id);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2 text-xs">
                <Link href={`/app/build/${p.id}`} className="font-mono text-text-primary hover:underline">
                  {p.projectKey}
                </Link>
                <span className="text-text-muted">{p.isolationClass === "client" ? "client · metered" : "internal"}</span>
                <span className="ml-auto text-text-secondary">
                  {c ? `${usd(c.todayUsd)} today · ${usd(c.last7dUsd)} 7d · ${c.calls7d} calls` : "no spend"}
                  {p.dailyBudgetUsd != null ? ` · cap ${usd(p.dailyBudgetUsd)}/day` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
