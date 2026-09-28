import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseEnvConfigured } from "@/lib/env";
import { isAuthorizedOperator } from "@/lib/auth/operator-allowlist";

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
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  // Re-check the operator allowlist after the session exists. A session can
  // be minted outside `signInWithMagicLink` (e.g. a direct Supabase Auth call
  // with the public anon key), so the pre-send check alone is not a control.
  // (docs/74 — platform auth exposure audit.)
  const email = data.user?.email ?? "";
  if (!email || !isAuthorizedOperator(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=unauthorized`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
