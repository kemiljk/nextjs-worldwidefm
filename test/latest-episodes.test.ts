import { expect, mock, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Newest first: the recent broadcasts have not all had their archives added.
const episodes = [
  undefined,
  null,
  '',
  '   ',
  '/worldwidefm/first/',
  'https://www.mixcloud.com/worldwidefm/second/',
  '/worldwidefm/third/',
  '/worldwidefm/fourth/',
  '/worldwidefm/fifth/',
].map((player, index) => ({
  id: String(index),
  slug: `episode-${index}`,
  title: `Episode ${index}`,
  metadata: { player, broadcast_date: '2020-01-01' },
}));

mock.module('../lib/cosmic-config', () => ({ cosmic: {} }));
const fetchEpisodes = mock(
  async (query: Record<string, unknown>, limit: number, offset: number) => {
    const playerFilter = query['metadata.player'] as { $regex: string } | undefined;
    const matches = episodes.filter(
      episode =>
        !playerFilter ||
        (typeof episode.metadata.player === 'string' &&
          new RegExp(playerFilter.$regex).test(episode.metadata.player))
    );
    return { objects: matches.slice(offset, offset + limit), total: matches.length };
  }
);
mock.module('../lib/episode-service.server', () => ({ fetchEpisodesFromCosmic: fetchEpisodes }));
mock.module('../components/ui/show-card', () => ({
  ShowCard: ({ show }: { show: { title: string } }) => createElement('div', null, show.title),
}));

const { default: LatestEpisodes } = await import('../components/latest-episodes');
const { getEpisodesForShows } = await import('../lib/episode-service');

test('Latest Shows fills slots from archived episodes, excluding missing, null, empty, and blank players', async () => {
  const html = renderToStaticMarkup(await LatestEpisodes({ hasHeroItems: true }));
  for (let index = 0; index < 4; index++) expect(html).not.toContain(`Episode ${index}`);
  for (let index = 4; index < 9; index++) expect(html).toContain(`Episode ${index}`);
  expect(fetchEpisodes.mock.lastCall?.[0]['metadata.player']).toEqual({ $regex: '\\S' });
});

test('Latest Shows retains its configured limit and offset after filtering', async () => {
  const html = renderToStaticMarkup(
    await LatestEpisodes({ config: { number_of_latest_shows: 2 } })
  );
  expect(html).toContain('Episode 6');
  expect(html).toContain('Episode 7');
  expect(html).not.toContain('Episode 4');
  expect(html).not.toContain('Episode 5');
  expect(html).not.toContain('Episode 8');
  expect(fetchEpisodes.mock.lastCall?.slice(1, 3)).toEqual([2, 2]);
});

test('the unfiltered request used by the hero and other sections still includes shows without archives', async () => {
  const response = await getEpisodesForShows({ limit: 20 });
  expect(response.shows).toEqual(episodes);
  expect(fetchEpisodes.mock.lastCall?.[0]['metadata.player']).toBeUndefined();
});
