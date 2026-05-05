/**
 * Deterministic, non-PII storage path helpers for the
 * `engagement-documents` bucket.
 *
 * Layout:
 *   workspaces/<workspace_id>/engagements/<engagement_id>/sessions/<session_id>/<asset_id>/<safe_filename>
 *   workspaces/<workspace_id>/engagements/<engagement_id>/operator/<asset_id>/<safe_filename>
 *
 * The `asset_id` segment guarantees uniqueness even when two operators
 * upload identically-named files. Filenames are sanitized to ASCII
 * + a small set of safe punctuation so the storage layer never has to
 * deal with arbitrary unicode or path-traversal characters.
 */

const MAX_FILENAME_LENGTH = 96;
const FALLBACK_FILENAME = "upload";

export function sanitizeFilename(input: string): string {
  if (!input) return FALLBACK_FILENAME;
  const last = input.split(/[\\/]/).pop() ?? input;
  const cleaned = last
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "")
    .toLowerCase();
  const trimmed = cleaned.slice(0, MAX_FILENAME_LENGTH);
  return trimmed.length > 0 ? trimmed : FALLBACK_FILENAME;
}

export interface StakeholderUploadPathArgs {
  workspaceId: string;
  engagementId: string;
  sessionId: string;
  assetId: string;
  filename: string;
}

export function buildStakeholderUploadPath(
  args: StakeholderUploadPathArgs,
): string {
  return [
    "workspaces",
    args.workspaceId,
    "engagements",
    args.engagementId,
    "sessions",
    args.sessionId,
    args.assetId,
    sanitizeFilename(args.filename),
  ].join("/");
}

export interface OperatorUploadPathArgs {
  workspaceId: string;
  engagementId: string;
  assetId: string;
  filename: string;
}

export function buildOperatorUploadPath(
  args: OperatorUploadPathArgs,
): string {
  return [
    "workspaces",
    args.workspaceId,
    "engagements",
    args.engagementId,
    "operator",
    args.assetId,
    sanitizeFilename(args.filename),
  ].join("/");
}
