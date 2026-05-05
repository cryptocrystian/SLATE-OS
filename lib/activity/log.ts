import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { LogActivityEventInput } from "./types";

/**
 * Best-effort activity logger.
 *
 * Calls from authenticated operator paths use the cookie-bound server
 * client so RLS evaluates with the operator's auth.uid(). Calls from
 * public-server paths (where there is no operator session) opt into
 * the service-role client by setting `viaServiceRole: true`. The raw
 * service-role key is never exposed to the browser — both clients
 * are server-only.
 *
 * Logging never blocks the primary business action: every error is
 * swallowed after a sanitized server-side log. Metadata must be small
 * and safe; we shallow-clone it so callers cannot accidentally pass an
 * object that holds PII or secrets.
 */
export async function logActivityEvent(
  input: LogActivityEventInput,
  options: { viaServiceRole?: boolean } = {},
): Promise<void> {
  try {
    const supabase = options.viaServiceRole
      ? createSupabaseServiceClient()
      : createSupabaseServerClient();

    let workspaceId: string | null = null;
    let actorProfileId: string | null = null;
    let actorUserId: string | null = null;

    if (options.viaServiceRole) {
      // Public-server logger — no operator session. Resolve workspace
      // via the singleton row.
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id")
        .limit(1)
        .maybeSingle<{ id: string }>();
      workspaceId = ws?.id ?? null;
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Caller is not authenticated — skip silently. This protects
        // any code path that calls the logger before the auth gate.
        return;
      }
      actorUserId = user.id;
      actorProfileId = user.id;
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id")
        .limit(1)
        .maybeSingle<{ id: string }>();
      workspaceId = ws?.id ?? null;
    }

    if (!workspaceId) return;

    const safeMetadata = sanitizeMetadata(input.metadata);

    const { error } = await supabase.from("activity_events").insert({
      workspace_id: workspaceId,
      actor_profile_id: actorProfileId,
      actor_user_id: actorUserId,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      engagement_id: input.engagementId ?? null,
      lead_id: input.leadId ?? null,
      account_id: input.accountId ?? null,
      contact_id: input.contactId ?? null,
      title: input.title,
      summary: input.summary ?? null,
      metadata: safeMetadata,
    });
    if (error) {
      console.error("[activity.log] insert-failed", {
        eventType: input.eventType,
        name: error.name,
        code: error.code,
        message: error.message,
      });
    }
  } catch (e) {
    console.error("[activity.log] unexpected", {
      eventType: input.eventType,
      message: e instanceof Error ? e.message : "unknown",
    });
  }
}

const FORBIDDEN_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /apikey/i,
  /api_key/i,
  /service[-_ ]?role/i,
  /authorization/i,
  /cookie/i,
  /email/i,
  /body/i,
  /raw/i,
  /excerpt/i,
];

function sanitizeMetadata(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (count >= 12) break;
    if (FORBIDDEN_KEY_PATTERNS.some((re) => re.test(key))) continue;
    const safeValue = sanitizeValue(value);
    if (safeValue === undefined) continue;
    out[key] = safeValue;
    count += 1;
  }
  return out;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    if (trimmed.length > 200) return `${trimmed.slice(0, 197)}…`;
    return trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const arr = value
      .slice(0, 10)
      .map(sanitizeValue)
      .filter((v) => v !== undefined);
    return arr;
  }
  return undefined;
}
