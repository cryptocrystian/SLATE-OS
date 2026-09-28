"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createPolicyAction, saveDraftVersionAction } from "@/lib/governance/actions";
import { LABELS, POLICY_DOMAINS, type PolicyDomain } from "@/lib/governance/types";
import { FieldGroup, FormError, SelectField, TextAreaField, describeServiceError } from "./fields";

const MODE_NOTE =
  "Activation mode: Advisory. Gated policies arrive with decision records (G3); enforced policies only with a real enforcement adapter (G4+). GovernanceOS never claims enforcement it does not have.";

export function CreatePolicyForm({ programId }: { programId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [policyKey, setPolicyKey] = React.useState("");
  const [domain, setDomain] = React.useState<PolicyDomain | "">("");
  const [statement, setStatement] = React.useState("");
  const [rationale, setRationale] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await createPolicyAction(programId, {
        name,
        policyKey: policyKey || undefined,
        policyDomain: domain,
        statement,
        rationale,
        activationMode: "advisory",
      });
      if (r.ok) {
        toast({ title: "Policy created as draft v1", variant: "success" });
        router.push(`/app/governance/programs/${programId}/policies/${r.policyId}`);
      } else {
        setError(describeServiceError(r.error, r.detail));
      }
    } catch {
      setError(describeServiceError("service-error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FieldGroup title="Policy" description="Identity is stable; content lives in immutable versions.">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        <SelectField
          label="Domain"
          value={domain}
          onChange={setDomain}
          options={POLICY_DOMAINS.map((d) => ({ value: d, label: LABELS.policyDomain[d] }))}
          placeholder="Select…"
          required
        />
        <Input
          label="Policy key"
          value={policyKey}
          onChange={(e) => setPolicyKey(e.target.value.toLowerCase())}
          maxLength={80}
          placeholder="auto from name"
          hint="Stable machine identifier (lowercase, digits, - _ .). Used by systems that consult this policy."
        />
      </FieldGroup>
      <FieldGroup title="Version 1 (draft)" description={MODE_NOTE}>
        <div className="md:col-span-2">
          <TextAreaField label="Policy statement" value={statement} onChange={setStatement} rows={5} required maxLength={8000} />
        </div>
        <div className="md:col-span-2">
          <TextAreaField label="Rationale" value={rationale} onChange={setRationale} rows={3} />
        </div>
      </FieldGroup>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !name.trim() || !domain || !statement.trim()}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}

export function DraftVersionEditor({
  programId,
  policyId,
  initial,
  nextVersion,
  isExistingDraft,
}: {
  programId: string;
  policyId: string;
  initial: { statement: string; rationale: string };
  nextVersion: number;
  isExistingDraft: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [statement, setStatement] = React.useState(initial.statement);
  const [rationale, setRationale] = React.useState(initial.rationale);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await saveDraftVersionAction(programId, policyId, { statement, rationale, activationMode: "advisory" });
      if (r.ok) {
        toast({ title: `Draft v${nextVersion} saved`, variant: "success" });
        router.refresh();
      } else {
        setError(describeServiceError(r.error, r.detail));
      }
    } catch {
      setError(describeServiceError("service-error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <TextAreaField label={`Statement — v${nextVersion} ${isExistingDraft ? "(draft)" : "(new draft)"}`} value={statement} onChange={setStatement} rows={6} required maxLength={8000} />
      <TextAreaField label="Rationale" value={rationale} onChange={setRationale} rows={3} />
      <p className="text-[11px] leading-relaxed text-text-muted">{MODE_NOTE}</p>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" size="sm" disabled={pending || !statement.trim()}>
          {pending ? "Saving…" : isExistingDraft ? "Save draft" : `Start draft v${nextVersion}`}
        </Button>
      </div>
    </form>
  );
}
