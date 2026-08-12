"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary scoped to a single engagement workspace (Phase 1 / W4).
 * Isolates a failing engagement (or one of its sub-routes) so the app
 * shell and navigation stay intact instead of the whole /app tree erroring.
 */
export default function EngagementError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-status-critical/40 bg-status-critical/10 text-status-critical">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-text-primary">
          This engagement failed to load
        </h2>
        <p className="max-w-sm text-xs leading-relaxed text-text-muted">
          Something went wrong loading this workspace. You can retry, or return
          to the engagement list.
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
        <Link href="/app/engagements">
          <Button variant="ghost" size="sm">
            Back to engagements
          </Button>
        </Link>
      </div>
    </div>
  );
}
