import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { parseBroadcastDateTime, parseDurationToMinutes } from '@/lib/date-utils';
import { fetchWithRetry } from '@/lib/upload-fetch';
import {
  UPLOAD_BLOB_FETCH_TIMEOUT_MS,
  UPLOAD_EXTERNAL_TIMEOUT_MS,
  getMixcloudApiBaseUrl,
} from '@/lib/upload-config';
import { normalizeAudioMimeType } from '@/lib/radiocult-upload';

export type MixcloudUploadInput = {
  audioFile?: File | null;
  mediaUrl?: string | null;
  fileName?: string | null;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  tagsJson?: string | null;
  hostsJson?: string | null;
  broadcastDate?: string | null;
  broadcastTime?: string | null;
  duration?: string | null;
  accessToken: string;
  apiBaseUrl?: string;
  blobFetchTimeoutMs?: number;
  externalUploadTimeoutMs?: number;
};

export type MixcloudUploadSuccess = {
  success: true;
  url: string;
  key?: string;
};

export type MixcloudUploadFailure = {
  success: false;
  error: string;
  details?: unknown;
  status?: number;
};

export type MixcloudUploadResult = MixcloudUploadSuccess | MixcloudUploadFailure;

type MixcloudUploadResponse = {
  key?: string;
  url?: string;
  result?: {
    success?: boolean;
    key?: string;
    url?: string;
    cloudcast?: {
      key?: string;
      url?: string;
    };
  };
  [k: string]: unknown;
};

type MixcloudErrorResponse = {
  error?: {
    message?: string;
    type?: string;
  };
  details?: Record<string, unknown>;
};

type MixcloudCloudcast = {
  name?: string;
  key?: string;
  url?: string;
};

export async function uploadMediaToMixcloud(
  input: MixcloudUploadInput
): Promise<MixcloudUploadResult> {
  const {
    audioFile,
    mediaUrl,
    fileName: requestedFileName,
    title,
    description,
    imageUrl,
    tagsJson,
    hostsJson,
    broadcastDate,
    broadcastTime,
    duration,
    accessToken,
    apiBaseUrl = getMixcloudApiBaseUrl(),
    blobFetchTimeoutMs = UPLOAD_BLOB_FETCH_TIMEOUT_MS,
    externalUploadTimeoutMs = UPLOAD_EXTERNAL_TIMEOUT_MS,
  } = input;

  if ((!audioFile && !mediaUrl) || !title) {
    return { success: false, error: 'Missing audio file or title' };
  }

  let audioStreamOrBuffer: Readable | Buffer;
  let audioContentType: string;
  let fileName: string;
  let audioSize: number | undefined;

  if (mediaUrl) {
    try {
      const mediaRes = await fetchWithRetry(mediaUrl, { timeoutMs: blobFetchTimeoutMs });
      if (!mediaRes.ok) {
        return {
          success: false,
          error: `Failed to fetch media from URL: ${mediaRes.statusText}`,
        };
      }

      fileName = requestedFileName?.trim() || mediaUrl.split('/').pop() || 'audio.mp3';
      audioContentType = normalizeAudioMimeType(
        fileName,
        mediaRes.headers.get('content-type') || 'audio/mpeg'
      );
      audioSize = Number(mediaRes.headers.get('content-length')) || undefined;

      if (!mediaRes.body) {
        return {
          success: false,
          error: 'Fetched media response did not include a readable body',
        };
      }

      audioStreamOrBuffer = Readable.fromWeb(
        mediaRes.body as unknown as NodeReadableStream<Uint8Array>
      );
    } catch (fetchError) {
      return {
        success: false,
        error: `Failed to fetch media: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
      };
    }
  } else if (audioFile) {
    fileName = requestedFileName?.trim() || audioFile.name || 'audio.mp3';
    audioContentType = normalizeAudioMimeType(fileName, audioFile.type || 'audio/mpeg');
    audioSize = audioFile.size;
    audioStreamOrBuffer = Buffer.from(await audioFile.arrayBuffer());
  } else {
    return { success: false, error: 'Missing audio file' };
  }

  const mcForm = new FormData();
  mcForm.append('mp3', audioStreamOrBuffer, {
    filename: fileName,
    contentType: audioContentType,
    knownLength: audioSize,
  });
  mcForm.append('name', title);

  if (description?.trim()) {
    mcForm.append('description', description.trim());
  }

  const tags = parseTags(tagsJson);
  tags.forEach((tag, index) => {
    mcForm.append(`tags-${index}-tag`, tag);
  });
  mcForm.append('hide_stats', '1');

  const hostUsernames = parseHostUsernames(hostsJson);
  hostUsernames.forEach((username, index) => {
    mcForm.append(`hosts-${index}-username`, username);
  });

  const publishDate = buildMixcloudPublishDate(broadcastDate, broadcastTime, duration);
  if (publishDate) {
    mcForm.append('publish_date', publishDate);
  }

  if (imageUrl?.trim()) {
    try {
      const imgRes = await fetch(imageUrl.trim());
      if (imgRes.ok) {
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
        mcForm.append('picture', imgBuffer, {
          filename: `cover.${ext}`,
          contentType: imgRes.headers.get('content-type') || 'image/jpeg',
        });
      }
    } catch {
      // Image attachment is optional.
    }
  }

  const uploadUrl = new URL(`${apiBaseUrl}/upload/`);
  uploadUrl.searchParams.set('access_token', accessToken);

  try {
    const response = await axios.post<MixcloudUploadResponse | MixcloudErrorResponse | string>(
      uploadUrl.toString(),
      mcForm,
      {
        headers: {
          ...mcForm.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: externalUploadTimeoutMs,
        validateStatus: () => true,
      }
    );

    const mcStatus = response.status;
    const mcData = response.data;

    if (mcStatus < 200 || mcStatus >= 300) {
      const { message, details } = parseMixcloudError(
        mcData as MixcloudErrorResponse | string,
        response.statusText
      );
      return {
        success: false,
        error: `Mixcloud upload failed: ${message}`,
        details,
        status: mcStatus,
      };
    }

    if (!isMixcloudUploadSuccessful(mcData)) {
      return {
        success: false,
        error: 'Mixcloud upload did not return a success response',
        details: mcData,
        status: mcStatus,
      };
    }

    const { key, url } = extractMixcloudUploadLocation(mcData);
    const resolvedUrl =
      url ||
      (key ? buildMixcloudUrlFromKey(key) : undefined) ||
      (await lookupMixcloudCloudcastUrl(accessToken, title, apiBaseUrl)) ||
      buildFallbackMixcloudUrl(title);

    if (!resolvedUrl) {
      return {
        success: false,
        error:
          'Mixcloud accepted the upload but the cloudcast URL could not be determined. Set MIXCLOUD_USERNAME.',
        details: mcData,
        status: mcStatus,
      };
    }

    return {
      success: true,
      url: resolvedUrl,
      key: key || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Mixcloud upload failed',
    };
  }
}

export function isMixcloudUploadSuccessful(
  data: MixcloudUploadResponse | MixcloudErrorResponse | string
): boolean {
  if (typeof data !== 'object' || data === null) return false;

  const response = data as MixcloudUploadResponse;
  if (response.result?.success === true) return true;

  const { key, url } = extractMixcloudUploadLocation(data);
  return Boolean(key || url);
}

export function parseMixcloudError(
  errorData: MixcloudErrorResponse | string,
  statusText: string
): { message: string; details: unknown } {
  if (typeof errorData === 'string') {
    try {
      return parseMixcloudError(JSON.parse(errorData) as MixcloudErrorResponse, statusText);
    } catch {
      return { message: errorData || statusText, details: undefined };
    }
  }

  const detailSummary = summarizeMixcloudDetails(errorData.details);
  const message =
    errorData.error?.message ||
    (errorData.error?.type
      ? `${errorData.error.type}${detailSummary ? `: ${detailSummary}` : ''}`
      : statusText);

  return { message, details: errorData.details };
}

export function extractMixcloudUploadLocation(
  data: MixcloudUploadResponse | MixcloudErrorResponse | string
): { key?: string; url?: string } {
  if (typeof data !== 'object' || data === null) return {};

  const response = data as MixcloudUploadResponse;
  const key = response.key || response.result?.key || response.result?.cloudcast?.key;
  const url =
    response.url ||
    response.result?.url ||
    response.result?.cloudcast?.url ||
    (key ? buildMixcloudUrlFromKey(key) : undefined);

  return { key, url };
}

export function buildMixcloudUrlFromKey(key: string): string {
  return `https://www.mixcloud.com${key.startsWith('/') ? '' : '/'}${key}`;
}

function slugifyMixcloudName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

function buildFallbackMixcloudUrl(title: string): string | undefined {
  const username = process.env.MIXCLOUD_USERNAME?.trim();
  if (!username) return undefined;

  const slug = slugifyMixcloudName(title);
  if (!slug) return undefined;

  return `https://www.mixcloud.com/${username}/${slug}/`;
}

async function lookupMixcloudCloudcastUrl(
  accessToken: string,
  title: string,
  apiBaseUrl: string
): Promise<string | undefined> {
  try {
    const listUrl = new URL(`${apiBaseUrl}/me/cloudcasts/`);
    listUrl.searchParams.set('access_token', accessToken);
    listUrl.searchParams.set('limit', '10');

    const response = await fetch(listUrl.toString());
    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as { data?: MixcloudCloudcast[] };
    const cloudcasts = data.data ?? [];
    const normalizedTitle = title.trim().toLowerCase();

    const exactMatch = cloudcasts.find(
      cloudcast => cloudcast.name?.trim().toLowerCase() === normalizedTitle
    );
    if (exactMatch) {
      return cloudcastToUrl(exactMatch);
    }

    const newest = cloudcasts[0];
    return newest ? cloudcastToUrl(newest) : undefined;
  } catch {
    return undefined;
  }
}

function cloudcastToUrl(cloudcast: MixcloudCloudcast): string | undefined {
  if (cloudcast.url) return cloudcast.url;
  if (cloudcast.key) return buildMixcloudUrlFromKey(cloudcast.key);
  return undefined;
}

function parseHostUsernames(hostsJson: string | null | undefined): string[] {
  if (!hostsJson) return [];

  try {
    const hosts = JSON.parse(hostsJson);
    if (!Array.isArray(hosts)) return [];

    return Array.from(
      new Set(
        hosts
          .filter((host): host is string => typeof host === 'string')
          .map(host => host.trim().replace(/^@/, ''))
          .filter(Boolean)
      )
    ).slice(0, 2);
  } catch {
    return [];
  }
}

export function buildMixcloudPublishDate(
  broadcastDate: string | null | undefined,
  broadcastTime: string | null | undefined,
  duration: string | null | undefined
): string | null {
  if (!broadcastDate?.trim()) return null;

  const start = parseBroadcastDateTime(broadcastDate, broadcastTime?.trim() || '00:00');
  if (!start) return null;

  const durationMinutes = parseDurationToMinutes(duration);
  const publishInstant = new Date(start.getTime() + durationMinutes * 60_000);

  if (publishInstant.getTime() <= Date.now()) return null;

  return publishInstant.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseTags(tagsJson: string | null | undefined): string[] {
  const fallbackTags = ['WorldWide FM'];
  if (!tagsJson) return fallbackTags;

  try {
    const tags = JSON.parse(tagsJson);
    if (!Array.isArray(tags)) return fallbackTags;

    const cleanTags = tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map(normalizeMixcloudTag)
      .filter(Boolean);

    return Array.from(new Set(cleanTags.length > 0 ? cleanTags : fallbackTags)).slice(0, 5);
  } catch {
    return fallbackTags;
  }
}

function normalizeMixcloudTag(tag: string): string {
  return tag
    .replace(/[^a-zA-Z0-9 '&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30);
}

function summarizeMixcloudDetails(details: Record<string, unknown> | undefined): string {
  if (!details) return '';

  const messages = Object.entries(details)
    .flatMap(([field, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0
          ? value.map(message => `${field}: ${String(message)}`)
          : [`${field}: no detail supplied`];
      }

      if (value && typeof value === 'object') {
        return `${field}: ${JSON.stringify(value)}`;
      }

      return `${field}: ${String(value)}`;
    })
    .filter(Boolean);

  return messages.join('; ');
}
