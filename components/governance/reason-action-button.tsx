"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { TextAreaField, FormError, describeServiceError } from "./fields";

type ActionResult = { ok: true } | { ok: false; error: string; detail?: string };

/**
 * A consequential governance action that REQUIRES a human-written reason
 * (asset lifecycle changes, program status, policy activation/retirement,
 * engagement unlink). The reason is stored with the record and in the
 * audit trail. There is no way to perform these actions without one.
 */
export function ReasonActionButton({
  label,
  title,
  description,
  confirmLabel,
  reasonLabel = "Reason (recorded in the audit trail)",
  placeholder,
  variant = "secondary",
  size = "sm",
  tone = "default",
  onConfirm,
  successTitle,
  disabled,
}: {
  label: string;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  reasonLabel?: string;
  placeholder?: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md";
  tone?: "default" | "danger";
  onConfirm: (reason: string) => Promise<ActionResult>;
  successTitle: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  async function submit() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const r = await onConfirm(reason.trim());
      if (r.ok) {
        setOpen(false);
        setReason("");
        toast({ title: successTitle, variant: "success" });
        router.refresh();
      } else {
        setError(describeServiceError(r.error, r.detail));
      }
    } catch {
      setError(describeServiceError("service-error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)} disabled={disabled}>
        {label}
      </Button>
      {open ? (
        <Dialog
          open
          onClose={() => !pending && setOpen(false)}
          closeOnBackdrop={!pending}
          title={title}
          description={description}
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={submit}
                disabled={pending || !reason.trim()}
                className={tone === "danger" ? "bg-status-critical" : undefined}
              >
                {pending ? "Saving…" : confirmLabel}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <TextAreaField label={reasonLabel} value={reason} onChange={setReason} rows={3} placeholder={placeholder} required maxLength={1000} />
            <FormError message={error} />
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
