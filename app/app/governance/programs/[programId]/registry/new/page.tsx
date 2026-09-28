import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetForm } from "@/components/governance/asset-form";
import { getProgramRole } from "@/lib/governance/authorization";
import { can } from "@/lib/governance/permissions";
import { getProgram, listAssets } from "@/lib/governance/queries";

export const metadata: Metadata = { title: "Register asset · GovernanceOS" };
export const dynamic = "force-dynamic";

export default async function RegisterAssetPage({ params }: { params: { programId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const [assets, role] = await Promise.all([listAssets(program.id), getProgramRole(program.id)]);
  if (!can(role, "asset.register") || program.status === "archived") notFound();
  const parents = assets.filter((a) => a.lifecycleStatus !== "retired").map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">Register a governed asset</h2>
        <p className="text-xs leading-relaxed text-text-muted">
          New assets start as <em>proposed</em>. Nothing is governance-approved until a human decision exists.
        </p>
      </div>
      <AssetForm programId={program.id} parents={parents} />
    </div>
  );
}
