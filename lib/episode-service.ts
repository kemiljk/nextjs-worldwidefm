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

/**
 * Simplified episode service that works directly with Cosmic data
 */
export async function getEpisodes(params: EpisodeParams = {}): Promise<EpisodeResponse> {
  const baseLimit = params.limit || 20;
  const offset = params.offset || 0;

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
            // Match genre IDs directly - genres stores ID strings, not objects
            query['metadata.genres'] = { $in: validGenres };
          }
        }

        // Add location filter
        if (params.location) {
          const locations = Array.isArray(params.location) ? params.location : [params.location];
          // Match location IDs directly - locations stores ID strings, not objects
          query['metadata.locations'] = { $in: locations };
        }

        // Exclude future broadcast dates
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        query['metadata.broadcast_date'] = { $lte: todayStr };

        // Fetch a larger set to randomize from
        const fetchLimit = Math.min(baseLimit * 5, 200);
        const response = await cosmic.objects.find(query).limit(fetchLimit).depth(2);

        const episodes = response.objects || [];
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
        // Match genre IDs directly - genres stores ID strings, not objects
        query['metadata.genres'] = { $in: validGenres };
      }
    }

    if (params.location) {
      const locations = Array.isArray(params.location) ? params.location : [params.location];
      // Match location IDs directly - locations stores ID strings, not objects
      query['metadata.locations'] = { $in: locations };
    }

    if (params.host) {
      if (params.host === '*') {
        query['metadata.regular_hosts'] = { $exists: true, $ne: [] };
      } else {
        const hosts = Array.isArray(params.host) ? params.host : [params.host];
        // Match host IDs directly - regular_hosts stores ID strings, not objects
        query['metadata.regular_hosts'] = { $in: hosts };
      }
    }

    if (params.takeover) {
      if (params.takeover === '*') {
        query['metadata.takeovers'] = { $exists: true, $ne: [] };
      } else {
        const takeovers = Array.isArray(params.takeover) ? params.takeover : [params.takeover];
        // Match takeover IDs directly - takeovers stores ID strings, not objects
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

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (params.isNew) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query['metadata.broadcast_date'] = {
        $gte: thirtyDaysAgo.toISOString().slice(0, 10),
        $lte: todayStr,
      };
    } else {
      query['metadata.broadcast_date'] = { $lte: todayStr };
    }

    // Fetch episodes from Cosmic
    const response = await cosmic.objects
      .find(query)
      .limit(baseLimit)
      .skip(offset)
      .sort('-metadata.broadcast_date')
      .depth(2);

    const episodes = response.objects || [];
    const total = response.total || episodes.length;
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

    // Build the query
    const query: Record<string, unknown> = {
      type: 'regular-hosts',
      status: 'published',
    };

    // Add genre filter
    if (genre && genre.length > 0) {
      query['metadata.genre.slug'] = { $in: genre };
    }

    // Add location filter
    if (location && location.length > 0) {
      query['metadata.location.slug'] = { $in: location };
    }

    // Add letter filter (starts with)
    if (letter) {
      query.title = { $regex: `^${letter}`, $options: 'i' };
    }

    const response = await cosmic.objects.find(query).limit(limit).skip(offset).depth(1);

    const shows = response.objects || [];
    const total = response.total || shows.length;
    const hasNext = shows.length === limit && offset + limit < total;

    return { shows, total, hasNext };
  } catch (error) {
    console.error('Error fetching regular hosts:', error);
    return { shows: [], total: 0, hasNext: false };
  }
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
  } = {}
): Promise<{
  shows: EpisodeObject[];
  total: number;
  hasNext: boolean;
}> {
  try {
    const { limit = 100, offset = 0, genre, location } = params;

    // Build the query
    const query: Record<string, unknown> = {
      type: 'takeovers',
      status: 'published',
    };

    // Add genre filter
    if (genre && genre.length > 0) {
      query['metadata.genre.slug'] = { $in: genre };
    }

    // Add location filter
    if (location && location.length > 0) {
      query['metadata.location.slug'] = { $in: location };
    }

    const response = await cosmic.objects.find(query).limit(limit).skip(offset).depth(1);

    const shows = response.objects || [];
    const total = response.total || shows.length;
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
 * Get episode by slug
 * Handles URL-encoded slugs and normalizes them to match stored slugs
 */
export async function getEpisodeBySlug(
  slug: string,
  preview?: string
): Promise<EpisodeObject | null> {
  // First try the original slug as-is
  let query: Record<string, unknown> = {
    type: 'episode',
    slug: slug,
    status: preview ? 'any' : 'published',
  };

  try {
    const response = await cosmic.objects.findOne(query).depth(2);
    if (response.object) {
      return response.object;
    }
  } catch (error) {
    // Silently handle 404s - they're expected when slug doesn't match
    if (!is404Error(error)) {
      console.error('Error fetching episode by slug:', error);
    }
  }

  // If not found, try the normalized version
  const normalizedSlug = normalizeSlug(slug);
  if (normalizedSlug !== slug) {
    query = {
      type: 'episode',
      slug: normalizedSlug,
      status: preview ? 'any' : 'published',
    };

    try {
      const response = await cosmic.objects.findOne(query).depth(2);
      if (response.object) {
        return response.object;
      }
    } catch (error) {
      // Silently handle 404s - they're expected when slug doesn't match
      if (!is404Error(error)) {
        console.error('Error fetching episode by normalized slug:', error);
      }
    }
  }

  return null;
}

/**
 * Get related episodes based on shared genres and hosts
 * Simplified to use a single query for better performance and reliability
 */
export async function getRelatedEpisodes(
  episodeId: string,
  limit: number = 5
): Promise<EpisodeObject[]> {
  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Single query: get recent episodes excluding current one
    // This is faster and more reliable than multiple complex queries
    const response = await cosmic.objects
      .find({
        type: 'episode',
        status: 'published',
        id: { $ne: episodeId },
        'metadata.broadcast_date': { $lte: todayStr },
      })
      .props(
        'id,slug,title,metadata.broadcast_date,metadata.image,metadata.genres,metadata.regular_hosts'
      )
      .limit(limit)
      .sort('-metadata.broadcast_date')
      .depth(2);

    return response.objects || [];
  } catch (error) {
    // Silently fail - related episodes are not critical
    return [];
  }
}
