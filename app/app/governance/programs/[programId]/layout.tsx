import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProgramKindBadge, ProgramStatusBadge } from "@/components/governance/badges";
import { ProgramNav } from "@/components/governance/program-nav";
import { Badge } from "@/components/ui/badge";
import { getProgramRole } from "@/lib/governance/authorization";
import { getProgram } from "@/lib/governance/queries";
import { LABELS } from "@/lib/governance/types";

export const dynamic = "force-dynamic";

/**
 * Program shell. Visibility is decided by RLS: a program the caller has no
 * role in resolves to 404 (no existence leak through URL guessing).
 */
export default async function ProgramLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { programId: string };
}) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const role = await getProgramRole(program.id);

  const owner =
    program.programKind === "client"
      ? program.accountName ?? "Client account"
      : program.programKind === "venture"
        ? `VentureOS · ${program.ventureSourceId}`
        : "Saipien Labs";

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <header className="flex flex-col gap-4 border-b border-border-subtle pb-5">
        <Link href="/app/governance" className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text-primary">
          <ChevronLeft className="h-3.5 w-3.5" /> All programs
        </Link>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">GovernanceOS · {owner}</span>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-[28px]">{program.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <ProgramKindBadge kind={program.programKind} />
            <ProgramStatusBadge status={program.status} />
            {role ? (
              <Badge tone="neutral" variant="outline">
                Your role: {LABELS.role[role]}
              </Badge>
            ) : null}
          </div>
        </div>
        <ProgramNav programId={program.id} />
      </header>
      {children}
    </div>
  );
}
