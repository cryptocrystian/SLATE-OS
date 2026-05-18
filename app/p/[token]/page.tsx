import type { Metadata } from "next";
import { headers } from "next/headers";

import { ClientProposalShareDocument } from "@/components/proposals/client-proposal-share-document";
import { Card, CardBody } from "@/components/ui/card";
import {
  evaluateProposalShareTokenPublicAccess,
  flipProposalShareTokenExpired,
  lookupProposalShareTokenByRawToken,
  recordProposalShareTokenAccess,
  type ProposalShareTokenLookupResult,
  type ProposalShareTokenPublicAccessResult,
} from "@/lib/proposals/share-token-public";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P5 — public read-only Client
 * Proposal Review Link route.
 *
 * Boundaries (docs/24 § Client Proposal Route Security):
 *   - Anonymous public route. NOT under `/app/*` — `middleware.ts`'s
 *     `needsSessionRefresh` matcher only refreshes `/app/*`,
 *     `/login`, `/auth/*`; `/p/*` falls through without auth in
 *     the same shape as `/r/*` from Sprint 4D-C.
 *   - Server component. No client Supabase. No anonymous RLS policy.
 *   - The token is looked up server-side through the service-role
 *     client (`lib/proposals/share-token-public.ts`), which is
 *     `server-only`. The raw token never reaches the client bundle
 *     and is never logged.
 *   - Eligibility is re-evaluated at render time. Voided, un-approved,
 *     over-age, draft-watermark, or commercial-guard-failing snapshots
 *     fall through to the generic-unavailable page.
 *   - Every blocked state renders the SAME generic page. The route
 *     never reveals whether a token exists, has expired, was revoked,
 *     or backs a voided / ineligible snapshot.
 *   - `noindex,nofollow` metadata + `Cache-Control: no-store`
 *     + `Referrer-Policy: no-referrer` headers via `next.config.mjs`
 *     `/p/:token*` entry (mirrors the report-side `/r/:token*` block).
 *   - Snapshot-pure render: the page reads only from the snapshot's
 *     jsonb columns plus a single engagement-name fetch for the
 *     visible proposal title. No live re-query of `proposal_options`
 *     or commercial-guard inputs.
 *   - Reviewer notes, internal UUIDs, commercial-guard codes, audience
 *     labels, operator-only banners, and approval / e-sign controls
 *     are deliberately stripped by `ClientProposalShareDocument`.
 *   - `dynamic = "force-dynamic"` + `revalidate = 0` +
 *     `fetchCache = "force-no-store"` defeats Next 14's server-component
 *     fetch cache so post-revoke + post-void reads never leak stale
 *     "allowed" pages (same Sprint 4D-C precedent on the report side).
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Client Proposal Review",
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function ClientProposalShareRoutePage({
  params,
}: {
  params: { token: string };
}) {
  // Security headers (`Cache-Control: no-store`, `X-Robots-Tag`,
  // `Referrer-Policy`) are applied at the framework layer via
  // `next.config.mjs` headers entry for `/p/:token*`. We rely on that
  // single source of truth rather than injecting headers from the
  // page component (which is not supported in App Router server
  // components).

  const lookup = await lookupProposalShareTokenByRawToken(params.token);
  const access = evaluateProposalShareTokenPublicAccess(lookup);

  if (access.status !== "allowed" || !lookup) {
    // Best-effort expiry flip — never blocks the render.
    if (access.shouldFlipExpired && lookup?.token?.id) {
      await flipProposalShareTokenExpired(lookup.token.id);
    }
    return <UnavailablePage />;
  }

  // Allowed path — record the access and render the client artifact.
  // Pull the engagement display fields via the service-role client so
  // the client-facing title shows the company name (the client viewer
  // already knows who they are). No engagement UUID surfaces.
  const proposalTitle = await resolveClientProposalTitle(
    lookup.snapshot.engagementId,
  );

  await recordProposalShareTokenAccess(
    lookup.token.id,
    captureRequestMetadata(),
  );

  return (
    <div className="slate-print-light min-h-screen bg-bg-canvas px-4 py-10 print:bg-white print:p-0 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 print:max-w-none">
        <ClientProposalShareDocument
          snapshot={lookup.snapshot}
          proposalTitle={proposalTitle}
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
          Saipien Labs · Proposal Review
        </span>
        <Card variant="base">
          <CardBody className="flex flex-col gap-3 p-6 sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              This proposal link is unavailable.
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              The link you opened can no longer be displayed. Contact
              the sender for an updated link.
            </p>
            <p className="text-[11px] leading-relaxed text-text-muted">
              This document is a commercial discussion artifact. It is
              not a contract, not an executed SOW, not a financial
              guarantee, not acceptance of work, not a binding quote,
              and not a statement of work. Final scope, pricing, and
              timeline require written approval.
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

async function resolveClientProposalTitle(
  engagementId: string,
): Promise<string> {
  // Sprint H1 — fixed engagement-title fallback. See the matching
  // comment on the report-side `resolveClientReportTitle` for the full
  // rationale. Company name lives on `accounts.name`, joined via
  // `engagements.account_id`; the previous `engagements.company_name`
  // select was a column that doesn't exist.
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
      return "Proposal Review";
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
      return "Proposal Review";
    }
    const type = engagement.engagement_type
      ? engagement.engagement_type.replace(/_/g, " ")
      : "Engagement";
    return `${displayName} · ${capitalize(type)} · Proposal Review`;
  } catch {
    return "Proposal Review";
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

// Re-exported for completeness — downstream tests can pin the
// expected shape if needed.
export type {
  ProposalShareTokenLookupResult,
  ProposalShareTokenPublicAccessResult,
};
