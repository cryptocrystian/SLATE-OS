import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "risk"
  | "critical"
  | "brand"
  | "ai"
  | "dev"
  | "studio";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  variant?: "soft" | "outline";
}

const toneStyles: Record<BadgeTone, { soft: string; outline: string; dot: string }> = {
  neutral: {
    soft: "bg-white/[0.04] text-text-secondary border-border-subtle",
    outline: "text-text-secondary border-border-strong",
    dot: "bg-status-neutral",
  },
  info: {
    soft: "bg-status-info/10 text-status-info border-status-info/20",
    outline: "text-status-info border-status-info/40",
    dot: "bg-status-info",
  },
  success: {
    soft: "bg-status-success/10 text-status-success border-status-success/20",
    outline: "text-status-success border-status-success/40",
    dot: "bg-status-success",
  },
  warning: {
    soft: "bg-status-warning/10 text-status-warning border-status-warning/20",
    outline: "text-status-warning border-status-warning/40",
    dot: "bg-status-warning",
  },
  risk: {
    soft: "bg-status-risk/10 text-status-risk border-status-risk/20",
    outline: "text-status-risk border-status-risk/40",
    dot: "bg-status-risk",
  },
  critical: {
    soft: "bg-status-critical/10 text-status-critical border-status-critical/25",
    outline: "text-status-critical border-status-critical/40",
    dot: "bg-status-critical",
  },
  brand: {
    soft: "bg-brand-primary/10 text-brand-primary border-brand-primary/25",
    outline: "text-brand-primary border-brand-primary/40",
    dot: "bg-brand-primary",
  },
  ai: {
    soft: "bg-practice-ai/10 text-practice-ai border-practice-ai/25",
    outline: "text-practice-ai border-practice-ai/40",
    dot: "bg-practice-ai",
  },
  dev: {
    soft: "bg-practice-dev/10 text-practice-dev border-practice-dev/25",
    outline: "text-practice-dev border-practice-dev/40",
    dot: "bg-practice-dev",
  },
  studio: {
    soft: "bg-practice-studio/10 text-practice-studio border-practice-studio/25",
    outline: "text-practice-studio border-practice-studio/40",
    dot: "bg-practice-studio",
  },
};

export function Badge({
  className,
  tone = "neutral",
  variant = "soft",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const styles = toneStyles[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none tracking-tight",
        variant === "soft" ? styles.soft : styles.outline,
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", styles.dot)}
        />
      ) : null}
      {children}
    </span>
  );
}
