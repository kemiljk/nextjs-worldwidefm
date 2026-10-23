import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { NextRequest } from 'next/server';
import { createPreviewToken, isValidPreviewSecret, isValidPreviewToken } from '@/lib/preview-token';
import { GET } from '@/app/api/preview/route';

const originalSecret = process.env.PREVIEW_SECRET;

beforeEach(() => {
  process.env.PREVIEW_SECRET = 'test-preview-secret';
});

afterEach(() => {
  process.env.PREVIEW_SECRET = originalSecret;
});

describe('preview tokens', () => {
  it('unlocks only the object it was made for', () => {
    const token = createPreviewToken('posts', 'draft-post');
    expect(isValidPreviewToken('posts', 'draft-post', token)).toBe(true);
    expect(isValidPreviewToken('posts', 'other-post', token)).toBe(false);
    expect(isValidPreviewToken('episode', 'draft-post', token)).toBe(false);
    expect(isValidPreviewToken('posts', 'draft-post', 'x'.repeat(32))).toBe(false);
    expect(isValidPreviewToken('posts', 'draft-post', undefined)).toBe(false);
  });

  it('is disabled when no secret is configured', () => {
    delete process.env.PREVIEW_SECRET;
    expect(createPreviewToken('posts', 'draft-post')).toBeNull();
    expect(isValidPreviewToken('posts', 'draft-post', 'anything')).toBe(false);
    expect(isValidPreviewSecret('')).toBe(false);
  });
});

describe('GET /api/preview', () => {
  const call = (query: string) => GET(new NextRequest(`http://localhost/api/preview?${query}`));

  it('redirects to the page with a token for that slug', async () => {
    const response = await call('secret=test-preview-secret&type=posts&slug=draft-post');
    const location = new URL(response.headers.get('location')!);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe('/editorial/draft-post');
    expect(isValidPreviewToken('posts', 'draft-post', location.searchParams.get('preview'))).toBe(
      true
    );
    expect(location.search).not.toContain('test-preview-secret');
  });

  it('sends episodes to the episode page', async () => {
    const response = await call('secret=test-preview-secret&type=episode&slug=draft-show');
    expect(new URL(response.headers.get('location')!).pathname).toBe('/episode/draft-show');
  });

  it('rejects a wrong secret and unknown types', async () => {
    expect((await call('secret=nope&slug=draft-post')).status).toBe(401);
    expect((await call('secret=test-preview-secret&type=users&slug=x')).status).toBe(400);
    expect((await call('secret=test-preview-secret&type=toString&slug=x')).status).toBe(400);
  });
});
