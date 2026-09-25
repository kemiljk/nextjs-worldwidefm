import { describe, expect, it, mock } from 'bun:test';
import { NextRequest } from 'next/server';

mock.module('@/lib/upload-config', () => ({
  UPLOAD_MAX_RETRIES: 1,
  UPLOAD_CLIENT_TIMEOUT_MS: 840000,
  UPLOAD_RETRY_DELAY_MS: 2000,
  UPLOAD_PROVIDER_TIMEOUT_MS: 100,
  UPLOAD_PERSIST_TIMEOUT_MS: 25,
  UPLOAD_CLEANUP_TIMEOUT_MS: 25,
}));
mock.module('@/lib/radiocult-upload', () => ({
  uploadMediaToRadioCult: async () => ({ success: true, radiocultMediaId: 'rc-1' }),
}));
mock.module('@/lib/mixcloud-upload', () => ({
  uploadMediaToMixcloud: async () => ({
    success: true,
    url: 'https://www.mixcloud.com/test/show/',
  }),
}));
mock.module('@/lib/episode-archive', () => ({
  saveMixcloudLinkToEpisode: async () => new Promise(() => {}),
}));
let cleanupSignal: AbortSignal | undefined;
mock.module('@/lib/blob-client', () => ({
  isVercelBlobUrl: () => true,
  del: async (_url: string, options: { abortSignal?: AbortSignal }) => {
    cleanupSignal = options.abortSignal;
    return new Promise(() => {});
  },
}));

const { POST: mixcloud } = await import('@/app/api/upload-mixcloud/route');
const { POST: radiocult } = await import('@/app/api/upload-media/route');

function request(cleanup: boolean) {
  const body = new FormData();
  body.set('mediaUrl', 'https://example.public.blob.vercel-storage.com/audio.mp3');
  body.set('title', 'Show');
  body.set('episodeId', 'episode-1');
  body.set('cleanup', String(cleanup));
  return new NextRequest('http://localhost/api/upload', { method: 'POST', body });
}

describe('route work after a successful upload', () => {
  it('returns the Mixcloud URL when archive persistence times out', async () => {
    process.env.MIXCLOUD_ACCESS_TOKEN = 'test';
    const started = performance.now();
    const response = await mixcloud(request(false));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.url).toBe('https://www.mixcloud.com/test/show/');
    expect(result.episodeUpdated).toBe(false);
    expect(result.episodeUpdateError).toMatch(/timeout/i);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('bounds Mixcloud cleanup even after persistence times out', async () => {
    process.env.MIXCLOUD_ACCESS_TOKEN = 'test';
    const started = performance.now();
    const response = await mixcloud(request(true));
    expect(response.status).toBe(200);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('preserves RadioCult success when cleanup times out', async () => {
    process.env.RADIOCULT_SECRET_KEY = 'test';
    process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID = 'test';
    const started = performance.now();
    const response = await radiocult(request(true));
    expect(await response.json()).toEqual({ success: true, radiocultMediaId: 'rc-1' });
    expect(cleanupSignal?.aborted).toBe(true);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

for (const [name, handler] of [
  ['Mixcloud', mixcloud],
  ['RadioCult', radiocult],
] as const) {
  it(`${name} bounds stalled incoming form parsing`, async () => {
    const incoming = request(false);
    Object.defineProperty(incoming, 'formData', { value: () => new Promise(() => {}) });
    const started = performance.now();
    const response = await handler(incoming);
    expect(response.status).toBe(500);
    expect(performance.now() - started).toBeLessThan(500);
  });
}
