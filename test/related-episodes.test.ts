import { beforeEach, expect, mock, test } from 'bun:test';

let queries: Record<string, any>[] = [];
let responses: Record<string, any[]> = {};
mock.module('../lib/cosmic-config', () => ({
  cosmic: {
    objects: {
      find(query: Record<string, any>) {
        queries.push(query);
        const chain = {
          props: () => chain,
          limit: () => chain,
          sort: () => chain,
          depth: async () => ({
            objects: responses[query['metadata.genres']?.$in?.[0] || 'recent'] || [],
          }),
        };
        return chain;
      },
    },
  },
}));

const { getRelatedEpisodes } = await import('../lib/episode-service');
beforeEach(() => {
  queries = [];
  responses = {};
});

test('uses only matching episodes and reports the genre that matched', async () => {
  responses.jazz = [{ id: 'jazz-show' }];
  responses.recent = [{ id: 'unrelated' }];
  const result = await getRelatedEpisodes('current', 3, [], ['soul', 'jazz'], []);
  expect(result).toEqual({ episodes: [{ id: 'jazz-show' }], matchType: 'genre', genreId: 'jazz' });
  expect(queries.map(query => query['metadata.genres']?.$in)).toEqual([['soul'], ['jazz']]);
});

test('falls back to recent episodes when no genre matches', async () => {
  responses.recent = [{ id: 'recent-show' }];
  const result = await getRelatedEpisodes('current', 3, [], ['soul'], []);
  expect(result).toEqual({ episodes: [{ id: 'recent-show' }], matchType: 'recent' });
  expect(queries.at(-1)?.id).toEqual({ $nin: ['current'] });
});
