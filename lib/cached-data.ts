'use cache';

import type { AboutPage, MembershipPage } from './cosmic-service';
import { cacheLife, cacheTag } from 'next/cache';
import { getPublicObject, getPublicObjects } from './cosmic-public';

export async function getCachedGenres() {
  cacheLife('minutes');
  cacheTag('genres');
  const response = await getPublicObjects(
    { type: 'genres' },
    { props: 'id,slug,title', depth: 0, limit: 1000 }
  );
  return response.objects as { id: string; slug: string; title: string }[];
}

export async function getCachedShowBySlug(slug: string) {
  cacheLife('minutes');
  cacheTag('episodes', 'shows', `episode-${slug}`);
  return (
    await getPublicObject(
      { type: 'episode', slug },
      {
        props:
          'id,slug,title,type,created_at,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.player,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers',
        depth: 1,
      }
    )
  ).object;
}

export async function getCachedHostBySlug(slug: string) {
  cacheLife('minutes');
  cacheTag('hosts', 'content-relationships');
  return (
    await getPublicObject(
      { type: 'regular-hosts', slug },
      { props: 'id,slug,title,type,content,metadata', depth: 2 }
    )
  ).object;
}

export async function getCachedTakeoverBySlug(slug: string) {
  cacheLife('minutes');
  cacheTag('takeovers', 'content-relationships');
  return (
    await getPublicObject(
      { type: 'takeovers', slug },
      { props: 'id,slug,title,type,content,metadata', depth: 2 }
    )
  ).object;
}

export async function getCachedNavigation() {
  cacheLife('minutes');
  cacheTag('navigation', 'content-relationships');
  return getPublicObject(
    { type: 'navigation', slug: 'navigation' },
    { props: 'id,slug,title,metadata', depth: 1 }
  );
}

export async function getCachedAboutPage(): Promise<AboutPage | null> {
  cacheLife('minutes');
  cacheTag('about', 'content-relationships');
  return (await getPublicObject({ type: 'about', slug: 'about' }, { props: 'metadata', depth: 2 }))
    .object;
}

export async function getCachedMembershipPage(): Promise<MembershipPage | null> {
  cacheLife('minutes');
  cacheTag('membership', 'content-relationships');
  return (
    await getPublicObject(
      { type: 'memberships', slug: 'membership' },
      { props: 'slug,title,content,metadata,type', depth: 1 }
    )
  ).object;
}
