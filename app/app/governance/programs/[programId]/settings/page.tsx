import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { ProgramSettingsForm } from "@/components/governance/program-settings-form";
import { ProgramStatusControls } from "@/components/governance/controls";
import { ProgramStatusBadge } from "@/components/governance/badges";
import { getProgramRole } from "@/lib/governance/authorization";
import { can } from "@/lib/governance/permissions";
import { getProgram } from "@/lib/governance/queries";

export const metadata: Metadata = { title: "Settings · GovernanceOS" };
export const dynamic = "force-dynamic";

export default async function ProgramSettingsPage({ params }: { params: { programId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const role = await getProgramRole(program.id);
  const archived = program.status === "archived";

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              Program status <ProgramStatusBadge status={program.status} />
            </h2>
            <p className="text-xs leading-relaxed text-text-muted">
              {archived
                ? "Archived programs are read-only. Nothing was deleted."
                : "Programs are never deleted — archive instead. Every status change records a reason."}
            </p>
          </div>
          {!archived && can(role, "program.transition") ? <ProgramStatusControls programId={program.id} status={program.status} /> : null}
        </CardBody>
      </Card>
      <ProgramSettingsForm program={program} readOnly={archived || !can(role, "program.edit")} />
    </div>
  );
}
