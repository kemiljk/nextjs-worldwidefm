import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
const tags: string[] = [];
const paths: string[] = [];
mock.module('next/cache', () => ({
  revalidateTag: (tag: string) => tags.push(tag),
  revalidatePath: (path: string) => paths.push(path),
}));
mock.module('next/navigation', () => ({ unstable_rethrow: () => {} }));
const { POST } = await import('../app/api/revalidate/route');
const { NextRequest } = await import('next/server');
const previous = process.env.REVALIDATION_SECRET;
afterAll(() => {
  if (previous === undefined) delete process.env.REVALIDATION_SECRET;
  else process.env.REVALIDATION_SECRET = previous;
});
beforeEach(() => {
  tags.length = 0;
  paths.length = 0;
  process.env.REVALIDATION_SECRET = 'test-only-secret';
});
function request(body: object, authorized = true) {
  return new NextRequest('http://localhost/api/revalidate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorized ? { Authorization: 'Bearer test-only-secret' } : {}),
    },
    body: JSON.stringify(body),
  });
}
test('rejects unauthenticated and unconfigured webhooks without invalidating', async () => {
  expect((await POST(request({}, false))).status).toBe(401);
  delete process.env.REVALIDATION_SECRET;
  expect((await POST(request({}))).status).toBe(401);
  expect(tags).toEqual([]);
});
test('an episode publication invalidates lists, detail and expanded relationships', async () => {
  expect((await POST(request({ object: { type: 'episode', slug: 'example-show' } }))).status).toBe(
    200
  );
  expect(tags).toContain('episode-example-show');
  expect(tags).toContain('schedule');
  expect(tags).toContain('homepage');
  expect(tags).toContain('content-relationships');
  expect(tags).not.toContain('public-content');
});
test('retains authenticated manual tag invalidation', async () => {
  expect((await POST(request({ tag: 'genres, navigation' }))).status).toBe(200);
  expect(tags).toEqual(['genres', 'navigation']);
});
