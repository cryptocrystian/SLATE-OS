/**
 * Safe environment-variable accessors for SLATE.
 *
 * `getPublicEnv()` is for code that must run with Supabase configured (server
 * client, browser client, middleware-on-app-routes). It throws at call time
 * — never at module import time — so `next build` does not crash if env
 * is unset during static analysis.
 *
 * `isSupabaseEnvConfigured()` is for guards that want to degrade gracefully
 * when env is missing (e.g. middleware on public routes, or telling the user
 * to finish .env.local before exercising auth).
 *
 * The service role key is intentionally not exposed by this module. It must
 * only be read inside server-only code that has a clear authorization story
 * (none in Step 0/1). Never prefix it with `NEXT_PUBLIC_`.
 */

function isMissing(value: string | undefined): boolean {
  return value == null || value.length === 0;
}

export interface PublicEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_SITE_URL: string;
}

export function getPublicEnv(): PublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (isMissing(url) || isMissing(anonKey)) {
    throw new Error("Supabase env not configured");
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: url as string,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey as string,
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  };
}

export function isSupabaseEnvConfigured(): boolean {
  return (
    !isMissing(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !isMissing(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
