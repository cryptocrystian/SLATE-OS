import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

/**
 * Server-side Supabase client bound to the current request's cookies.
 *
 * Safe to call from:
 *   - server components
 *   - route handlers
 *   - server actions
 *
 * The cookie writers swallow exceptions thrown when called from a server
 * component (Next.js does not allow writes during render); session refresh
 * for those reads still happens in middleware via `lib/supabase/middleware.ts`.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const env = getPublicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component render — middleware refreshes
            // the cookie on the next request.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Same caveat as `set` above.
          }
        },
      },
    },
  );
}
