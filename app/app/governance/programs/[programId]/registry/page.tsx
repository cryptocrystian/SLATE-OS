import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RegistryTable } from "@/components/governance/registry-table";
import { getProgramRole } from "@/lib/governance/authorization";
import { can } from "@/lib/governance/permissions";
import { getProgram, listAssets } from "@/lib/governance/queries";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Registry · GovernanceOS" };
export const dynamic = "force-dynamic";

export default async function RegistryPage({ params }: { params: { programId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const [assets, role] = await Promise.all([listAssets(program.id), getProgramRole(program.id)]);
  const canRegister = can(role, "asset.register") && program.status !== "archived";
  const newHref = `/app/governance/programs/${program.id}/registry/new`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">Governed asset registry</h2>
          <p className="max-w-2xl text-xs leading-relaxed text-text-muted">
            Use cases, AI systems, models, agents, workflows and vendor services — from any SLATE module or outside it.
          </p>
        </div>
        {canRegister ? (
          <Link href={newHref}>
            <Button variant="primary" size="sm" leadingIcon={<Plus className="h-3.5 w-3.5" />}>
              Register asset
            </Button>
          </Link>
        ) : null}
      </div>
      {assets.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-4 w-4" />}
          title="Nothing registered yet"
          description="Register the AI systems, agents and models this program governs."
          action={
            canRegister ? (
              <Link href={newHref}>
                <Button variant="secondary" size="sm">
                  Register the first asset
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <RegistryTable programId={program.id} assets={assets} />
      )}
    </div>
  );
}
