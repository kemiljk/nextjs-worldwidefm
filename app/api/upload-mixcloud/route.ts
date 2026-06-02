import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { del, isVercelBlobUrl } from '@/lib/blob-client';
import { parseBroadcastDateTime, parseDurationToMinutes } from '@/lib/date-utils';

export const maxDuration = 300;
const MIXCLOUD_UPLOAD_TIMEOUT_MS = 4.5 * 60 * 1000;

function getAudioMimeType(fileName: string, originalType: string): string {
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

export async function POST(request: NextRequest) {
  let mediaUrlForCleanup: string | undefined;
  let shouldCleanupMediaUrl = false;
  const requestAbortController = new AbortController();
  const requestTimeoutId = setTimeout(
    () => requestAbortController.abort(),
    MIXCLOUD_UPLOAD_TIMEOUT_MS
  );

  try {
    const accessToken = process.env.MIXCLOUD_ACCESS_TOKEN;

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const mediaUrl = formData.get('mediaUrl') as string | null;
    const requestedFileName = formData.get('fileName') as string | null;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const imageUrl = formData.get('imageUrl') as string | null;
    const tagsJson = formData.get('tags') as string | null;
    const broadcastDate = formData.get('broadcastDate') as string | null;
    const broadcastTime = formData.get('broadcastTime') as string | null;
    const duration = formData.get('duration') as string | null;
    shouldCleanupMediaUrl = formData.get('cleanup') === 'true';
    mediaUrlForCleanup = mediaUrl || undefined;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Mixcloud not configured (MIXCLOUD_ACCESS_TOKEN)' },
        { status: 503 }
      );
    }

    if ((!audioFile && !mediaUrl) || !title) {
      return NextResponse.json({ error: 'Missing audio file or title' }, { status: 400 });
    }

    let audioStreamOrBuffer: Readable | Buffer;
    let audioContentType: string;
    let fileName: string;
    let audioSize: number | undefined;

    if (mediaUrl) {
      try {
        const mediaRes = await fetch(mediaUrl, { signal: requestAbortController.signal });

        if (!mediaRes.ok) {
          throw new Error(`Failed to fetch media from URL: ${mediaRes.statusText}`);
        }

        fileName = requestedFileName?.trim() || mediaUrl.split('/').pop() || 'audio.mp3';
        audioContentType = getAudioMimeType(
          fileName,
          mediaRes.headers.get('content-type') || 'audio/mpeg'
        );
        audioSize = Number(mediaRes.headers.get('content-length')) || undefined;

        if (!mediaRes.body) {
          throw new Error('Fetched media response did not include a readable body');
        }

        audioStreamOrBuffer = Readable.fromWeb(
          mediaRes.body as unknown as NodeReadableStream<Uint8Array>
        );
      } catch (fetchError) {
        return NextResponse.json(
          {
            error: `Failed to fetch media: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
          },
          { status: 400 }
        );
      }
    } else if (audioFile) {
      fileName = requestedFileName?.trim() || audioFile.name || 'audio.mp3';
      audioContentType = getAudioMimeType(fileName, audioFile.type || 'audio/mpeg');
      audioSize = audioFile.size;
      audioStreamOrBuffer = Buffer.from(await audioFile.arrayBuffer());
    } else {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
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

    const publishDate = buildMixcloudPublishDate(broadcastDate, broadcastTime, duration);
    if (publishDate) {
      mcForm.append('publish_date', publishDate);
      console.log('Scheduling Mixcloud upload for', publishDate);
    } else {
      console.log('No future broadcast time; upload will land in Mixcloud drafts');
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
      } catch (imgErr) {
        console.warn('Could not attach image to Mixcloud upload:', imgErr);
      }
    }

    const uploadUrl = new URL('https://api.mixcloud.com/upload/');
    uploadUrl.searchParams.set('access_token', accessToken);

    let mcStatus: number;
    let mcStatusText: string;
    let mcData: MixcloudUploadResponse | MixcloudErrorResponse | string;
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
          signal: requestAbortController.signal,
          timeout: MIXCLOUD_UPLOAD_TIMEOUT_MS,
          validateStatus: () => true,
        }
      );

      mcStatus = response.status;
      mcStatusText = response.statusText;
      mcData = response.data;
    } finally {
      clearTimeout(requestTimeoutId);
    }

    if (mcStatus < 200 || mcStatus >= 300) {
      console.error('Mixcloud upload failed:', mcStatus, mcData);
      const { message, details } = parseMixcloudError(
        mcData as MixcloudErrorResponse | string,
        mcStatusText
      );

      return NextResponse.json(
        {
          error: `Mixcloud upload failed: ${message}`,
          details,
        },
        { status: 502 }
      );
    }

    const { key, url } = extractMixcloudUploadLocation(mcData);

    if (!url && !key) {
      console.error('Mixcloud upload success response missing URL/key:', mcData);
      return NextResponse.json(
        {
          error: 'Mixcloud accepted the upload but did not return a URL or key',
          details: mcData,
        },
        { status: 502 }
      );
    }

    console.log('✅ Mixcloud upload SUCCESS:', { url, key, fileName });

    return NextResponse.json({
      url: url || (key ? `https://www.mixcloud.com/${key}` : ''),
      key: key || undefined,
    });
  } catch (error) {
    console.error('Mixcloud upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mixcloud upload failed' },
      { status: 500 }
    );
  } finally {
    clearTimeout(requestTimeoutId);
    if (shouldCleanupMediaUrl && mediaUrlForCleanup && isVercelBlobUrl(mediaUrlForCleanup)) {
      try {
        await del(mediaUrlForCleanup);
      } catch (cleanupError) {
        console.error('Failed to delete temporary Mixcloud upload blob:', cleanupError);
      }
    }
  }
}

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

function parseMixcloudError(
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

function extractMixcloudUploadLocation(
  data: MixcloudUploadResponse | MixcloudErrorResponse | string
): { key?: string; url?: string } {
  if (typeof data !== 'object' || data === null) return {};

  const response = data as MixcloudUploadResponse;
  const key = response.key || response.result?.key || response.result?.cloudcast?.key;
  const url =
    response.url ||
    response.result?.url ||
    response.result?.cloudcast?.url ||
    (key ? `https://www.mixcloud.com${key.startsWith('/') ? '' : '/'}${key}` : undefined);

  return { key, url };
}

/**
 * Mixcloud schedules an upload (rather than dropping it in Drafts) only when a future
 * `publish_date` is supplied in UTC as `YYYY-MM-DDTHH:MM:SSZ`. Broadcast time is stored as
 * Europe/London wall time, so we convert via parseBroadcastDateTime and drop milliseconds.
 * The show should go public when it finishes airing, so we publish at start + duration.
 * Past instants are ignored by Mixcloud, so we omit the field entirely in that case.
 */
function buildMixcloudPublishDate(
  broadcastDate: string | null,
  broadcastTime: string | null,
  duration: string | null
): string | null {
  if (!broadcastDate?.trim()) return null;

  const start = parseBroadcastDateTime(broadcastDate, broadcastTime?.trim() || '00:00');
  if (!start) return null;

  const durationMinutes = parseDurationToMinutes(duration);
  const publishInstant = new Date(start.getTime() + durationMinutes * 60_000);

  if (publishInstant.getTime() <= Date.now()) return null;

  return publishInstant.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseTags(tagsJson: string | null): string[] {
  const fallbackTags = ['Radio'];
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
