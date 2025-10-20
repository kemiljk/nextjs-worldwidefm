import { cosmic } from './cosmic-config';
import { EpisodeObject } from './cosmic-types';
import { broadcastToISOString } from './date-utils';

export interface EpisodeParams {
  limit?: number;
  offset?: number;
  random?: boolean;
  tag?: string;
  searchTerm?: string;
  isNew?: boolean;
  genre?: string | string[];
  host?: string | string[] | '*'; // "*" means any regular hosts
  takeover?: string | string[] | '*'; // "*" means any takeovers
  location?: string | string[];
  showType?: string | string[]; // Filter by show type IDs
}

export interface EpisodeResponse {
  episodes: EpisodeObject[];
  total: number;
  hasNext: boolean;
}

/**
 * Get episodes from Cosmic CMS with filtering and pagination
 */
export async function getEpisodes(params: EpisodeParams = {}): Promise<EpisodeResponse> {
  const baseLimit = params.limit || 20;
  const offset = params.offset || 0;

  // Check if filters are active
  const hasFilters = !!(
    params.genre ||
    params.location ||
    params.host ||
    params.takeover ||
    params.showType ||
    params.searchTerm ||
    params.isNew
  );

  try {
    // Handle random episodes
    if (params.random) {
      const response = await cosmic.objects
        .find({
          type: 'episode',
          status: 'published',
        })
        .props('slug,title,metadata,type,created_at,published_at')
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

    // For filtered queries, use client-side filtering for reliability
    // Cosmic CMS has limited support for complex nested queries
    if (hasFilters) {
      // Use a reasonable limit to avoid timeouts (300 episodes is ~15 pages)
      const fetchLimit = Math.min(offset + baseLimit * 15, 300);

      const allResponse = await cosmic.objects
        .find({
          type: 'episode',
          status: 'published',
        })
        .props('slug,title,metadata,type,created_at,published_at')
        .limit(fetchLimit)
        .sort('-order')
        .depth(2);

      let allEpisodes = allResponse.objects || [];
      const originalFetchedCount = allEpisodes.length;

      // Apply filters client-side
      if (params.genre) {
        const genres = Array.isArray(params.genre) ? params.genre : [params.genre];
        const validGenres = genres.filter((g) => g && typeof g === 'string' && g.trim() !== '');
        if (validGenres.length > 0) {
          allEpisodes = allEpisodes.filter((episode: EpisodeObject) => {
            const episodeGenres = episode.metadata?.genres || [];
            return episodeGenres.some((genre: any) => validGenres.includes(genre.id));
          });
        }
      }

      if (params.location) {
        const locations = Array.isArray(params.location) ? params.location : [params.location];
        allEpisodes = allEpisodes.filter((episode: EpisodeObject) => {
          const episodeLocations = episode.metadata?.locations || [];
          return episodeLocations.some((location: any) => locations.includes(location.id));
        });
      }

      if (params.host) {
        if (params.host === '*') {
          allEpisodes = allEpisodes.filter((episode: EpisodeObject) => {
            const episodeHosts = episode.metadata?.regular_hosts || [];
            return episodeHosts.length > 0;
          });
        } else {
          const hosts = Array.isArray(params.host) ? params.host : [params.host];
          allEpisodes = allEpisodes.filter((episode: EpisodeObject) => {
            const episodeHosts = episode.metadata?.regular_hosts || [];
            return episodeHosts.some((host: any) => {
              return hosts.includes(host.id) || hosts.includes(host.slug);
            });
          });
        }
      }

      if (params.takeover) {
        if (params.takeover === '*') {
          allEpisodes = allEpisodes.filter((episode: EpisodeObject) => {
            const episodeTakeovers = episode.metadata?.takeovers || [];
            return episodeTakeovers.length > 0;
          });
        } else {
          const takeovers = Array.isArray(params.takeover) ? params.takeover : [params.takeover];
          allEpisodes = allEpisodes.filter((episode: EpisodeObject) => {
            const episodeTakeovers = episode.metadata?.takeovers || [];
            return episodeTakeovers.some((takeover: any) => takeovers.includes(takeover.id));
          });
        }
      }

      if (params.showType) {
        const showTypes = Array.isArray(params.showType) ? params.showType : [params.showType];
        allEpisodes = allEpisodes.filter((episode: EpisodeObject) => {
          const episodeType = episode.metadata?.type;
          return episodeType && showTypes.includes(episodeType.id);
        });
      }

      if (params.searchTerm) {
        const searchLower = params.searchTerm.toLowerCase();
        allEpisodes = allEpisodes.filter((episode: EpisodeObject) => {
          return episode.title.toLowerCase().includes(searchLower);
        });
      }

      if (params.isNew) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        allEpisodes = allEpisodes.filter((episode: EpisodeObject) => {
          const broadcastDate = episode.metadata?.broadcast_date;
          return broadcastDate && new Date(broadcastDate) >= thirtyDaysAgo;
        });
      }

      // Apply pagination
      const startIndex = offset;
      const endIndex = startIndex + baseLimit;
      const paginatedEpisodes = allEpisodes.slice(startIndex, endIndex);

      // If we have more filtered results, or hit the fetch limit (suggesting more episodes exist)
      const hasNext = endIndex < allEpisodes.length || originalFetchedCount === fetchLimit;

      return {
        episodes: paginatedEpisodes,
        total: allEpisodes.length,
        hasNext,
      };
    }

    // For unfiltered queries, use simple server-side query with pagination
    const response = await cosmic.objects
      .find({
        type: 'episode',
        status: 'published',
      })
      .props('slug,title,metadata,type,created_at,published_at')
      .limit(baseLimit)
      .skip(offset)
      .sort('-order')
      .depth(2);

    const episodes = response.objects || [];
    const total = response.total || episodes.length;
    const hasNext = episodes.length === baseLimit && offset + baseLimit < total;

    return {
      episodes,
      total,
      hasNext,
    };
  } catch (error) {
    console.error('Error fetching episodes:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
    });
    return { episodes: [], total: 0, hasNext: false };
  }
}

/**
 * Get a single episode by slug
 */
export async function getEpisodeBySlug(slug: string): Promise<EpisodeObject | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'episode',
        slug: slug,
        status: 'published',
        // Removed player requirement to match the main getEpisodes function
      })
      .props('slug,title,metadata,type,created_at,published_at')
      .depth(2);

    return response?.object || null;
  } catch (error) {
    console.error('Error fetching episode by slug:', error);
    return null;
  }
}

/**
 * Get all episodes (for admin/bulk operations)
 */
export async function getAllEpisodes(): Promise<EpisodeObject[]> {
  try {
    const response = await cosmic.objects
      .find({
        type: 'episode',
        status: 'published',
        // Removed player requirement for consistency
      })
      .props('slug,title,metadata,type,created_at,published_at')
      .limit(1000)
      .sort('-order')
      .depth(2);

    return response.objects || [];
  } catch (error) {
    console.error('Error fetching all episodes:', error);
    return [];
  }
}

/**
 * Transform episode to format compatible with existing show card components
 */
export function transformEpisodeToShowFormat(episode: EpisodeObject): any {
  const metadata = episode.metadata || {};

  return {
    // Episode-specific fields
    id: episode.id,
    slug: episode.slug,
    title: episode.title,
    key: episode.slug, // For backward compatibility
    name: episode.title, // For backward compatibility

    // URLs and links
    url: metadata.player || '', // Audio player URL for media player

    // Image handling
    pictures: {
      small: metadata.image?.imgix_url || '/image-placeholder.svg',
      thumbnail: metadata.image?.imgix_url || '/image-placeholder.svg',
      medium_mobile: metadata.image?.imgix_url || '/image-placeholder.svg',
      medium: metadata.image?.imgix_url || '/image-placeholder.svg',
      large: metadata.image?.imgix_url || '/image-placeholder.svg',
      '320wx320h': metadata.image?.imgix_url || '/image-placeholder.svg',
      extra_large: metadata.image?.imgix_url || '/image-placeholder.svg',
      '640wx640h': metadata.image?.imgix_url || '/image-placeholder.svg',
      '768wx768h': metadata.image?.imgix_url || '/image-placeholder.svg',
      '1024wx1024h': metadata.image?.imgix_url || '/image-placeholder.svg',
    },

    // Dates and times
    created_time:
      broadcastToISOString(
        metadata.broadcast_date,
        metadata.broadcast_time,
        metadata.broadcast_date_old
      ) || episode.created_at,
    updated_time: episode.modified_at || episode.created_at,
    broadcast_date: metadata.broadcast_date,
    broadcast_time: metadata.broadcast_time,

    // Content
    description: metadata.description || '',
    body_text: metadata.body_text,
    tracklist: metadata.tracklist,
    duration: metadata.duration,
    player: metadata.player, // Important: the audio player URL

    // Metadata - preserve original metadata object
    metadata: episode.metadata || {},

    // Flattened metadata for backward compatibility
    genres: metadata.genres || [],
    locations: metadata.locations || [],
    regular_hosts: metadata.regular_hosts || [],
    takeovers: metadata.takeovers || [],
    featured_on_homepage: metadata.featured_on_homepage || false,

    // Tags format for backward compatibility
    tags: (metadata.genres || []).map((genre: any) => ({
      key: genre.slug || genre.id,
      url: `/genre/${genre.slug}`,
      name: genre.title || genre.id,
    })),

    // Hosts format for backward compatibility
    hosts: (metadata.regular_hosts || []).map((host: any) => ({
      key: host.slug || host.id,
      url: `/hosts/${host.slug}`,
      name: host.title || host.id,
      username: host.slug || host.id,
      pictures: {
        small: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        thumbnail: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        medium_mobile: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        medium: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        large: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        '320wx320h': host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        extra_large: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        '640wx640h': host.metadata?.image?.imgix_url || '/image-placeholder.svg',
      },
    })),

    // Stats (default values for compatibility)
    play_count: 0,
    favorite_count: 0,
    comment_count: 0,
    listener_count: 0,
    repost_count: 0,

    // Source tracking
    __source: 'episode' as const,
    source: metadata.source || 'cosmic',

    // Enhanced fields
    enhanced_image: metadata.image?.imgix_url,
    enhanced_genres: metadata.genres || [],
    enhanced_hosts: metadata.regular_hosts || [],

    // Additional fields
    episodeData: episode,
  };
}

/**
 * Get regular hosts objects from Cosmic
 * Filters hosts by finding episodes that match genre/location criteria and extracting their hosts
 */
export async function getRegularHosts(
  params: {
    limit?: number;
    offset?: number;
    genre?: string | string[];
    location?: string | string[];
    letter?: string;
  } = {}
): Promise<{
  shows: any[];
  total: number;
  hasNext: boolean;
}> {
  const limit = params.limit || 20;
  const offset = params.offset || 0;

  try {
    // If no filters, get all hosts directly
    if (!params.genre && !params.location) {
      let query: any = {
        type: 'regular-hosts',
        status: 'published',
      };

      // Add letter filter if provided
      if (params.letter) {
        if (params.letter === '0') {
          query.title = { $regex: '^[^a-zA-Z]', $options: 'i' };
        } else {
          query.title = { $regex: `^${params.letter}`, $options: 'i' };
        }
      }

      const response = await cosmic.objects
        .find(query)
        .props('slug,title,metadata,type')
        .limit(limit)
        .skip(offset)
        .sort('title')
        .depth(2);

      const hosts = response.objects || [];
      const total = response.total || hosts.length;
      const hasNext = hosts.length === limit && offset + limit < total;

      const shows = hosts.map(transformHostToShowFormat);
      return { shows, total, hasNext };
    }

    // If filters are applied, find hosts through episodes
    let episodeQuery: any = {
      type: 'episode',
      status: 'published',
      'metadata.regular_hosts': { $exists: true, $ne: [] }, // Only episodes with hosts
    };

    // Apply genre filter to episodes
    if (params.genre) {
      const genres = Array.isArray(params.genre) ? params.genre : [params.genre];
      const validGenres = genres.filter(Boolean);
      if (validGenres.length === 1) {
        episodeQuery['metadata.genres.id'] = validGenres[0];
      } else if (validGenres.length > 1) {
        episodeQuery.$or = validGenres.map((id) => ({ 'metadata.genres.id': id }));
      }
    }

    // Apply location filter to episodes
    if (params.location) {
      const locations = Array.isArray(params.location) ? params.location : [params.location];
      episodeQuery['metadata.locations.id'] = { $in: locations };
    }

    // Get episodes that match the criteria (limit to avoid timeouts)
    const episodesResponse = await cosmic.objects
      .find(episodeQuery)
      .props('metadata.regular_hosts')
      .limit(300)
      .depth(2);

    const episodes = episodesResponse.objects || [];

    // Extract unique hosts from episodes
    const hostMap = new Map();
    episodes.forEach((episode: any) => {
      const hosts = episode.metadata?.regular_hosts || [];
      hosts.forEach((host: any) => {
        if (host.id && !hostMap.has(host.id)) {
          hostMap.set(host.id, host);
        }
      });
    });

    let uniqueHosts = Array.from(hostMap.values());

    // Apply letter filter if provided
    if (params.letter) {
      if (params.letter === '0') {
        uniqueHosts = uniqueHosts.filter((host: any) => !/^[a-zA-Z]/.test(host.title));
      } else {
        uniqueHosts = uniqueHosts.filter((host: any) =>
          host.title.toLowerCase().startsWith(params.letter!.toLowerCase())
        );
      }
    }

    // Apply pagination to the unique hosts
    const paginatedHosts = uniqueHosts.slice(offset, offset + limit);
    const hasNext = offset + limit < uniqueHosts.length;

    // Transform hosts to show format
    const shows = paginatedHosts.map(transformHostToShowFormat);

    return {
      shows,
      total: uniqueHosts.length,
      hasNext,
    };
  } catch (error) {
    console.error('Error fetching regular hosts:', error);
    return { shows: [], total: 0, hasNext: false };
  }
}

/**
 * Get takeovers objects from Cosmic
 * Filters takeovers by finding episodes that match genre/location criteria and extracting their takeovers
 */
export async function getTakeovers(
  params: {
    limit?: number;
    offset?: number;
    genre?: string | string[];
    location?: string | string[];
  } = {}
): Promise<{
  shows: any[];
  total: number;
  hasNext: boolean;
}> {
  const limit = params.limit || 20;
  const offset = params.offset || 0;

  try {
    // If no filters, get all takeovers directly
    if (!params.genre && !params.location) {
      const response = await cosmic.objects
        .find({
          type: 'takeovers',
          status: 'published',
        })
        .props('slug,title,metadata,type')
        .limit(limit)
        .skip(offset)
        .sort('title')
        .depth(2);

      const takeovers = response.objects || [];
      const total = response.total || takeovers.length;
      const hasNext = takeovers.length === limit && offset + limit < total;

      const shows = takeovers.map(transformTakeoverToShowFormat);
      return { shows, total, hasNext };
    }

    // If filters are applied, find takeovers through episodes
    let episodeQuery: any = {
      type: 'episode',
      status: 'published',
      'metadata.takeovers': { $exists: true, $ne: [] }, // Only episodes with takeovers
    };

    // Apply genre filter to episodes
    if (params.genre) {
      const genres = Array.isArray(params.genre) ? params.genre : [params.genre];
      const validGenres = genres.filter(Boolean);
      if (validGenres.length === 1) {
        episodeQuery['metadata.genres.id'] = validGenres[0];
      } else if (validGenres.length > 1) {
        episodeQuery.$or = validGenres.map((id) => ({ 'metadata.genres.id': id }));
      }
    }

    // Apply location filter to episodes
    if (params.location) {
      const locations = Array.isArray(params.location) ? params.location : [params.location];
      episodeQuery['metadata.locations.id'] = { $in: locations };
    }

    // Get episodes that match the criteria (limit to avoid timeouts)
    const episodesResponse = await cosmic.objects
      .find(episodeQuery)
      .props('metadata.takeovers')
      .limit(300)
      .depth(2);

    const episodes = episodesResponse.objects || [];

    // Extract unique takeovers from episodes
    const takeoverMap = new Map();
    episodes.forEach((episode: any) => {
      const takeovers = episode.metadata?.takeovers || [];
      takeovers.forEach((takeover: any) => {
        if (takeover.id && !takeoverMap.has(takeover.id)) {
          takeoverMap.set(takeover.id, takeover);
        }
      });
    });

    const uniqueTakeovers = Array.from(takeoverMap.values());

    // Apply pagination to the unique takeovers
    const paginatedTakeovers = uniqueTakeovers.slice(offset, offset + limit);
    const hasNext = offset + limit < uniqueTakeovers.length;

    // Transform takeovers to show format
    const shows = paginatedTakeovers.map(transformTakeoverToShowFormat);

    return {
      shows,
      total: uniqueTakeovers.length,
      hasNext,
    };
  } catch (error) {
    console.error('Error fetching takeovers:', error);
    return { shows: [], total: 0, hasNext: false };
  }
}

/**
 * Get episodes formatted for show cards and listings
 */
export async function getEpisodesForShows(params: EpisodeParams = {}): Promise<{
  shows: any[];
  total: number;
  hasNext: boolean;
}> {
  const { episodes, total, hasNext } = await getEpisodes(params);

  const shows = episodes.map(transformEpisodeToShowFormat);

  return { shows, total, hasNext };
}

/**
 * Transform host object to format compatible with existing show card components
 */
export function transformHostToShowFormat(host: any): any {
  const metadata = host.metadata || {};

  return {
    // Host-specific fields
    id: host.id,
    slug: host.slug,
    title: host.title,
    key: host.slug, // For backward compatibility
    name: host.title, // For backward compatibility

    // URLs and links
    url: '', // Hosts don't have audio players

    // Image handling
    pictures: {
      small: metadata.image?.imgix_url || '/image-placeholder.svg',
      thumbnail: metadata.image?.imgix_url || '/image-placeholder.svg',
      medium_mobile: metadata.image?.imgix_url || '/image-placeholder.svg',
      medium: metadata.image?.imgix_url || '/image-placeholder.svg',
      large: metadata.image?.imgix_url || '/image-placeholder.svg',
      '320wx320h': metadata.image?.imgix_url || '/image-placeholder.svg',
      extra_large: metadata.image?.imgix_url || '/image-placeholder.svg',
      '640wx640h': metadata.image?.imgix_url || '/image-placeholder.svg',
      '768wx768h': metadata.image?.imgix_url || '/image-placeholder.svg',
      '1024wx1024h': metadata.image?.imgix_url || '/image-placeholder.svg',
    },

    // Dates and times
    created_time: host.created_at,
    updated_time: host.modified_at || host.created_at,
    broadcast_date: metadata.broadcast_date,
    broadcast_time: metadata.broadcast_time,

    // Content
    description: metadata.description || metadata.bio || '',
    body_text: metadata.body_text,
    tracklist: metadata.tracklist,
    duration: metadata.duration,
    player: '', // Hosts don't have audio players

    // Metadata
    genres: metadata.genres || [],
    locations: metadata.locations || [],
    regular_hosts: [], // Hosts don't have hosts
    takeovers: [],
    featured_on_homepage: metadata.featured_on_homepage || false,

    // Tags format for backward compatibility
    tags: (metadata.genres || []).map((genre: any) => ({
      key: genre.slug || genre.id,
      url: `/genre/${genre.slug}`,
      name: genre.title || genre.id,
    })),

    // Hosts format for backward compatibility
    hosts: [],

    // Stats (default values for compatibility)
    play_count: 0,
    favorite_count: 0,
    comment_count: 0,
    listener_count: 0,
    repost_count: 0,

    // Source tracking
    __source: 'host' as const,
    source: metadata.source || 'cosmic',

    // Enhanced fields
    enhanced_image: metadata.image?.imgix_url,
    enhanced_genres: metadata.genres || [],
    enhanced_hosts: [],

    // Additional fields
    hostData: host,
  };
}

/**
 * Transform takeover object to format compatible with existing show card components
 */
export function transformTakeoverToShowFormat(takeover: any): any {
  const metadata = takeover.metadata || {};

  return {
    // Takeover-specific fields
    id: takeover.id,
    slug: takeover.slug,
    title: takeover.title,
    key: takeover.slug, // For backward compatibility
    name: takeover.title, // For backward compatibility

    // URLs and links
    url: metadata.player || '', // Audio player URL for media player

    // Image handling
    pictures: {
      small: metadata.image?.imgix_url || '/image-placeholder.svg',
      thumbnail: metadata.image?.imgix_url || '/image-placeholder.svg',
      medium_mobile: metadata.image?.imgix_url || '/image-placeholder.svg',
      medium: metadata.image?.imgix_url || '/image-placeholder.svg',
      large: metadata.image?.imgix_url || '/image-placeholder.svg',
      '320wx320h': metadata.image?.imgix_url || '/image-placeholder.svg',
      extra_large: metadata.image?.imgix_url || '/image-placeholder.svg',
      '640wx640h': metadata.image?.imgix_url || '/image-placeholder.svg',
      '768wx768h': metadata.image?.imgix_url || '/image-placeholder.svg',
      '1024wx1024h': metadata.image?.imgix_url || '/image-placeholder.svg',
    },

    // Dates and times
    created_time: takeover.created_at,
    updated_time: takeover.modified_at || takeover.created_at,
    broadcast_date: metadata.broadcast_date,
    broadcast_time: metadata.broadcast_time,

    // Content
    description: metadata.description || '',
    body_text: metadata.body_text,
    tracklist: metadata.tracklist,
    duration: metadata.duration,
    player: metadata.player, // Important: the audio player URL

    // Metadata
    genres: metadata.genres || [],
    locations: metadata.locations || [],
    regular_hosts: metadata.regular_hosts || [],
    takeovers: [],
    featured_on_homepage: metadata.featured_on_homepage || false,

    // Tags format for backward compatibility
    tags: (metadata.genres || []).map((genre: any) => ({
      key: genre.slug || genre.id,
      url: `/genre/${genre.slug}`,
      name: genre.title || genre.id,
    })),

    // Hosts format for backward compatibility
    hosts: (metadata.regular_hosts || []).map((host: any) => ({
      key: host.slug || host.id,
      url: `/hosts/${host.slug}`,
      name: host.title || host.id,
      username: host.slug || host.id,
      pictures: {
        small: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        thumbnail: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        medium_mobile: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        medium: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        large: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        '320wx320h': host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        extra_large: host.metadata?.image?.imgix_url || '/image-placeholder.svg',
        '640wx640h': host.metadata?.image?.imgix_url || '/image-placeholder.svg',
      },
    })),

    // Stats (default values for compatibility)
    play_count: 0,
    favorite_count: 0,
    comment_count: 0,
    listener_count: 0,
    repost_count: 0,

    // Source tracking
    __source: 'takeover' as const,
    source: metadata.source || 'cosmic',

    // Enhanced fields
    enhanced_image: metadata.image?.imgix_url,
    enhanced_genres: metadata.genres || [],
    enhanced_hosts: metadata.regular_hosts || [],

    // Additional fields
    takeoverData: takeover,
  };
}

/**
 * Clean and format episode title (similar to Mixcloud's cleanShowTitle)
 */
export function cleanEpisodeTitle(title: string): string {
  if (!title) return '';

  // Remove common prefixes
  const cleanedTitle = title
    .replace(/^Worldwide FM[\s\-:]*/, '')
    .replace(/^WWFM[\s\-:]*/, '')
    .trim();

  return cleanedTitle || title;
}

/**
 * Extract show series name from episode title for intelligent matching
 */
function extractShowSeries(title: string): string {
  if (!title) return '';

  // Clean the title first
  const cleaned = cleanEpisodeTitle(title);

  // Common patterns for show series
  const patterns = [
    // "Show Name: Episode Title" -> "Show Name"
    /^([^:]+):/,
    // "Show Name with Host" -> "Show Name"
    /^(.+?)\s+w[\/\s]/i,
    // "Show Name (details)" -> "Show Name"
    /^([^(]+)\s*\(/,
    // "Show Name - details" -> "Show Name"
    /^([^-]+)\s*-/,
    // Extract first few words if no patterns match
    /^(\w+(?:\s+\w+){0,2})/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      return match[1].trim().toLowerCase();
    }
  }

  return cleaned.toLowerCase();
}

/**
 * Calculate similarity score between two strings
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const series1 = extractShowSeries(title1);
  const series2 = extractShowSeries(title2);

  // Exact series match
  if (series1 === series2 && series1.length > 2) {
    return 1.0;
  }

  // Partial series match
  if (series1.includes(series2) || series2.includes(series1)) {
    return 0.8;
  }

  // Word overlap
  const words1 = series1.split(/\s+/);
  const words2 = series2.split(/\s+/);
  const commonWords = words1.filter((word) => words2.includes(word) && word.length > 2);

  if (commonWords.length > 0) {
    return (commonWords.length / Math.max(words1.length, words2.length)) * 0.6;
  }

  return 0;
}

/**
 * Get intelligently related episodes based on title patterns, genres, and hosts
 */
export async function getRelatedEpisodes(
  currentEpisode: EpisodeObject,
  limit: number = 3
): Promise<EpisodeObject[]> {
  try {
    const metadata = currentEpisode.metadata || {};
    const genres = metadata.genres || [];
    const hosts = metadata.regular_hosts || [];

    // Get a larger pool of potential matches
    const poolSize = Math.min(50, limit * 10);

    // Build query to get episodes that might be related
    const orConditions: any[] = [];

    // Add genre matching
    if (genres.length > 0) {
      orConditions.push({
        'metadata.genres': {
          $elemMatch: {
            $or: [
              { id: { $in: genres.map((g: any) => g.id) } },
              { slug: { $in: genres.map((g: any) => g.slug) } },
            ],
          },
        },
      });
    }

    // Add host matching
    if (hosts.length > 0) {
      orConditions.push({
        'metadata.regular_hosts.id': { $in: hosts.map((h: any) => h.id) },
      });
    }

    // If no genre or host matches possible, get recent episodes for title matching
    if (orConditions.length === 0) {
      const query = {
        type: 'episode',
        status: 'published',
        id: { $ne: currentEpisode.id },
      };

      const response = await cosmic.objects
        .find(query)
        .props('slug,title,metadata,type,created_at,published_at')
        .limit(poolSize)
        .sort('-metadata.broadcast_date,-created_at')
        .depth(2);

      const allEpisodes = response.objects || [];
      return scoreAndRankEpisodes(allEpisodes, currentEpisode, limit);
    }

    const query: any = {
      type: 'episode',
      status: 'published',
      id: { $ne: currentEpisode.id },
      $or: orConditions,
    };

    const response = await cosmic.objects
      .find(query)
      .props('slug,title,metadata,type,created_at,published_at')
      .limit(poolSize)
      .sort('-metadata.broadcast_date,-published_at,-created_at')
      .limit(poolSize)
      .sort('-order')
      .limit(poolSize)
      .sort('-order')
      .depth(2);

    const candidates = response.objects || [];

    // Score and rank the candidates
    return scoreAndRankEpisodes(candidates, currentEpisode, limit);
  } catch (error) {
    console.error('Error fetching related episodes:', error);
    return [];
  }
}

/**
 * Score and rank episodes based on multiple relevance factors
 */
function scoreAndRankEpisodes(
  candidates: EpisodeObject[],
  currentEpisode: EpisodeObject,
  limit: number
): EpisodeObject[] {
  const currentMetadata = currentEpisode.metadata || {};
  const currentGenres = currentMetadata.genres || [];
  const currentHosts = currentMetadata.regular_hosts || [];
  const currentTitle = currentEpisode.title || '';

  const scoredEpisodes = candidates.map((episode) => {
    const metadata = episode.metadata || {};
    const episodeGenres = metadata.genres || [];
    const episodeHosts = metadata.regular_hosts || [];
    const episodeTitle = episode.title || '';

    let score = 0;

    // Title/Series similarity (highest weight)
    const titleSimilarity = calculateTitleSimilarity(currentTitle, episodeTitle);
    score += titleSimilarity * 10;

    // Genre matching
    const genreMatches = episodeGenres.filter((genre: any) =>
      currentGenres.some((currentGenre: any) => currentGenre.id === genre.id)
    ).length;
    score += genreMatches * 3;

    // Host matching
    const hostMatches = episodeHosts.filter((host: any) =>
      currentHosts.some((currentHost: any) => currentHost.id === host.id)
    ).length;
    score += hostMatches * 5;

    // Recency bonus (newer episodes get slight boost)
    const episodeDate = new Date(metadata.broadcast_date || episode.created_at);
    const daysSince = (Date.now() - episodeDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) score += 1;
    if (daysSince < 7) score += 0.5;

    return { episode, score };
  });

  // Sort by score (highest first) and return top episodes
  return scoredEpisodes
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.score > 0) // Only return episodes with some relevance
    .slice(0, limit)
    .map((item) => item.episode);
}

/**
 * Get episodes filtered by show type IDs - dedicated function for homepage sections
 */
export async function getEpisodesByShowType(
  showTypeIds: string[],
  limit: number = 8
): Promise<EpisodeObject[]> {
  try {
    console.log('Fetching episodes by show type IDs:', showTypeIds);

    const response = await cosmic.objects
      .find({
        type: 'episode',
        status: 'published',
        'metadata.type.id': { $in: showTypeIds },
      })
      .props('slug,title,metadata,type,created_at,published_at')
      .limit(limit)
      .sort('-order')
      .depth(2);

    const episodes = response.objects || [];
    console.log(`Found ${episodes.length} episodes for show types:`, showTypeIds);

    return episodes;
  } catch (error) {
    console.error('Error in getEpisodesByShowType:', error);
    return [];
  }
}
