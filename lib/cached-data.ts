'use cache';

import { cacheLife, cacheTag } from 'next/cache';
import { cosmic } from './cosmic-config';
import { getCanonicalGenres as fetchCanonicalGenres } from './get-canonical-genres';
import { withRetry } from './cosmic-retry';

export async function getCachedGenres() {
  cacheLife('hours');
  cacheTag('genres');
  return fetchCanonicalGenres();
}

export async function getCachedShowBySlug(slug: string) {
  cacheLife('minutes');
  cacheTag('shows', `show-${slug}`);

  try {
    const response = await withRetry(
      async () =>
        cosmic.objects
          .findOne({
            type: 'shows',
            slug,
            status: 'published',
          })
          .props(
            'id,slug,title,type,created_at,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.player,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers'
          )
          .depth(1),
      `show:${slug}`
    );
    return response?.object || null;
  } catch {
    return null;
  }
}

export async function getCachedHostBySlug(slug: string) {
  cacheLife('minutes');
  cacheTag('hosts', `host-${slug}`);

  try {
    const response = await withRetry(
      async () =>
        cosmic.objects
          .findOne({
            type: 'regular-hosts',
            slug,
            status: 'published',
          })
          .props('id,slug,title,type,content,metadata')
          .depth(2),
      `host:${slug}`
    );
    return response?.object || null;
  } catch {
    return null;
  }
}

export async function getCachedTakeoverBySlug(slug: string) {
  cacheLife('minutes');
  cacheTag('takeovers', `takeover-${slug}`);

  try {
    const response = await withRetry(
      async () =>
        cosmic.objects
          .findOne({
            type: 'takeovers',
            slug,
            status: 'published',
          })
          .props('id,slug,title,type,content,metadata')
          .depth(2),
      `takeover:${slug}`
    );
    return response?.object || null;
  } catch {
    return null;
  }
}
