"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl, isSupabaseEnvConfigured } from "@/lib/env";
import { isAuthorizedOperator } from "@/lib/auth/operator-allowlist";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send a Supabase magic-link email to an authorized operator. Always
 * redirects:
 *   - `/login?sent=1` on success
 *   - `/login?error=<token>` on validation, allowlist, or Supabase failure
 *
 * Error tokens never leak Supabase internals to the page UI.
 *
 * The allowlist check happens *before* Supabase is called, so unauthorized
 * addresses never trigger an OTP send and don't reveal account existence
 * via Supabase rate-limit timing.
 */
export async function signInWithMagicLink(formData: FormData) {
  const rawEmail = formData.get("email");
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!email) {
    redirect(`/login?error=missing-email`);
  }
  if (!EMAIL_REGEX.test(email)) {
    redirect(`/login?error=invalid-email`);
  }
  if (!isAuthorizedOperator(email)) {
    redirect(`/login?error=unauthorized`);
  }
  if (!isSupabaseEnvConfigured()) {
    redirect(`/login?error=config`);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    logAuthError("signInWithOtp failed", error);
    redirect(`/login?error=auth`);
  }

  redirect(`/login?sent=1`);
}

/**
 * Sign the current operator out and redirect to /login.
 */
export async function signOut() {
  if (!isSupabaseEnvConfigured()) {
    redirect(`/login?error=config`);
  }
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/login`);
}

/**
 * Sanitized server-side error logger. Whitelists only the four fields
 * Supabase exposes about its own response (`name`, `code`, `status`,
 * `message`) — never logs the email, the redirect target, the raw error
 * object, or any field that might carry user/credential metadata.
 */
function logAuthError(prefix: string, error: unknown): void {
  if (error == null || typeof error !== "object") return;
  const e = error as Record<string, unknown>;
  const safe: Record<string, string | number> = {};
  if (typeof e.name === "string") safe.name = e.name;
  if (typeof e.code === "string") safe.code = e.code;
  if (typeof e.status === "number") safe.status = e.status;
  if (typeof e.message === "string") safe.message = e.message;
  // eslint-disable-next-line no-console
  console.error(`[auth] ${prefix}`, safe);
}
