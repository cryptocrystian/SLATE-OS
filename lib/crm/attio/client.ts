import "server-only";

/**
 * Sprint S3-B — Attio API client.
 *
 * Canon: `docs/42_ATTIO_CRM_SYSTEM_OF_RECORD_CANON.md` § 12, § 16.4.
 *
 * Strictly read-only. The client exposes a single GET helper and
 * a small POST-for-query helper (Attio's `/objects/{slug}/records/query`
 * endpoint is a POST despite returning data — it accepts filter bodies).
 * NO write methods. NO PUT / PATCH / DELETE helpers.
 *
 * Token posture:
 *   - Read from `process.env.ATTIO_ACCESS_TOKEN` server-side only.
 *   - Never logged, never returned in error messages, never embedded
 *     in any client-side bundle (this file imports `server-only`).
 *   - Errors raised by the client redact the Authorization header.
 */

import type { AttioSelfResponse } from "./types";

const ATTIO_API_BASE_URL = "https://api.attio.com/v2";

/**
 * Sentinel thrown when ATTIO_ACCESS_TOKEN is missing from the env.
 * Caught higher up so the UI can render the "not-configured" state
 * without surfacing an exception.
 */
export class AttioNotConfiguredError extends Error {
  constructor() {
    super("ATTIO_ACCESS_TOKEN is not configured");
    this.name = "AttioNotConfiguredError";
  }
}

/** Generic Attio API error. Carries HTTP status + sanitized message. */
export class AttioApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  constructor(status: number, endpoint: string, message: string) {
    // Endpoint is included in the message — token never is.
    super(`[attio] ${status} ${endpoint}: ${message}`);
    this.name = "AttioApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

function getToken(): string {
  const token = process.env.ATTIO_ACCESS_TOKEN;
  if (!token || token.trim().length === 0) {
    throw new AttioNotConfiguredError();
  }
  return token.trim();
}

interface RequestOptions {
  /** Optional JSON body for POST endpoints (Attio's `/records/query`). */
  body?: unknown;
  /** Optional Next.js `revalidate` hint; default 0 (no cache). */
  revalidate?: number;
  /** Optional AbortSignal. */
  signal?: AbortSignal;
}

/**
 * Internal request helper. Method defaults to GET; pass `body` to issue
 * a POST. NEVER expose this helper for arbitrary methods — all callers
 * in this module are read-only.
 *
 * Errors:
 *   - 4xx / 5xx → `AttioApiError` with HTTP status and sanitized message.
 *   - Network failure → `AttioApiError` with status `0`.
 *   - Missing token → `AttioNotConfiguredError`.
 */
async function attioRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = getToken();
  const method = options.body === undefined ? "GET" : "POST";

  let response: Response;
  try {
    response = await fetch(`${ATTIO_API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      cache: "no-store",
      // Next.js fetch cache hint — keep CRM context fresh per page load.
      next: { revalidate: options.revalidate ?? 0 },
    });
  } catch (err) {
    // Network-level failure. Suppress token by not including err.message
    // verbatim if it could echo the URL with credentials (it doesn't —
    // we use the Authorization header, not URL-embedded creds — but
    // belt-and-suspenders).
    throw new AttioApiError(
      0,
      endpoint,
      "Network error contacting Attio API.",
    );
  }

  if (!response.ok) {
    // Try to extract Attio's error body for a useful message, but
    // sanitize aggressively. If the body looks like JSON, take the
    // `code` / `message`. Otherwise return a generic message.
    let safeMessage = `HTTP ${response.status}`;
    try {
      const text = await response.text();
      try {
        const parsed = JSON.parse(text) as {
          code?: string;
          message?: string;
          status_code?: number;
        };
        if (parsed.message) {
          safeMessage = String(parsed.message).slice(0, 200);
        } else if (parsed.code) {
          safeMessage = String(parsed.code).slice(0, 200);
        }
      } catch {
        // Not JSON; ignore body to avoid leaking unexpected content.
      }
    } catch {
      // ignore
    }
    throw new AttioApiError(response.status, endpoint, safeMessage);
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Exposed helpers — read-only only
// ---------------------------------------------------------------------------

/** Tiny ping — used by health checks. Returns the workspace metadata. */
export async function getAttioSelf(
  signal?: AbortSignal,
): Promise<AttioSelfResponse> {
  return attioRequest<AttioSelfResponse>("/self", { signal });
}

/** GET helper — exposed so the per-object fetchers (companies, people,
 *  deals, notes) can share the auth + error-sanitization machinery. */
export async function attioGet<T>(
  endpoint: string,
  options: { signal?: AbortSignal; revalidate?: number } = {},
): Promise<T> {
  return attioRequest<T>(endpoint, options);
}

/** POST helper — Attio uses POST `/objects/{slug}/records/query` for
 *  filtered reads. NOT a write surface. */
export async function attioPostQuery<T>(
  endpoint: string,
  body: unknown,
  options: { signal?: AbortSignal; revalidate?: number } = {},
): Promise<T> {
  if (!endpoint.includes("/records/query") && !endpoint.includes("/notes/query")) {
    // Belt-and-suspenders guard: this helper only routes to documented
    // POST-query endpoints. Adding write endpoints requires a canon
    // change in `docs/42` first.
    throw new AttioApiError(
      0,
      endpoint,
      "Disallowed endpoint for POST helper",
    );
  }
  return attioRequest<T>(endpoint, { ...options, body });
}

/** Check whether ATTIO_ACCESS_TOKEN is configured without making a
 *  network call. Used by query layer to short-circuit to
 *  "not-configured" status. */
export function isAttioConfigured(): boolean {
  const token = process.env.ATTIO_ACCESS_TOKEN;
  return typeof token === "string" && token.trim().length > 0;
}
