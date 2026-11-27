import { beforeEach, describe, expect, it, mock } from 'bun:test';

mock.module('server-only', () => ({}));

let calls: Record<string, unknown>[] = [];
let respond: () => Promise<{ shows: unknown[]; total: number; hasNext: boolean }>;

mock.module('@/lib/episode-service', () => ({
  getEpisodesForShows: async (params: Record<string, unknown>) => {
    calls.push(params);
    return respond();
  },
}));

const { fetchShowsByLocation } = await import('@/lib/actions/location-selector');

const episode = (slug: string) => ({
  id: `id-${slug}`,
  slug,
  title: slug,
  created_at: '2026-01-01T00:00:00.000Z',
  metadata: { broadcast_date: '2026-01-01', genres: [], regular_hosts: [], locations: [] },
});

describe('fetchShowsByLocation', () => {
  beforeEach(() => {
    calls = [];
  });

  it('asks for random, playable shows from the chosen location', async () => {
    respond = async () => ({ shows: [episode('a'), episode('b')], total: 2, hasNext: false });

    const result = await fetchShowsByLocation('loc-1', 10);

    expect(calls[0]).toMatchObject({
      location: ['loc-1'],
      random: true,
      listenBackOnly: true,
      limit: 10,
    });
    expect(result.isEmpty).toBe(false);
    expect(result.shows.map(show => show.slug)).toEqual(['a', 'b']);
  });

  it('reports a location with no archived shows as empty, not as an error', async () => {
    respond = async () => ({ shows: [], total: 0, hasNext: false });
    expect(await fetchShowsByLocation('loc-2')).toEqual({ shows: [], isEmpty: true });

    respond = async () => {
      throw Object.assign(new Error('No objects found'), { status: 404 });
    };
    expect(await fetchShowsByLocation('loc-3')).toEqual({ shows: [], isEmpty: true });
  });

  it('flags a real failure so the page can say so', async () => {
    respond = async () => {
      throw new Error('Cosmic unavailable');
    };
    const originalError = console.error;
    console.error = () => undefined;
    const result = await fetchShowsByLocation('loc-4');
    console.error = originalError;

    expect(result).toMatchObject({ shows: [], isEmpty: false, failed: true });
  });

  it('caps the page size and ignores an empty id', async () => {
    respond = async () => ({ shows: [], total: 0, hasNext: false });
    await fetchShowsByLocation('loc-5', 500);
    expect(calls[0].limit).toBe(20);

    calls = [];
    expect(await fetchShowsByLocation('')).toEqual({ shows: [], isEmpty: true });
    expect(calls).toHaveLength(0);
  });
});
