import { expect, mock, test } from 'bun:test';
const read = mock(async (_params: unknown) => ({
  shows: [
    {
      slug: 'example',
      title: 'Example',
      metadata: { player: '/worldwidefm/example/', body_text: 'private-to-detail-payload' },
    },
  ],
  total: 21,
  hasNext: true,
}));
mock.module('../lib/episode-service', () => ({ getEpisodesForShows: read }));
const { getPublicEpisodeCards } = await import('../lib/actions/public-episode-cards');

test('public browsing validates bounds before issuing an upstream read', async () => {
  read.mockClear();
  await expect(getPublicEpisodeCards({ limit: 1000 })).rejects.toThrow();
  await expect(getPublicEpisodeCards({ offset: -1 })).rejects.toThrow();
  await expect(getPublicEpisodeCards({ searchTerm: 'x'.repeat(201) })).rejects.toThrow();
  expect(read).not.toHaveBeenCalled();
});

test('equivalent filters share parameters and cards retain playback without article payloads', async () => {
  const response = await getPublicEpisodeCards({ genre: ['b', 'a', 'b'], searchTerm: ' test ' });
  expect(read).toHaveBeenLastCalledWith({
    limit: 20,
    offset: 0,
    genre: ['a', 'b'],
    searchTerm: 'test',
  });
  expect(response.hasNext).toBe(true);
  expect(response.total).toBe(21);
  expect(response.shows[0].url).toBe('https://www.mixcloud.com/worldwidefm/example/');
  expect(JSON.stringify(response)).not.toContain('private-to-detail-payload');
});
