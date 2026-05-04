import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

/**
 * Browser-side Supabase client. Reads only `NEXT_PUBLIC_*` env vars; the
 * service role key is never bundled into client code.
 *
 * Each call returns a fresh client. Most components should not need this —
 * server components and route handlers should prefer the server client. Use
 * the browser client only for client-component flows that genuinely require
 * a user-scoped Supabase request from the browser (none in Step 0/1).
 */
export function createSupabaseBrowserClient() {
  const env = getPublicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
