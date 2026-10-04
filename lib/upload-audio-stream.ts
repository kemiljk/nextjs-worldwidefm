import { setTimeout as delay } from 'node:timers/promises';
import { Readable } from 'node:stream';
import { isRetryableUploadError, remainingUploadTime, withUploadTimeout } from '@/lib/upload-fetch';
import { UPLOAD_MAX_RETRIES, UPLOAD_RETRY_DELAY_MS } from '@/lib/upload-config';

/** A single-use source. Only a small prefix and the current network chunk are retained. */
export async function openUploadAudio(input: {
  mediaUrl?: string | null;
  file?: Blob | null;
  deadline: number;
  readTimeoutMs: number;
  signal: AbortSignal;
}) {
  const { mediaUrl, file, deadline, readTimeoutMs, signal } = input;
  let body: ReadableStream<Uint8Array>;
  let size: number | undefined;
  let contentType: string;
  if (mediaUrl) {
    let response: Response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await withUploadTimeout(
          timeoutSignal =>
            fetch(mediaUrl, {
              signal: AbortSignal.any([signal, timeoutSignal]),
              // Next's patched fetch must not cache or clone a large response body.
              cache: 'no-store',
            }),
          remainingUploadTime(deadline, readTimeoutMs),
          signal
        );
        if (response.status < 500 || attempt >= UPLOAD_MAX_RETRIES) break;
        await response.body?.cancel();
      } catch (error) {
        // Only fetching headers is replayed here; no provider POST has started yet.
        if (attempt >= UPLOAD_MAX_RETRIES || signal.aborted || !isRetryableUploadError(error))
          throw error;
      }
      await withUploadTimeout(
        () => delay(UPLOAD_RETRY_DELAY_MS),
        remainingUploadTime(deadline),
        signal
      );
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(`Failed to fetch media from URL: ${response.status} ${response.statusText}`);
    }
    body = response.body;
    const length = response.headers.get('content-length');
    // fetch decodes compressed responses, so their wire length is not the audio length.
    if (length && !response.headers.get('content-encoding') && /^\d+$/.test(length)) {
      const parsed = Number(length);
      if (Number.isSafeInteger(parsed)) size = parsed;
    }
    contentType = response.headers.get('content-type') || 'audio/mpeg';
  } else if (file) {
    body = file.stream();
    size = file.size;
    contentType = file.type || 'audio/mpeg';
  } else {
    throw new Error('Missing audio file');
  }

  const reader = body.getReader();
  let pending = new Uint8Array(0) as Uint8Array;
  let received = 0;
  let ended = false;
  async function next() {
    if (pending.length || ended) return;
    const chunk = await withUploadTimeout(
      () => reader.read(),
      remainingUploadTime(deadline, readTimeoutMs),
      signal
    );
    if (chunk.done) {
      ended = true;
      if (size !== undefined && received !== size)
        throw new Error('Audio source ended before its declared length');
    } else {
      received += chunk.value.byteLength;
      if (size !== undefined && received > size)
        throw new Error('Audio source exceeded its declared length');
      pending = chunk.value;
    }
  }
  async function read(length: number) {
    const parts: Uint8Array[] = [];
    let count = 0;
    while (count < length) {
      await next();
      if (ended) break;
      const n = Math.min(length - count, pending.length);
      parts.push(pending.subarray(0, n));
      pending = pending.subarray(n);
      count += n;
    }
    return Buffer.concat(parts, count);
  }
  async function skip(length: number) {
    while (length > 0) {
      await next();
      if (ended) break;
      const n = Math.min(length, pending.length);
      pending = pending.subarray(n);
      length -= n;
    }
    if (length > 0) throw new Error('Audio source ended inside its ID3 tag');
  }
  function stream(prefix: Uint8Array[]) {
    return Readable.from(
      (async function* () {
        for (const chunk of prefix) if (chunk.length) yield chunk;
        while (!ended) {
          await next();
          if (pending.length) {
            const chunk = pending;
            pending = new Uint8Array(0);
            yield chunk;
          }
        }
      })(),
      { objectMode: false, highWaterMark: 64 * 1024 }
    );
  }
  return {
    size,
    contentType,
    read,
    skip,
    stream,
    close: async () => {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    },
  };
}
