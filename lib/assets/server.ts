import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logActivityEvent } from "@/lib/activity/log";
import {
  ENGAGEMENT_DOCUMENTS_BUCKET,
  validateUpload,
} from "./limits";
import { buildOperatorUploadPath, sanitizeFilename } from "./paths";
import type { AssetUploadError, OperatorAsset } from "./types";

/**
 * Server-only helpers for the operator-facing upload + download flow.
 *
 * Operator paths run under the cookie-bound authenticated server
 * client so RLS evaluates with `auth.uid()`. Storage uploads + signed
 * URL minting use the service-role client because Supabase Storage
 * does not currently expose anon-equivalent grants for private buckets
 * via the authenticated server client; the boundary is enforced one
 * level up by the operator-only `auth.getUser()` short-circuit.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

const SIGNED_URL_TTL_SECONDS = 5 * 60;

export interface OperatorUploadInput {
  engagementId: string;
  filename: string;
  mimeType: string;
  size: number;
  bytes: ArrayBuffer | Uint8Array;
  /** Optional human-readable title; defaults to the safe filename. */
  title?: string;
  summary?: string;
  assetType?: string;
}

export type OperatorUploadResult =
  | { ok: true; assetId: string }
  | { ok: false; error: AssetUploadError };

export async function uploadOperatorAsset(
  input: OperatorUploadInput,
): Promise<OperatorUploadResult> {
  if (!isUuid(input.engagementId)) {
    return { ok: false, error: "engagement-not-found" };
  }
  const validation = validateUpload({
    size: input.size,
    mimeType: input.mimeType,
    filename: input.filename,
  });
  if (!validation.ok) {
    return { ok: false, error: validation.reason };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", input.engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    console.error("[assets.server] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagement?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  const safeFilename = sanitizeFilename(input.filename);
  const title = input.title?.trim() || safeFilename;
  const summary =
    input.summary?.trim() || "Operator-uploaded supporting document.";
  const assetType = input.assetType?.trim() || "other";
  const nowIso = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("input_assets")
    .insert({
      workspace_id: engagement.workspace_id,
      engagement_id: engagement.id,
      title,
      asset_type: assetType,
      source: "operator",
      status: "received",
      evidence_quality: "adequate",
      summary,
      original_filename: safeFilename,
      mime_type: input.mimeType,
      size_bytes: input.size,
      uploaded_by_profile_id: user.id,
      uploaded_by_user_id: user.id,
      uploaded_at: nowIso,
      storage_bucket: ENGAGEMENT_DOCUMENTS_BUCKET,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !inserted?.id) {
    console.error("[assets.server] metadata-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  const objectPath = buildOperatorUploadPath({
    workspaceId: engagement.workspace_id,
    engagementId: engagement.id,
    assetId: inserted.id,
    filename: safeFilename,
  });

  let storage;
  try {
    storage = createSupabaseServiceClient();
  } catch {
    await supabase.from("input_assets").delete().eq("id", inserted.id);
    return { ok: false, error: "service-error" };
  }

  const body =
    input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
  const { error: uploadError } = await storage.storage
    .from(ENGAGEMENT_DOCUMENTS_BUCKET)
    .upload(objectPath, body, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (uploadError) {
    await supabase.from("input_assets").delete().eq("id", inserted.id);
    console.error("[assets.server] storage-upload-failed", {
      name: uploadError.name,
      message: uploadError.message,
    });
    return { ok: false, error: "service-error" };
  }

  const { error: linkError } = await supabase
    .from("input_assets")
    .update({ storage_path: objectPath })
    .eq("id", inserted.id);
  if (linkError) {
    console.error("[assets.server] metadata-link-failed", {
      name: linkError.name,
      code: linkError.code,
      message: linkError.message,
    });
  }

  await supabase
    .from("engagements")
    .update({ last_activity_at: nowIso })
    .eq("id", engagement.id);

  await logActivityEvent({
    eventType: "input_asset_uploaded",
    entityType: "input_asset",
    entityId: inserted.id,
    engagementId: engagement.id,
    title: "Operator uploaded supporting document",
    summary: "An operator uploaded an internal supporting input.",
    metadata: {
      mimeType: input.mimeType,
      sizeBytes: input.size,
      source: "operator",
    },
  });

  return { ok: true, assetId: inserted.id };
}

export type OperatorDownloadResult =
  | { ok: true; signedUrl: string; expiresInSeconds: number; filename: string }
  | { ok: false; error: AssetUploadError };

export async function createOperatorDownloadUrl(
  assetId: string,
): Promise<OperatorDownloadResult> {
  if (!isUuid(assetId)) {
    return { ok: false, error: "engagement-not-found" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: asset, error: assetError } = await supabase
    .from("input_assets")
    .select(
      "id, engagement_id, storage_bucket, storage_path, original_filename, download_count",
    )
    .eq("id", assetId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      storage_bucket: string | null;
      storage_path: string | null;
      original_filename: string | null;
      download_count: number | null;
    }>();
  if (assetError) {
    console.error("[assets.server] asset-lookup-failed", {
      name: assetError.name,
      code: assetError.code,
      message: assetError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!asset?.id || !asset.storage_path) {
    return { ok: false, error: "engagement-not-found" };
  }

  let storage;
  try {
    storage = createSupabaseServiceClient();
  } catch {
    return { ok: false, error: "service-error" };
  }

  const { data: signed, error: signedError } = await storage.storage
    .from(asset.storage_bucket ?? ENGAGEMENT_DOCUMENTS_BUCKET)
    .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: asset.original_filename ?? undefined,
    });
  if (signedError || !signed?.signedUrl) {
    console.error("[assets.server] signed-url-failed", {
      name: signedError?.name,
      message: signedError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  // Best-effort: bump download counters. RLS allows the operator to
  // update; if the update fails we still return the signed URL.
  await supabase
    .from("input_assets")
    .update({
      download_count: (asset.download_count ?? 0) + 1,
      last_downloaded_at: new Date().toISOString(),
    })
    .eq("id", asset.id);

  await logActivityEvent({
    eventType: "input_asset_downloaded",
    entityType: "input_asset",
    entityId: asset.id,
    engagementId: asset.engagement_id,
    title: "Supporting document downloaded",
    summary: "An operator generated a short-lived signed download URL.",
    metadata: { ttlSeconds: SIGNED_URL_TTL_SECONDS },
  });

  return {
    ok: true,
    signedUrl: signed.signedUrl,
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    filename: asset.original_filename ?? "download",
  };
}

export async function getOperatorAssetsForEngagement(
  engagementId: string,
): Promise<OperatorAsset[]> {
  if (!isUuid(engagementId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("input_assets")
    .select(
      `
        id,
        engagement_id,
        session_id,
        title,
        original_filename,
        asset_type,
        status,
        evidence_quality,
        source,
        mime_type,
        size_bytes,
        uploaded_at,
        download_count,
        storage_path,
        uploaded_by_profile_id,
        uploaded_by_session_id
      `,
    )
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[assets.server] list-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows =
    (data as Array<{
      id: string;
      engagement_id: string;
      session_id: string | null;
      title: string;
      original_filename: string | null;
      asset_type: string | null;
      status: string | null;
      evidence_quality: string | null;
      source: string | null;
      mime_type: string | null;
      size_bytes: number | null;
      uploaded_at: string | null;
      download_count: number | null;
      storage_path: string | null;
      uploaded_by_profile_id: string | null;
      uploaded_by_session_id: string | null;
    }>) ?? [];
  if (rows.length === 0) return [];

  const profileIds = Array.from(
    new Set(
      rows
        .map((r) => r.uploaded_by_profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const sessionIds = Array.from(
    new Set(
      rows
        .map((r) => r.uploaded_by_session_id ?? r.session_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const profileLookup: Record<string, { display_name: string | null }> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", profileIds);
    for (const p of (profiles as Array<{
      id: string;
      display_name: string | null;
    }> | null) ?? []) {
      profileLookup[p.id] = { display_name: p.display_name };
    }
  }
  const sessionLookup: Record<string, { stakeholder_name: string | null }> = {};
  if (sessionIds.length > 0) {
    const { data: sessions } = await supabase
      .from("stakeholder_intake_sessions")
      .select("id, stakeholder_name")
      .in("id", sessionIds);
    for (const s of (sessions as Array<{
      id: string;
      stakeholder_name: string | null;
    }> | null) ?? []) {
      sessionLookup[s.id] = { stakeholder_name: s.stakeholder_name };
    }
  }

  return rows.map<OperatorAsset>((row) => {
    const source = row.source === "stakeholder" || row.source === "operator"
      ? row.source
      : null;
    const sourceLabel =
      source === "operator"
        ? row.uploaded_by_profile_id
          ? (profileLookup[row.uploaded_by_profile_id]?.display_name ?? "Operator")
          : "Operator"
        : source === "stakeholder"
          ? row.uploaded_by_session_id
            ? (sessionLookup[row.uploaded_by_session_id]?.stakeholder_name ?? "Stakeholder")
            : "Stakeholder"
          : null;
    const uploadedByDisplay =
      source === "operator" && row.uploaded_by_profile_id
        ? (profileLookup[row.uploaded_by_profile_id]?.display_name ?? null)
        : null;
    return {
      id: row.id,
      engagementId: row.engagement_id,
      sessionId: row.session_id,
      title: row.title,
      originalFilename: row.original_filename,
      assetType: row.asset_type,
      status: row.status ?? "requested",
      evidenceQuality: row.evidence_quality ?? "unverified",
      source,
      sourceLabel,
      sizeBytes: row.size_bytes,
      mimeType: row.mime_type,
      uploadedAt: row.uploaded_at,
      uploadedByDisplay,
      downloadCount: row.download_count ?? 0,
      hasBinary: Boolean(row.storage_path),
    };
  });
}
