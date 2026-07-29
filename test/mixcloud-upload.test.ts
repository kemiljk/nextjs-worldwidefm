/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  buildMixcloudPublishDate,
  extractMixcloudUploadLocation,
  parseMixcloudError,
  uploadMediaToMixcloud,
} from '@/lib/mixcloud-upload';

const TAGLESS_MP3 = Buffer.from([
  0xff, 0xfb, 0xe0, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

let mediaServer: ReturnType<typeof Bun.serve>;
let mixcloudServer: ReturnType<typeof Bun.serve>;
let mediaServerUrl = '';
let mixcloudBaseUrl = '';
let receivedAudioLength = 0;

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

  mediaServerUrl = `http://127.0.0.1:${mediaServer.port}/master.mp3`;

  mixcloudServer = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = Buffer.from(await request.arrayBuffer());
      receivedAudioLength = body.length;

      if (request.url.includes('/me/cloudcasts/')) {
        return Response.json({
          data: [{ name: 'Test Show', key: '/worldwidefm/test-show/' }],
        });
      }

      return Response.json({
        result: {
          success: true,
          key: '/worldwidefm/test-show/',
        },
      });
    },
  });

  mixcloudBaseUrl = `http://127.0.0.1:${mixcloudServer.port}`;
});

afterAll(() => {
  mediaServer.stop();
  mixcloudServer.stop();
});

describe('mixcloud upload helpers', () => {
  it('parses Mixcloud error payloads', () => {
    const parsed = parseMixcloudError(
      {
        error: {
          type: 'ValidationError',
          message: 'Invalid publish date',
        },
        details: { publish_date: ['must be in the future'] },
      },
      'Bad Request'
    );

    expect(parsed.message).toBe('Invalid publish date');
    expect(parsed.details).toEqual({ publish_date: ['must be in the future'] });
  });

  it('extracts upload location from nested Mixcloud responses', () => {
    const location = extractMixcloudUploadLocation({
      result: {
        cloudcast: {
          key: '/worldwidefm/show/',
        },
      },
    });

    expect(location.url).toBe('https://www.mixcloud.com/worldwidefm/show/');
  });

  it('builds a future publish date from broadcast metadata', () => {
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 7);

    const publishDate = buildMixcloudPublishDate(
      futureDate.toISOString().slice(0, 10),
      '18:00',
      '120'
    );

    expect(publishDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

describe('uploadMediaToMixcloud', () => {
  it('streams fetched media to Mixcloud and resolves a URL', async () => {
    receivedAudioLength = 0;

    const result = await uploadMediaToMixcloud({
      mediaUrl: mediaServerUrl,
      fileName: 'master.mp3',
      title: 'Test Show',
      description: 'Show description',
      tagsJson: JSON.stringify(['Jazz', 'WorldWide FM']),
      hostsJson: JSON.stringify(['worldwidefm']),
      accessToken: 'token',
      apiBaseUrl: mixcloudBaseUrl,
      blobFetchTimeoutMs: 5_000,
      externalUploadTimeoutMs: 5_000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.url).toContain('mixcloud.com');
    }

    expect(receivedAudioLength).toBeGreaterThan(TAGLESS_MP3.length);
  });

  it('returns structured failure for Mixcloud API errors', async () => {
    const failingServer = Bun.serve({
      port: 0,
      fetch() {
        return Response.json(
          {
            error: {
              message: 'Upload rejected',
            },
          },
          { status: 400 }
        );
      },
    });

    const result = await uploadMediaToMixcloud({
      mediaUrl: mediaServerUrl,
      fileName: 'master.mp3',
      title: 'Broken Show',
      accessToken: 'token',
      apiBaseUrl: `http://127.0.0.1:${failingServer.port}`,
      blobFetchTimeoutMs: 5_000,
      externalUploadTimeoutMs: 5_000,
    });

    failingServer.stop();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Upload rejected');
    }
  });
});
