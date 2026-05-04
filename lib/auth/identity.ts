import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseEnvConfigured } from "@/lib/env";
import type { SidebarIdentity } from "@/components/layout/sidebar-nav";

interface ProfileRow {
  display_name: string | null;
  title: string | null;
  avatar_initials: string | null;
}

interface OperatorContext {
  email: string;
  profile: ProfileRow | null;
}

/**
 * Resolve the authenticated operator's display identity for the sidebar
 * tile, with safe fallbacks at every level so the layout never crashes:
 *
 *   1. profiles row exists → display_name / title / avatar_initials.
 *   2. auth user only → email + derived initials.
 *   3. no session or no env → unauthenticated placeholder. Middleware
 *      will already have redirected to /login in this case; this branch
 *      only protects the layout against a transient race.
 */
export async function getOperatorIdentity(): Promise<SidebarIdentity> {
  const ctx = await loadOperator();
  if (!ctx) return PLACEHOLDER_IDENTITY;

  const { email, profile } = ctx;
  const displayName =
    nonEmpty(profile?.display_name) ?? nonEmpty(email) ?? "Operator";
  const subtitle = nonEmpty(profile?.title) ?? "Saipien Labs";
  const initials =
    nonEmpty(profile?.avatar_initials) ?? deriveInitials(displayName, email);

  return {
    initials,
    displayName,
    subtitle,
    authenticated: true,
  };
}

async function loadOperator(): Promise<OperatorContext | null> {
  if (!isSupabaseEnvConfigured()) return null;
  try {
    const supabase = createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name, title, avatar_initials")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    return { email: user.email ?? "", profile: profileData ?? null };
  } catch {
    return null;
  }
}

const PLACEHOLDER_IDENTITY: SidebarIdentity = {
  initials: "··",
  displayName: "Operator",
  subtitle: "Saipien Labs",
  authenticated: false,
};

function nonEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Best-effort initials derivation. Always returns 1–2 uppercase chars and
 * never throws on malformed input.
 */
function deriveInitials(displayName: string, email: string): string {
  const fromName = initialsFromWords(displayName);
  if (fromName) return fromName;

  const localPart = email.split("@")[0] ?? "";
  const fromEmail = initialsFromWords(localPart.replace(/[._-]+/g, " "));
  if (fromEmail) return fromEmail;

  const firstChar = (displayName + email).trim().charAt(0).toUpperCase();
  return firstChar || "··";
}

function initialsFromWords(input: string): string | null {
  const tokens = input
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  const first = tokens[0]?.charAt(0) ?? "";
  const last = tokens.length > 1 ? tokens[tokens.length - 1]!.charAt(0) : "";
  const initials = (first + last).toUpperCase();
  return initials.length > 0 ? initials : null;
}
