import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logActivityEvent } from "@/lib/activity/log";
import { hashIntakeToken, isPlausibleRawToken } from "@/lib/intake/tokens";
import {
  ENGAGEMENT_DOCUMENTS_BUCKET,
  describeValidationError,
  validateUpload,
} from "./limits";
import { buildStakeholderUploadPath, sanitizeFilename } from "./paths";
import type {
  AssetUploadError,
  PublicUploadFailure,
  PublicUploadResult,
} from "./types";

/**
 * Server-only helper used by the public `/intake/[token]` route to
 * accept a stakeholder-uploaded supporting document.
 *
 * Boundary recap:
 *   - The raw token is hashed and matched against
 *     `stakeholder_intake_sessions.token_hash`. The raw token never
 *     reaches storage paths or activity metadata.
 *   - The bucket is private (Step 10 migration). The browser never
 *     receives a service-role client; this helper runs server-side
 *     only and returns a public-safe result.
 *   - On failure we never leak storage paths, server errors, or
 *     internal engagement details.
 */
export interface PublicUploadInput {
  rawToken: string;
  filename: string;
  mimeType: string;
  size: number;
  bytes: ArrayBuffer | Uint8Array;
}

export type PublicUploadOutcome =
  | PublicUploadResult
  | PublicUploadFailure;

export async function uploadStakeholderAsset(
  input: PublicUploadInput,
): Promise<PublicUploadOutcome> {
  if (!isPlausibleRawToken(input.rawToken)) {
    return fail("invalid-token");
  }

  const validation = validateUpload({
    size: input.size,
    mimeType: input.mimeType,
    filename: input.filename,
  });
  if (!validation.ok) {
    return fail(validation.reason);
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return fail("service-error");
  }

  const tokenHash = hashIntakeToken(input.rawToken);
  const { data: session, error: sessionError } = await supabase
    .from("stakeholder_intake_sessions")
    .select(
      "id, workspace_id, engagement_id, role, stakeholder_name, token_expires_at",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      engagement_id: string;
      role: string | null;
      stakeholder_name: string | null;
      token_expires_at: string | null;
    }>();
  if (sessionError) {
    console.error("[assets.public] session-lookup-failed", {
      name: sessionError.name,
      code: sessionError.code,
      message: sessionError.message,
    });
    return fail("service-error");
  }
  if (!session) {
    return fail("session-not-found");
  }
  if (session.token_expires_at) {
    const expires = new Date(session.token_expires_at);
    if (Number.isFinite(expires.getTime()) && expires.getTime() < Date.now()) {
      return fail("session-expired");
    }
  }

  const safeFilename = sanitizeFilename(input.filename);
  const nowIso = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("input_assets")
    .insert({
      workspace_id: session.workspace_id,
      engagement_id: session.engagement_id,
      session_id: session.id,
      title: safeFilename,
      asset_type: "other",
      source: "stakeholder",
      status: "received",
      evidence_quality: "unverified",
      linked_role: session.role,
      summary: "Stakeholder-uploaded supporting document.",
      original_filename: safeFilename,
      mime_type: input.mimeType,
      size_bytes: input.size,
      uploaded_by_session_id: session.id,
      uploaded_at: nowIso,
      storage_bucket: ENGAGEMENT_DOCUMENTS_BUCKET,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !inserted?.id) {
    console.error("[assets.public] metadata-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return fail("service-error");
  }

  const objectPath = buildStakeholderUploadPath({
    workspaceId: session.workspace_id,
    engagementId: session.engagement_id,
    sessionId: session.id,
    assetId: inserted.id,
    filename: safeFilename,
  });

  const body =
    input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
  const { error: uploadError } = await supabase.storage
    .from(ENGAGEMENT_DOCUMENTS_BUCKET)
    .upload(objectPath, body, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (uploadError) {
    // Roll back the metadata row so the operator workspace doesn't show
    // a phantom "received" asset that has no binary backing it.
    await supabase.from("input_assets").delete().eq("id", inserted.id);
    console.error("[assets.public] storage-upload-failed", {
      name: uploadError.name,
      message: uploadError.message,
    });
    return fail("service-error");
  }

  const { error: linkError } = await supabase
    .from("input_assets")
    .update({ storage_path: objectPath })
    .eq("id", inserted.id);
  if (linkError) {
    console.error("[assets.public] metadata-link-failed", {
      name: linkError.name,
      code: linkError.code,
      message: linkError.message,
    });
    // Best-effort: the binary exists, the metadata exists, only the
    // path link missed. Operator workspace will still surface the row
    // and a future reconciliation pass can patch the path.
  }

  // Best-effort engagement timestamp bump.
  await supabase
    .from("engagements")
    .update({ last_activity_at: nowIso })
    .eq("id", session.engagement_id);

  await logActivityEvent(
    {
      eventType: "input_asset_uploaded",
      entityType: "input_asset",
      entityId: inserted.id,
      engagementId: session.engagement_id,
      title: "Stakeholder uploaded supporting document",
      summary: "A token-gated stakeholder added a supporting input.",
      metadata: {
        mimeType: input.mimeType,
        sizeBytes: input.size,
        source: "stakeholder",
      },
    },
    { viaServiceRole: true },
  );

  return {
    ok: true,
    asset: {
      id: inserted.id,
      title: safeFilename,
      status: "received",
      sizeBytes: input.size,
      mimeType: input.mimeType,
    },
  };
}

function fail(error: AssetUploadError): PublicUploadFailure {
  return { ok: false, error };
}

export function describeUploadError(error: AssetUploadError): string {
  switch (error) {
    case "invalid-token":
    case "session-not-found":
      return "This invite link is no longer valid.";
    case "session-expired":
      return "This invite has expired. Reach out to your engagement contact for a new link.";
    case "missing-file":
      return "Please choose a file to upload.";
    case "file-too-large":
    case "unsupported-mime":
    case "unsupported-extension":
    case "empty-file":
      return describeValidationError(error);
    case "engagement-not-found":
      return "We couldn't find this engagement.";
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "service-error":
    default:
      return "We couldn't accept the upload. Please try again.";
  }
}
