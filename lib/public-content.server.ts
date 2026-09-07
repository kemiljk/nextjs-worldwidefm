'use cache';

import { cacheLife, cacheTag } from 'next/cache';
import { getPublicObjects, getPublicObject, type PublicReadOptions } from './cosmic-public';

/** Bridge for shared modules whose pure formatting helpers also run in the browser. */
export async function fetchPublicContent(
  query: Record<string, unknown>,
  options: PublicReadOptions = {}
) {
  cacheLife('minutes');
  cacheTag('public-content', 'content-relationships');
  return getPublicObjects(query, options);
}

export async function fetchPublicContentObject(
  query: Record<string, unknown>,
  options: PublicReadOptions = {}
) {
  cacheLife('minutes');
  cacheTag('public-content', 'content-relationships');
  return getPublicObject(query, options);
}
