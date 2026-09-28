import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatePolicyForm } from "@/components/governance/policy-forms";
import { getProgramRole } from "@/lib/governance/authorization";
import { can } from "@/lib/governance/permissions";
import { getProgram } from "@/lib/governance/queries";

export const metadata: Metadata = { title: "New policy · GovernanceOS" };
export const dynamic = "force-dynamic";

export default async function NewPolicyPage({ params }: { params: { programId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const role = await getProgramRole(program.id);
  if (!can(role, "policy.create") || program.status === "archived") notFound();
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <h2 className="text-lg font-semibold tracking-tight text-text-primary">New policy</h2>
      <CreatePolicyForm programId={program.id} />
    </div>
  );
}
