/// <reference types="bun-types" />
import { beforeEach, describe, expect, it, mock } from 'bun:test';

type CosmicUpdate = { id: string; data: { metadata?: Record<string, unknown> } };

const cosmicUpdates: CosmicUpdate[] = [];
let pendingEpisodes: { id: string; slug?: string; metadata?: Record<string, unknown> }[] = [];
let lastFindQuery: Record<string, unknown> | undefined;

mock.module('@/lib/cosmic-config', () => ({
  cosmic: {
    objects: {
      find: (query: Record<string, unknown>) => {
        lastFindQuery = query;
        const chain = {
          props: () => chain,
          limit: () => chain,
          status: async () => {
            if (!pendingEpisodes.length)
              throw Object.assign(new Error('Not found'), { status: 404 });
            return { objects: pendingEpisodes };
          },
        };
        return chain;
      },
      updateOne: async (id: string, data: CosmicUpdate['data']) => {
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

const { mixcloudKeyFromUrl, isMixcloudCloudcastLive, publishPendingMixcloudArchives } =
  await import('@/lib/mixcloud-archive-publisher');

const LIVE_URL = 'https://www.mixcloud.com/worldwidefm/live-show/';
const SCHEDULED_URL = 'https://www.mixcloud.com/worldwidefm/scheduled-show/';

// Mixcloud's public API only returns cloudcasts listeners can play.
const mixcloudApi: typeof fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  if (url.endsWith('/worldwidefm/live-show/')) {
    return Response.json({ key: '/worldwidefm/live-show/', name: 'Live Show' });
  }
  if (url.endsWith('/worldwidefm/broken/')) {
    return new Response('upstream error', { status: 503 });
  }
  return Response.json({ error: { type: 'NotFound' } }, { status: 404 });
}) as typeof fetch;

beforeEach(() => {
  cosmicUpdates.length = 0;
  pendingEpisodes = [];
  lastFindQuery = undefined;
});

describe('mixcloudKeyFromUrl', () => {
  it.each([
    [LIVE_URL, '/worldwidefm/live-show/'],
    ['https://mixcloud.com/worldwidefm/live-show', '/worldwidefm/live-show/'],
    ['https://www.mixcloud.com/worldwidefm/', null],
    ['https://example.com/worldwidefm/live-show/', null],
    ['not a url', null],
  ])('%s → %s', (url, key) => {
    expect(mixcloudKeyFromUrl(url)).toBe(key);
  });
});

describe('isMixcloudCloudcastLive', () => {
  it('is true only when the public API returns the same cloudcast', async () => {
    expect(await isMixcloudCloudcastLive(LIVE_URL, { fetchFn: mixcloudApi })).toBe(true);
    expect(await isMixcloudCloudcastLive(SCHEDULED_URL, { fetchFn: mixcloudApi })).toBe(false);
  });

  it('throws on upstream errors so the URL stays pending for the next run', async () => {
    let message = '';
    try {
      await isMixcloudCloudcastLive('https://www.mixcloud.com/worldwidefm/broken/', {
        fetchFn: mixcloudApi,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('HTTP 503');
  });
});

describe('publishPendingMixcloudArchives', () => {
  it('promotes live cloudcasts to the player and leaves scheduled ones pending', async () => {
    pendingEpisodes = [
      { id: 'live', slug: 'live-show', metadata: { mixcloud_pending_url: LIVE_URL } },
      {
        id: 'scheduled',
        slug: 'scheduled-show',
        metadata: { mixcloud_pending_url: SCHEDULED_URL },
      },
      {
        id: 'broken',
        metadata: { mixcloud_pending_url: 'https://www.mixcloud.com/worldwidefm/broken/' },
      },
    ];

    const result = await publishPendingMixcloudArchives({ fetchFn: mixcloudApi });

    expect(lastFindQuery).toMatchObject({
      type: 'episode',
      'metadata.mixcloud_pending_url': { $regex: '\\S' },
    });
    expect(result.checked).toBe(3);
    expect(result.published).toEqual(['live']);
    expect(result.pending).toEqual(['scheduled']);
    expect(result.failed.map(failure => failure.id)).toEqual(['broken']);
    expect(cosmicUpdates).toEqual([
      {
        id: 'live',
        data: {
          metadata: { player: LIVE_URL, page_link: LIVE_URL, mixcloud_pending_url: '' },
        },
      },
    ]);
  });

  it('does nothing when no episodes are pending', async () => {
    const result = await publishPendingMixcloudArchives({ fetchFn: mixcloudApi });

    expect(result).toEqual({ checked: 0, published: [], pending: [], failed: [] });
    expect(cosmicUpdates).toHaveLength(0);
  });
});
