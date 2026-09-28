"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateProgramAction } from "@/lib/governance/actions";
import { REVIEW_CADENCES, type GovernanceProgram, type ReviewCadence } from "@/lib/governance/types";
import { FieldGroup, FormError, SelectField, TextAreaField, describeServiceError } from "./fields";

export function ProgramSettingsForm({ program, readOnly }: { program: GovernanceProgram; readOnly: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState(program.name);
  const [description, setDescription] = React.useState(program.description ?? "");
  const [sponsor, setSponsor] = React.useState(program.executiveSponsorName ?? "");
  const [operatingModel, setOperatingModel] = React.useState(program.operatingModel ?? "");
  const [cadence, setCadence] = React.useState<ReviewCadence | "">(program.defaultReviewCadence ?? "");
  const [nextReview, setNextReview] = React.useState(program.nextProgramReviewAt ? program.nextProgramReviewAt.slice(0, 10) : "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await updateProgramAction(program.id, {
        name,
        description,
        executiveSponsorName: sponsor,
        operatingModel,
        defaultReviewCadence: cadence || null,
        nextProgramReviewAt: nextReview || null,
      });
      if (r.ok) {
        toast({ title: "Program updated", variant: "success" });
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
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <fieldset disabled={readOnly || pending} className="flex flex-col gap-5">
        <FieldGroup title="Program details">
          <Input label="Program name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} />
          <Input label="Executive sponsor" value={sponsor} onChange={(e) => setSponsor(e.target.value)} maxLength={160} />
          <div className="md:col-span-2">
            <TextAreaField label="Description" value={description} onChange={setDescription} rows={3} />
          </div>
          <div className="md:col-span-2">
            <TextAreaField label="Operating model" value={operatingModel} onChange={setOperatingModel} rows={3} placeholder="Who runs the program, how often, and how decisions are made." maxLength={2000} />
          </div>
        </FieldGroup>
        <FieldGroup title="Review cadence">
          <SelectField
            label="Default review cadence"
            value={cadence}
            onChange={setCadence}
            options={REVIEW_CADENCES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
            placeholder="Not set"
          />
          <Input label="Next program review" type="date" value={nextReview} onChange={(e) => setNextReview(e.target.value)} />
        </FieldGroup>
      </fieldset>
      <FormError message={error} />
      {readOnly ? null : (
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
