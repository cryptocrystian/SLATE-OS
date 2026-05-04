import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseEnvConfigured } from "@/lib/env";

/**
 * Supabase magic-link callback. Exchanges the `code` query param for a
 * session, sets auth cookies, and redirects:
 *   - success → `/app`
 *   - failure → `/login?error=callback`
 *
 * The handler intentionally does not surface Supabase error internals.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";
  const safeNext = next.startsWith("/app") ? next : "/app";

  if (!code || !isSupabaseEnvConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
