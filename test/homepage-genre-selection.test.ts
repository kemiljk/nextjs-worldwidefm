import { expect, test } from 'bun:test';
import { selectHomepageGenreEpisodes } from '../lib/homepage-genre-selection';

test('selects matching episodes from the shared pool and prefers distinct shows', () => {
  const genres = [
    { id: 'jazz', title: 'Jazz' },
    { id: 'soul', title: 'Soul' },
    { id: 'dub', title: 'Dub' },
  ];
  const episodes = [
    { id: 'both', metadata: { genres: [{ id: 'jazz' }, { id: 'soul' }] } },
    { id: 'soul-only', metadata: { genres: ['soul'] } },
  ];
  expect(selectHomepageGenreEpisodes(genres, episodes)).toEqual({
    Jazz: episodes[0],
    Soul: episodes[1],
  });
});

test('allows an episode to serve multiple genres when there is no alternative', () => {
  const episode = { id: 'both', metadata: { genres: [{ id: 'jazz' }, { id: 'soul' }] } };
  expect(
    selectHomepageGenreEpisodes(
      [
        { id: 'jazz', title: 'Jazz' },
        { id: 'soul', title: 'Soul' },
      ],
      [episode]
    )
  ).toEqual({ Jazz: episode, Soul: episode });
});
