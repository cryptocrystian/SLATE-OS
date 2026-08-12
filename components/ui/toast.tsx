"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Default 5000. Pass 0 to persist. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "description">> {
  id: number;
  description?: string;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>.");
  }
  return ctx;
}

const variantMeta: Record<
  ToastVariant,
  { icon: React.ComponentType<{ className?: string }>; accent: string }
> = {
  success: { icon: CheckCircle2, accent: "text-status-success" },
  error: { icon: AlertTriangle, accent: "text-status-critical" },
  info: { icon: Info, accent: "text-status-info" },
};

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const remove = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ title, description, variant = "info", duration = 5000 }: ToastOptions) => {
      idCounter += 1;
      const id = idCounter;
      setToasts((prev) => [...prev, { id, title, description, variant, duration }]);
      if (duration > 0) {
        window.setTimeout(() => remove(id), duration);
      }
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted
        ? createPortal(
            <div
              role="region"
              aria-label="Notifications"
              className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
            >
              {toasts.map((t) => (
                <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: () => void;
}) {
  const { icon: Icon, accent } = variantMeta[item.variant];
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3 shadow-elevated motion-safe:animate-fade-up"
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", accent)} aria-hidden />
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-xs font-semibold text-text-primary">{item.title}</p>
        {item.description ? (
          <p className="text-[11px] leading-relaxed text-text-muted">
            {item.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:text-text-primary"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
