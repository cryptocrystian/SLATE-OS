"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  clearAlarmAction,
  evaluateAlarmsAction,
  requestRunCancelAction,
  setProviderAccountStatusAction,
  setWorkerStatusAction,
  transitionProjectAction,
  transitionWorkItemAction,
} from "@/lib/build/actions";
import { LABELS, OPERATOR_ITEM_TRANSITIONS, PROJECT_TRANSITIONS, type ProjectStatus, type WorkItemStatus } from "@/lib/build/types";
import { describeServiceError, FormError, TextAreaField } from "./fields";

type ActionResult = { ok: boolean; error?: string; detail?: string };

/**
 * A consequential BuildOS action that REQUIRES a human-written reason
 * (project status, work-item release/cancel). The reason goes to the audit
 * trail. There is no way to perform these actions without one.
 */
export function ReasonActionButton({
  label,
  title,
  description,
  confirmLabel,
  placeholder,
  variant = "secondary",
  tone = "default",
  onConfirm,
  successTitle,
}: {
  label: string;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  placeholder?: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  tone?: "default" | "danger";
  onConfirm: (reason: string) => Promise<ActionResult>;
  successTitle: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  async function submit() {
    if (!reason.trim()) return setError("A reason is required.");
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
        setError(describeServiceError(r.error ?? "service-error", r.detail));
      }
    } catch {
      setError(describeServiceError("service-error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size="sm" onClick={() => setOpen(true)}>
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
            <TextAreaField label="Reason (recorded in the audit trail)" value={reason} onChange={setReason} rows={3} placeholder={placeholder} required maxLength={1000} />
            <FormError message={error} />
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** A one-click action with no reason (idempotent or low-consequence: clear alarm, re-evaluate, enable/disable). */
export function QuickActionButton({
  label,
  pendingLabel = "Working…",
  onRun,
  successTitle,
  variant = "ghost",
}: {
  label: string;
  pendingLabel?: string;
  onRun: () => Promise<ActionResult>;
  successTitle: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
}) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const { toast } = useToast();
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const r = await onRun();
          if (r.ok) {
            toast({ title: successTitle, variant: "success" });
            router.refresh();
          } else {
            toast({ title: describeServiceError(r.error ?? "service-error", r.detail), variant: "error" });
          }
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

// -----------------------------------------------------------------------------
// Id-bound wrappers (server pages pass ids, never closures).
// -----------------------------------------------------------------------------

const PROJECT_VERB: Record<ProjectStatus, string> = {
  intake: "Back to intake",
  ready: "Mark ready",
  active: "Activate",
  paused: "Pause",
  closed: "Close project",
};

export function ProjectTransitions({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_TRANSITIONS[status].map((to) => (
        <ReasonActionButton
          key={to}
          label={PROJECT_VERB[to]}
          title={`${PROJECT_VERB[to]}?`}
          description={
            to === "ready"
              ? "Attest that the canon package has been validated against its canon profile (journeys with bindings, acceptance criteria declared, stack profile known). Your note is stored as the readiness record."
              : to === "active"
                ? "Work in this project becomes claimable by workers (subject to capacity, WIP and dependencies)."
                : to === "closed"
                  ? "Closed is terminal. Run history is kept; any engagement retention hold is released."
                  : undefined
          }
          confirmLabel={PROJECT_VERB[to]}
          variant={to === "active" ? "primary" : "secondary"}
          tone={to === "closed" ? "danger" : "default"}
          successTitle={`Project ${LABELS.projectStatus[to].toLowerCase()}`}
          onConfirm={(reason) => transitionProjectAction(projectId, to, reason)}
        />
      ))}
    </div>
  );
}

const ITEM_VERB: Partial<Record<WorkItemStatus, string>> = {
  ready: "Release",
  draft: "Back to draft",
  cancelled: "Cancel",
  superseded: "Supersede",
};

export function ItemTransitions({ itemId, status }: { itemId: string; status: WorkItemStatus }) {
  const moves = OPERATOR_ITEM_TRANSITIONS[status];
  if (!moves.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {moves.map((to) => (
        <ReasonActionButton
          key={to}
          label={status === "draft" && to === "ready" ? "Mark ready" : ITEM_VERB[to] ?? to}
          title={`${ITEM_VERB[to] ?? to} this work item?`}
          confirmLabel={ITEM_VERB[to] ?? to}
          variant="ghost"
          tone={to === "cancelled" ? "danger" : "default"}
          successTitle="Work item updated"
          onConfirm={(reason) => transitionWorkItemAction(itemId, to, reason)}
        />
      ))}
    </div>
  );
}

export function ClearAlarmButton({ alarmId }: { alarmId: string }) {
  return <QuickActionButton label="Clear" onRun={() => clearAlarmAction(alarmId)} successTitle="Alarm cleared" />;
}

export function EvaluateAlarmsButton() {
  return <QuickActionButton label="Re-evaluate" onRun={evaluateAlarmsAction} successTitle="Alarms re-evaluated" />;
}

export function CancelRunButton({ runId }: { runId: string }) {
  return (
    <QuickActionButton
      label="Request cancel"
      variant="secondary"
      onRun={() => requestRunCancelAction(runId)}
      successTitle="Cancellation requested — the worker stops at its next heartbeat"
    />
  );
}

export function AccountStatusButton({ accountId, status }: { accountId: string; status: "active" | "disabled" }) {
  const next = status === "active" ? "disabled" : "active";
  return (
    <QuickActionButton
      label={next === "disabled" ? "Disable" : "Enable"}
      onRun={() => setProviderAccountStatusAction(accountId, next)}
      successTitle={`Account ${next === "disabled" ? "disabled" : "enabled"}`}
    />
  );
}

export function WorkerStatusButton({ workerId, status }: { workerId: string; status: "active" | "disabled" }) {
  const next = status === "active" ? "disabled" : "active";
  return (
    <QuickActionButton
      label={next === "disabled" ? "Disable" : "Enable"}
      onRun={() => setWorkerStatusAction(workerId, next)}
      successTitle={`Worker ${next === "disabled" ? "disabled" : "enabled"}`}
    />
  );
}
