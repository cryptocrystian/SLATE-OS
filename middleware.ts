import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseEnvConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * SLATE auth middleware.
 *
 * Behavior:
 *   - On `/app/*`: refresh Supabase session and redirect unauthenticated
 *     requests to `/login`.
 *   - On `/login` and `/auth/*`: refresh Supabase session so cookies stay
 *     fresh through the magic-link round trip; never redirect.
 *   - On every other route (`/`, `/scorecard*`, `/apply/*`, etc.): pass
 *     through untouched. Public surfaces stay anonymous.
 *
 * If Supabase env is not configured, `/app/*` redirects to `/login` with a
 * controlled error code — production builds must not crash because auth
 * cannot be exercised.
 */

const APP_PATH = "/app";

function isAppRoute(pathname: string): boolean {
  return pathname === APP_PATH || pathname.startsWith(`${APP_PATH}/`);
}

function needsSessionRefresh(pathname: string): boolean {
  return (
    isAppRoute(pathname) ||
    pathname === "/login" ||
    pathname.startsWith("/auth/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!needsSessionRefresh(pathname)) {
    return NextResponse.next();
  }

  if (!isSupabaseEnvConfigured()) {
    if (isAppRoute(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "?error=config";
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (isAppRoute(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match everything except Next.js internals and common static assets.
    // The handler still gates work via `needsSessionRefresh` above.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.ico$).*)",
  ],
};
