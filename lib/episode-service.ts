import { cosmic } from './cosmic-config';
import { EpisodeObject } from './cosmic-types';
import { unstable_cache } from 'next/cache';

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
            query['metadata.genres.id'] = { $in: validGenres };
          }
        }

        // Add location filter
        if (params.location) {
          const locations = Array.isArray(params.location) ? params.location : [params.location];
          query['metadata.locations.id'] = { $in: locations };
        }

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
      } catch (error: any) {
        // Handle 404s gracefully - genres/locations with no episodes are expected
        const is404 = error?.status === 404 || 
                     error?.message?.includes('404') || 
                     error?.message?.includes('No objects found');
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
        query['metadata.genres.id'] = { $in: validGenres };
      }
    }

    if (params.location) {
      const locations = Array.isArray(params.location) ? params.location : [params.location];
      query['metadata.locations.id'] = { $in: locations };
    }

    if (params.host) {
      if (params.host === '*') {
        query['metadata.regular_hosts'] = { $exists: true, $ne: [] };
      } else {
        const hosts = Array.isArray(params.host) ? params.host : [params.host];
        query['metadata.regular_hosts.id'] = { $in: hosts };
      }
    }

    if (params.takeover) {
      if (params.takeover === '*') {
        query['metadata.takeovers'] = { $exists: true, $ne: [] };
      } else {
        const takeovers = Array.isArray(params.takeover) ? params.takeover : [params.takeover];
        query['metadata.takeovers.id'] = { $in: takeovers };
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
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query['metadata.broadcast_date'] = { $gte: thirtyDaysAgo.toISOString().slice(0, 10) };
    }

    // Fetch episodes from Cosmic with conditional caching (server-side only)
    // unstable_cache only works in Server Components/Actions, so we detect context
    const fetchEpisodes = async () => {
      return await cosmic.objects
        .find(query)
        .limit(baseLimit)
        .skip(offset)
        .sort('-metadata.broadcast_date')
        .depth(2);
    };

    let response;
    try {
      // Only use caching in server context (unstable_cache requires server-side)
      if (typeof window === 'undefined') {
        try {
          const cacheKey = `episodes-${JSON.stringify(query)}-${baseLimit}-${offset}`;
          const getCachedEpisodes = unstable_cache(
            fetchEpisodes,
            [cacheKey],
            {
              tags: ['episodes', 'shows'],
              revalidate: 60,
            }
          );
          response = await getCachedEpisodes();
        } catch (cacheError: any) {
          // If cache fails (e.g., missing incrementalCache), fallback to direct fetch
          if (cacheError?.message?.includes('incrementalCache') || cacheError?.message?.includes('cache')) {
            response = await fetchEpisodes();
          } else {
            throw cacheError;
          }
        }
      } else {
        // Client-side: fetch directly without caching
        response = await fetchEpisodes();
      }
    } catch (cacheError) {
      // Final fallback to direct fetch if caching fails
      response = await fetchEpisodes();
    }

    const episodes = response.objects || [];
    const total = response.total || episodes.length;
    const hasNext = episodes.length === baseLimit && offset + baseLimit < total;

    return {
      episodes,
      total,
      hasNext,
    };
  } catch (error: any) {
    // Don't log 404s as errors - they're expected when no episodes match the query
    if (error?.status !== 404 && error?.message?.includes('404') === false) {
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
  shows: any[];
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
  shows: any[];
  total: number;
  hasNext: boolean;
}> {
  try {
    const { limit = 100, offset = 0, genre, location, letter } = params;

    // Build the query
    const query: any = {
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

    const fetchHosts = async () => {
      return await cosmic.objects.find(query).limit(limit).skip(offset).depth(1);
    };

    let response;
    try {
      // Only use caching in server context
      if (typeof window === 'undefined') {
        const cacheKey = `regular-hosts-${JSON.stringify(query)}-${limit}-${offset}`;
        const getCachedHosts = unstable_cache(
          fetchHosts,
          [cacheKey],
          {
            tags: ['hosts', 'shows'],
            revalidate: 60,
          }
        );
        response = await getCachedHosts();
      } else {
        response = await fetchHosts();
      }
    } catch (cacheError) {
      response = await fetchHosts();
    }

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
  shows: any[];
  total: number;
  hasNext: boolean;
}> {
  try {
    const { limit = 100, offset = 0, genre, location } = params;

    // Build the query
    const query: any = {
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

    const fetchTakeovers = async () => {
      return await cosmic.objects.find(query).limit(limit).skip(offset).depth(1);
    };

    let response;
    try {
      // Only use caching in server context
      if (typeof window === 'undefined') {
        const cacheKey = `takeovers-${JSON.stringify(query)}-${limit}-${offset}`;
        const getCachedTakeovers = unstable_cache(
          fetchTakeovers,
          [cacheKey],
          {
            tags: ['takeovers', 'shows'],
            revalidate: 60,
          }
        );
        response = await getCachedTakeovers();
      } else {
        response = await fetchTakeovers();
      }
    } catch (cacheError) {
      response = await fetchTakeovers();
    }

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
 * Get episode by slug
 */
export async function getEpisodeBySlug(slug: string): Promise<any | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'episode',
        slug: slug,
        status: 'published',
      })
      .depth(2);

    return response.object || null;
  } catch (error) {
    console.error('Error fetching episode by slug:', error);
    return null;
  }
}

/**
 * Get related episodes based on shared genres and hosts
 */
export async function getRelatedEpisodes(episodeId: string, limit: number = 5): Promise<any[]> {
  try {
    // First get the current episode to extract its genres and hosts
    const currentEpisode = await cosmic.objects
      .findOne({
        type: 'episode',
        id: episodeId,
        status: 'published',
      })
      .depth(2);

    if (!currentEpisode?.object) {
      return [];
    }

    const episode = currentEpisode.object;
    const genres = episode.metadata?.genres?.map((g: any) => g.id) || [];
    const hosts = episode.metadata?.regular_hosts?.map((h: any) => h.id) || [];

    // If no genres or hosts, fall back to random episodes
    if (genres.length === 0 && hosts.length === 0) {
      const response = await cosmic.objects
        .find({
          type: 'episode',
          status: 'published',
          id: { $ne: episodeId },
        })
        .limit(limit)
        .depth(2);

      return response.objects || [];
    }

    // Build query to find episodes with shared genres or hosts
    const query: any = {
      type: 'episode',
      status: 'published',
      id: { $ne: episodeId },
    };

    // Add genre or host filters
    if (genres.length > 0) {
      query['metadata.genres.id'] = { $in: genres };
    }
    if (hosts.length > 0) {
      query['metadata.regular_hosts.id'] = { $in: hosts };
    }

    // If we have both genres and hosts, use OR logic
    if (genres.length > 0 && hosts.length > 0) {
      query.$or = [
        { 'metadata.genres.id': { $in: genres } },
        { 'metadata.regular_hosts.id': { $in: hosts } },
      ];
      delete query['metadata.genres.id'];
      delete query['metadata.regular_hosts.id'];
    }

    const response = await cosmic.objects
      .find(query)
      .limit(limit * 2) // Get more to ensure we have enough after filtering
      .depth(2);

    const episodes = response.objects || [];

    // If we don't have enough episodes with shared genres/hosts, fill with random ones
    if (episodes.length < limit) {
      const randomResponse = await cosmic.objects
        .find({
          type: 'episode',
          status: 'published',
          id: { $nin: [episodeId, ...episodes.map((e: EpisodeObject) => e.id)] },
        })
        .limit(limit - episodes.length)
        .depth(2);
      const randomEpisodes = randomResponse.objects || [];
      episodes.push(...randomEpisodes);
    }

    return episodes.slice(0, limit) as EpisodeObject[];
  } catch (error) {
    console.error('Error fetching related episodes:', error);
    return [];
  }
}
