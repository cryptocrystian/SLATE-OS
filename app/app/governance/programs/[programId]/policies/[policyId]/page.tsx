import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { ActivationBadge, PolicyStatusBadge } from "@/components/governance/badges";
import { PolicyVersionControls } from "@/components/governance/controls";
import { DraftVersionEditor } from "@/components/governance/policy-forms";
import { getProgramRole } from "@/lib/governance/authorization";
import { can } from "@/lib/governance/permissions";
import { getPolicy, getProgram } from "@/lib/governance/queries";
import { LABELS } from "@/lib/governance/types";

export const metadata: Metadata = { title: "Policy · GovernanceOS" };
export const dynamic = "force-dynamic";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default async function PolicyDetailPage({ params }: { params: { programId: string; policyId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const [policy, role] = await Promise.all([getPolicy(program.id, params.policyId), getProgramRole(program.id)]);
  if (!policy) notFound();

  const active = policy.versions.find((v) => v.status === "active");
  const draft = policy.versions.find((v) => v.status === "draft");
  const latest = policy.versions[0];
  const writable = program.status !== "archived";
  const canDraft = writable && can(role, "policy.draft");
  const root = `/app/governance/programs/${program.id}`;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`${root}/policies`} className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text-primary">
        <ChevronLeft className="h-3.5 w-3.5" /> Policies
      </Link>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11px] text-text-muted">
          {policy.policyKey} · {LABELS.policyDomain[policy.policyDomain]}
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-text-primary">{policy.name}</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="flex flex-col gap-4 xl:col-span-3">
          <Card>
            <CardBody className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-text-primary">In force</h3>
                {active ? (
                  <span className="flex items-center gap-2">
                    <ActivationBadge mode={active.activationMode} />
                    <span className="text-[11px] text-text-muted">
                      v{active.version} · since {fmt(active.activatedAt)}
                    </span>
                  </span>
                ) : null}
              </div>
              {active ? (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{active.statement}</p>
                  {active.rationale ? <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-muted">{active.rationale}</p> : null}
                  <PolicyVersionControls
                    programId={program.id}
                    versionId={active.id}
                    version={active.version}
                    status="active"
                    canActivate={false}
                    canRetire={writable && can(role, "policy.retire")}
                    hasActive
                  />
                </>
              ) : (
                <p className="text-sm text-text-muted">No version is active. Activate a draft to put this policy in force.</p>
              )}
            </CardBody>
          </Card>

          {canDraft ? (
            <Card>
              <CardBody className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-text-primary">{draft ? `Draft v${draft.version}` : "Propose a change"}</h3>
                <DraftVersionEditor
                  key={draft?.id ?? "new"}
                  programId={program.id}
                  policyId={policy.id}
                  nextVersion={draft ? draft.version : latest.version + 1}
                  isExistingDraft={Boolean(draft)}
                  initial={{
                    statement: draft?.statement ?? active?.statement ?? "",
                    rationale: draft?.rationale ?? "",
                  }}
                />
                {draft ? (
                  <PolicyVersionControls
                    programId={program.id}
                    versionId={draft.id}
                    version={draft.version}
                    status="draft"
                    canActivate={can(role, "policy.activate")}
                    canRetire={can(role, "policy.retire")}
                    hasActive={Boolean(active)}
                  />
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <Card className="xl:col-span-2">
          <CardBody className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Lock className="h-3.5 w-3.5 text-text-muted" aria-hidden /> Version history
            </h3>
            <p className="text-[11px] leading-relaxed text-text-muted">
              Non-draft versions are immutable in the database. Nothing is overwritten; superseded versions stay visible.
            </p>
            <ol className="flex flex-col gap-2">
              {policy.versions.map((v) => (
                <li key={v.id} className="rounded-lg border border-border-subtle p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-text-primary">v{v.version}</span>
                    <span className="flex items-center gap-1.5">
                      <PolicyStatusBadge status={v.status} />
                      <ActivationBadge mode={v.activationMode} />
                    </span>
                  </div>
                  <p className="line-clamp-3 pt-1 text-[11px] leading-relaxed text-text-secondary">{v.statement}</p>
                  <p className="pt-1 text-[10px] text-text-muted">
                    Created {fmt(v.createdAt)}
                    {v.activatedAt ? ` · activated ${fmt(v.activatedAt)}` : ""}
                    {v.supersededAt ? ` · superseded ${fmt(v.supersededAt)}` : ""}
                    {v.retiredAt ? ` · retired ${fmt(v.retiredAt)}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
