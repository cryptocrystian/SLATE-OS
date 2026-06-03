import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AttioApiError,
  AttioNotConfiguredError,
  isAttioConfigured,
} from "@/lib/crm/attio/client";
import { fetchAttioCompanyById } from "@/lib/crm/attio/companies";
import { fetchAttioPeopleByCompanyId } from "@/lib/crm/attio/people";
import { fetchAttioDealsByCompanyId } from "@/lib/crm/attio/deals";
import { mapAttioContextToCrmContext } from "@/lib/crm/attio/mappers";
import type { CrmContextSourceStatus } from "@/lib/crm/types";

/**
 * Sprint S3-B — CRM context query entry point.
 *
 * Canon: `docs/42` § 12.
 *
 * Server-only. Reads via the authenticated workspace-scoped Supabase
 * client; the read-side never touches `service_role`. The Attio call
 * happens AFTER the workspace-scoped RLS read confirms the engagement
 * + account belong to the operator's workspace, so an unauthorized
 * caller can never trigger an outbound Attio request for a foreign
 * account.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/**
 * Load Attio-backed CRM context for an engagement. Returns a status
 * envelope so the UI can render the three canonical states uniformly:
 *   - "linked"        → render Attio context
 *   - "not-linked"    → render the "Link to Attio" form
 *   - "fetch-failed"  → render the "Attio link broken — re-link?" hint
 *   - "not-configured"→ silent (workspace doesn't have the connector
 *                       wired yet)
 */
export async function getCrmContextForEngagement(
  engagementId: string,
): Promise<CrmContextSourceStatus | null> {
  if (!isUuid(engagementId)) return null;
  if (!isAttioConfigured()) {
    return { status: "not-configured", provider: "attio" };
  }

  const supabase = createSupabaseServerClient();
  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id, account_id")
    .eq("id", engagementId)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      account_id: string | null;
    }>();
  if (engagementError) {
    console.error("[crm.queries] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return null;
  }
  if (!engagement?.id || !engagement.account_id) return null;

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, attio_company_id")
    .eq("id", engagement.account_id)
    .maybeSingle<{ id: string; attio_company_id: string | null }>();
  if (accountError) {
    console.error("[crm.queries] account-lookup-failed", {
      name: accountError.name,
      code: accountError.code,
      message: accountError.message,
    });
    return null;
  }
  if (!account?.id) return null;
  if (!account.attio_company_id) {
    return {
      status: "not-linked",
      provider: "attio",
      accountId: account.id,
    };
  }

  // Fetch the company + bounded related context. Each fetcher fails
  // soft on 4xx — so an out-of-date attio_company_id or workspace
  // without Deals enabled doesn't break the page.
  try {
    const fetchedAt = new Date().toISOString();
    const company = await fetchAttioCompanyById(account.attio_company_id);
    if (!company) {
      return {
        status: "fetch-failed",
        provider: "attio",
        reason:
          "Attio Company not found. The stored attio_company_id may be stale — re-link from the Engagement context surface.",
      };
    }
    const [people, deals] = await Promise.all([
      fetchAttioPeopleByCompanyId(account.attio_company_id),
      fetchAttioDealsByCompanyId(account.attio_company_id),
    ]);
    const context = mapAttioContextToCrmContext({
      company,
      people,
      deals,
      fetchedAt,
    });
    return { status: "linked", context };
  } catch (err) {
    if (err instanceof AttioNotConfiguredError) {
      return { status: "not-configured", provider: "attio" };
    }
    if (err instanceof AttioApiError) {
      console.error("[crm.queries] attio-fetch-failed", {
        status: err.status,
        endpoint: err.endpoint,
        message: err.message,
      });
      return {
        status: "fetch-failed",
        provider: "attio",
        reason: `Attio API error (HTTP ${err.status})`,
      };
    }
    console.error("[crm.queries] unexpected-error", {
      name: (err as Error)?.name,
      message: (err as Error)?.message,
    });
    return {
      status: "fetch-failed",
      provider: "attio",
      reason: "Unexpected error fetching Attio context",
    };
  }
}
