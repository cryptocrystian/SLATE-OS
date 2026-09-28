import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleDashed, Pencil } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CriticalityBadge, LifecycleBadge } from "@/components/governance/badges";
import { AssetLifecycleControls } from "@/components/governance/controls";
import { getProgramRole } from "@/lib/governance/authorization";
import { can } from "@/lib/governance/permissions";
import { computeAssetPosture } from "@/lib/governance/posture";
import { getAsset, getProgram, listAssetLifecycle, listAssets, listPolicies } from "@/lib/governance/queries";
import { LABELS, humanizeToken } from "@/lib/governance/types";

export const metadata: Metadata = { title: "Asset · GovernanceOS" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-xs text-text-primary sm:text-right">{value ?? "—"}</dd>
    </div>
  );
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function AssetDetailPage({ params }: { params: { programId: string; assetId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const asset = await getAsset(program.id, params.assetId);
  if (!asset) notFound();
  const [history, role, policies, all] = await Promise.all([
    listAssetLifecycle(asset.id),
    getProgramRole(program.id),
    listPolicies(program.id),
    listAssets(program.id),
  ]);
  const posture = computeAssetPosture(asset, policies);
  const root = `/app/governance/programs/${program.id}`;
  const parent = asset.parentGovernedAssetId ? all.find((a) => a.id === asset.parentGovernedAssetId) : null;
  const children = all.filter((a) => a.parentGovernedAssetId === asset.id);
  const writable = program.status !== "archived" && asset.lifecycleStatus !== "retired";

  return (
    <div className="flex flex-col gap-6">
      <Link href={`${root}/registry`} className="inline-flex w-fit items-center gap-1 text-xs text-text-muted hover:text-text-primary">
        <ChevronLeft className="h-3.5 w-3.5" /> Registry
      </Link>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{LABELS.assetType[asset.assetType]}</span>
          <h2 className="text-xl font-semibold tracking-tight text-text-primary">{asset.name}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <LifecycleBadge status={asset.lifecycleStatus} />
            <CriticalityBadge value={asset.criticality} />
          </div>
          {asset.description ? <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">{asset.description}</p> : null}
        </div>
        {writable ? (
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <AssetLifecycleControls
              programId={program.id}
              assetId={asset.id}
              status={asset.lifecycleStatus}
              canTransition={can(role, "asset.transition")}
              canRetire={can(role, "asset.retire")}
            />
            {can(role, "asset.edit") ? (
              <Link href={`${root}/registry/${asset.id}/edit`}>
                <Button variant="ghost" size="sm" leadingIcon={<Pencil className="h-3.5 w-3.5" />}>
                  Edit details
                </Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody className="flex flex-col gap-5">
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text-primary">Governance dimensions</h3>
              <dl className="flex flex-col gap-2">
                <Row label="Data sensitivity" value={humanizeToken(asset.dataSensitivity)} />
                <Row label="Autonomy level" value={humanizeToken(asset.autonomyLevel)} />
                <Row label="Human oversight" value={humanizeToken(asset.humanOversightMode)} />
                <Row label="Deployment environment" value={humanizeToken(asset.deploymentEnvironment)} />
                <Row label="Model" value={[asset.modelProvider, asset.modelIdentifier].filter(Boolean).join(" · ") || "—"} />
                <Row label="External vendor" value={asset.externalVendor} />
                <Row label="Business owner" value={asset.businessOwnerName} />
                <Row label="Technical owner" value={asset.technicalOwnerName} />
              </dl>
            </section>
            {asset.intendedUse ? (
              <section className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-text-primary">Intended use</h3>
                <p className="text-xs leading-relaxed text-text-secondary">{asset.intendedUse}</p>
              </section>
            ) : null}
            {asset.prohibitedUses.length > 0 ? (
              <section className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-text-primary">Prohibited uses</h3>
                <ul className="list-disc pl-5 text-xs leading-relaxed text-text-secondary">
                  {asset.prohibitedUses.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text-primary">Source lineage</h3>
              <dl className="flex flex-col gap-2">
                <Row label="System" value={asset.sourceSystem ? LABELS.sourceSystem[asset.sourceSystem] : "None"} />
                <Row label="Entity type" value={asset.sourceEntityType} />
                <Row label="Entity id" value={asset.sourceEntityId ? <code className="font-mono text-[11px]">{asset.sourceEntityId}</code> : "—"} />
                <Row label="Correlation id" value={asset.correlationId} />
                <Row label="Runtime id" value={asset.externalRuntimeId} />
              </dl>
              <p className="text-[11px] leading-relaxed text-text-muted">Lineage is a reference only — it never grants access.</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text-primary">Governance relationships</h3>
              <dl className="flex flex-col gap-2">
                <Row label="Part of" value={parent ? <Link className="underline decoration-dotted" href={`${root}/registry/${parent.id}`}>{parent.name}</Link> : "—"} />
                <Row label="Components" value={children.length ? children.map((c) => c.name).join(", ") : "—"} />
                <Row label="Advisory policies in force" value={String(posture.applicableAdvisoryPolicies)} />
                <Row label="Governance approval" value="None yet (G3)" />
              </dl>
              <ul className="flex flex-col gap-1 pt-1">
                {["Risks", "Controls", "Evidence", "Exceptions & incidents"].map((l) => (
                  <li key={l} className="flex items-center justify-between text-xs text-text-disabled">
                    <span className="flex items-center gap-1.5">
                      <CircleDashed className="h-3 w-3" aria-hidden />
                      {l}
                    </span>
                    <span>Not yet assessed</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      <section aria-label="Lifecycle history" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text-primary">Lifecycle history</h3>
        <ol className="flex flex-col gap-2">
          {history.map((h) => (
            <li key={h.id} className="rounded-xl border border-border-subtle bg-bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-text-primary">
                  {h.fromStatus ? `${LABELS.lifecycle[h.fromStatus]} → ` : "Registered as "}
                  <strong>{LABELS.lifecycle[h.toStatus]}</strong>
                </span>
                <span className="text-[11px] text-text-muted">
                  {h.changedByName ?? "Operator"} · {fmt(h.changedAt)}
                </span>
              </div>
              {h.reason ? <p className="pt-1 text-xs leading-relaxed text-text-secondary">{h.reason}</p> : null}
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-text-muted">Recorded by the database on every lifecycle change; append-only.</p>
      </section>
    </div>
  );
}
