import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createFakeCosmic } from './support/fake-cosmic';

mock.module('server-only', () => ({}));
mock.module('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }));
mock.module('../components/ui/show-card', () => ({
  ShowCard: ({ show }: { show: { title: string } }) => createElement('div', null, show.title),
}));

// Newest first: the most recent broadcasts have not all had their archives added.
const players = [
  undefined,
  null,
  '',
  '   ',
  '/worldwidefm/first/',
  'https://www.mixcloud.com/worldwidefm/second/',
  '/worldwidefm/third/',
  '/worldwidefm/fourth/',
  '/worldwidefm/fifth/',
];
const cosmic = createFakeCosmic(
  players.map((player, index) => ({
    id: String(index),
    type: 'episode',
    slug: `episode-${index}`,
    title: `Episode ${index}`,
    metadata: {
      broadcast_date: new Date(Date.now() - (index + 2) * 86_400_000).toISOString().slice(0, 10),
      ...(player === undefined ? {} : { player }),
    },
  }))
);

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

const { default: LatestEpisodes } = await import('../components/latest-episodes');
const { getEpisodesForShows } = await import('../lib/episode-service');

const shown = (html: string) =>
  players.map((_, index) => `Episode ${index}`).filter(title => html.includes(title));

test('Latest Shows lists only episodes with an archive, skipping missing, null, empty and blank players', async () => {
  const html = renderToStaticMarkup(await LatestEpisodes({ hasHeroItems: true }));
  expect(shown(html)).toEqual(['Episode 4', 'Episode 5', 'Episode 6', 'Episode 7', 'Episode 8']);
});

test('Latest Shows applies its configured limit and offset after filtering', async () => {
  const html = renderToStaticMarkup(
    await LatestEpisodes({ config: { number_of_latest_shows: 2 } })
  );
  expect(shown(html)).toEqual(['Episode 6', 'Episode 7']);
});

test('other sections still list episodes without archives', async () => {
  const response = await getEpisodesForShows({ limit: 20 });
  expect(response.shows.map(show => show.title)).toEqual(players.map((_, i) => `Episode ${i}`));
});
