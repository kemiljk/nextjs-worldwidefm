import { setTimeout as delay } from 'node:timers/promises';
import axios from 'axios';
import FormData from 'form-data';
import { openUploadAudio } from '@/lib/upload-audio-stream';
import {
  buildId3v23Tag,
  ID3V2_HEADER_LENGTH,
  inspectMp3Structure,
  readId3v2TagLength,
} from '@/lib/mp3-utils';
import { uploadAttemptLogger, withUploadTimeout, remainingUploadTime } from '@/lib/upload-fetch';
import {
  UPLOAD_MAX_RETRIES,
  UPLOAD_RETRY_DELAY_MS,
  UPLOAD_PROVIDER_TIMEOUT_MS,
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
  deadline?: number;
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
  const deadline = input.deadline ?? performance.now() + UPLOAD_PROVIDER_TIMEOUT_MS;
  try {
    return await withUploadTimeout(
      signal => performRadioCultUpload({ ...input, deadline, signal }),
      remainingUploadTime(deadline)
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
      mediaUrl: input.mediaUrl,
    };
  }
}

async function performRadioCultUpload(
  input: RadioCultUploadInput & { deadline: number; signal: AbortSignal }
): Promise<RadioCultUploadResult> {
  const {
    mediaUrl,
    file,
    metadata = {},
    stationId,
    secretKey,
    deadline,
    signal,
    apiBaseUrl = getRadioCultApiBaseUrl(),
    blobFetchTimeoutMs = UPLOAD_BLOB_FETCH_TIMEOUT_MS,
    externalUploadTimeoutMs = UPLOAD_EXTERNAL_TIMEOUT_MS,
  } = input;
  if (!file && !mediaUrl) return { success: false, error: 'No file or mediaUrl provided' };
  const fileName = mediaUrl
    ? resolveFileName(mediaUrl, input.fileName)
    : input.fileName?.trim() || (file instanceof File ? file.name : 'media-file');
  const logAttempt = uploadAttemptLogger('RadioCult', 'upload');
  // One budget covers every attempt, including fetching and streaming the source.
  const uploadDeadline = Math.min(deadline, performance.now() + externalUploadTimeoutMs);
  for (let attempt = 0; ; attempt++) {
    logAttempt(attempt + 1);
    const source = await openUploadAudio({
      mediaUrl,
      file,
      deadline: uploadDeadline,
      readTimeoutMs: blobFetchTimeoutMs,
      signal,
    });
    let stream: ReturnType<typeof source.stream> | undefined;
    let mp3Diagnostics: ReturnType<typeof inspectMp3Structure> | undefined;
    let response;
    try {
      const prefix = await source.read(ID3V2_HEADER_LENGTH);
      const parts: Uint8Array[] = [prefix];
      let length = source.size;
      if (fileName.toLowerCase().endsWith('.mp3')) {
        const tag = buildId3v23Tag({
          title: metadata.title?.trim() || buildMediaMetadataTitle(fileName),
          artist: metadata.artist,
        });
        if (tag) {
          const skip = readId3v2TagLength(prefix, source.size ?? Infinity);
          if (skip) await source.skip(skip - prefix.length);
          const audioHead = await source.read(64);
          // Inspect the original header and audio separately without buffering the old tag.
          if (source.size !== undefined) {
            mp3Diagnostics = {
              ...inspectMp3Structure(Buffer.concat([prefix, audioHead]), source.size),
              hasMpegFrameSync: inspectMp3Structure(
                skip ? audioHead : Buffer.concat([prefix, audioHead])
              ).hasMpegFrameSync,
            };
          }
          parts.splice(0, parts.length, tag, ...(skip ? [] : [prefix]), audioHead);
          if (length !== undefined) length += tag.length - skip;
        }
      }
      stream = source.stream(parts);
      const form = new FormData();
      form.append('stationMedia', stream, {
        filename: fileName,
        contentType: normalizeAudioMimeType(fileName, source.contentType),
        ...(length === undefined ? {} : { knownLength: length }),
      });
      form.append('metadata', JSON.stringify(metadata));
      response = await withUploadTimeout(
        timeoutSignal =>
          axios.post<string>(`${apiBaseUrl}/api/station/${stationId}/media/track`, form, {
            headers: {
              ...form.getHeaders(),
              ...(form.hasKnownLength() ? { 'Content-Length': String(form.getLengthSync()) } : {}),
              'x-api-key': secretKey,
            },
            // Redirect replay retains the whole upload. Provider endpoints must be direct.
            adapter: 'http',
            maxRedirects: 0,
            maxBodyLength: Infinity,
            maxContentLength: 1024 * 1024,
            responseType: 'text',
            transformResponse: [data => data],
            signal: timeoutSignal,
            timeout: remainingUploadTime(uploadDeadline),
            validateStatus: () => true,
          }),
        remainingUploadTime(uploadDeadline),
        signal
      );
    } finally {
      stream?.destroy();
      await source.close();
    }
    const status = response.status;
    if (status >= 500 && attempt < UPLOAD_MAX_RETRIES) {
      await withUploadTimeout(
        () => delay(UPLOAD_RETRY_DELAY_MS),
        remainingUploadTime(uploadDeadline),
        signal
      );
      continue;
    }
    if (status < 200 || status >= 300)
      return {
        success: false,
        error: `RadioCult upload failed: ${response.data}`,
        radiocultError: response.data,
        mediaUrl,
        mp3Diagnostics,
        status,
      };
    const data = JSON.parse(response.data) as { track?: { id?: string } };
    if (!data.track?.id)
      return {
        success: false,
        error: 'RadioCult did not return a media ID',
        mediaUrl,
        mp3Diagnostics,
        status,
      };
    return { success: true, radiocultMediaId: data.track.id, mp3Diagnostics };
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
