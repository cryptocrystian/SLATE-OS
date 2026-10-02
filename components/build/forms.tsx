"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  createProjectAction,
  createProviderAccountAction,
  createWorkItemAction,
  registerWorkerAction,
  ruleDecisionAction,
} from "@/lib/build/actions";
import {
  BILLING_CLASSES,
  ITEM_ACTIONS,
  LABELS,
  MODEL_FAMILIES,
  WORK_ITEM_KINDS,
  type BillingClass,
  type DecisionOption,
  type ItemAction,
  type ModelFamily,
  type OriginKind,
  type WorkItemKind,
} from "@/lib/build/types";
import { describeServiceError, FormError, SelectField, TextAreaField, TextField } from "./fields";

type Result = { ok: boolean; error?: string; detail?: string };

function useSubmit() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  async function run(fn: () => Promise<Result>, success: string, after?: (r: Result) => void) {
    setPending(true);
    setError(null);
    try {
      const r = await fn();
      if (r.ok) {
        toast({ title: success, variant: "success" });
        if (after) after(r);
        else router.refresh();
      } else {
        setError(describeServiceError(r.error ?? "service-error", r.detail));
      }
    } catch {
      setError(describeServiceError("service-error"));
    } finally {
      setPending(false);
    }
  }
  return { pending, error, run, router };
}

const box = "flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-4 sm:p-5";

// -----------------------------------------------------------------------------
// New project
// -----------------------------------------------------------------------------

export function CreateProjectForm({ engagements }: { engagements: { id: string; name: string }[] }) {
  const [f, setF] = React.useState({
    projectKey: "",
    name: "",
    description: "",
    originKind: "internal" as OriginKind,
    originEngagementId: engagements[0]?.id ?? "",
    originRef: "",
    repoUrl: "",
    defaultBranch: "main",
    stackProfile: "next-supabase",
    canonProfile: "arxus-v2",
    builderFamily: "anthropic" as ModelFamily,
    judgeFamilies: ["openai", "google", "xai"] as ModelFamily[],
  });
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const { pending, error, run, router } = useSubmit();

  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createProjectAction({ ...f, judgeFamilies: f.judgeFamilies.filter((j) => j !== f.builderFamily) }),
          "Project created",
          (r) => router.push(`/app/build/${(r as { projectId?: string }).projectId ?? ""}`),
        );
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="Name" value={f.name} onChange={set("name")} required maxLength={160} />
        <TextField label="Project key" value={f.projectKey} onChange={set("projectKey")} required mono maxLength={40}
          hint="Lowercase slug, unique in the workspace — prefixes every run key (e.g. arxus/jrn-s4/3)." />
        <SelectField
          label="Origin"
          value={f.originKind}
          onChange={set("originKind")}
          options={[
            { value: "internal", label: LABELS.originKind.internal },
            { value: "ventureos_venture", label: LABELS.originKind.ventureos_venture },
            { value: "consultos_engagement", label: LABELS.originKind.consultos_engagement, disabled: engagements.length === 0 },
          ]}
          hint={f.originKind === "consultos_engagement" ? "Client-isolated: metered provider accounts only. Places a retention hold on the engagement." : undefined}
        />
        {f.originKind === "consultos_engagement" ? (
          <SelectField label="Engagement" value={f.originEngagementId} onChange={set("originEngagementId")}
            options={engagements.map((e) => ({ value: e.id, label: e.name }))} required />
        ) : f.originKind === "ventureos_venture" ? (
          <TextField label="Venture reference" value={f.originRef} onChange={set("originRef")} required
            hint="Lineage only until VentureOS has its own records (e.g. arxus)." />
        ) : (
          <div />
        )}
        <TextField label="Repository URL" value={f.repoUrl} onChange={set("repoUrl")} required mono maxLength={300} placeholder="https://github.com/org/repo" />
        <TextField label="Default branch" value={f.defaultBranch} onChange={set("defaultBranch")} required mono />
        <TextField label="Stack profile" value={f.stackProfile} onChange={set("stackProfile")} required mono
          hint="A worker must advertise this profile to claim the project's work." />
        <TextField label="Canon profile" value={f.canonProfile} onChange={set("canonProfile")} required mono />
        <SelectField label="Builder family" value={f.builderFamily} onChange={set("builderFamily")}
          options={MODEL_FAMILIES.map((m) => ({ value: m, label: LABELS.family[m] }))} />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-tight text-text-secondary">Judge families</span>
          <div className="flex flex-wrap gap-3 pt-2">
            {MODEL_FAMILIES.filter((m) => m !== f.builderFamily).map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={f.judgeFamilies.includes(m)}
                  onChange={(e) =>
                    set("judgeFamilies")(e.target.checked ? [...f.judgeFamilies, m] : f.judgeFamilies.filter((j) => j !== m))
                  }
                />
                {LABELS.family[m]}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-text-muted">I3: a judge never shares the builder&apos;s family.</p>
        </div>
      </div>
      <TextAreaField label="Description" value={f.description} onChange={set("description")} rows={3} />
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// New work item
// -----------------------------------------------------------------------------

export function CreateWorkItemForm({
  projectId,
  items,
}: {
  projectId: string;
  items: { id: string; itemKey: string }[];
}) {
  const empty = { itemKey: "", kind: "journey" as WorkItemKind, canonRef: "", title: "", brief: "", bindings: "", status: "draft" as "draft" | "ready", remediatesItemId: "", dependsOn: [] as string[] };
  const [f, setF] = React.useState(empty);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const { pending, error, run } = useSubmit();

  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createWorkItemAction(projectId, { ...f, remediatesItemId: f.remediatesItemId || null }),
          "Work item added",
          () => setF(empty),
        ).then(() => undefined);
      }}
    >
      <h3 className="text-sm font-semibold tracking-tight text-text-primary">Add a work item</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TextField label="Item key" value={f.itemKey} onChange={set("itemKey")} required mono maxLength={80} placeholder="jrn-s5" />
        <SelectField label="Kind" value={f.kind} onChange={set("kind")} options={WORK_ITEM_KINDS.map((k) => ({ value: k, label: LABELS.workItemKind[k] }))} />
        <TextField label="Canon ref" value={f.canonRef} onChange={set("canonRef")} mono maxLength={80} placeholder="JRN-S5" />
      </div>
      <TextField label="Title" value={f.title} onChange={set("title")} required />
      <TextField label="Bindings" value={f.bindings} onChange={set("bindings")} mono maxLength={1000}
        hint="Canon entities this item touches, comma-separated. Overlapping items never run in parallel. Use * to bind the whole project." />
      {f.kind === "remediation" ? (
        <SelectField label="Remediates" value={f.remediatesItemId} onChange={set("remediatesItemId")}
          options={[{ value: "", label: "Select an item" }, ...items.map((i) => ({ value: i.id, label: i.itemKey }))]} required />
      ) : null}
      {items.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-tight text-text-secondary">Depends on</span>
          <div className="flex flex-wrap gap-3">
            {items.map((i) => (
              <label key={i.id} className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={f.dependsOn.includes(i.id)}
                  onChange={(e) => set("dependsOn")(e.target.checked ? [...f.dependsOn, i.id] : f.dependsOn.filter((d) => d !== i.id))}
                />
                {i.itemKey}
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <TextAreaField label="Brief" value={f.brief} onChange={set("brief")} rows={3} maxLength={20000} />
      <FormError message={error} />
      <div className="flex items-center justify-end gap-3">
        <SelectField label="" value={f.status} onChange={set("status")}
          options={[{ value: "draft", label: "Add as draft" }, { value: "ready", label: "Add as ready (claimable)" }]} />
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Adding…" : "Add item"}
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Rule a decision
// -----------------------------------------------------------------------------

export function RuleDecisionForm({
  decisionId,
  options,
  recommended,
}: {
  decisionId: string;
  options: DecisionOption[];
  recommended: string | null;
}) {
  const [option, setOption] = React.useState(recommended ?? options[0]?.key ?? "");
  const [itemAction, setItemAction] = React.useState<ItemAction>("ready");
  const [note, setNote] = React.useState("");
  const [canonRef, setCanonRef] = React.useState("");
  const { pending, error, run } = useSubmit();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => ruleDecisionAction(decisionId, { option, itemAction, note, resultingCanonRef: canonRef }), "Decision ruled");
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium text-text-secondary">Ruling</legend>
        {options.map((o) => (
          <label key={o.key} className="flex items-start gap-2 rounded-md border border-border-subtle p-2.5 text-sm text-text-primary">
            <input type="radio" name={`ruling-${decisionId}`} checked={option === o.key} onChange={() => setOption(o.key)} className="mt-1" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">
                {o.label}
                {o.key === recommended ? <span className="ml-2 text-[11px] font-normal text-brand-primary">Recommended</span> : null}
              </span>
              {o.consequence ? <span className="text-xs text-text-muted">{o.consequence}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SelectField label="Then the work item" value={itemAction} onChange={setItemAction}
          options={ITEM_ACTIONS.map((a) => ({ value: a, label: LABELS.itemAction[a] }))}
          hint="A ruling never dispatches work — it makes the item claimable; the scheduler does the rest." />
        <TextField label="Resulting canon ref" value={canonRef} onChange={setCanonRef} mono placeholder="DEC-062"
          hint="The decision-log entry recording this ruling in the project repo." />
      </div>
      <TextAreaField label="Note" value={note} onChange={setNote} rows={2} />
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={pending || !option}>
          {pending ? "Recording…" : "Record ruling"}
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Capacity: provider accounts + workers
// -----------------------------------------------------------------------------

export function ProviderAccountForm() {
  const empty = { label: "", family: "openai" as ModelFamily, provider: "", billingClass: "metered" as BillingClass, secretRef: "", maxConcurrency: "2" };
  const [f, setF] = React.useState(empty);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const { pending, error, run } = useSubmit();
  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createProviderAccountAction(f), "Provider account added", () => setF(empty));
      }}
    >
      <h3 className="text-sm font-semibold tracking-tight text-text-primary">Add a provider account</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TextField label="Label" value={f.label} onChange={set("label")} required maxLength={80} placeholder="openai-org-1" />
        <SelectField label="Family" value={f.family} onChange={set("family")} options={MODEL_FAMILIES.map((m) => ({ value: m, label: LABELS.family[m] }))} />
        <TextField label="Provider" value={f.provider} onChange={set("provider")} required mono maxLength={40} placeholder="openai" />
        <SelectField label="Billing" value={f.billingClass} onChange={set("billingClass")}
          options={BILLING_CLASSES.map((b) => ({ value: b, label: LABELS.billingClass[b] }))}
          hint="Client projects only ever use metered accounts (D3)." />
        <TextField label="Secret reference" value={f.secretRef} onChange={set("secretRef")} required mono maxLength={120}
          placeholder="vault/openai-org-1" hint="The NAME of the secret in the worker secret manager — never the key itself." />
        <TextField label="Max concurrent calls" value={f.maxConcurrency} onChange={set("maxConcurrency")} type="number" required />
      </div>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add account"}
        </Button>
      </div>
    </form>
  );
}

export function WorkerForm() {
  const empty = { name: "", substrate: "", capabilities: "next-supabase" };
  const [f, setF] = React.useState(empty);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const { pending, error, run } = useSubmit();
  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => registerWorkerAction(f), "Worker registered", () => setF(empty));
      }}
    >
      <h3 className="text-sm font-semibold tracking-tight text-text-primary">Register a worker</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TextField label="Name" value={f.name} onChange={set("name")} required mono maxLength={63} placeholder="vps-1" />
        <TextField label="Substrate" value={f.substrate} onChange={set("substrate")} required maxLength={60} placeholder="vps · exe.dev · container" />
        <TextField label="Stack profiles" value={f.capabilities} onChange={set("capabilities")} required mono maxLength={400} />
      </div>
      <p className="text-[11px] text-text-muted">
        The worker authenticates as a database login IN ROLE buildos_worker, created out-of-band; this record only names it and its capabilities.
      </p>
      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Registering…" : "Register worker"}
        </Button>
      </div>
    </form>
  );
}
