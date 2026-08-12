"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary for the operator app shell (Phase 1 / W4).
 * Catches render/data errors in the /app tree and offers a retry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surface for observability; the UI stays calm and generic.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-status-critical/40 bg-status-critical/10 text-status-critical">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-text-primary">
          Something went wrong
        </h2>
        <p className="max-w-sm text-xs leading-relaxed text-text-muted">
          This view failed to load. You can retry, or head back to the command
          center.
        </p>
        {error.digest ? (
          <p className="pt-1 font-mono text-[10px] text-text-disabled">
            Ref: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={reset}
          leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Retry
        </Button>
        <Link href="/app">
          <Button variant="ghost" size="sm">
            Back to command center
          </Button>
        </Link>
      </div>
    </div>
  );
}
