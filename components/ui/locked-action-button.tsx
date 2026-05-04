import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LockedActionButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  /** Short label for the unlocking sprint, e.g. "Sprint 7". */
  lockedNote?: string;
  size?: "sm" | "md" | "lg";
  /** Use the wider primary footprint instead of the compact pill. */
  variant?: "compact" | "primary";
}

const sizes: Record<NonNullable<LockedActionButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-xs",
  lg: "h-10 px-5 text-xs",
};

export const LockedActionButton = React.forwardRef<
  HTMLButtonElement,
  LockedActionButtonProps
>(function LockedActionButton(
  {
    label,
    lockedNote,
    className,
    size = "md",
    variant = "primary",
    type = "button",
    ...props
  },
  ref,
) {
  const accessibleName = lockedNote
    ? `${label}, locked until ${lockedNote}`
    : `${label}, locked`;

  return (
    <button
      ref={ref}
      type={type}
      disabled
      aria-disabled
      aria-label={accessibleName}
      title={accessibleName}
      className={cn(
        "inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-border-subtle bg-bg-elevated/60 font-medium text-text-secondary opacity-80",
        sizes[size],
        variant === "compact" && "px-3 py-1.5 text-[11px]",
        className,
      )}
      {...props}
    >
      <Lock aria-hidden className="h-3 w-3 text-text-muted" />
      <span>{label}</span>
      {lockedNote ? (
        <span
          aria-hidden
          className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted"
        >
          {lockedNote}
        </span>
      ) : null}
    </button>
  );
});
