import { describe, expect, it } from 'bun:test';
import { buildUploadResultSummary, runUploadMasterFlow } from '@/lib/upload-master-flow';
import type { UploadFetchFn } from '@/lib/upload-fetch';

const baseInput = {
  blobUrl: 'https://blob.vercel-storage.com/media/test.mp3',
  mediaFileName: 'master.mp3',
  episodeId: 'episode-1',
  episodeSlug: 'test-episode',
  mixcloudTitle: 'Test Show // 29-07-26',
  mixcloudTags: ['WorldWide FM'],
  mixcloudDescription: 'Description',
  mixcloudHostUsernames: ['worldwidefm'],
  broadcastDate: '2026-07-29',
  broadcastTime: '18:00',
  duration: '120',
  radiocultMetadata: {
    title: 'master',
    artist: 'Host',
  },
  regularHostIds: ['host-1'],
  clientTimeoutMs: 5_000,
};

describe('runUploadMasterFlow', () => {
  it('completes the happy path and cleans up the blob', async () => {
    const calls: string[] = [];
    const fetchFn = createMockFetch({
      mixcloudUrl: 'https://www.mixcloud.com/worldwidefm/test-show/',
      radiocultMediaId: 'rc-1',
      onCall: url => calls.push(url),
    });

    const result = await runUploadMasterFlow({
      ...baseInput,
      fetchFn,
    });

    expect(result.mixcloudUrl).toContain('mixcloud.com');
    expect(result.radiocultMediaId).toBe('rc-1');
    expect(result.archiveUpdated).toBe(true);
    expect(result.shouldCleanupBlob).toBe(true);
    expect(calls).toEqual([
      '/api/upload-mixcloud',
      '/api/upload-media',
      '/api/episodes/episode-1/archive',
      '/api/upload-media',
    ]);
  });

  it('continues to RadioCult and archive when Mixcloud fails', async () => {
    const fetchFn = createMockFetch({
      mixcloudError: true,
      radiocultMediaId: 'rc-2',
    });

    const result = await runUploadMasterFlow({
      ...baseInput,
      fetchFn,
    });

    expect(result.mixcloudError).toBeTruthy();
    expect(result.radiocultMediaId).toBe('rc-2');
    expect(result.archiveUpdated).toBe(true);
    expect(result.shouldCleanupBlob).toBe(false);
    expect(result.mixcloudUrl).toBeUndefined();
  });

  it('keeps the blob and reports both destination failures', async () => {
    const fetchFn = createMockFetch({
      mixcloudError: true,
      radiocultError: true,
      archiveError: true,
    });

    const result = await runUploadMasterFlow({
      ...baseInput,
      fetchFn,
    });

    expect(result.hasAnySuccess).toBe(false);
    expect(result.shouldCleanupBlob).toBe(false);
    expect(buildUploadResultSummary(result)).toContain('Raw audio kept at');
  });
});

function createMockFetch(options: {
  mixcloudUrl?: string;
  mixcloudError?: boolean;
  radiocultMediaId?: string;
  radiocultError?: boolean;
  archiveError?: boolean;
  onCall?: (url: string) => void;
}): UploadFetchFn {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    options.onCall?.(url);

    if (url.includes('/api/upload-mixcloud')) {
      if (options.mixcloudError) {
        return new Response(JSON.stringify({ error: 'Mixcloud upload failed' }), { status: 502 });
      }

      return new Response(JSON.stringify({ url: options.mixcloudUrl }), { status: 200 });
    }

    if (url.includes('/api/upload-media')) {
      const body = init?.body;
      if (body instanceof FormData && body.get('cleanupOnly') === 'true') {
        return new Response(JSON.stringify({ success: true, cleaned: true }), { status: 200 });
      }

      if (options.radiocultError) {
        return new Response(JSON.stringify({ success: false, error: 'RadioCult upload failed' }), {
          status: 502,
        });
      }

      return new Response(
        JSON.stringify({ success: true, radiocultMediaId: options.radiocultMediaId || 'rc-default' }),
        { status: 200 }
      );
    }

    if (url.includes('/archive')) {
      if (options.archiveError) {
        return new Response(JSON.stringify({ error: 'Archive failed' }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response('not found', { status: 404 });
  };
}
