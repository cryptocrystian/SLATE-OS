import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { uploadOperatorAsset } from "@/lib/assets/server";
import { describeUploadError } from "@/lib/assets/public";
import type { AssetUploadError } from "@/lib/assets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operator upload endpoint.
 *
 * Authenticated operator only. Accepts multipart/form-data with a
 * `file` field plus optional `title`, `summary`, and `assetType`
 * fields. Returns the new asset id but never the storage path.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const engagementId = params.id;
  if (!engagementId || typeof engagementId !== "string") {
    return jsonError(400, "engagement-not-found");
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
  const title = readText(formData, "title");
  const summary = readText(formData, "summary");
  const assetType = readText(formData, "assetType");

  const arrayBuffer = await file.arrayBuffer();
  const result = await uploadOperatorAsset({
    engagementId,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    bytes: arrayBuffer,
    title,
    summary,
    assetType,
  });

  if (!result.ok) {
    return jsonError(statusForError(result.error), result.error);
  }

  revalidatePath(`/app/engagements/${engagementId}/intake`);
  revalidatePath(`/app/engagements/${engagementId}`);
  return NextResponse.json({ ok: true, assetId: result.assetId });
}

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function jsonError(status: number, error: AssetUploadError): NextResponse {
  return NextResponse.json(
    { ok: false, error, message: describeUploadError(error) },
    { status },
  );
}

function statusForError(error: AssetUploadError): number {
  switch (error) {
    case "unauthenticated":
      return 401;
    case "engagement-not-found":
      return 404;
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
