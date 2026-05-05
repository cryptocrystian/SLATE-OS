"use client";

import * as React from "react";
import { CheckCircle2, FileText, Upload, X } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  describeValidationError,
  isAllowedMimeType,
} from "@/lib/assets/limits";

export interface PublicIntakeUploadsProps {
  rawToken: string;
}

interface UploadedRow {
  id: string;
  title: string;
  sizeBytes: number;
  mimeType: string;
}

export function PublicIntakeUploads({ rawToken }: PublicIntakeUploadsProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploads, setUploads] = React.useState<UploadedRow[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    // Cheap pre-flight checks before opening a network call.
    if (file.size <= 0) {
      setError(describeValidationError("empty-file"));
      resetInput();
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(describeValidationError("file-too-large"));
      resetInput();
      return;
    }
    if (!isAllowedMimeType(file.type)) {
      setError(describeValidationError("unsupported-mime"));
      resetInput();
      return;
    }

    setPending(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(
        `/api/intake/${encodeURIComponent(rawToken)}/assets`,
        {
          method: "POST",
          body,
        },
      );
      const json = await safeJson(response);
      const ok = json && json.ok === true;
      if (!response.ok || !ok) {
        setError(
          (json && typeof json.message === "string" && json.message) ||
            "We couldn't accept the file. Please try again.",
        );
        return;
      }
      const asset =
        json && typeof json.asset === "object" && json.asset !== null
          ? (json.asset as Record<string, unknown>)
          : null;
      setUploads((prev) => [
        ...prev,
        {
          id: String(asset?.id ?? cryptoRandomId()),
          title: String(asset?.title ?? file.name),
          sizeBytes: Number(asset?.sizeBytes ?? file.size),
          mimeType: String(asset?.mimeType ?? file.type),
        },
      ]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
      resetInput();
    }
  }

  function resetInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Optional supporting documents
          </span>
          <p className="text-xs leading-relaxed text-text-muted">
            Upload supporting documents that help explain your workflows,
            handoffs, reporting, or system constraints. PDF, Word, Excel, CSV,
            TXT, PNG, or JPG. 10 MB per file.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border-subtle bg-bg-elevated/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_MIME_TYPES.join(",")}
              onChange={handleChange}
              disabled={pending}
              className="block text-[11px] text-text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border-subtle file:bg-bg-surface file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-text-primary hover:file:bg-bg-elevated"
            />
            <Badge tone="neutral" variant="outline">
              <Upload aria-hidden className="mr-1 h-3 w-3" />
              Optional
            </Badge>
          </div>
          {pending ? (
            <p className="text-[11px] text-text-muted">Uploading…</p>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
            {error}
          </p>
        ) : null}

        {uploads.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {uploads.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-text-secondary">
                    <FileText className="h-3 w-3" />
                  </span>
                  <span className="truncate text-[11px] text-text-secondary">
                    {u.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <span>{formatSize(u.sizeBytes)}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 text-status-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Upload complete
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <X aria-hidden className="h-3 w-3 text-text-disabled" />
            No documents uploaded yet — this section is optional.
          </div>
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

interface UploadResponseJson {
  ok?: boolean;
  message?: string;
  asset?: unknown;
}

async function safeJson(response: Response): Promise<UploadResponseJson | null> {
  try {
    const value = await response.json();
    return typeof value === "object" && value !== null
      ? (value as UploadResponseJson)
      : null;
  } catch {
    return null;
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
