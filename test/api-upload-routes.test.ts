/// <reference types="bun-types" />
process.env.RESEND_API_KEY = 're_test';

import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import { NextRequest } from 'next/server';

const TAGLESS_MP3 = Buffer.from([
  0xff, 0xfb, 0xe0, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const BLOB_URL = 'https://example.public.blob.vercel-storage.com/media/test.mp3';

let mediaServer: ReturnType<typeof Bun.serve>;
let radioCultServer: ReturnType<typeof Bun.serve>;
let mixcloudServer: ReturnType<typeof Bun.serve>;
let mediaServerUrl = '';
let radioCultBaseUrl = '';
let mixcloudBaseUrl = '';

mock.module('@/lib/blob-client', () => ({
  del: async () => undefined,
  isVercelBlobUrl: (url: string) => url.includes('blob.vercel-storage.com'),
}));

type CosmicUpdate = { id: string; data: { metadata?: Record<string, unknown> } };

const cosmicUpdates: CosmicUpdate[] = [];
let cosmicUpdateShouldFail = false;

mock.module('@/lib/cosmic-config', () => ({
  cosmic: {
    objects: {
      updateOne: async (id: string, data: CosmicUpdate['data']) => {
        if (cosmicUpdateShouldFail) {
          throw new Error('Cosmic rejected the update');
        }
        cosmicUpdates.push({ id, data });
        return { object: { id } };
      },
    },
  },
}));

mock.module('next/cache', () => ({
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}));

beforeAll(() => {
  mediaServer = Bun.serve({
    port: 0,
    fetch(request) {
      if (request.url.includes('/large.mp3')) {
        const large = Buffer.alloc(20 * 1024 * 1024, 0xff);
        large[0] = 0xff;
        large[1] = 0xfb;
        large[2] = 0xe0;
        large[3] = 0x40;
        return new Response(large, {
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': String(large.length),
          },
        });
      }

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
    fetch() {
      return Response.json({ track: { id: 'route-rc-1' } });
    },
  });

  mixcloudServer = Bun.serve({
    port: 0,
    fetch() {
      return Response.json({
        result: {
          success: true,
          key: '/worldwidefm/route-test/',
        },
      });
    },
  });

  radioCultBaseUrl = `http://127.0.0.1:${radioCultServer.port}`;
  mixcloudBaseUrl = `http://127.0.0.1:${mixcloudServer.port}`;

  process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID = 'station-test';
  process.env.RADIOCULT_SECRET_KEY = 'secret-test';
  process.env.MIXCLOUD_ACCESS_TOKEN = 'mixcloud-token';
  process.env.RADIOCULT_API_BASE_URL = radioCultBaseUrl;
  process.env.MIXCLOUD_API_BASE_URL = mixcloudBaseUrl;
});

afterAll(() => {
  mediaServer.stop();
  radioCultServer.stop();
  mixcloudServer.stop();
});

describe('upload API routes', () => {
  it('uploads media through /api/upload-media and returns a RadioCult id', async () => {
    const { POST } = await import('@/app/api/upload-media/route');
    const formData = new FormData();
    formData.append('mediaUrl', mediaServerUrl);
    formData.append('fileName', 'route-test.mp3');
    formData.append('metadata', JSON.stringify({ title: 'Route Test' }));
    formData.append('cleanup', 'false');

    const response = await POST(
      new NextRequest('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData,
      })
    );

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.radiocultMediaId).toBe('route-rc-1');
  });

  // Retrying a 5xx costs a deliberate delay, so this needs more than the default budget.
  it('keeps the blob URL on RadioCult failure', async () => {
    const failingServer = Bun.serve({
      port: 0,
      fetch() {
        return new Response('bad gateway', { status: 502 });
      },
    });

    process.env.RADIOCULT_API_BASE_URL = `http://127.0.0.1:${failingServer.port}`;

    try {
      const { POST } = await import('@/app/api/upload-media/route');

      const formData = new FormData();
      formData.append('mediaUrl', BLOB_URL);
      formData.append('fileName', 'failed.mp3');
      formData.append('metadata', JSON.stringify({ title: 'Failed' }));

      const response = await POST(
        new NextRequest('http://localhost/api/upload-media', {
          method: 'POST',
          body: formData,
        })
      );

      const json = await response.json();

      expect(response.status).toBe(502);
      expect(json.success).toBe(false);
      expect(json.mediaUrl).toBe(BLOB_URL);
    } finally {
      // Restore even on failure, so a later test does not inherit the broken host.
      failingServer.stop();
      process.env.RADIOCULT_API_BASE_URL = radioCultBaseUrl;
    }
  }, 30_000);

  it('keeps RadioCult quota details out of the host-facing response', async () => {
    const quotaServer = Bun.serve({
      port: 0,
      fetch() {
        return Response.json(
          {
            success: false,
            error: "You have exceeded all of your plan's available storage",
          },
          { status: 400 }
        );
      },
    });

    process.env.RADIOCULT_API_BASE_URL = `http://127.0.0.1:${quotaServer.port}`;

    try {
      const { POST } = await import('@/app/api/upload-media/route');
      const formData = new FormData();
      formData.append('mediaUrl', mediaServerUrl);
      formData.append('fileName', 'quota.mp3');
      formData.append('metadata', JSON.stringify({ title: 'Quota' }));

      const response = await POST(
        new NextRequest('http://localhost/api/upload-media', {
          method: 'POST',
          body: formData,
        })
      );
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.failureCode).toBe('storage_full');
      expect(json.error).toBe("We couldn't finish processing your audio automatically.");
      expect(JSON.stringify(json)).not.toContain("plan's available storage");
      expect(json.mediaUrl).toBe(mediaServerUrl);
    } finally {
      quotaServer.stop();
      process.env.RADIOCULT_API_BASE_URL = radioCultBaseUrl;
    }
  });

  it('cleans up a temporary blob when cleanupOnly is set', async () => {
    const { POST } = await import('@/app/api/upload-media/route');
    const formData = new FormData();
    formData.append('mediaUrl', BLOB_URL);
    formData.append('cleanupOnly', 'true');

    const response = await POST(
      new NextRequest('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData,
      })
    );

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.cleaned).toBe(true);
  });

  it('uploads media through /api/upload-mixcloud and resolves a URL', async () => {
    const { POST } = await import('@/app/api/upload-mixcloud/route');
    const formData = new FormData();
    formData.append('mediaUrl', mediaServerUrl);
    formData.append('fileName', 'route-master.mp3');
    formData.append('title', 'Route Master');
    formData.append('tags', JSON.stringify(['WorldWide FM']));

    const response = await POST(
      new NextRequest('http://localhost/api/upload-mixcloud', {
        method: 'POST',
        body: formData,
      })
    );

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.url).toContain('mixcloud.com');
  });

  it('saves the resolved Mixcloud URL onto the episode when an episodeId is sent', async () => {
    cosmicUpdates.length = 0;
    const { POST } = await import('@/app/api/upload-mixcloud/route');
    const formData = new FormData();
    formData.append('mediaUrl', mediaServerUrl);
    formData.append('fileName', 'route-master.mp3');
    formData.append('title', 'Route Master');
    formData.append('episodeId', 'episode-1');
    formData.append('episodeSlug', 'route-master');

    const response = await POST(
      new NextRequest('http://localhost/api/upload-mixcloud', {
        method: 'POST',
        body: formData,
      })
    );

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.episodeUpdated).toBe(true);
    expect(cosmicUpdates).toHaveLength(1);
    expect(cosmicUpdates[0].id).toBe('episode-1');
    expect(cosmicUpdates[0].data.metadata).toEqual({
      player: 'https://www.mixcloud.com/worldwidefm/route-test/',
      page_link: 'https://www.mixcloud.com/worldwidefm/route-test/',
    });
  });

  it('leaves the episode alone when no episodeId is sent', async () => {
    cosmicUpdates.length = 0;
    const { POST } = await import('@/app/api/upload-mixcloud/route');
    const formData = new FormData();
    formData.append('mediaUrl', mediaServerUrl);
    formData.append('fileName', 'route-master.mp3');
    formData.append('title', 'Route Master');

    const response = await POST(
      new NextRequest('http://localhost/api/upload-mixcloud', {
        method: 'POST',
        body: formData,
      })
    );

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.episodeUpdated).toBe(false);
    expect(cosmicUpdates).toHaveLength(0);
  });

  it('still returns the Mixcloud URL when saving it to the episode fails', async () => {
    cosmicUpdates.length = 0;
    cosmicUpdateShouldFail = true;
    const { POST } = await import('@/app/api/upload-mixcloud/route');
    const formData = new FormData();
    formData.append('mediaUrl', mediaServerUrl);
    formData.append('fileName', 'route-master.mp3');
    formData.append('title', 'Route Master');
    formData.append('episodeId', 'episode-1');

    const response = await POST(
      new NextRequest('http://localhost/api/upload-mixcloud', {
        method: 'POST',
        body: formData,
      })
    );

    const json = await response.json();
    cosmicUpdateShouldFail = false;

    expect(response.status).toBe(200);
    expect(json.url).toContain('mixcloud.com');
    expect(json.episodeUpdated).toBe(false);
    expect(json.episodeUpdateError).toContain('Cosmic rejected the update');
  });

  it('handles large media files without failing the route handler', async () => {
    const largeMediaUrl = `http://127.0.0.1:${mediaServer.port}/large.mp3`;
    const { POST } = await import('@/app/api/upload-media/route');
    const formData = new FormData();
    formData.append('mediaUrl', largeMediaUrl);
    formData.append('fileName', 'large.mp3');
    formData.append('metadata', JSON.stringify({ title: 'Large File' }));
    formData.append('cleanup', 'false');

    const response = await POST(
      new NextRequest('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData,
      })
    );

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.radiocultMediaId).toBe('route-rc-1');
  });
});
