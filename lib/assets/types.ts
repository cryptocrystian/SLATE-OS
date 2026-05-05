/**
 * Shared shapes for the asset upload + download surfaces.
 *
 * The browser only ever sees the `PublicUploadResult` / `OperatorAsset`
 * shapes — never `storage_bucket` / `storage_path`, never service-role
 * details, never signed URLs that we did not deliberately mint.
 */

export type AssetUploadSource = "stakeholder" | "operator";

export type AssetUploadError =
  | "invalid-token"
  | "session-expired"
  | "session-not-found"
  | "engagement-not-found"
  | "unauthenticated"
  | "missing-file"
  | "file-too-large"
  | "unsupported-mime"
  | "unsupported-extension"
  | "empty-file"
  | "service-error";

export interface PublicUploadResult {
  ok: true;
  asset: {
    id: string;
    title: string;
    status: string;
    sizeBytes: number;
    mimeType: string;
  };
}

export interface PublicUploadFailure {
  ok: false;
  error: AssetUploadError;
}

export type OperatorAsset = {
  id: string;
  engagementId: string;
  sessionId: string | null;
  title: string;
  originalFilename: string | null;
  assetType: string | null;
  status: string;
  evidenceQuality: string;
  source: AssetUploadSource | null;
  sourceLabel: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
  uploadedAt: string | null;
  uploadedByDisplay: string | null;
  downloadCount: number;
  hasBinary: boolean;
};
