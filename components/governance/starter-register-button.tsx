"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { loadStarterRegisterAction } from "@/lib/governance/actions";
import { FormError, describeServiceError } from "./fields";

/**
 * Loads the docs/73 v0.2 starter register into an INTERNAL program.
 * Everything lands as `proposed` systems and v1 policy DRAFTS, attributed to
 * the person who clicks. Nothing is activated here.
 */
export function StarterRegisterButton({ programId, assetCount, policyCount }: { programId: string; assetCount: number; policyCount: number }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  async function load() {
    setPending(true);
    setError(null);
    try {
      const r = await loadStarterRegisterAction(programId);
      if (r.ok) {
        setOpen(false);
        toast({
          title: "Starter register loaded",
          description: `${r.assetsCreated} systems proposed, ${r.policiesCreated} policy drafts. Nothing is active yet.`,
          variant: "success",
        });
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
      <Button type="button" variant="secondary" size="sm" leadingIcon={<ListPlus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
        Load Saipien starter register
      </Button>
      {open ? (
        <Dialog
          open
          onClose={() => !pending && setOpen(false)}
          closeOnBackdrop={!pending}
          title="Load the Saipien starter register?"
          description="From the AI operating standard (docs/73 v0.2): Saipien's AI systems and the seven GOV policies, prepared from production evidence."
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={load} disabled={pending}>
                {pending ? "Loading…" : "Load as proposals and drafts"}
              </Button>
            </>
          }
        >
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-xs leading-relaxed text-text-secondary">
            <li>Systems are registered as <strong>proposed</strong>. To put one live you complete its GOV 06 record, including a named approver, and give a reason.</li>
            <li>Policies are created as <strong>v1 drafts</strong>. Review, edit, and activate each one with a reason; activation is your ratification.</li>
            <li>Everything is recorded as yours. Already-present items are skipped ({assetCount} systems, {policyCount} policies now).</li>
          </ul>
          <div className="pt-3">
            <FormError message={error} />
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
