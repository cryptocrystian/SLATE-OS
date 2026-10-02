import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DecisionClassBadge } from "@/components/build/badges";
import { ago } from "@/components/build/format";
import { RuleDecisionForm } from "@/components/build/forms";
import { requireWorkspaceMember } from "@/lib/auth/authorization";
import { listDecisions } from "@/lib/build/queries";
import { LABELS } from "@/lib/build/types";

export const metadata: Metadata = { title: "Build decisions" };
export const dynamic = "force-dynamic";

export default async function BuildDecisionsPage({ searchParams }: { searchParams: { view?: string } }) {
  const view = searchParams.view === "all" ? "all" : "open";
  const [member, decisions] = await Promise.all([requireWorkspaceMember(), listDecisions({ status: view })]);
  const canRule = member.ok && (member.actor.role === "owner" || member.actor.role === "operator");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="BuildOS · Decisions"
        title="Decisions waiting on a human."
        description="Only questions canon does not answer reach this inbox. Technical non-convergence, product forks and owner-level business calls — each with a brief, options and a recommendation."
        actions={
          <Link href={view === "open" ? "/app/build/decisions?view=all" : "/app/build/decisions"} className="text-xs text-text-muted underline">
            {view === "open" ? "Show ruled decisions" : "Show open only"}
          </Link>
        }
        meta={<span><Link href="/app/build" className="underline">← Portfolio</Link> · A ruling makes the work item claimable again; it never dispatches work by itself.</span>}
      />

      {decisions.length === 0 ? (
        <EmptyState icon={<Inbox className="h-4 w-4" />} title="Nothing to rule" description="No open decisions across any build project." />
      ) : (
        <ul className="flex flex-col gap-4">
          {decisions.map((d) => (
            <li key={d.id} id={d.id} className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <DecisionClassBadge cls={d.class} />
                <Link href={`/app/build/${d.projectId}`} className="font-mono text-xs text-text-muted hover:underline">
                  {d.projectKey}/{d.itemKey}
                </Link>
                <span className="ml-auto text-[11px] text-text-muted">raised {ago(d.createdAt)}</span>
              </div>
              <h2 className="text-base font-semibold tracking-tight text-text-primary">{d.title}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{d.brief}</p>
              {d.status === "open" ? (
                canRule ? (
                  <RuleDecisionForm decisionId={d.id} options={d.options} recommended={d.recommendedOption} />
                ) : (
                  <p className="text-xs text-text-muted">Ruling requires the workspace owner or operator role.</p>
                )
              ) : (
                <p className="text-xs text-text-muted">
                  Ruled {ago(d.ruledAt)}: <strong className="text-text-secondary">{d.options.find((o) => o.key === d.rulingOption)?.label ?? d.rulingOption}</strong>
                  {d.itemAction ? ` · ${LABELS.itemAction[d.itemAction].toLowerCase()}` : ""}
                  {d.resultingCanonRef ? ` · ${d.resultingCanonRef}` : ""}
                  {d.rulingNote ? ` — ${d.rulingNote}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
