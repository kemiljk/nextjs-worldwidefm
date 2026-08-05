import { inspectMp3Structure, writeMp3Id3v23Metadata } from '@/lib/mp3-utils';
import { fetchWithRetry } from '@/lib/upload-fetch';
import {
  UPLOAD_BLOB_FETCH_TIMEOUT_MS,
  UPLOAD_EXTERNAL_TIMEOUT_MS,
  getRadioCultApiBaseUrl,
} from '@/lib/upload-config';
import { buildMediaMetadataTitle } from '@/lib/upload-filename-utils';

export type RadioCultUploadInput = {
  mediaUrl?: string;
  file?: File | Blob;
  fileName?: string;
  metadata?: Record<string, string>;
  stationId: string;
  secretKey: string;
  apiBaseUrl?: string;
  blobFetchTimeoutMs?: number;
  externalUploadTimeoutMs?: number;
};

export type RadioCultUploadSuccess = {
  success: true;
  radiocultMediaId: string;
  mp3Diagnostics?: ReturnType<typeof inspectMp3Structure>;
};

export type RadioCultUploadFailure = {
  success: false;
  error: string;
  radiocultError?: string;
  mediaUrl?: string;
  mp3Diagnostics?: ReturnType<typeof inspectMp3Structure>;
  status?: number;
};

export type RadioCultUploadResult = RadioCultUploadSuccess | RadioCultUploadFailure;

export function normalizeAudioMimeType(fileName: string, originalType: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'ogg') return 'audio/ogg';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4';
  if (ext === 'flac') return 'audio/flac';
  if (
    !originalType ||
    originalType === 'application/octet-stream' ||
    originalType === 'audio/mp3'
  ) {
    return 'audio/mpeg';
  }

  return originalType;
}

export async function uploadMediaToRadioCult(
  input: RadioCultUploadInput
): Promise<RadioCultUploadResult> {
  const {
    mediaUrl,
    file,
    fileName: requestedFileName,
    metadata = {},
    stationId,
    secretKey,
    apiBaseUrl = getRadioCultApiBaseUrl(),
    blobFetchTimeoutMs = UPLOAD_BLOB_FETCH_TIMEOUT_MS,
    externalUploadTimeoutMs = UPLOAD_EXTERNAL_TIMEOUT_MS,
  } = input;

  if (!file && !mediaUrl) {
    return { success: false, error: 'No file or mediaUrl provided' };
  }

  let finalFile: File | Blob;
  let finalFileName: string;
  let finalFileType: string;

  if (mediaUrl) {
    try {
      const res = await fetchWithRetry(mediaUrl, { timeoutMs: blobFetchTimeoutMs });
      if (!res.ok) {
        return {
          success: false,
          error: `Failed to fetch media from URL: ${res.statusText}`,
          mediaUrl,
        };
      }

      const blob = await res.blob();
      finalFile = blob;
      finalFileType = blob.type || 'audio/mpeg';
      finalFileName = resolveFileName(mediaUrl, requestedFileName);
    } catch (fetchError) {
      return {
        success: false,
        error: `Failed to fetch media: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
        mediaUrl,
      };
    }
  } else if (file) {
    finalFile = file;
    finalFileName = requestedFileName?.trim() || (file instanceof File ? file.name : 'media-file');
    finalFileType = file.type || 'audio/mpeg';
  } else {
    return { success: false, error: 'No file or mediaUrl provided' };
  }

  const ext = finalFileName.split('.').pop()?.toLowerCase();
  finalFileType = normalizeAudioMimeType(finalFileName, finalFileType);

  const arrayBuffer = await finalFile.arrayBuffer();
  let buffer = Buffer.from(arrayBuffer);

  let mp3Diagnostics: ReturnType<typeof inspectMp3Structure> | undefined;
  if (ext === 'mp3' || finalFileName.toLowerCase().endsWith('.mp3')) {
    try {
      mp3Diagnostics = inspectMp3Structure(buffer);
    } catch {
      // Non-blocking diagnostics only.
    }

    const title = metadata.title?.trim() || buildMediaMetadataTitle(finalFileName);
    buffer = Buffer.from(
      writeMp3Id3v23Metadata(buffer, {
        title,
        artist: metadata.artist,
      })
    );
  }

  const fileBlob = new Blob([buffer], { type: finalFileType });
  buffer = Buffer.alloc(0);

  const rcForm = new FormData();
  rcForm.append('stationMedia', fileBlob, finalFileName);
  rcForm.append('metadata', JSON.stringify(metadata));

  try {
    const rcRes = await fetchWithRetry(`${apiBaseUrl}/api/station/${stationId}/media/track`, {
      method: 'POST',
      headers: { 'x-api-key': secretKey },
      body: rcForm,
      timeoutMs: externalUploadTimeoutMs,
    });

    if (!rcRes.ok) {
      const rcErrorText = await rcRes.text();
      return {
        success: false,
        error: `RadioCult upload failed: ${rcErrorText}`,
        radiocultError: rcErrorText,
        mediaUrl,
        mp3Diagnostics,
        status: rcRes.status,
      };
    }

    const rcJson = (await rcRes.json()) as { track?: { id?: string } };
    const radiocultMediaId = rcJson.track?.id;

    if (!radiocultMediaId) {
      return {
        success: false,
        error: 'RadioCult did not return a media ID',
        mediaUrl,
        mp3Diagnostics,
        status: rcRes.status,
      };
    }

    return {
      success: true,
      radiocultMediaId,
      mp3Diagnostics,
    };
  } catch (rcError) {
    return {
      success: false,
      error: rcError instanceof Error ? rcError.message : 'Unknown upload error',
      mediaUrl,
      mp3Diagnostics,
    };
  }
}

function resolveFileName(mediaUrl: string, requestedFileName?: string | null): string {
  if (requestedFileName?.trim()) {
    return requestedFileName.trim();
  }

  try {
    const url = new URL(mediaUrl);
    return url.pathname.split('/').pop() || 'media-file';
  } catch {
    return 'media-file';
  }
}
