import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetForm } from "@/components/governance/asset-form";
import { getProgramRole } from "@/lib/governance/authorization";
import { can } from "@/lib/governance/permissions";
import { getAsset, getProgram, listAssets } from "@/lib/governance/queries";

export const metadata: Metadata = { title: "Edit asset · GovernanceOS" };
export const dynamic = "force-dynamic";

export default async function EditAssetPage({ params }: { params: { programId: string; assetId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const [asset, assets, role] = await Promise.all([
    getAsset(program.id, params.assetId),
    listAssets(program.id),
    getProgramRole(program.id),
  ]);
  if (!asset || !can(role, "asset.edit") || asset.lifecycleStatus === "retired" || program.status === "archived") notFound();

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <h2 className="text-lg font-semibold tracking-tight text-text-primary">Edit {asset.name}</h2>
      <AssetForm
        programId={program.id}
        asset={asset}
        parents={assets.filter((a) => a.lifecycleStatus !== "retired").map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
