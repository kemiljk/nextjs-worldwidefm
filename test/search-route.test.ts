import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { createFakeCosmic, type FakeCosmicObject } from './support/fake-cosmic';

mock.module('server-only', () => ({}));
mock.module('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }));

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const episode = (
  title: string,
  broadcast_date: string,
  metadata: Record<string, unknown> = {}
): FakeCosmicObject => ({
  id: title,
  type: 'episode',
  slug: title.toLowerCase().replace(/\W+/g, '-'),
  title,
  metadata: { broadcast_date, player: '/worldwidefm/audio/', ...metadata },
});
const cosmic = createFakeCosmic([
  episode('Karl Bos w/ Sam Bhok', daysFromNow(-3), { genres: [{ id: 'jazz', title: 'Jazz' }] }),
  episode('Sam Bhok', daysFromNow(-4)),
  episode('Karl Bos', daysFromNow(-5)),
  episode('Sam Bhok and Karl Bos Live', daysFromNow(3)),
  episode('Gilles Peterson', daysFromNow(-6), { genres: [{ id: 'soul', title: 'Soul' }] }),
  episode('Gilles Peterson Jazz Hour', daysFromNow(-7), {
    genres: [{ id: 'jazz', title: 'Jazz' }],
    regular_hosts: [{ id: 'gilles', title: 'Gilles Peterson' }],
  }),
  episode('Gilles Peterson Jazz Special', daysFromNow(-10), {
    genres: [{ id: 'jazz', title: 'Jazz' }],
  }),
  episode('Clémentine', daysFromNow(-8)),
  episode('fooXbar', daysFromNow(-9)),
]);

const originalFetch = globalThis.fetch;
const env = { ...process.env };
beforeAll(() => {
  process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG = 'test-bucket';
  process.env.COSMIC_READ_KEY = 'test-read-key';
  globalThis.fetch = cosmic.fetch as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  process.env = env;
});

const { GET } = await import('../app/api/search/route');
const { NextRequest } = await import('next/server');

async function search(params: string) {
  const response = await GET(new NextRequest(`https://worldwidefm.test/api/search?${params}`));
  const body = await response.json();
  return {
    status: response.status,
    body,
    titles: (body.results ?? []).map((result: { title: string }) => result.title),
  };
}

test('multi-word searches match words in any order without returning the whole archive', async () => {
  // Before bbdc357 the term was one substring, so this missed the "Karl Bos w/ Sam Bhok"
  // episode. Cosmic also drops $and next to the date filter, which returns every episode.
  const { status, titles } = await search('q=Sam+Bhok+Karl&limit=20');
  expect(status).toBe(200);
  expect(titles).toEqual(['Karl Bos w/ Sam Bhok']);
});

test('searching a name succeeds instead of failing on a regex Cosmic rejects', async () => {
  // Before 7a11c3f the accent pattern sent literal \u escapes and Cosmic returned 500.
  const { status, titles } = await search('q=Gilles&limit=20');
  expect(status).toBe(200);
  expect(titles).toEqual([
    'Gilles Peterson',
    'Gilles Peterson Jazz Hour',
    'Gilles Peterson Jazz Special',
  ]);
});

test('accent-free queries find accented titles', async () => {
  expect((await search('q=Clementine')).titles).toEqual(['Clémentine']);
});

test('search terms are literal text, not regular expressions', async () => {
  const { status, body } = await search('q=foo.bar');
  expect(status).toBe(200);
  expect(body.results).toEqual([]);
});

test('genre and host filters combine with the search term and cards omit audio', async () => {
  expect((await search('q=Gilles&genre=jazz&limit=20')).titles).toEqual([
    'Gilles Peterson Jazz Hour',
    'Gilles Peterson Jazz Special',
  ]);
  const { status, body, titles } = await search('q=Gilles&genre=jazz&host=gilles&limit=20');
  expect(status).toBe(200);
  expect(titles).toEqual(['Gilles Peterson Jazz Hour']);
  expect(body.results[0].metadata.genres).toEqual([{ id: 'jazz', title: 'Jazz' }]);
  expect(body.results[0].metadata.player).toBeUndefined();
});
