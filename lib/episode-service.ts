import { cosmic } from './cosmic-config';
import { EpisodeObject } from './cosmic-types';

export interface EpisodeParams {
  limit?: number;
  offset?: number;
  random?: boolean;
  searchTerm?: string;
  isNew?: boolean;
  genre?: string | string[];
  host?: string | string[] | '*';
  takeover?: string | string[] | '*';
  location?: string | string[];
  showType?: string | string[];
}

export interface EpisodeResponse {
  episodes: EpisodeObject[];
  total: number;
  hasNext: boolean;
}

const EPISODE_PROPS =
  'id,slug,title,type,created_at,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.player,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers,metadata.featured_on_homepage';

const EPISODE_DETAIL_PROPS =
  'id,slug,title,type,status,created_at,metadata.image,metadata.external_image_url,metadata.broadcast_date,metadata.broadcast_date_old,metadata.broadcast_time,metadata.description,metadata.subtitle,metadata.body_text,metadata.player,metadata.tracklist,metadata.duration,metadata.genres,metadata.regular_hosts,metadata.locations,metadata.takeovers,metadata.featured_on_homepage';

const RELATED_EPISODE_PROPS =
  'id,slug,title,metadata.broadcast_date,metadata.image,metadata.external_image_url,metadata.genres,metadata.regular_hosts';

/**
 * Get yesterday's date string for filtering episodes (excludes future broadcasts)
 * This is computed fresh each time to ensure date accuracy
 */
function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

/**
 * Get date string for 30 days ago (for "new" episode filtering)
 */
function getThirtyDaysAgoDateString(): string {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return thirtyDaysAgo.toISOString().slice(0, 10);
}

/**
 * Episode fetching - core implementation
 */
async function fetchEpisodesFromCosmic(
  query: Record<string, unknown>,
  baseLimit: number,
  offset: number
): Promise<{ objects: EpisodeObject[]; total: number }> {
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
 * Random episodes fetching
 */
async function fetchRandomEpisodesFromCosmic(
  query: Record<string, unknown>,
  fetchLimit: number
): Promise<EpisodeObject[]> {
  const response = await cosmic.objects.find(query).props(EPISODE_PROPS).limit(fetchLimit).depth(1);

  return response.objects || [];
}

/**
 * Simplified episode service that works directly with Cosmic data
 */
export async function getEpisodes(params: EpisodeParams = {}): Promise<EpisodeResponse> {
  const baseLimit = params.limit || 20;
  const offset = params.offset || 0;
  const yesterdayStr = getYesterdayDateString();

  try {
    // Handle random episodes
    if (params.random) {
      try {
        // Build query with filters if provided
        const query: Record<string, unknown> = {
          type: 'episode',
          status: 'published',
        };

        // Add genre filter if provided
        if (params.genre) {
          const genres = Array.isArray(params.genre) ? params.genre : [params.genre];
          const validGenres = genres.filter(Boolean);
          if (validGenres.length > 0) {
            query['metadata.genres'] = { $in: validGenres };
          }
        }

        // Add location filter
        if (params.location) {
          const locations = Array.isArray(params.location) ? params.location : [params.location];
          query['metadata.locations'] = { $in: locations };
        }

        // Exclude future broadcast dates and episodes from today (1-day delay)
        query['metadata.broadcast_date'] = { $lte: yesterdayStr };

        // Fetch a larger set to randomize from
        const fetchLimit = Math.min(baseLimit * 5, 200);
        const episodes = await fetchRandomEpisodesFromCosmic(query, fetchLimit);

        // Shuffle client-side (randomization happens after fetch)
        const shuffled = [...episodes].sort(() => Math.random() - 0.5);
        const randomEpisodes = shuffled.slice(0, baseLimit);

        return {
          episodes: randomEpisodes,
          total: randomEpisodes.length,
          hasNext: false,
        };
      } catch (error: unknown) {
        // Handle 404s gracefully - genres/locations with no episodes are expected
        const is404 =
          (error &&
            typeof error === 'object' &&
            'status' in error &&
            (error as { status: number }).status === 404) ||
          (error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof (error as { message: unknown }).message === 'string' &&
            ((error as { message: string }).message.includes('404') ||
              (error as { message: string }).message.includes('No objects found')));
        if (is404) {
          return {
            episodes: [],
            total: 0,
            hasNext: false,
          };
        }
        throw error;
      }
    }

    // Build query for Cosmic
    const query: Record<string, unknown> = {
      type: 'episode',
      status: 'published',
    };

    // Add filters
    if (params.genre) {
      const genres = Array.isArray(params.genre) ? params.genre : [params.genre];
      const validGenres = genres.filter(Boolean);
      if (validGenres.length > 0) {
        query['metadata.genres'] = { $in: validGenres };
      }
    }

    if (params.location) {
      const locations = Array.isArray(params.location) ? params.location : [params.location];
      query['metadata.locations'] = { $in: locations };
    }

    if (params.host) {
      if (params.host === '*') {
        query['metadata.regular_hosts'] = { $exists: true, $ne: [] };
      } else {
        const hosts = Array.isArray(params.host) ? params.host : [params.host];
        query['metadata.regular_hosts'] = { $in: hosts };
      }
    }

    if (params.takeover) {
      if (params.takeover === '*') {
        query['metadata.takeovers'] = { $exists: true, $ne: [] };
      } else {
        const takeovers = Array.isArray(params.takeover) ? params.takeover : [params.takeover];
        query['metadata.takeovers'] = { $in: takeovers };
      }
    }

    if (params.showType) {
      const showTypes = Array.isArray(params.showType) ? params.showType : [params.showType];
      query['metadata.type.id'] = { $in: showTypes };
    }

    if (params.searchTerm) {
      const term = String(params.searchTerm).trim();
      if (term) {
        query.title = { $regex: term, $options: 'i' };
      }
    }

    if (params.isNew) {
      const thirtyDaysAgoStr = getThirtyDaysAgoDateString();
      query['metadata.broadcast_date'] = {
        $gte: thirtyDaysAgoStr,
        $lte: yesterdayStr,
      };
    } else {
      query['metadata.broadcast_date'] = { $lte: yesterdayStr };
    }

    // Fetch episodes from Cosmic
    const { objects: episodes, total: totalCount } = await fetchEpisodesFromCosmic(
      query,
      baseLimit,
      offset
    );

    const total = totalCount || episodes.length;
    const hasNext = episodes.length === baseLimit && offset + baseLimit < total;

    return {
      episodes,
      total,
      hasNext,
    };
  } catch (error: unknown) {
    // Don't log 404s as errors - they're expected when no episodes match the query
    const is404 =
      (error &&
        typeof error === 'object' &&
        'status' in error &&
        (error as { status: number }).status === 404) ||
      (error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string' &&
        (error as { message: string }).message.includes('404'));
    if (!is404) {
      console.error('Error fetching episodes:', error || 'Unknown error');
    }
    return {
      episodes: [],
      total: 0,
      hasNext: false,
    };
  }
}

/**
 * Get episodes formatted for the Shows page - returns direct Cosmic objects
 */
export async function getEpisodesForShows(params: EpisodeParams = {}): Promise<{
  shows: EpisodeObject[];
  total: number;
  hasNext: boolean;
}> {
  const result = await getEpisodes(params);

  // Return episodes directly from Cosmic - no transformation needed
  return {
    shows: result.episodes,
    total: result.total,
    hasNext: result.hasNext,
  };
}

/**
 * Fetch for regular hosts
 */
async function fetchRegularHostsFromCosmic(
  query: Record<string, unknown>,
  limit: number,
  offset: number
): Promise<{ objects: EpisodeObject[]; total: number }> {
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
 * Get regular hosts from Cosmic
 */
export async function getRegularHosts(
  params: {
    limit?: number;
    offset?: number;
    genre?: string[];
    location?: string[];
    letter?: string;
  } = {}
): Promise<{
  shows: EpisodeObject[];
  total: number;
  hasNext: boolean;
}> {
  try {
    const { limit = 100, offset = 0, genre, location, letter } = params;

    const query: Record<string, unknown> = {
      type: 'regular-hosts',
      status: 'published',
    };

    if (genre && genre.length > 0) {
      query['metadata.genre.slug'] = { $in: genre };
    }

    if (location && location.length > 0) {
      query['metadata.location.slug'] = { $in: location };
    }

    if (letter) {
      query.title = { $regex: `^${letter}`, $options: 'i' };
    }

    const { objects: shows, total: totalCount } = await fetchRegularHostsFromCosmic(
      query,
      limit,
      offset
    );

    const total = totalCount || shows.length;
    const hasNext = shows.length === limit && offset + limit < total;

    return { shows, total, hasNext };
  } catch (error) {
    console.error('Error fetching regular hosts:', error);
    return { shows: [], total: 0, hasNext: false };
  }
}

/**
 * Fetch for takeovers
 */
async function fetchTakeoversFromCosmic(
  query: Record<string, unknown>,
  limit: number,
  offset: number
): Promise<{ objects: EpisodeObject[]; total: number }> {
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
 * Get takeovers from Cosmic
 */
export async function getTakeovers(
  params: {
    limit?: number;
    offset?: number;
    genre?: string[];
    location?: string[];
    host?: string[];
  } = {}
): Promise<{
  shows: EpisodeObject[];
  total: number;
  hasNext: boolean;
}> {
  try {
    const { limit = 100, offset = 0, genre, location, host } = params;

    const query: Record<string, unknown> = {
      type: 'takeovers',
      status: 'published',
    };

    if (genre && genre.length > 0) {
      query['metadata.genre.slug'] = { $in: genre };
    }

    if (location && location.length > 0) {
      query['metadata.location.slug'] = { $in: location };
    }

    if (host && host.length > 0) {
      query['metadata.regular_hosts'] = { $in: host };
    }

    const { objects: shows, total: totalCount } = await fetchTakeoversFromCosmic(
      query,
      limit,
      offset
    );

    const total = totalCount || shows.length;
    const hasNext = shows.length === limit && offset + limit < total;

    return { shows, total, hasNext };
  } catch (error) {
    console.error('Error fetching takeovers:', error);
    return { shows: [], total: 0, hasNext: false };
  }
}

/**
 * Normalize a slug by:
 * 1. Decoding URL encoding (handles both encoded and already-decoded slugs)
 * 2. Normalizing Unicode characters to ASCII (ã → a, é → e, etc.)
 * 3. Removing special characters and normalizing to slug format
 *
 * This handles slugs from search indexes that may be URL-encoded (%C3%A3)
 * as well as slugs that Next.js has already decoded (ã).
 */
function normalizeSlug(slug: string): string {
  try {
    let normalized = slug;

    // Try to decode URL encoding - safe to call even on non-encoded strings
    // This handles cases where the slug is still URL-encoded (%C3%A3 → ã)
    // We try multiple times in case of double encoding
    for (let i = 0; i < 3; i++) {
      if (normalized.includes('%')) {
        try {
          const decoded = decodeURIComponent(normalized);
          if (decoded !== normalized) {
            normalized = decoded;
            continue;
          }
        } catch {
          // If decoding fails, break and continue with current normalized value
          break;
        }
      } else {
        break;
      }
    }

    // Normalize Unicode characters to ASCII equivalents
    // This converts ã → a, é → e, ñ → n, etc.
    normalized = normalized
      .normalize('NFD') // Decompose characters (ã → a + ~)
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    return normalized;
  } catch (error) {
    console.error('Error normalizing slug:', error);
    return slug;
  }
}

/**
 * Check if an error is a 404 (not found) error
 */
function is404Error(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
    return (error as { status: number }).status === 404;
  }

  if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
    const message = (error as { message: string }).message;
    return message.includes('404') || message.includes('No objects found');
  }

  return false;
}

/**
 * Episode fetch by slug
 */
async function fetchEpisodeBySlugFromCosmic(
  slugToFetch: string,
  isPreview: boolean
): Promise<EpisodeObject | null> {
  const query: Record<string, unknown> = {
    type: 'episode',
    slug: slugToFetch,
    status: isPreview ? 'any' : 'published',
  };

  try {
    const response = await cosmic.objects.findOne(query).props(EPISODE_DETAIL_PROPS).depth(1);
    return response.object || null;
  } catch (error) {
    if (!is404Error(error)) {
      console.error('Error fetching episode by slug:', error);
    }
    return null;
  }
}

/**
 * Get episode by slug
 * Handles URL-encoded slugs and normalizes them to match stored slugs
 */
export async function getEpisodeBySlug(
  slug: string,
  preview?: string
): Promise<EpisodeObject | null> {
  const isPreview = !!preview;

  // First try the original slug as-is
  const episode = await fetchEpisodeBySlugFromCosmic(slug, isPreview);
  if (episode) {
    return episode;
  }

  // If not found, try the normalized version
  const normalizedSlug = normalizeSlug(slug);
  if (normalizedSlug !== slug) {
    return fetchEpisodeBySlugFromCosmic(normalizedSlug, isPreview);
  }

  return null;
}

/**
 * Fetch for related episodes by host
 */
async function fetchRelatedByHost(
  episodeId: string,
  hostIds: string[],
  limit: number,
  todayStr: string
): Promise<EpisodeObject[]> {
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
 * Fetch for recent episodes (fallback)
 */
async function fetchRecentEpisodes(
  excludeIds: string[],
  limit: number,
  todayStr: string
): Promise<EpisodeObject[]> {
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
 * Get related episodes based on shared genres and hosts
 * Prioritizes episodes with the same hosts, then falls back to recent episodes
 */
export async function getRelatedEpisodes(
  episodeId: string,
  limit: number = 5,
  hostIds?: string[]
): Promise<EpisodeObject[]> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    // First try to get episodes by same host if host IDs are provided
    if (hostIds && hostIds.length > 0) {
      try {
        const hostEpisodes = await fetchRelatedByHost(episodeId, hostIds, limit, todayStr);
        if (hostEpisodes.length >= limit) {
          return hostEpisodes.slice(0, limit);
        }

        // If we have some host matches but not enough, fill with recent episodes
        if (hostEpisodes.length > 0) {
          const remainingLimit = limit - hostEpisodes.length;
          const excludeIds = [episodeId, ...hostEpisodes.map(e => e.id)];
          const recentEpisodes = await fetchRecentEpisodes(excludeIds, remainingLimit, todayStr);
          return [...hostEpisodes, ...recentEpisodes].slice(0, limit);
        }
      } catch (hostError) {
        console.warn('Error fetching episodes by host:', hostError);
      }
    }

    // Fallback: get recent episodes excluding current one
    return fetchRecentEpisodes([episodeId], limit, todayStr);
  } catch {
    return [];
  }
}
