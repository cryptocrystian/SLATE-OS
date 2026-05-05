/**
 * File-size + MIME validation rules for engagement document uploads.
 *
 * Mirrors the bucket-level constraints in
 * `supabase/migrations/0010_file_storage.sql`. The bucket enforces the
 * same limits, but server-side validation runs first so the user sees
 * a controlled error before any storage call is attempted.
 */

export const ENGAGEMENT_DOCUMENTS_BUCKET = "engagement-documents";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
]);

export type FileValidationError =
  | "file-too-large"
  | "unsupported-mime"
  | "unsupported-extension"
  | "empty-file";

export function validateUpload(args: {
  size: number;
  mimeType: string;
  filename: string;
}): { ok: true } | { ok: false; reason: FileValidationError } {
  if (!Number.isFinite(args.size) || args.size <= 0) {
    return { ok: false, reason: "empty-file" };
  }
  if (args.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: "file-too-large" };
  }
  if (!isAllowedMimeType(args.mimeType)) {
    return { ok: false, reason: "unsupported-mime" };
  }
  if (!hasAllowedExtension(args.filename)) {
    return { ok: false, reason: "unsupported-extension" };
  }
  return { ok: true };
}

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

function hasAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  for (const ext of ALLOWED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

export function describeValidationError(reason: FileValidationError): string {
  switch (reason) {
    case "file-too-large":
      return "File is too large. The maximum size is 10 MB.";
    case "unsupported-mime":
      return "Unsupported file type. Allowed types: PDF, Word, Excel, CSV, TXT, PNG, JPG.";
    case "unsupported-extension":
      return "File extension is not allowed.";
    case "empty-file":
      return "The file is empty.";
    default:
      return "We couldn't accept the file.";
  }
}
