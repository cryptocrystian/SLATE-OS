import "server-only";

import { attioPostQuery } from "./client";
import type { AttioListResponse, AttioRecord } from "./types";

/**
 * Sprint S3-B — Attio Deals fetcher (read-only).
 *
 * Canon: `docs/42` § 12 + § 9.3.
 *
 * Fetches up to N Deal records that reference the given Attio Company.
 * Provides the pipeline-stage and deal-value enrichment that
 * `docs/42` § 10 originally listed under Company but which actually
 * lives on the Deal object in Attio's data model (noted during the
 * S3-B property audit).
 */

const DEALS_PAGE_LIMIT = 5;

export async function fetchAttioDealsByCompanyId(
  attioCompanyId: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<AttioRecord[]> {
  if (!attioCompanyId) return [];
  const limit = Math.min(
    Math.max(options.limit ?? DEALS_PAGE_LIMIT, 1),
    DEALS_PAGE_LIMIT,
  );
  try {
    const response = await attioPostQuery<AttioListResponse<AttioRecord>>(
      "/objects/deals/records/query",
      {
        filter: {
          associated_company: {
            target_record_id: attioCompanyId,
            target_object: "companies",
          },
        },
        limit,
        sorts: [{ attribute: "created_at", direction: "desc" }],
      },
      { signal: options.signal },
    );
    return response.data ?? [];
  } catch (err) {
    if (err instanceof Error && err.name === "AttioApiError") {
      const status = (err as unknown as { status: number }).status;
      // 404 → deals object not enabled in this workspace; 400 →
      // attribute slug mismatch. Treat as "no deals" rather than fail
      // the entire context fetch.
      if (status === 400 || status === 404) return [];
    }
    throw err;
  }
}
