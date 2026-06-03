"use client";

import * as React from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkAccountToAttioCompanyAction } from "@/lib/crm/actions";
import type { LinkAccountToAttioCompanyResult } from "@/lib/crm/types";

/**
 * Sprint S3-B — Minimal operator form for linking a SLATE account to
 * an Attio Company record_id.
 *
 * Boundary: this form ONLY writes `accounts.attio_company_id` on the
 * SLATE side. It never calls Attio. The action's docstring restates
 * that contract for callers reading source.
 *
 * The form deliberately does NOT include an Attio search affordance —
 * operator pastes the record_id they copied from Attio. Search UI would
 * pull more surface area into S3-B than the canon authorized.
 */

export interface LinkAttioCompanyFormProps {
  accountId: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function LinkAttioCompanyForm({ accountId }: LinkAttioCompanyFormProps) {
  const [attioId, setAttioId] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<boolean>(false);

  const looksValid = UUID_RE.test(attioId.trim());

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setPending(true);
    try {
      const result: LinkAccountToAttioCompanyResult =
        await linkAccountToAttioCompanyAction({
          accountId,
          attioCompanyId: attioId.trim(),
        });
      if (result.ok) {
        setSuccess(true);
        setAttioId("");
      } else {
        setError(translateError(result.error));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3"
    >
      <Input
        label="Attio Company record ID"
        value={attioId}
        onChange={(e) => setAttioId(e.target.value)}
        placeholder="00000000-0000-0000-0000-000000000000"
        autoComplete="off"
        hint="Copy this from the Attio Company URL or the API panel. UUID-shaped."
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-text-muted">
          Read-only. SLATE will not write to Attio.
        </p>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          leadingIcon={<Link2 className="h-3.5 w-3.5" />}
          disabled={pending || !looksValid}
        >
          {pending ? "Linking…" : "Link Attio company"}
        </Button>
      </div>
      {error ? (
        <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-status-success/40 bg-status-success/10 p-2 text-[11px] text-status-success">
          Linked. Attio context will appear on the next page render.
        </p>
      ) : null}
    </form>
  );
}

function translateError(
  code: Exclude<LinkAccountToAttioCompanyResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again to link the account.";
    case "invalid-account":
    case "account-not-found":
      return "Account could not be found.";
    case "invalid-attio-id":
      return "Attio Company ID must be a UUID copied from the Attio record URL.";
    case "service-error":
    default:
      return "Couldn't link the account. Please try again.";
  }
}
