import * as React from "react";
import Link from "next/link";
import { Download, FileText, Lock } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { OperatorAsset } from "@/lib/assets/types";

const STATUS_TONE: Record<string, BadgeTone> = {
  requested: "info",
  received: "info",
  reviewed: "success",
  missing: "risk",
  outdated: "warning",
};

const QUALITY_TONE: Record<string, BadgeTone> = {
  strong: "success",
  adequate: "info",
  thin: "warning",
  unverified: "neutral",
};

export interface PersistedSupportingInputsProps {
  assets: OperatorAsset[];
}

export function PersistedSupportingInputs({
  assets,
}: PersistedSupportingInputsProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Supporting inputs · live
          </span>
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            Documents and evidence
          </h2>
        </div>

        {assets.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="No supporting inputs yet"
            description="Stakeholder uploads land here automatically. Operators can also upload internal documents using the form above."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {asset.title}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={STATUS_TONE[asset.status] ?? "neutral"}
                      dot
                    >
                      {asset.status}
                    </Badge>
                    <Badge
                      tone={QUALITY_TONE[asset.evidenceQuality] ?? "neutral"}
                      variant="outline"
                    >
                      {asset.evidenceQuality} evidence
                    </Badge>
                    {asset.source ? (
                      <Badge tone="neutral" variant="outline">
                        {asset.source === "operator" ? "Operator" : "Stakeholder"}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                  {asset.sizeBytes !== null ? (
                    <span>{formatSize(asset.sizeBytes)}</span>
                  ) : null}
                  {asset.mimeType ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{asset.mimeType}</span>
                    </>
                  ) : null}
                  {asset.sourceLabel ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="text-text-secondary">
                        {asset.sourceLabel}
                      </span>
                    </>
                  ) : null}
                  {asset.uploadedAt ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{formatTimestamp(asset.uploadedAt)}</span>
                    </>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-2">
                  {asset.hasBinary ? (
                    <Link
                      href={`/api/app/assets/${asset.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-surface px-3 py-1.5 text-[11px] font-medium text-text-primary hover:bg-bg-elevated"
                    >
                      <Download className="h-3 w-3" />
                      Download · 5-min link
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
                      <Lock className="h-3 w-3" />
                      Metadata only · no file uploaded
                    </span>
                  )}
                  <span className="text-[11px] text-text-muted">
                    {asset.downloadCount} download
                    {asset.downloadCount === 1 ? "" : "s"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
