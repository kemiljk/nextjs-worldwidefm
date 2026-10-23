import { createHmac, timingSafeEqual } from 'node:crypto';

export type PreviewType = 'posts' | 'episode';

export const PREVIEW_PATHS: Record<PreviewType, string> = {
  posts: '/editorial',
  episode: '/episode',
};

function previewSecret(): string | undefined {
  return process.env.PREVIEW_SECRET?.trim() || undefined;
}

/**
 * A token that unlocks the draft of one object only, so a preview URL can be
 * shared for review without handing out the preview secret itself.
 */
export function createPreviewToken(type: PreviewType, slug: string): string | null {
  const secret = previewSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(`${type}:${slug}`).digest('base64url').slice(0, 32);
}

export function isValidPreviewToken(
  type: PreviewType,
  slug: string,
  token: string | null | undefined
): boolean {
  const expected = createPreviewToken(type, slug);
  if (!expected || !token || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function isValidPreviewSecret(value: string | null | undefined): boolean {
  const secret = previewSecret();
  if (!secret || !value || value.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(secret));
}
