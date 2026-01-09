'use cache';

import { cacheLife, cacheTag } from 'next/cache';
import { cosmic } from './cosmic-config';
import { EpisodeObject } from './cosmic-types';

/**
 * Server-only cached episode fetching functions
 * This file uses 'use cache' at the top level and should only be imported from Server Components
 */

const EPISODE_PROPS =
  'id,slug,title,type,created_at,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.player,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers,metadata.featured_on_homepage';

const EPISODE_DETAIL_PROPS =
  'id,slug,title,type,status,created_at,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.broadcast_date_old,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.body_text,metadata.player,metadata.tracklist,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers,metadata.featured_on_homepage';

const RELATED_EPISODE_PROPS =
  'id,slug,title,metadata.broadcast_date,metadata.image,metadata.external_image_url,metadata.genres,metadata.regular_hosts';

/**
 * Cached episode fetching - core implementation
 * Uses 'latest' cache profile for fresh content with 5min revalidation
 */
export async function fetchEpisodesFromCosmic(
  query: Record<string, unknown>,
  baseLimit: number,
  offset: number
): Promise<{ objects: EpisodeObject[]; total: number }> {
  cacheLife('latest');
  cacheTag('episodes');

  const response = await cosmic.objects
    .find(query)
    .props(EPISODE_PROPS)
    .limit(baseLimit)
    .skip(offset)
    .sort('-metadata.broadcast_date')
    .depth(1);

  return {
    objects: response.objects || [],
    total: response.total || 0,
  };
}

/**
 * Cached random episodes fetching
 */
export async function fetchRandomEpisodesFromCosmic(
  query: Record<string, unknown>,
  fetchLimit: number
): Promise<EpisodeObject[]> {
  cacheLife('latest');
  cacheTag('episodes');

  const response = await cosmic.objects.find(query).props(EPISODE_PROPS).limit(fetchLimit).depth(1);

  return response.objects || [];
}

/**
 * Cached fetch for regular hosts
 */
export async function fetchRegularHostsFromCosmic(
  query: Record<string, unknown>,
  limit: number,
  offset: number
): Promise<{ objects: EpisodeObject[]; total: number }> {
  cacheLife('hours');
  cacheTag('hosts');

  const response = await cosmic.objects
    .find(query)
    .props(
      'id,slug,title,type,content,metadata.image,metadata.external_image_url,metadata.description,metadata.genres,metadata.locations'
    )
    .limit(limit)
    .skip(offset)
    .depth(1);

  return {
    objects: response.objects || [],
    total: response.total || 0,
  };
}

/**
 * Cached fetch for takeovers
 */
export async function fetchTakeoversFromCosmic(
  query: Record<string, unknown>,
  limit: number,
  offset: number
): Promise<{ objects: EpisodeObject[]; total: number }> {
  cacheLife('hours');
  cacheTag('takeovers');

  const response = await cosmic.objects
    .find(query)
    .props(
      'id,slug,title,type,content,metadata.image,metadata.external_image_url,metadata.description,metadata.regular_hosts'
    )
    .limit(limit)
    .skip(offset)
    .depth(1);

  return {
    objects: response.objects || [],
    total: response.total || 0,
  };
}

/**
 * Cached episode fetch by slug
 */
export async function fetchEpisodeBySlugFromCosmic(
  slugToFetch: string,
  isPreview: boolean
): Promise<EpisodeObject | null> {
  cacheLife('latest');
  cacheTag('episodes', `episode-${slugToFetch}`);

  const query: Record<string, unknown> = {
    type: 'episode',
    slug: slugToFetch,
    status: isPreview ? 'any' : 'published',
  };

  try {
    const response = await cosmic.objects.findOne(query).props(EPISODE_DETAIL_PROPS).depth(1);
    return response.object || null;
  } catch (error) {
    const is404 =
      error &&
      typeof error === 'object' &&
      (('status' in error && (error as { status: number }).status === 404) ||
        ('message' in error &&
          typeof (error as { message: unknown }).message === 'string' &&
          ((error as { message: string }).message.includes('404') ||
            (error as { message: string }).message.includes('No objects found'))));
    if (!is404) {
      console.error('Error fetching episode by slug:', error);
    }
    return null;
  }
}

/**
 * Cached fetch for related episodes by host
 */
export async function fetchRelatedByHost(
  episodeId: string,
  hostIds: string[],
  limit: number,
  todayStr: string
): Promise<EpisodeObject[]> {
  cacheLife('latest');
  cacheTag('episodes');

  const response = await cosmic.objects
    .find({
      type: 'episode',
      status: 'published',
      id: { $ne: episodeId },
      'metadata.regular_hosts': { $in: hostIds },
      'metadata.broadcast_date': { $lte: todayStr },
    })
    .props(RELATED_EPISODE_PROPS)
    .limit(limit)
    .sort('-metadata.broadcast_date')
    .depth(2);

  return response.objects || [];
}

/**
 * Cached fetch for recent episodes (fallback)
 */
export async function fetchRecentEpisodes(
  excludeIds: string[],
  limit: number,
  todayStr: string
): Promise<EpisodeObject[]> {
  cacheLife('latest');
  cacheTag('episodes');

  const response = await cosmic.objects
    .find({
      type: 'episode',
      status: 'published',
      id: { $nin: excludeIds },
      'metadata.broadcast_date': { $lte: todayStr },
    })
    .props(RELATED_EPISODE_PROPS)
    .limit(limit)
    .sort('-metadata.broadcast_date')
    .depth(2);

  return response.objects || [];
}

/**
 * Get recent episode slugs for static generation
 * Used by generateStaticParams to pre-render popular episode pages
 */
export async function getRecentEpisodeSlugs(limit: number = 200): Promise<{ slugs: string[] }> {
  cacheLife('archive');
  cacheTag('episodes');

  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    const response = await cosmic.objects
      .find({
        type: 'episode',
        status: 'published',
        'metadata.broadcast_date': { $lte: todayStr },
      })
      .props('slug')
      .limit(limit)
      .sort('-metadata.broadcast_date');

    interface EpisodeSlug {
      slug?: string;
    }
    const slugs = (response.objects || [])
      .map((ep: EpisodeSlug) => ep.slug)
      .filter((slug: string | undefined): slug is string => !!slug);

    return { slugs };
  } catch (error) {
    console.error('Error fetching episode slugs:', error);
    return { slugs: [] };
  }
}

