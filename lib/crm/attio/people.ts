import "server-only";

import { attioPostQuery } from "./client";
import type { AttioListResponse, AttioRecord } from "./types";

/**
 * Sprint S3-B — Attio People fetcher (read-only).
 *
 * Canon: `docs/42` § 12 + § 9.2.
 *
 * Fetches a small bounded list of People associated with a Company.
 * Bounded because the EngagementContextCard surface only renders a
 * summary — not a full directory.
 */

const PEOPLE_PAGE_LIMIT = 10;

/**
 * Fetch up to N People records that have a record-reference to the
 * given Attio Company ID via Attio's standard `company` attribute on
 * the Person object. Returns [] when none are found.
 *
 * NOTE: this is a POST `/records/query` call against the `people` slug
 * — Attio's filtered-read endpoint. It is NOT a write surface.
 */
export async function fetchAttioPeopleByCompanyId(
  attioCompanyId: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<AttioRecord[]> {
  if (!attioCompanyId) return [];
  const limit = Math.min(
    Math.max(options.limit ?? PEOPLE_PAGE_LIMIT, 1),
    PEOPLE_PAGE_LIMIT,
  );
  try {
    const response = await attioPostQuery<AttioListResponse<AttioRecord>>(
      "/objects/people/records/query",
      {
        filter: {
          company: {
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
      // 400/404 on filter shape mismatch — Attio workspaces sometimes
      // use a different attribute slug than `company`. Treat as "no
      // people found" rather than failing the whole context fetch.
      if (status === 400 || status === 404) return [];
    }
    throw err;
  }
}
