import { describe, expect, it, mock } from 'bun:test';
let handler: (query: unknown, options: unknown) => Promise<any>;
mock.module('@/lib/cosmic-public', () => ({
  getPublicObjects: (query: unknown, options: unknown) => handler(query, options),
}));
const { buildSearchPageQuery, getSearchPage, searchPageSchema, SEARCH_RESULT_PROPS } = await import(
  '@/lib/search-page'
);
const yesterday = '2026-09-06';
function stubResponse(response: unknown, reject = false) {
  const calls: Record<string, unknown> = {};
  handler = async (query, options) => {
    Object.assign(calls, options, { query });
    if (reject) throw response;
    return response;
  };
  return calls;
}

describe('search pages', () => {
  it('returns a small first batch with only card fields, retaining date and filters', async () => {
    const objects = Array.from({ length: 5 }, (_, id) => ({ id: String(id), title: 'Gilles' }));
    const calls = stubResponse({ objects, total: 100 });
    const params = searchPageSchema.parse({
      searchTerm: 'Gilles',
      genre: ['jazz'],
      host: ['host-id'],
    });
    expect(await getSearchPage(params, yesterday)).toEqual({
      results: objects,
      hasNext: true,
      nextCursor: '4',
    });
    expect(calls.limit).toBe(5);
    expect(calls.props).toBe(SEARCH_RESULT_PROPS);
    expect(String(calls.props)).not.toContain('metadata.player');
    expect(calls.sort).toBe('-metadata.broadcast_date');
    expect(calls.query).toMatchObject({
      status: 'published',
      'metadata.broadcast_date': { $lte: yesterday },
      'metadata.genres': { $in: ['jazz'] },
      'metadata.regular_hosts': { $in: ['host-id'] },
    });
  });
  it('continues from the rendered count without skipping the results after the first five', async () => {
    const objects = Array.from({ length: 20 }, (_, id) => ({ id: String(id + 5) }));
    const calls = stubResponse({ objects, total: 25 });
    expect(
      await getSearchPage(
        searchPageSchema.parse({ offset: 5, limit: 20, after: '123456789012345678901234' }),
        yesterday
      )
    ).toEqual({ results: objects, hasNext: false, nextCursor: '24' });
    expect(calls.after).toBe('123456789012345678901234');
    expect(calls.skip).toBeUndefined();
    expect(calls.limit).toBe(20);
  });
  it('treats a genuine no-match response as empty', async () => {
    stubResponse({ objects: [], total: 0 });
    expect(await getSearchPage(searchPageSchema.parse({}), yesterday)).toEqual({
      results: [],
      hasNext: false,
      nextCursor: null,
    });
  });
  it('propagates upstream failures rather than reporting no matches', async () => {
    stubResponse({ status: 500 }, true);
    expect(getSearchPage(searchPageSchema.parse({}), yesterday)).rejects.toMatchObject({
      status: 500,
    });
  });
  it('shares cache keys for reordered and repeated filters', () => {
    expect(searchPageSchema.parse({ genre: ['b', 'a', 'b'] }).genre).toEqual(['a', 'b']);
  });
  it('does not mask an upstream 404 configuration failure', async () => {
    stubResponse({ status: 404 }, true);
    expect(getSearchPage(searchPageSchema.parse({}), yesterday)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('bounds public requests and rejects unknown types', () => {
    for (const params of [
      { limit: 1000 },
      { offset: -1 },
      { type: 'users' },
      { searchTerm: 'x'.repeat(201) },
      { host: Array(21).fill('a') },
    ])
      expect(searchPageSchema.safeParse(params).success).toBe(false);
  });
  it('preserves the existing host and takeover filter field conventions', () => {
    const base = { genre: ['genre-id'], location: ['location-id'], host: ['host-id'] };
    expect(
      buildSearchPageQuery(searchPageSchema.parse({ ...base, type: 'hosts-series' }), yesterday)
    ).toEqual({
      type: 'regular-hosts',
      status: 'published',
      'metadata.genres': { $in: base.genre },
      'metadata.locations': { $in: base.location },
    });
    expect(
      buildSearchPageQuery(searchPageSchema.parse({ ...base, type: 'takeovers' }), yesterday)
    ).toEqual({
      type: 'takeovers',
      status: 'published',
      'metadata.genre.slug': { $in: base.genre },
      'metadata.location.slug': { $in: base.location },
      'metadata.regular_hosts': { $in: base.host },
    });
  });
  it('uses creation dates for videos with missing publication dates', async () => {
    const calls = stubResponse({ objects: [], total: 0 });
    await getSearchPage(searchPageSchema.parse({ type: 'videos' }), yesterday);
    expect(calls.sort).toBe('-created_at');
  });
  it('sorts editorial by date without applying episode-only filters', async () => {
    const calls = stubResponse({ objects: [], total: 0 });
    await getSearchPage(searchPageSchema.parse({ type: 'posts', genre: ['jazz'] }), yesterday);
    expect(calls.query).toEqual({ type: 'posts', status: 'published' });
    expect(calls.sort).toBe('-metadata.date');
  });
});
