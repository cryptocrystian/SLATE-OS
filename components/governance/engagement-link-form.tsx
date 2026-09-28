"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { linkEngagementAction } from "@/lib/governance/actions";
import { LINK_RELATIONSHIPS, humanizeToken, type LinkRelationship } from "@/lib/governance/types";
import { FormError, SelectField, describeServiceError } from "./fields";

export function EngagementLinkForm({
  programId,
  engagements,
}: {
  programId: string;
  engagements: Array<{ id: string; name: string; status: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [engagementId, setEngagementId] = React.useState("");
  const [relationship, setRelationship] = React.useState<LinkRelationship | "">("assessment");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await linkEngagementAction(programId, engagementId, relationship || "assessment");
      if (r.ok) {
        toast({ title: "Engagement linked", description: "A retention hold now protects it from deletion while linked.", variant: "success" });
        setEngagementId("");
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
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-bg-surface p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
        <SelectField
          label="ConsultOS engagement"
          value={engagementId}
          onChange={setEngagementId}
          options={engagements.map((e) => ({ value: e.id, label: `${e.name} · ${humanizeToken(e.status)}` }))}
          placeholder={engagements.length ? "Select an engagement…" : "No unlinked engagements"}
          required
        />
        <SelectField
          label="Relationship"
          value={relationship}
          onChange={setRelationship}
          options={LINK_RELATIONSHIPS.map((r) => ({ value: r, label: humanizeToken(r) }))}
        />
      </div>
      <FormError message={error} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-text-muted">
          The engagement stays a ConsultOS record. Governance state belongs to this program and survives the engagement.
        </p>
        <Button type="submit" size="sm" variant="primary" leadingIcon={<Link2 className="h-3.5 w-3.5" />} disabled={pending || !engagementId}>
          {pending ? "Linking…" : "Link engagement"}
        </Button>
      </div>
    </form>
  );
}
