"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl, isSupabaseEnvConfigured } from "@/lib/env";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send a Supabase magic-link email to the operator. Always redirects:
 *   - `/login?sent=1` on success
 *   - `/login?error=<token>` on validation or Supabase failure
 *
 * Error tokens never leak Supabase internals to the page UI.
 */
export async function signInWithMagicLink(formData: FormData) {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

  if (!email) {
    redirect(`/login?error=missing-email`);
  }
  if (!EMAIL_REGEX.test(email)) {
    redirect(`/login?error=invalid-email`);
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
