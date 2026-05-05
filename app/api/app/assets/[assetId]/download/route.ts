import { NextResponse } from "next/server";
import { createOperatorDownloadUrl } from "@/lib/assets/server";
import { describeUploadError } from "@/lib/assets/public";
import type { AssetUploadError } from "@/lib/assets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operator download endpoint. Mints a short-lived (5 min) signed URL
 * scoped to the requested asset and redirects the client to it. The
 * signed URL is never logged.
 */
export async function GET(
  _request: Request,
  { params }: { params: { assetId: string } },
) {
  const result = await createOperatorDownloadUrl(params.assetId);
  if (!result.ok) {
    return jsonError(statusForError(result.error), result.error);
  }
  return NextResponse.redirect(result.signedUrl);
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
    case "service-error":
    default:
      return 500;
  }
}
