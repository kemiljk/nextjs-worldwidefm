/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { uploadMediaToRadioCult } from '@/lib/radiocult-upload';
import { writeMp3Id3v23Metadata } from '@/lib/mp3-utils';

const TAGLESS_MP3 = Buffer.from([
  0xff, 0xfb, 0xe0, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

let mediaServer: ReturnType<typeof Bun.serve>;
let radioCultServer: ReturnType<typeof Bun.serve>;
let mediaServerUrl = '';
let radioCultBaseUrl = '';
let receivedUploads: Array<{ fileName?: string; contentType?: string; bodyLength: number }> = [];
let radioCultAttempts = 0;
let failRadioCultOnce = false;

beforeAll(() => {
  mediaServer = Bun.serve({
    port: 0,
    fetch() {
      return new Response(TAGLESS_MP3, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(TAGLESS_MP3.length),
        },
      });
    },
  });

  mediaServerUrl = `http://127.0.0.1:${mediaServer.port}/audio.mp3`;

  radioCultServer = Bun.serve({
    port: 0,
    async fetch(request) {
      radioCultAttempts += 1;
      const contentType = request.headers.get('content-type') || '';
      const body = Buffer.from(await request.arrayBuffer());

      if (failRadioCultOnce && radioCultAttempts === 1) {
        return new Response('temporary outage', { status: 503 });
      }

      receivedUploads.push({
        contentType,
        bodyLength: body.length,
      });

      return Response.json({ track: { id: 'rc-track-123' } });
    },
  });

  radioCultBaseUrl = `http://127.0.0.1:${radioCultServer.port}`;
});

afterAll(() => {
  mediaServer.stop();
  radioCultServer.stop();
});

describe('uploadMediaToRadioCult', () => {
  it('uploads fetched media and returns the RadioCult media id', async () => {
    receivedUploads = [];
    radioCultAttempts = 0;

    const result = await uploadMediaToRadioCult({
      mediaUrl: mediaServerUrl,
      fileName: 'raw20250729 Test Show.mp3',
      metadata: { title: 'Test Show', artist: 'Worldwide FM' },
      stationId: 'station-1',
      secretKey: 'secret',
      apiBaseUrl: radioCultBaseUrl,
      blobFetchTimeoutMs: 5_000,
      externalUploadTimeoutMs: 5_000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.radiocultMediaId).toBe('rc-track-123');
    }

    expect(receivedUploads.length).toBe(1);
    expect(receivedUploads[0]?.contentType).toContain('multipart/form-data');
    expect(receivedUploads[0]?.bodyLength).toBeGreaterThan(TAGLESS_MP3.length);
  });

  it('retries once after a RadioCult 503 and then succeeds', async () => {
    receivedUploads = [];
    radioCultAttempts = 0;
    failRadioCultOnce = true;

    const result = await uploadMediaToRadioCult({
      mediaUrl: mediaServerUrl,
      fileName: 'retry-show.mp3',
      metadata: { title: 'Retry Show' },
      stationId: 'station-1',
      secretKey: 'secret',
      apiBaseUrl: radioCultBaseUrl,
      blobFetchTimeoutMs: 5_000,
      externalUploadTimeoutMs: 5_000,
    });

    failRadioCultOnce = false;

    expect(result.success).toBe(true);
    expect(radioCultAttempts).toBe(2);
  });

  it('returns structured failure without deleting the source media URL', async () => {
    const failingServer = Bun.serve({
      port: 0,
      fetch() {
        return new Response('nope', { status: 500 });
      },
    });

    const result = await uploadMediaToRadioCult({
      mediaUrl: mediaServerUrl,
      fileName: 'broken.mp3',
      metadata: { title: 'Broken' },
      stationId: 'station-1',
      secretKey: 'secret',
      apiBaseUrl: `http://127.0.0.1:${failingServer.port}`,
      blobFetchTimeoutMs: 5_000,
      externalUploadTimeoutMs: 5_000,
    });

    failingServer.stop();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.mediaUrl).toBe(mediaServerUrl);
      expect(result.error).toContain('RadioCult upload failed');
    }
  });

  it('times out slow RadioCult responses cleanly', async () => {
    const slowServer = Bun.serve({
      port: 0,
      fetch() {
        return new Promise<Response>(() => {
          // Never resolves within the test timeout budget.
        });
      },
    });

    const result = await uploadMediaToRadioCult({
      mediaUrl: mediaServerUrl,
      fileName: 'slow.mp3',
      metadata: { title: 'Slow' },
      stationId: 'station-1',
      secretKey: 'secret',
      apiBaseUrl: `http://127.0.0.1:${slowServer.port}`,
      blobFetchTimeoutMs: 1_000,
      externalUploadTimeoutMs: 50,
    });

    slowServer.stop();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.toLowerCase()).toMatch(/abort|timeout|failed/i);
    }
  });

  it('writes ID3 metadata before upload for MP3 files', async () => {
    const expected = writeMp3Id3v23Metadata(TAGLESS_MP3, {
      title: 'Tagged Show',
      artist: 'Host',
    });

    const result = await uploadMediaToRadioCult({
      file: new Blob([TAGLESS_MP3], { type: 'application/octet-stream' }),
      fileName: 'tagged.mp3',
      metadata: { title: 'Tagged Show', artist: 'Host' },
      stationId: 'station-1',
      secretKey: 'secret',
      apiBaseUrl: radioCultBaseUrl,
      blobFetchTimeoutMs: 5_000,
      externalUploadTimeoutMs: 5_000,
    });

    expect(result.success).toBe(true);
    expect(receivedUploads.at(-1)?.bodyLength).toBeGreaterThanOrEqual(expected.length);
  });
});
