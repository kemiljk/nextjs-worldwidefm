import { beforeEach, expect, mock, test } from 'bun:test';
mock.module('server-only', () => ({}));
let calls: Array<{ query: any; options: any }> = [];
let handler: (query: any, options: any) => Promise<any>;
mock.module('@/lib/cosmic-public', () => ({
  getPublicObjects: (query: any, options: any) => {
    calls.push({ query, options });
    return handler(query, options);
  },
}));
const { getPublicFacet, getSearchFacets } = await import('../lib/public-facets');
beforeEach(() => {
  calls = [];
});

test('search loads only three lean taxonomies without sending options as query filters', async () => {
  handler = async ({ type }) => ({
    objects: [{ id: type, slug: type, title: type, metadata: { unneeded: true } }],
    total: 1,
  });
  const result = await getSearchFacets();
  expect(calls.map(call => call.query.type).sort()).toEqual([
    'genres',
    'locations',
    'regular-hosts',
  ]);
  for (const call of calls) {
    expect(Object.keys(call.query)).toEqual(['type']);
    expect(call.options).toEqual({ props: 'id,slug,title', depth: 0, limit: 1000 });
  }
  expect(result.hosts[0]).toEqual({
    id: 'regular-hosts',
    title: 'regular-hosts',
  });
});
test('paginates large taxonomies rather than silently truncating them', async () => {
  handler = async (_query, options) => ({
    objects: Array.from({ length: options.skip ? 1 : 1000 }, (_, i) => ({
      id: String((options.skip || 0) + i),
      slug: String((options.skip || 0) + i),
      title: String((options.skip || 0) + i),
    })),
    total: 1001,
  });
  expect((await getPublicFacet('genres')).length).toBe(1001);
  expect(calls[1].options.skip).toBe(1000);
});
test('propagates outages so unavailable filters are retryable rather than cached empty', async () => {
  handler = async () => {
    throw new Error('unavailable');
  };
  expect(getPublicFacet('genres')).rejects.toThrow('unavailable');
});
