import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { SlateModule } from "./modules";

/**
 * Durable file store (migration 0025; docs/72 §3.4). SLATE PLATFORM.
 *
 * Files a module must keep beyond an engagement's lifetime (e.g.
 * GovernanceOS evidence). No engagement ownership; sha256 computed here at
 * write time and stored NOT NULL, so a record states exactly which bytes
 * were relied on.
 *
 * TRUST BOUNDARY: service-role only, like lib/assets/*. Callers MUST have
 * already authorised the actor for `workspaceId` (requireWorkspaceMember
 * + their module's own checks) before calling. This module does not
 * re-authorise.
 */

export const DURABLE_FILES_BUCKET = "slate-durable-files";

export function sha256Hex(bytes: Uint8Array | ArrayBuffer): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return createHash("sha256").update(buf).digest("hex");
}

export function durableFilePath(workspaceId: string, module: SlateModule, filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) || "file";
  return `${workspaceId}/${module}/${randomUUID()}/${safe}`;
}

export interface StoreDurableFileInput {
  workspaceId: string;
  module: SlateModule;
  bytes: Uint8Array | ArrayBuffer;
  mimeType: string;
  originalFilename: string;
  uploadedByProfileId: string;
  source?: { kind: "upload" | "input_asset_copy" | "generated"; ref?: string };
}

export interface StoredFile {
  id: string;
  path: string;
  sha256: string;
  sizeBytes: number;
}

export async function storeDurableFile(
  input: StoreDurableFileInput,
): Promise<{ ok: true; file: StoredFile } | { ok: false; error: "upload-failed" | "record-failed" }> {
  const supabase = createSupabaseServiceClient();
  const buf = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
  const sha256 = sha256Hex(buf);
  const path = durableFilePath(input.workspaceId, input.module, input.originalFilename);

  const upload = await supabase.storage
    .from(DURABLE_FILES_BUCKET)
    .upload(path, buf, { contentType: input.mimeType, upsert: false });
  if (upload.error) return { ok: false, error: "upload-failed" };

  const { data, error } = await supabase
    .from("stored_files")
    .insert({
      workspace_id: input.workspaceId,
      owner_module: input.module,
      bucket: DURABLE_FILES_BUCKET,
      path,
      sha256,
      size_bytes: buf.byteLength,
      mime_type: input.mimeType,
      original_filename: input.originalFilename,
      source_kind: input.source?.kind ?? "upload",
      source_ref: input.source?.ref ?? null,
      uploaded_by_profile_id: input.uploadedByProfileId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    // Do not leave an unrecorded object behind.
    await supabase.storage.from(DURABLE_FILES_BUCKET).remove([path]);
    return { ok: false, error: "record-failed" };
  }
  return { ok: true, file: { id: data.id, path, sha256, sizeBytes: buf.byteLength } };
}
