import "server-only";

import { attioGet } from "./client";
import type { AttioRecord, AttioSingletonResponse } from "./types";

/**
 * Sprint S3-B — Attio Companies fetcher (read-only).
 *
 * Canon: `docs/42` § 12.
 *
 * The only entry point is `fetchAttioCompanyById`. Domain rematch is
 * NOT done here per `docs/42` § 9.5 (deterministic lookup via stored
 * `attio_company_id`).
 */

/**
 * Fetch one Attio Company record by its `record_id`. Returns null when
 * Attio returns 404 (record not found / deleted upstream). Throws
 * `AttioApiError` for other failures so the query layer can surface a
 * `fetch-failed` status.
 */
export async function fetchAttioCompanyById(
  attioCompanyId: string,
  signal?: AbortSignal,
): Promise<AttioRecord | null> {
  if (!attioCompanyId) return null;
  try {
    const response = await attioGet<AttioSingletonResponse<AttioRecord>>(
      `/objects/companies/records/${encodeURIComponent(attioCompanyId)}`,
      { signal },
    );
    return response.data ?? null;
  } catch (err) {
    if (err instanceof Error && err.name === "AttioApiError") {
      const status = (err as unknown as { status: number }).status;
      if (status === 404) return null;
    }
    throw err;
  }
}
