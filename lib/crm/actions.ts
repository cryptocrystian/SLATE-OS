"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivityEvent } from "@/lib/activity/log";
import type {
  LinkAccountToAttioCompanyInput,
  LinkAccountToAttioCompanyResult,
} from "@/lib/crm/types";

/**
 * Sprint S3-B — Server actions for CRM link management.
 *
 * Canon: `docs/42` § 12.
 *
 * Boundary contract:
 *   - Cookie-bound authenticated operator required.
 *   - Workspace-scoped Supabase server client (no service-role).
 *   - Writes ONLY `accounts.attio_company_id` on the SLATE side.
 *   - NEVER writes to Attio. NEVER calls any Attio mutation endpoint.
 *   - Activity event carries `{ accountId, attioCompanyId }` only —
 *     never auth material, never raw Attio payload.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** Attio record IDs are UUID-shaped at the API layer; we accept that
 *  form to catch obvious paste errors before they hit the DB. */
function isPlausibleAttioId(s: string): boolean {
  return UUID_RE.test(s);
}

export async function linkAccountToAttioCompanyAction(
  input: LinkAccountToAttioCompanyInput,
): Promise<LinkAccountToAttioCompanyResult> {
  if (!isUuid(input.accountId)) {
    return { ok: false, error: "invalid-account" };
  }
  const attioId = (input.attioCompanyId ?? "").trim();
  if (!isPlausibleAttioId(attioId)) {
    return { ok: false, error: "invalid-attio-id" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // Workspace-scoped existence check before write. RLS would silently
  // filter, but the explicit lookup lets us return a clean error.
  const { data: account, error: lookupError } = await supabase
    .from("accounts")
    .select("id, workspace_id")
    .eq("id", input.accountId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (lookupError) {
    console.error("[crm.actions] account-lookup-failed", {
      name: lookupError.name,
      code: lookupError.code,
      message: lookupError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!account?.id) return { ok: false, error: "account-not-found" };

  const { error: updateError } = await supabase
    .from("accounts")
    .update({ attio_company_id: attioId })
    .eq("id", account.id);
  if (updateError) {
    console.error("[crm.actions] account-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "account_linked_to_attio",
    entityType: "account",
    entityId: account.id,
    accountId: account.id,
    title: "Account linked to Attio",
    summary:
      "Operator linked this SLATE account to an Attio Company record. Read-only — SLATE never writes to Attio.",
    metadata: {
      accountId: account.id,
      attioCompanyId: attioId,
    },
  });

  // Revalidate every engagement page for this account so the
  // EngagementContextCard's Attio section refreshes. Account-id ↔
  // engagement-id mapping is unknown here without an extra query, so
  // revalidate the engagements list root + rely on the per-engagement
  // page using `dynamic = "force-dynamic"` for the next render.
  revalidatePath("/app/engagements");

  return { ok: true, accountId: account.id, attioCompanyId: attioId };
}
