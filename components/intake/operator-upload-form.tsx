"use client";

import * as React from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  describeValidationError,
  isAllowedMimeType,
} from "@/lib/assets/limits";

export interface OperatorUploadFormProps {
  engagementId: string;
}

export function OperatorUploadForm({ engagementId }: OperatorUploadFormProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file before uploading.");
      return;
    }
    if (file.size <= 0) {
      setError(describeValidationError("empty-file"));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(describeValidationError("file-too-large"));
      return;
    }
    if (!isAllowedMimeType(file.type)) {
      setError(describeValidationError("unsupported-mime"));
      return;
    }

    setPending(true);
    try {
      const body = new FormData();
      body.append("file", file);
      if (title.trim()) body.append("title", title.trim());
      if (summary.trim()) body.append("summary", summary.trim());
      const response = await fetch(
        `/api/app/engagements/${engagementId}/assets`,
        { method: "POST", body },
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
      setSuccess(`Uploaded ${file.name}. The supporting inputs panel updates on refresh.`);
      setTitle("");
      setSummary("");
      formRef.current?.reset();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Upload supporting input
          </span>
          <p className="text-xs leading-relaxed text-text-muted">
            Operator-authored documents — internal notes, exported reports,
            process maps. Stored privately; downloadable only by other
            authenticated operators via short-lived signed URLs.
          </p>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`asset-title-${engagementId}`}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted"
            >
              Title (optional)
            </label>
            <input
              id={`asset-title-${engagementId}`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="Defaults to the safe filename"
              className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs leading-relaxed text-text-primary placeholder:text-text-muted focus:border-brand-primary/60 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor={`asset-summary-${engagementId}`}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted"
            >
              Summary (optional)
            </label>
            <textarea
              id={`asset-summary-${engagementId}`}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={400}
              rows={2}
              placeholder="One-line description for the synthesis trail."
              className="w-full resize-y rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs leading-relaxed text-text-primary placeholder:text-text-muted focus:border-brand-primary/60 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor={`asset-file-${engagementId}`}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted"
            >
              File · 10 MB max
            </label>
            <input
              id={`asset-file-${engagementId}`}
              ref={fileRef}
              type="file"
              accept={ALLOWED_MIME_TYPES.join(",")}
              disabled={pending}
              className="block text-[11px] text-text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border-subtle file:bg-bg-surface file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-text-primary hover:file:bg-bg-elevated"
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
            <Badge tone="neutral" variant="outline">
              <Upload aria-hidden className="mr-1 h-3 w-3" />
              Operator only · private bucket
            </Badge>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={pending}
            >
              {pending ? "Uploading…" : "Upload document"}
            </Button>
          </div>

          {error ? (
            <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="flex items-center gap-2 rounded-md border border-status-success/40 bg-status-success/10 p-2 text-[11px] text-status-success">
              <CheckCircle2 aria-hidden className="h-3 w-3" />
              {success}
            </p>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}

interface UploadResponseJson {
  ok?: boolean;
  message?: string;
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
