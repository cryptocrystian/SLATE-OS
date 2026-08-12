import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton — loading placeholder block. Uses `animate-pulse`, which is
 * disabled under `prefers-reduced-motion` by the global rule in
 * styles/globals.css. Purely decorative → aria-hidden.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-bg-elevated/60",
        className,
      )}
      {...props}
    />
  );
}
