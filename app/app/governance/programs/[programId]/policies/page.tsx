import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cardInteractiveClass } from "@/components/ui/card";
import { ActivationBadge, PolicyStatusBadge } from "@/components/governance/badges";
import { getProgramRole } from "@/lib/governance/authorization";
import { can } from "@/lib/governance/permissions";
import { getProgram, listPolicies } from "@/lib/governance/queries";
import { LABELS } from "@/lib/governance/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Policies · GovernanceOS" };
export const dynamic = "force-dynamic";

export default async function PoliciesPage({ params }: { params: { programId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const [policies, role] = await Promise.all([listPolicies(program.id), getProgramRole(program.id)]);
  const canCreate = can(role, "policy.create") && program.status !== "archived";
  const root = `/app/governance/programs/${program.id}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">Governance policies</h2>
          <p className="max-w-2xl text-xs leading-relaxed text-text-muted">
            Approved operating rules that people and systems consult. Every version is immutable once active; changes are new versions.
            All policies are <strong>advisory</strong> in this release.
          </p>
        </div>
        {canCreate ? (
          <Link href={`${root}/policies/new`}>
            <Button variant="primary" size="sm" leadingIcon={<Plus className="h-3.5 w-3.5" />}>
              New policy
            </Button>
          </Link>
        ) : null}
      </div>

      {policies.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-4 w-4" />}
          title="No policies yet"
          description="Encode the operating standard as policies — e.g. approved AI providers, decision rights, model-change procedure."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {policies.map((p) => {
            const active = p.versions.find((v) => v.status === "active");
            const draft = p.versions.find((v) => v.status === "draft");
            return (
              <li key={p.id}>
                <Link href={`${root}/policies/${p.id}`} className={cn(cardInteractiveClass, "flex flex-col gap-2 rounded-xl p-4")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-text-primary">{p.name}</span>
                      <span className="font-mono text-[11px] text-text-muted">
                        {p.policyKey} · {LABELS.policyDomain[p.policyDomain]}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {active ? (
                        <>
                          <PolicyStatusBadge status="active" />
                          <ActivationBadge mode={active.activationMode} />
                          <span className="text-[11px] text-text-muted">v{active.version}</span>
                        </>
                      ) : (
                        <PolicyStatusBadge status={draft ? "draft" : "retired"} />
                      )}
                      {active && draft ? <span className="text-[11px] text-status-warning">v{draft.version} draft pending</span> : null}
                    </span>
                  </div>
                  {active ? <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">{active.statement}</p> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
