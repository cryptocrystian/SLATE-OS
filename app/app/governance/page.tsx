import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cardInteractiveClass } from "@/components/ui/card";
import { ProgramKindBadge, ProgramStatusBadge } from "@/components/governance/badges";
import { requireWorkspaceMember } from "@/lib/auth/authorization";
import { listPrograms } from "@/lib/governance/queries";
import { LABELS, type GovernanceProgram, type ProgramKind } from "@/lib/governance/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "GovernanceOS" };
export const dynamic = "force-dynamic";

function reviewState(p: GovernanceProgram): { label: string; tone: string } {
  if (p.status === "archived") return { label: "Archived", tone: "text-text-muted" };
  if (!p.nextProgramReviewAt) return { label: "No review scheduled", tone: "text-status-warning" };
  const due = new Date(p.nextProgramReviewAt);
  const overdue = due.getTime() < Date.now();
  return {
    label: `${overdue ? "Review overdue since" : "Next review"} ${due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    tone: overdue ? "text-status-critical" : "text-text-muted",
  };
}

const GROUPS: ProgramKind[] = ["client", "internal", "venture"];

export default async function GovernancePortfolioPage() {
  const [programs, member] = await Promise.all([listPrograms(), requireWorkspaceMember()]);
  const canCreate = member.ok && (member.actor.role === "owner" || member.actor.role === "operator");

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="GovernanceOS · Programs"
        title="AI governance programs."
        description="Durable governance for every AI system Saipien advises on, builds, deploys or runs — outliving any single engagement."
        actions={
          canCreate ? (
            <Link href="/app/governance/programs/new">
              <Button variant="primary" size="md" leadingIcon={<Plus className="h-4 w-4" />}>
                New program
              </Button>
            </Link>
          ) : null
        }
        meta={
          <span>
            Human authority is permanent: GovernanceOS records, maps and advises — people approve.
          </span>
        }
      />

      {!member.ok ? (
        <EmptyState
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Workspace membership required"
          description="GovernanceOS is available to active workspace members. Ask a workspace owner to grant membership."
        />
      ) : programs.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-4 w-4" />}
          title="No governance programs yet"
          description="Start with Saipien's own internal program — it is the first program GovernanceOS governs."
          action={
            canCreate ? (
              <Link href="/app/governance/programs/new?kind=internal">
                <Button variant="secondary" size="sm">
                  Create the internal program
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        GROUPS.map((kind) => {
          const group = programs.filter((p) => p.programKind === kind);
          if (group.length === 0) return null;
          return (
            <section key={kind} aria-label={`${LABELS.programKind[kind]} programs`} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold tracking-tight text-text-primary">
                {LABELS.programKind[kind]} programs <span className="font-normal text-text-muted">· {group.length}</span>
              </h2>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {group.map((p) => {
                  const review = reviewState(p);
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/app/governance/programs/${p.id}`}
                        className={cn(cardInteractiveClass, "flex h-full flex-col gap-3 rounded-xl p-5")}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <ProgramKindBadge kind={p.programKind} />
                          <ProgramStatusBadge status={p.status} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-base font-semibold tracking-tight text-text-primary">{p.name}</span>
                          <span className="text-xs text-text-muted">
                            {p.programKind === "client"
                              ? p.accountName ?? "Client account"
                              : p.programKind === "venture"
                                ? `VentureOS · ${p.ventureSourceId}`
                                : "Saipien Labs"}
                            {p.executiveSponsorName ? ` · Sponsor: ${p.executiveSponsorName}` : ""}
                          </span>
                        </div>
                        <span className={cn("mt-auto text-[11px]", review.tone)}>{review.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
