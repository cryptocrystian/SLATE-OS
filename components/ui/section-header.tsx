import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Eyebrow — the section-context label above a title.
 *
 * Phase 1 (docs/63) typography decision: SANS small-caps, never mono.
 * Mono is reserved for IDs, scores, and metadata. This replaces the
 * `font-mono uppercase tracking-[…] text-text-muted` "console" eyebrow
 * that saturated the app.
 */
export function Eyebrow({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted",
        className,
      )}
      {...props}
    />
  );
}

type SectionHeaderSize = "sm" | "md" | "lg";

const titleSize: Record<SectionHeaderSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  size?: SectionHeaderSize;
  /** Heading element for the title. Defaults to h3. */
  as?: "h2" | "h3" | "h4";
}

/**
 * SectionHeader — the standard in-page / in-card section heading.
 * Composes an optional sans Eyebrow, a sans-semibold title, optional
 * description, and an optional trailing actions cluster.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  size = "md",
  as: Heading = "h3",
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4", className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Heading
          className={cn(
            "font-semibold tracking-tight text-text-primary",
            titleSize[size],
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p className="max-w-prose text-xs leading-relaxed text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
