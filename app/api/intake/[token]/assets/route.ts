import { NextResponse } from "next/server";
import { uploadStakeholderAsset } from "@/lib/assets/public";
import { describeUploadError } from "@/lib/assets/public";
import type { AssetUploadError } from "@/lib/assets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public stakeholder upload endpoint.
 *
 * Accepts a multipart/form-data POST containing a single `file` field.
 * Validates the raw token, file size, and MIME type before reaching
 * any storage helper. Never returns the storage path or a signed URL.
 */
export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  const rawToken = params.token;
  if (!rawToken || typeof rawToken !== "string") {
    return jsonError(400, "invalid-token");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "missing-file");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "missing-file");
  }

  const arrayBuffer = await file.arrayBuffer();
  const result = await uploadStakeholderAsset({
    rawToken,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    bytes: arrayBuffer,
  });

  if (!result.ok) {
    return jsonError(statusForError(result.error), result.error);
  }
  return NextResponse.json({ ok: true, asset: result.asset });
}

function jsonError(status: number, error: AssetUploadError): NextResponse {
  return NextResponse.json(
    { ok: false, error, message: describeUploadError(error) },
    { status },
  );
}

function statusForError(error: AssetUploadError): number {
  switch (error) {
    case "invalid-token":
    case "session-not-found":
      return 404;
    case "session-expired":
      return 410;
    case "missing-file":
    case "empty-file":
    case "file-too-large":
    case "unsupported-mime":
    case "unsupported-extension":
      return 400;
    case "service-error":
    default:
      return 500;
  }
}
