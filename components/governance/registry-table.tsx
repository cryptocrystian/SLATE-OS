"use client";

import * as React from "react";
import Link from "next/link";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { cardInteractiveClass } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ASSET_TYPES,
  LABELS,
  LIFECYCLE_STATUSES,
  SOURCE_SYSTEMS,
  humanizeToken,
  type GovernedAsset,
} from "@/lib/governance/types";
import { CriticalityBadge, LifecycleBadge } from "./badges";

type LifecycleFilter = "live" | "all" | (typeof LIFECYCLE_STATUSES)[number];

export function RegistryTable({ programId, assets }: { programId: string; assets: GovernedAsset[] }) {
  const [lifecycle, setLifecycle] = React.useState<LifecycleFilter>("live");
  const [type, setType] = React.useState<string>("");
  const [source, setSource] = React.useState<string>("");
  const [critical, setCritical] = React.useState<string>("");

  const count = (f: LifecycleFilter) =>
    assets.filter((a) => (f === "all" ? true : f === "live" ? a.lifecycleStatus !== "retired" : a.lifecycleStatus === f)).length;

  const tabs = [
    { id: "live", label: "Live", count: count("live") },
    ...LIFECYCLE_STATUSES.map((s) => ({ id: s, label: LABELS.lifecycle[s], count: count(s) })),
    { id: "all", label: "All", count: assets.length },
  ];

  const rows = assets.filter((a) => {
    if (lifecycle === "live" && a.lifecycleStatus === "retired") return false;
    if (lifecycle !== "live" && lifecycle !== "all" && a.lifecycleStatus !== lifecycle) return false;
    if (type && a.assetType !== type) return false;
    if (source && (a.sourceSystem ?? "unsourced") !== source) return false;
    if (critical === "unclassified" && a.criticality) return false;
    if (critical && critical !== "unclassified" && a.criticality !== critical) return false;
    return true;
  });

  const byId = new Map(assets.map((a) => [a.id, a]));
  const selectCls =
    "h-8 rounded-md border border-border-subtle bg-bg-elevated/60 px-2 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30";

  return (
    <div className="flex flex-col gap-4">
      <FilterTabs tabs={tabs} activeId={lifecycle} onChange={(id) => setLifecycle(id as LifecycleFilter)} ariaLabel="Filter by lifecycle" />
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Asset type" value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
          <option value="">All types</option>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {LABELS.assetType[t]}
            </option>
          ))}
        </select>
        <select aria-label="Source system" value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
          <option value="">All sources</option>
          {SOURCE_SYSTEMS.map((s) => (
            <option key={s} value={s}>
              {LABELS.sourceSystem[s]}
            </option>
          ))}
          <option value="unsourced">No lineage</option>
        </select>
        <select aria-label="Criticality" value={critical} onChange={(e) => setCritical(e.target.value)} className={selectCls}>
          <option value="">Any criticality</option>
          {["critical", "high", "medium", "low"].map((c) => (
            <option key={c} value={c}>
              {humanizeToken(c)}
            </option>
          ))}
          <option value="unclassified">Unclassified</option>
        </select>
        <span className="ml-auto text-xs text-text-muted">
          {rows.length} of {assets.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-xs text-text-muted">
          No assets match these filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((a) => {
            const parent = a.parentGovernedAssetId ? byId.get(a.parentGovernedAssetId) : null;
            return (
              <li key={a.id}>
                <Link
                  href={`/app/governance/programs/${programId}/registry/${a.id}`}
                  className={cn(cardInteractiveClass, "flex flex-col gap-2 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between")}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{LABELS.assetType[a.assetType]}</span>
                      {parent ? <span className="text-[11px] text-text-muted">· part of {parent.name}</span> : null}
                    </span>
                    <span className="truncate text-sm font-semibold text-text-primary">{a.name}</span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
                      <span>{a.sourceSystem ? LABELS.sourceSystem[a.sourceSystem] : "No lineage"}</span>
                      {a.autonomyLevel ? <span>Autonomy: {humanizeToken(a.autonomyLevel)}</span> : null}
                      {a.dataSensitivity ? <span>Data: {humanizeToken(a.dataSensitivity)}</span> : null}
                      {a.deploymentEnvironment ? <span>{humanizeToken(a.deploymentEnvironment)}</span> : null}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <CriticalityBadge value={a.criticality} />
                    <LifecycleBadge status={a.lifecycleStatus} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
