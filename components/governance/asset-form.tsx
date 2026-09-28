"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { registerAssetAction, updateAssetAction } from "@/lib/governance/actions";
import {
  ASSET_TYPES,
  AUTONOMY_LEVELS,
  CRITICALITIES,
  DATA_SENSITIVITIES,
  DEPLOYMENT_ENVIRONMENTS,
  LABELS,
  OVERSIGHT_MODES,
  SOURCE_SYSTEMS,
  humanizeToken,
  type GovernedAsset,
} from "@/lib/governance/types";
import { FieldGroup, FormError, SelectField, TextAreaField, describeServiceError } from "./fields";

const opts = <T extends string>(list: readonly T[], label: (v: T) => string = humanizeToken) =>
  list.map((v) => ({ value: v, label: label(v) }));

export function AssetForm({
  programId,
  asset,
  parents,
}: {
  programId: string;
  /** When present, the form edits this asset (type + lineage are fixed). */
  asset?: GovernedAsset;
  parents: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const editing = Boolean(asset);
  const [f, setF] = React.useState({
    assetType: asset?.assetType ?? "ai_system",
    name: asset?.name ?? "",
    description: asset?.description ?? "",
    criticality: asset?.criticality ?? "",
    dataSensitivity: asset?.dataSensitivity ?? "",
    autonomyLevel: asset?.autonomyLevel ?? "",
    humanOversightMode: asset?.humanOversightMode ?? "",
    deploymentEnvironment: asset?.deploymentEnvironment ?? "",
    externalVendor: asset?.externalVendor ?? "",
    modelProvider: asset?.modelProvider ?? "",
    modelIdentifier: asset?.modelIdentifier ?? "",
    intendedUse: asset?.intendedUse ?? "",
    prohibitedUses: (asset?.prohibitedUses ?? []).join("\n"),
    businessOwnerName: asset?.businessOwnerName ?? "",
    technicalOwnerName: asset?.technicalOwnerName ?? "",
    sourceSystem: asset?.sourceSystem ?? "",
    sourceEntityType: asset?.sourceEntityType ?? "",
    sourceEntityId: asset?.sourceEntityId ?? "",
    correlationId: asset?.correlationId ?? "",
    externalRuntimeId: asset?.externalRuntimeId ?? "",
    parentGovernedAssetId: asset?.parentGovernedAssetId ?? "",
  });
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const payload = {
      ...f,
      prohibitedUses: f.prohibitedUses.split("\n").map((s) => s.trim()).filter(Boolean),
      source: f.sourceSystem
        ? {
            sourceSystem: f.sourceSystem,
            sourceEntityType: f.sourceEntityType,
            sourceEntityId: f.sourceEntityId,
            correlationId: f.correlationId,
          }
        : null,
    };
    try {
      const r = editing && asset
        ? await updateAssetAction(programId, asset.id, payload)
        : await registerAssetAction(programId, payload);
      if (r.ok) {
        const id = "assetId" in r ? (r.assetId as string) : asset?.id;
        const existed = "created" in r && r.created === false;
        toast({
          title: editing ? "Asset updated" : existed ? "Already registered" : "Asset registered",
          description: existed ? "An asset with this source lineage already exists in the program." : undefined,
          variant: existed ? "info" : "success",
        });
        router.push(`/app/governance/programs/${programId}/registry/${id}`);
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
      <FieldGroup title="Identity" description="What is being governed.">
        {editing ? (
          <Input label="Asset type" value={LABELS.assetType[f.assetType]} disabled hint="Fixed at registration." />
        ) : (
          <SelectField label="Asset type" value={f.assetType} onChange={(v) => v && set("assetType")(v)} options={opts(ASSET_TYPES, (v) => LABELS.assetType[v])} required />
        )}
        <Input label="Name" value={f.name} onChange={(e) => set("name")(e.target.value)} required maxLength={200} />
        <SelectField
          label="Part of (parent asset)"
          value={f.parentGovernedAssetId}
          onChange={set("parentGovernedAssetId")}
          options={parents.filter((p) => p.id !== asset?.id).map((p) => ({ value: p.id, label: p.name }))}
          placeholder="— None —"
          hint="Compose e.g. system → agent → model."
        />
        <Input label="External runtime id" value={f.externalRuntimeId} onChange={(e) => set("externalRuntimeId")(e.target.value)} maxLength={200} />
        <div className="md:col-span-2">
          <TextAreaField label="Description" value={f.description} onChange={set("description")} rows={3} />
        </div>
      </FieldGroup>

      <FieldGroup title="Governance dimensions" description="These drive posture. Unset dimensions are flagged as unclassified — never assumed low.">
        <SelectField label="Criticality" value={f.criticality} onChange={set("criticality")} options={opts(CRITICALITIES)} placeholder="Unclassified" />
        <SelectField label="Data sensitivity" value={f.dataSensitivity} onChange={set("dataSensitivity")} options={opts(DATA_SENSITIVITIES)} placeholder="Unclassified" />
        <SelectField label="Autonomy level" value={f.autonomyLevel} onChange={set("autonomyLevel")} options={opts(AUTONOMY_LEVELS)} placeholder="Not set" />
        <SelectField label="Human oversight" value={f.humanOversightMode} onChange={set("humanOversightMode")} options={opts(OVERSIGHT_MODES)} placeholder="Not set" />
        <SelectField label="Deployment environment" value={f.deploymentEnvironment} onChange={set("deploymentEnvironment")} options={opts(DEPLOYMENT_ENVIRONMENTS)} placeholder="Not set" />
        <Input label="External vendor" value={f.externalVendor} onChange={(e) => set("externalVendor")(e.target.value)} maxLength={200} />
        <Input label="Model provider" value={f.modelProvider} onChange={(e) => set("modelProvider")(e.target.value)} maxLength={200} placeholder="e.g. OpenAI" />
        <Input label="Model identifier" value={f.modelIdentifier} onChange={(e) => set("modelIdentifier")(e.target.value)} maxLength={200} placeholder="e.g. gpt-4o-mini" />
        <div className="md:col-span-2">
          <TextAreaField label="Intended use" value={f.intendedUse} onChange={set("intendedUse")} rows={3} />
        </div>
        <div className="md:col-span-2">
          <TextAreaField label="Prohibited uses (one per line)" value={f.prohibitedUses} onChange={set("prohibitedUses")} rows={3} />
        </div>
      </FieldGroup>

      <FieldGroup title="Ownership" description="Accountable people (names are stored as snapshots).">
        <Input label="Business owner" value={f.businessOwnerName} onChange={(e) => set("businessOwnerName")(e.target.value)} maxLength={160} />
        <Input label="Technical owner" value={f.technicalOwnerName} onChange={(e) => set("technicalOwnerName")(e.target.value)} maxLength={160} />
      </FieldGroup>

      <FieldGroup
        title="Source lineage"
        description="Where this asset originates in SLATE or outside it. Lineage is a reference, never an access grant. Registration is idempotent on the full source key."
      >
        {editing ? (
          <p className="text-xs text-text-muted md:col-span-2">
            {asset?.sourceSystem
              ? `${LABELS.sourceSystem[asset.sourceSystem]} · ${asset.sourceEntityType} · ${asset.sourceEntityId}`
              : "No source lineage."}{" "}
            Lineage is fixed after registration.
          </p>
        ) : (
          <>
            <SelectField label="Source system" value={f.sourceSystem} onChange={set("sourceSystem")} options={opts(SOURCE_SYSTEMS, (v) => LABELS.sourceSystem[v])} placeholder="— None —" />
            <Input label="Source entity type" value={f.sourceEntityType} onChange={(e) => set("sourceEntityType")(e.target.value)} placeholder="e.g. engagement, agent, slate_module" disabled={!f.sourceSystem} maxLength={80} />
            <Input label="Source entity id" value={f.sourceEntityId} onChange={(e) => set("sourceEntityId")(e.target.value)} disabled={!f.sourceSystem} maxLength={200} />
            <Input label="Correlation id" value={f.correlationId} onChange={(e) => set("correlationId")(e.target.value)} disabled={!f.sourceSystem} maxLength={200} />
          </>
        )}
      </FieldGroup>

      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !f.name.trim()}>
          {pending ? "Saving…" : editing ? "Save changes" : "Register asset"}
        </Button>
      </div>
    </form>
  );
}
