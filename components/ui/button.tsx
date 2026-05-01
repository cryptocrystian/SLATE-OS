import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium tracking-tight transition-[background,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-primary text-text-inverse font-semibold ring-1 ring-inset ring-white/15 hover:bg-[color:color-mix(in_oklab,var(--color-brand-primary)_92%,white)] active:translate-y-px shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_1px_2px_rgba(0,0,0,0.4),0_10px_28px_-10px_rgba(108,140,255,0.55)] hover:shadow-[0_1px_0_rgba(255,255,255,0.28)_inset,0_2px_4px_rgba(0,0,0,0.45),0_14px_32px_-10px_rgba(108,140,255,0.7)]",
  secondary:
    "bg-bg-elevated text-text-primary border border-border-strong hover:bg-bg-panel hover:border-border-strong",
  outline:
    "bg-transparent text-text-primary border border-border-strong hover:bg-bg-elevated/60",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated/60",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      leadingIcon,
      trailingIcon,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {leadingIcon ? (
          <span className="-ml-0.5 inline-flex h-4 w-4 items-center justify-center">
            {leadingIcon}
          </span>
        ) : null}
        {children}
        {trailingIcon ? (
          <span className="-mr-0.5 inline-flex h-4 w-4 items-center justify-center">
            {trailingIcon}
          </span>
        ) : null}
      </button>
    );
  },
);
