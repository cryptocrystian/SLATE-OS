"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createProgramAction } from "@/lib/governance/actions";
import { REVIEW_CADENCES, type ProgramKind, type ReviewCadence } from "@/lib/governance/types";
import { FieldGroup, FormError, SelectField, TextAreaField, describeServiceError } from "./fields";

const KIND_COPY: Record<ProgramKind, { title: string; body: string }> = {
  client: {
    title: "Client",
    body: "Governs a client's AI portfolio. Owned by a CRM account; outlives any single engagement.",
  },
  internal: {
    title: "Internal",
    body: "Governs Saipien's own AI systems, agents and tooling. No CRM account.",
  },
  venture: {
    title: "Venture",
    body: "Governs a VentureOS concept or venture before and during build. Linked by venture id.",
  },
};

export function CreateProgramForm({
  accounts,
  defaultKind = "client",
}: {
  accounts: Array<{ id: string; name: string }>;
  defaultKind?: ProgramKind;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [kind, setKind] = React.useState<ProgramKind>(defaultKind);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [ventureSourceId, setVentureSourceId] = React.useState("");
  const [sponsor, setSponsor] = React.useState("");
  const [cadence, setCadence] = React.useState<ReviewCadence | "">("quarterly");
  const [nextReview, setNextReview] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await createProgramAction({
        programKind: kind,
        name,
        description,
        accountId: kind === "client" ? accountId : null,
        ventureSourceId: kind === "venture" ? ventureSourceId : null,
        executiveSponsorName: sponsor,
        defaultReviewCadence: cadence || null,
        nextProgramReviewAt: nextReview || null,
      });
      if (r.ok) {
        toast({ title: "Governance program created", description: "It starts as a draft — activate it from Settings.", variant: "success" });
        router.push(`/app/governance/programs/${r.programId}`);
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
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-medium tracking-tight text-text-secondary">Program kind</legend>
        <div role="radiogroup" className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(Object.keys(KIND_COPY) as ProgramKind[]).map((k) => (
            <label
              key={k}
              className={
                "flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors " +
                (kind === k
                  ? "border-brand-primary/60 bg-brand-primary/[0.06]"
                  : "border-border-subtle bg-bg-surface hover:border-border-strong")
              }
            >
              <span className="flex items-center gap-2">
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="accent-[color:var(--color-brand-primary)]" />
                <span className="text-sm font-semibold text-text-primary">{KIND_COPY[k].title}</span>
              </span>
              <span className="text-xs leading-relaxed text-text-muted">{KIND_COPY[k].body}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <FieldGroup title="Program" description="What this program governs and who is accountable.">
        <Input label="Program name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} placeholder={kind === "internal" ? "Saipien Labs — Internal AI Governance" : "Acme — AI Governance Program"} />
        {kind === "client" ? (
          <SelectField
            label="Client account"
            value={accountId}
            onChange={(v) => setAccountId(v)}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder={accounts.length ? "Select an account…" : "No accounts yet"}
            required
            hint="Accounts come from ConsultOS. The program is owned by the account, not by an engagement."
          />
        ) : kind === "venture" ? (
          <Input
            label="VentureOS venture id"
            value={ventureSourceId}
            onChange={(e) => setVentureSourceId(e.target.value)}
            required
            maxLength={200}
            hint="Lineage reference only (VentureOS records are not yet in SLATE)."
          />
        ) : (
          <div className="flex flex-col justify-end rounded-md border border-dashed border-border-subtle p-3 text-[11px] leading-relaxed text-text-muted">
            Internal programs are owned by the Saipien workspace — no CRM account is created or required.
          </div>
        )}
        <Input label="Executive sponsor" value={sponsor} onChange={(e) => setSponsor(e.target.value)} maxLength={160} hint="Name as the accountable executive (stored as a snapshot)." />
        <div className="md:col-span-2">
          <TextAreaField label="Description" value={description} onChange={setDescription} rows={3} placeholder="Scope, objectives, and what 'governed' means for this program." />
        </div>
      </FieldGroup>

      <FieldGroup title="Operating cadence" description="Governance is a recurring loop — schedule the first program review.">
        <SelectField
          label="Default review cadence"
          value={cadence}
          onChange={setCadence}
          options={REVIEW_CADENCES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
          placeholder="Not set"
        />
        <Input label="Next program review" type="date" value={nextReview} onChange={(e) => setNextReview(e.target.value)} />
      </FieldGroup>

      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !name.trim() || (kind === "client" && !accountId) || (kind === "venture" && !ventureSourceId.trim())}>
          {pending ? "Creating…" : "Create program"}
        </Button>
      </div>
    </form>
  );
}
