import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client created with the service role key. Bypasses
 * RLS — must never reach the browser bundle. The `server-only` import
 * makes any accidental client-side import a build-time error.
 *
 * Used by:
 *   - `app/api/scorecard/submit/route.ts` to write a submission + lead
 *     atomically without exposing service role credentials to the client.
 *   - any other server-only Step 2+ writer that needs to bypass RLS.
 *
 * The function reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
 * from `process.env` at call time and throws a controlled error if either
 * is missing. The key itself is never logged.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || url.length === 0 || !key || key.length === 0) {
    throw new Error("Supabase service role not configured");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "X-SLATE-Source": "service-role" },
    },
  });
}
