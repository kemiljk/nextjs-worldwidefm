import { afterEach, beforeAll, afterAll, expect, mock, test } from 'bun:test';
import { createFakeCosmic, type FakeCosmicObject } from './support/fake-cosmic';

mock.module('server-only', () => ({}));
mock.module('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }));

const term = (type: string, id: string): FakeCosmicObject => ({
  id,
  type,
  slug: id,
  title: id.toUpperCase(),
  metadata: { description: 'not needed by filters' },
});
const cosmic = createFakeCosmic([
  ...Array.from({ length: 1001 }, (_, i) => term('genres', `genre-${i}`)),
  term('regular-hosts', 'host'),
  term('locations', 'london'),
  term('episode', 'episode'),
]);

const originalFetch = globalThis.fetch;
const env = { ...process.env };
beforeAll(() => {
  process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG = 'test-bucket';
  process.env.COSMIC_READ_KEY = 'test-read-key';
});
afterEach(() => {
  globalThis.fetch = cosmic.fetch as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  process.env = env;
});
globalThis.fetch = cosmic.fetch as typeof fetch;

const { getPublicFacet, getSearchFacets } = await import('../lib/public-facets');

test('search filters list every genre, host and location as id and title', async () => {
  const facets = await getSearchFacets();
  expect(facets.genres).toHaveLength(1001);
  expect(facets.genres).toContainEqual({ id: 'genre-1000', title: 'GENRE-1000' });
  expect(facets.hosts).toEqual([{ id: 'host', title: 'HOST' }]);
  expect(facets.locations).toEqual([{ id: 'london', title: 'LONDON' }]);
});

test('taxonomies beyond one Cosmic page are not truncated', async () => {
  const genres = await getPublicFacet('genres');
  expect(new Set(genres.map(genre => genre.id)).size).toBe(1001);
});

test('an outage rejects instead of caching empty filters', async () => {
  globalThis.fetch = (async () =>
    Response.json({ message: 'unavailable' }, { status: 503 })) as unknown as typeof fetch;
  await expect(getPublicFacet('genres')).rejects.toThrow();
});
