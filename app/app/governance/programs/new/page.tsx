import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CreateProgramForm } from "@/components/governance/create-program-form";
import { listAccountsForPicker } from "@/lib/governance/queries";
import { PROGRAM_KINDS, type ProgramKind } from "@/lib/governance/types";

export const metadata: Metadata = { title: "New governance program" };
export const dynamic = "force-dynamic";

export default async function NewProgramPage({ searchParams }: { searchParams: { kind?: string } }) {
  const accounts = await listAccountsForPicker();
  const kind = (PROGRAM_KINDS as readonly string[]).includes(searchParams.kind ?? "")
    ? (searchParams.kind as ProgramKind)
    : "client";
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="GovernanceOS · New program"
        title="Create a governance program."
        description="A program is the durable home for an organization's AI governance: its registry, policies, and — soon — risks, controls, evidence and decisions. Engagements link to it; they never own it."
      />
      <div className="max-w-4xl">
        <CreateProgramForm accounts={accounts} defaultKind={kind} />
      </div>
    </div>
  );
}
