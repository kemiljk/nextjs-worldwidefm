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
      const response = await cosmic.objects
        .find({
          type: 'episode',
          status: 'published',
        })
        .limit(Math.min(baseLimit * 5, 200))
        .depth(2);

      const episodes = response.objects || [];
      const shuffled = [...episodes].sort(() => Math.random() - 0.5);
      const randomEpisodes = shuffled.slice(0, baseLimit);

      return {
        episodes: randomEpisodes,
        total: randomEpisodes.length,
        hasNext: false,
      };
    }

    // Build query for Cosmic
    const query: any = {
      type: 'episode',
      status: 'published',
    };

    // Add filters
    if (params.genre) {
      const genres = Array.isArray(params.genre) ? params.genre : [params.genre];
      const validGenres = genres.filter(Boolean);
      if (validGenres.length > 0) {
        query['metadata.genres.id'] = { $in: validGenres };
        console.log('[getEpisodes] Genre filter applied:', {
          'metadata.genres.id': { $in: validGenres },
        });
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

    // Fetch episodes from Cosmic
    console.log('[getEpisodes] Final query:', JSON.stringify(query, null, 2));
    const response = await cosmic.objects
      .find(query)
      .limit(baseLimit)
      .skip(offset)
      .sort('-order')
      .depth(2);

    const episodes = response.objects || [];
    const total = response.total || episodes.length;
    const hasNext = episodes.length === baseLimit && offset + baseLimit < total;

    console.log('[getEpisodes] Response from Cosmic:', {
      objectsCount: episodes.length,
      total,
      hasNext,
      sampleEpisode: episodes[0]
        ? { title: episodes[0].title, genres: episodes[0].metadata?.genres }
        : null,
    });

    return {
      episodes,
      total,
      hasNext,
    };
  } catch (error) {
    console.error('Error fetching episodes:', error);
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
export async function getRegularHosts(): Promise<any[]> {
  try {
    const response = await cosmic.objects
      .find({
        type: 'regular-hosts',
        status: 'published',
      })
      .limit(100)
      .depth(1);

    return response.objects || [];
  } catch (error) {
    console.error('Error fetching regular hosts:', error);
    return [];
  }
}

/**
 * Get takeovers from Cosmic
 */
export async function getTakeovers(): Promise<any[]> {
  try {
    const response = await cosmic.objects
      .find({
        type: 'takeovers',
        status: 'published',
      })
      .limit(100)
      .depth(1);

    return response.objects || [];
  } catch (error) {
    console.error('Error fetching takeovers:', error);
    return [];
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
 * Get related episodes
 */
export async function getRelatedEpisodes(episodeId: string, limit: number = 5): Promise<any[]> {
  try {
    const response = await cosmic.objects
      .find({
        type: 'episode',
        status: 'published',
        id: { $ne: episodeId },
      })
      .limit(limit)
      .depth(2);

    return response.objects || [];
  } catch (error) {
    console.error('Error fetching related episodes:', error);
    return [];
  }
}

/**
 * Transform episode to show format (for backward compatibility)
 */
export function transformEpisodeToShowFormat(episode: any): any {
  return {
    id: episode.id,
    slug: episode.slug,
    name: episode.title,
    pictures: {
      large:
        episode.metadata?.pictures?.large ||
        episode.metadata?.pictures?.extra_large ||
        episode.metadata?.pictures?.medium ||
        episode.metadata?.pictures?.small,
      extra_large:
        episode.metadata?.pictures?.extra_large ||
        episode.metadata?.pictures?.large ||
        episode.metadata?.pictures?.medium ||
        episode.metadata?.pictures?.small,
      medium:
        episode.metadata?.pictures?.medium ||
        episode.metadata?.pictures?.small ||
        episode.metadata?.pictures?.large,
      small:
        episode.metadata?.pictures?.small ||
        episode.metadata?.pictures?.medium ||
        episode.metadata?.pictures?.large,
    },
    broadcast_date: episode.metadata?.broadcast_date,
    created_time: episode.metadata?.broadcast_date || episode.created_at,
    genres: episode.metadata?.genres || [],
    enhanced_genres: episode.metadata?.genres || [],
    tags: episode.metadata?.genres?.map((g: any) => ({ name: g.title })) || [],
    hosts: episode.metadata?.regular_hosts || [],
    takeovers: episode.metadata?.takeovers || [],
    locations: episode.metadata?.locations || [],
    showType: episode.metadata?.type || {},
  };
}
