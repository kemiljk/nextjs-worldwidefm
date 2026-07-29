/** Vercel serverless route max duration (seconds). */
export const UPLOAD_ROUTE_MAX_DURATION_SEC = 800;

/** Client abort must exceed server max duration so the server can return JSON. */
export const UPLOAD_CLIENT_TIMEOUT_MS = UPLOAD_ROUTE_MAX_DURATION_SEC * 1000 + 40_000;

/** Time allowed to fetch audio from a temporary Vercel Blob URL. */
export const UPLOAD_BLOB_FETCH_TIMEOUT_MS = 120_000;

/** Time allowed for the external RadioCult / Mixcloud upload request. */
export const UPLOAD_EXTERNAL_TIMEOUT_MS = 620_000;

/** Short pause before retrying a failed network / 5xx upload. */
export const UPLOAD_RETRY_DELAY_MS = 2_000;

export const UPLOAD_MAX_RETRIES = 1;

export const DEFAULT_MAX_MEDIA_UPLOAD_MB = 2048;

export function getMaxMediaUploadMb(): number {
  const fromEnv =
    Number(process.env.MAX_MEDIA_UPLOAD_MB) ||
    Number(process.env.NEXT_PUBLIC_MAX_MEDIA_UPLOAD_MB) ||
    DEFAULT_MAX_MEDIA_UPLOAD_MB;

  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_MAX_MEDIA_UPLOAD_MB;
}

export function getRadioCultApiBaseUrl(): string {
  return process.env.RADIOCULT_API_BASE_URL?.trim() || 'https://api.radiocult.fm';
}

export function getMixcloudApiBaseUrl(): string {
  return process.env.MIXCLOUD_API_BASE_URL?.trim() || 'https://api.mixcloud.com';
}
