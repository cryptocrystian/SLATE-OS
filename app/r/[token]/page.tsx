import type { Metadata } from "next";
import { headers } from "next/headers";

import { ClientReportShareDocument } from "@/components/reports/client-report-share-document";
import { Card, CardBody } from "@/components/ui/card";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  evaluateShareTokenPublicAccess,
  flipShareTokenExpired,
  lookupShareTokenByRawToken,
  recordShareTokenAccess,
  type ShareTokenLookupResult,
  type ShareTokenPublicAccessResult,
} from "@/lib/reports/share-token-public";

/**
 * Phase 1B Sprint 4D-C — public read-only Client Report Link route.
 *
 * Boundaries (docs/22 § Public Route Security):
 *   - Anonymous public route. NOT under `/app/*` — the middleware
 *     passes `/r/*` through without auth.
 *   - Server component. No client Supabase. No anonymous RLS policy.
 *   - The token is looked up server-side through the service-role
 *     client (`lib/reports/share-token-public.ts`), which is
 *     `server-only`. The raw token never reaches the client bundle
 *     and is never logged.
 *   - Eligibility is re-evaluated at render time. Voided / over-age /
 *     ineligible snapshots fall through to the generic-unavailable
 *     page.
 *   - Every blocked state renders the SAME generic page. The route
 *     never reveals whether a token exists, has expired, was revoked,
 *     or backs a voided / ineligible snapshot.
 *   - `noindex,nofollow` metadata + `Cache-Control: no-store` header.
 *   - Snapshot-pure render: the page reads only from the snapshot's
 *     jsonb columns plus an engagement-name fetch for the visible
 *     report title. No live re-query of `report_sections` or adapter
 *     inputs.
 *   - Reviewer notes, internal UUIDs, claim-guard codes, audience
 *     labels, and operator-only banners are deliberately stripped by
 *     `ClientReportShareDocument`.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Client Report",
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function ClientReportShareRoutePage({
  params,
}: {
  params: { token: string };
}) {
  // `Cache-Control: no-store`, `X-Robots-Tag`, and `Referrer-Policy`
  // are applied at the framework layer via `next.config.mjs` headers
  // entry for `/r/:token*`. We rely on that single source of truth
  // rather than injecting headers from the page component (which is
  // not supported in App Router server components).

  const lookup = await lookupShareTokenByRawToken(params.token);
  const access = evaluateShareTokenPublicAccess(lookup);

  if (access.status !== "allowed" || !lookup) {
    logBlockedAccessForDev(access, lookup);
    // Best-effort expiry flip — never blocks the render.
    if (access.shouldFlipExpired && lookup?.token?.id) {
      await flipShareTokenExpired(lookup.token.id);
    }
    return <UnavailablePage />;
  }

  // Allowed path — record the access and render the client artifact.
  // Pull the engagement display fields via the service-role client so
  // the client-facing title shows the company name (the client viewer
  // already knows who they are). No engagement UUID surfaces.
  const reportTitle = await resolveClientReportTitle(
    lookup.snapshot.engagementId,
  );

  await recordShareTokenAccess(lookup.token.id, captureRequestMetadata());

  return (
    <div className="slate-print-light min-h-screen bg-bg-canvas px-4 py-10 print:bg-white print:p-0 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 print:max-w-none">
        <ClientReportShareDocument
          snapshot={lookup.snapshot}
          reportTitle={reportTitle}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic unavailable page — identical surface for every blocked state
// ---------------------------------------------------------------------------

function UnavailablePage() {
  return (
    <div className="slate-print-light min-h-screen bg-bg-canvas px-4 py-16 print:bg-white print:p-0 sm:px-6">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Saipien Labs · Client Report
        </span>
        <Card variant="base">
          <CardBody className="flex flex-col gap-3 p-6 sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              This report link is unavailable.
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              The link you opened can no longer be displayed. Contact
              the sender for an updated link.
            </p>
            <p className="text-[11px] leading-relaxed text-text-muted">
              This report is advisory only. It is not a SOW, not a
              binding quote, not a financial guarantee, and not a
              contract.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers — engagement-name fetch + request capture
// ---------------------------------------------------------------------------

async function resolveClientReportTitle(engagementId: string): Promise<string> {
  // Sprint H1 — fixed engagement-title fallback. The previous query
  // selected `engagements.company_name`, which does not exist on the
  // `engagements` table (canon: company name lives on
  // `accounts.name`, joined via `engagements.account_id`). The
  // mismatch caused every public route to fall through to the generic
  // "Client Report" title. The fix reads `engagements.name` +
  // `engagements.engagement_type` + `engagements.account_id`, then
  // resolves the company name from `accounts.name`. Both queries run
  // under the service-role client and surface only display strings —
  // no UUIDs ever reach the rendered DOM.
  try {
    const supabase = createSupabaseServiceClient();
    const { data: engagement, error: engagementError } = await supabase
      .from("engagements")
      .select("name, engagement_type, account_id")
      .eq("id", engagementId)
      .maybeSingle<{
        name: string | null;
        engagement_type: string | null;
        account_id: string | null;
      }>();
    if (engagementError || !engagement) {
      return "Client Report";
    }
    let companyName: string | null = null;
    if (engagement.account_id) {
      const { data: account } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", engagement.account_id)
        .maybeSingle<{ name: string | null }>();
      companyName = account?.name?.trim() || null;
    }
    const displayName = companyName ?? engagement.name?.trim() ?? null;
    if (!displayName) {
      return "Client Report";
    }
    const type = engagement.engagement_type
      ? engagement.engagement_type.replace(/_/g, " ")
      : "Engagement";
    return `${displayName} · ${capitalize(type)} · Report`;
  } catch {
    return "Client Report";
  }
}

function captureRequestMetadata() {
  try {
    const h = headers();
    // `x-forwarded-for` may carry multiple comma-separated IPs from
    // proxies. Take the first — the client's; never persist the raw
    // value (hashed downstream).
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;
    const userAgent = h.get("user-agent");
    return {
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Operator-only diagnostic for blocked /r/[token] renders. Emits a
// single sanitized server-side log line in non-production runtimes only,
// so operators running `npm run dev` can see WHY a token rejected
// (e.g. mint-vs-render eligibility divergence per docs/30 Audit Note 5).
// NEVER reaches the client bundle. NEVER includes the raw token. The
// internal IDs surfaced (token id, snapshot id, engagement id) are
// operator-facing — the same shape already lands in operator-only
// activity events. Suppressed entirely in production to keep
// rejection-reason emissions out of production telemetry.
function logBlockedAccessForDev(
  access: ShareTokenPublicAccessResult,
  lookup: ShareTokenLookupResult | null,
) {
  if (process.env.NODE_ENV === "production") return;
  console.warn("[reports.share-tokens.public] render-blocked", {
    status: access.status,
    reason: access.reason ?? null,
    tokenId: lookup?.token?.id ?? null,
    snapshotId: lookup?.snapshot?.id ?? null,
    engagementId: lookup?.token?.engagementId ?? null,
  });
}

// Re-exported so the next.config.js or downstream tests can pin the
// expected shape if needed.
export type { ShareTokenLookupResult, ShareTokenPublicAccessResult };
