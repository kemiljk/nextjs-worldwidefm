import { liveCacheHeaders } from '@/lib/live-cache';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { changedContentTags, contentTags } from '@/lib/content-cache-policy';

mock.module('server-only', () => ({}));
mock.module('next/cache', () => ({
  cacheLife() {},
  cacheTag() {},
  revalidateTag() {},
  revalidatePath() {},
}));
const { getPublicObject, getPublicObjects } = await import('@/lib/cosmic-public');
const originalFetch = globalThis.fetch;
const bucket = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG;
const readKey = process.env.NEXT_PUBLIC_COSMIC_READ_KEY;
let requests: URL[] = [];

beforeEach(() => {
  requests = [];
  process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG = 'test-bucket';
  process.env.NEXT_PUBLIC_COSMIC_READ_KEY = 'test-read-key';
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (bucket === undefined) delete process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG;
  else process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG = bucket;
  if (readKey === undefined) delete process.env.NEXT_PUBLIC_COSMIC_READ_KEY;
  else process.env.NEXT_PUBLIC_COSMIC_READ_KEY = readKey;
});

function respond(body: unknown, status = 200) {
  globalThis.fetch = (async (url: string | URL) => {
    requests.push(new URL(String(url)));
    return Response.json(body, { status });
  }) as typeof fetch;
}

describe('public Cosmic reads', () => {
  it('uses API options separately from filters and forces published status', async () => {
    respond({ objects: [{ type: 'episode', slug: 'test' }], total: 1 });
    await getPublicObject({ slug: 'test', type: 'episode' }, { props: 'slug', depth: 0 });
    const url = requests[0];
    expect(url.searchParams.get('status')).toBe('published');
    expect(JSON.parse(url.searchParams.get('query')!)).toEqual({ slug: 'test', type: 'episode' });
    expect(url.searchParams.get('limit')).toBe('1');
    expect(url.searchParams.get('depth')).toBe('0');
    expect(url.searchParams.get('props')).toBe('slug,type');
  });

  it('does not fetch previews or account collections through the public cache', async () => {
    respond({ objects: [] });
    await expect(getPublicObjects({ type: 'episode', status: 'any' })).rejects.toThrow('Preview');
    await expect(getPublicObjects({ type: 'users' })).rejects.toThrow('Account');
    expect(requests).toHaveLength(0);
  });

  it('rejects account objects fetched by opaque ID', async () => {
    respond({ objects: [{ type: 'users', id: 'private' }] });
    await expect(getPublicObject({ id: 'private' })).rejects.toThrow('Account');
  });

  it('normalizes only a documented empty result into absence', async () => {
    respond({ message: 'No objects found matching the query' }, 404);
    expect(await getPublicObject({ type: 'episode', slug: 'missing' })).toEqual({ object: null });
    respond({ message: 'Bucket not found' }, 404);
    await expect(getPublicObject({ type: 'episode' })).rejects.toThrow('404');
  });

  it('throws refresh failures instead of storing empty content and bounds retries', async () => {
    respond({ message: 'Unavailable' }, 503);
    await expect(getPublicObjects({ type: 'schedule' })).rejects.toThrow('503');
    expect(requests).toHaveLength(2);
  });

  it('rejects malformed successful responses', async () => {
    respond({ unexpected: true });
    await expect(getPublicObjects({ type: 'schedule' })).rejects.toThrow('502');
  });
});

describe('publishing dependencies', () => {
  it('invalidates live data, lists, homepage and the edited episode', () => {
    expect(changedContentTags('episode', 'updated')).toEqual(
      expect.arrayContaining([
        'schedule',
        'homepage',
        'episodes',
        'latest',
        'episode-updated',
        'content-relationships',
      ])
    );
  });
  it('invalidates expanded relationships when a host changes', () => {
    expect(changedContentTags('regular-hosts', 'host')).toContain('content-relationships');
    expect(contentTags('memberships')).toContain('membership');
  });
});

describe('live response edge caching', () => {
  it('limits reuse to five seconds and expires before programme boundaries', () => {
    const now = Date.parse('2026-09-07T10:00:00Z');
    expect(liveCacheHeaders(now, [])['CDN-Cache-Control']).toBe('public, s-maxage=5');
    expect(liveCacheHeaders(now, ['2026-09-07T10:00:02Z'])['CDN-Cache-Control']).toBe(
      'public, s-maxage=2'
    );
    expect(liveCacheHeaders(now, ['2026-09-07T10:00:00Z'])['Cache-Control']).toBe('no-store');
  });
});
