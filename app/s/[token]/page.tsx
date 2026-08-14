import type { Metadata } from "next";
import { headers } from "next/headers";

import { SowDraftDocument } from "@/components/proposals/sow-draft-document";
import { Card, CardBody } from "@/components/ui/card";
import {
  evaluateSowShareTokenPublicAccess,
  flipSowShareTokenExpired,
  lookupSowShareTokenByRawToken,
  recordSowShareTokenAccess,
} from "@/lib/proposals/sow-share-public";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Phase 1B SOW Share Route Sprint P7-B — public read-only SOW share
 * route `/s/[token]`.
 *
 * Mirrors `/p/[token]` (proposal review) with the highest-legal-weight
 * SOW-lane posture (`docs/28`, `docs/65`):
 *   - Anonymous public route. NOT under `/app/*`. Server component. No
 *     client Supabase. No anon RLS.
 *   - Token looked up server-side via the service-role client
 *     (`lib/proposals/sow-share-public.ts`, `server-only`). Raw token
 *     never reaches the client bundle, never logged.
 *   - Eligibility re-evaluated at render time — including the source
 *     Proposal Candidate's approval state (`docs/28` § 5 criterion 4).
 *     Revoked, expired, voided, un-approved, over-age, or
 *     source-not-approved states fall through to the generic-unavailable
 *     page; every blocked state renders the SAME page.
 *   - `SowDraftDocument mode="public"` strips the operator banners +
 *     operator metadata and adds the canon-required public disclaimer
 *     (`docs/28` § 4) with "not authorisation to begin work" at the top,
 *     keeps the DRAFT watermark, legal-boundary notice, and mandatory
 *     footer. It remains a draft — never an executed contract. SLATE
 *     provides no send and no signature workflow (`docs/29` Option A).
 *   - `noindex,nofollow` + `Cache-Control: no-store` + `X-Robots-Tag` +
 *     `Referrer-Policy: no-referrer` via `next.config.mjs` `/s/:token*`.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "SOW Draft · Review",
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function SowShareRoutePage({
  params,
}: {
  params: { token: string };
}) {
  const lookup = await lookupSowShareTokenByRawToken(params.token);
  const access = evaluateSowShareTokenPublicAccess(lookup);

  if (access.status !== "allowed" || !lookup) {
    // Best-effort expiry flip — never blocks the render.
    if (access.shouldFlipExpired && lookup?.token?.id) {
      await flipSowShareTokenExpired(lookup.token.id);
    }
    return <UnavailablePage />;
  }

  const identity = await resolveSowIdentity(lookup.snapshot.engagementId);

  await recordSowShareTokenAccess(lookup.token.id, captureRequestMetadata());

  return (
    <div className="slate-print-light min-h-screen bg-bg-canvas px-4 py-10 print:bg-white print:p-0 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 print:max-w-none">
        <SowDraftDocument
          companyName={identity.companyName}
          engagementType={identity.engagementType}
          snapshot={lookup.snapshot}
          mode="public"
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
          Saipien Labs · SOW Draft
        </span>
        <Card variant="base">
          <CardBody className="flex flex-col gap-3 p-6 sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              This SOW link is unavailable.
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              The link you opened can no longer be displayed. Contact the
              sender for an updated link.
            </p>
            <p className="text-[11px] leading-relaxed text-text-muted">
              This document is a draft Statement of Work. It is not a
              contract, not an executed SOW, not a binding quote, and not
              authorisation to begin work. Final scope, pricing, timeline,
              and terms require written approval and execution by
              authorised parties.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers — engagement identity fetch + request capture
// ---------------------------------------------------------------------------

interface SowIdentity {
  companyName: string;
  engagementType: string;
}

async function resolveSowIdentity(engagementId: string): Promise<SowIdentity> {
  const fallback: SowIdentity = {
    companyName: "Client",
    engagementType: "Engagement",
  };
  try {
    const supabase = createSupabaseServiceClient();
    const { data: engagement, error } = await supabase
      .from("engagements")
      .select("name, engagement_type, account_id")
      .eq("id", engagementId)
      .maybeSingle<{
        name: string | null;
        engagement_type: string | null;
        account_id: string | null;
      }>();
    if (error || !engagement) return fallback;

    let companyName: string | null = null;
    if (engagement.account_id) {
      const { data: account } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", engagement.account_id)
        .maybeSingle<{ name: string | null }>();
      companyName = account?.name?.trim() || null;
    }
    const displayName =
      companyName ?? engagement.name?.trim() ?? fallback.companyName;
    const type = engagement.engagement_type
      ? capitalize(engagement.engagement_type.replace(/_/g, " "))
      : fallback.engagementType;
    return { companyName: displayName, engagementType: type };
  } catch {
    return fallback;
  }
}

function captureRequestMetadata() {
  try {
    const h = headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;
    const userAgent = h.get("user-agent");
    return { ip: ip ?? null, userAgent: userAgent ?? null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
