/**
 * World Wide FM Search Engine
 *
 * This file implements the search engine using Fuse.js for fuzzy searching
 * and implements client-side caching for improved performance.
 */

import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import {
  SearchEngine,
  SearchFilters,
  SearchItem,
  SearchOptions,
  SearchResponse,
  FilterCategory,
  FilterItem,
  ContentType,
} from './types';
import { getAllPosts, getVideos } from '../actions';

// Constants
const DEFAULT_LIMIT = 20;
const DEFAULT_CACHE_EXPIRY = 1000 * 60 * 15; // 15 minutes
const FILTERS_CACHE_KEY = 'wwfm_search_filters';
const CONTENT_CACHE_KEY = 'wwfm_search_content';

/**
 * World Wide FM Search Engine Implementation
 */
export class WWFMSearchEngine implements SearchEngine {
  private fuseInstance: Fuse<SearchItem> | null = null;
  private allContent: SearchItem[] = [];
  private allFilters: Record<FilterCategory, FilterItem[]> = {
    genres: [],
    locations: [],
    hosts: [],
    takeovers: [],
    types: [],
  };

  private contentLoaded = false;
  private filtersLoaded = false;

  // Fuse.js configuration for improved searching
  private readonly fuseOptions: IFuseOptions<SearchItem> = {
    keys: [
      { name: 'title', weight: 2 },
      { name: 'description', weight: 1.5 },
      { name: 'excerpt', weight: 1 },
      { name: 'genres.title', weight: 0.7 },
      { name: 'hosts.title', weight: 0.8 },
      { name: 'takeovers.title', weight: 0.8 },
      { name: 'locations.title', weight: 0.6 },
    ],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
    useExtendedSearch: true,
  };

  /**
   * Initialize with optional content preloading
   */
  constructor(preloadContent = false) {
    // Only preload content if we're in the browser to avoid SSR issues
    if (preloadContent && typeof window !== 'undefined') {
      this.getInitialContent().catch(err => console.error('Failed to preload content:', err));
      this.getAvailableFilters().catch(err => console.error('Failed to preload filters:', err));
    }
  }

  /**
   * Get initial content batch - used for initial rendering and search
   */
  async getInitialContent(limit = DEFAULT_LIMIT): Promise<SearchResponse> {
    // Disable cache: always fetch fresh data
    // const cachedContent = this.loadFromCache<SearchItem[]>(CONTENT_CACHE_KEY);
    // if (cachedContent && cachedContent.length > 0) {
    //   console.log(`Loaded ${cachedContent.length} items from cache`);
    //   this.allContent = cachedContent;
    //   this.initFuse(cachedContent);
    //   this.contentLoaded = true;
    //
    //   // Return first batch from cache
    //   return {
    //     items: cachedContent.slice(0, limit),
    //     total: cachedContent.length,
    //     hasMore: cachedContent.length > limit,
    //     availableFilters: await this.getAvailableFilters(),
    //   };
    // }

    // Nothing in cache, load from API
    try {
      const [episodes, postsRes, videosRes] = await Promise.all([
        import('@/lib/episode-service').then(m => m.getEpisodesForShows({ limit: 100 })),
        getAllPosts(),
        getVideos({ limit: 20 }),
      ]);

      // Map to unified format
      const items: SearchItem[] = [
        ...mapEpisodesToSearchItems(episodes.shows || []),
        ...mapPostsToSearchItems(postsRes.posts || []),
        ...mapVideosToSearchItems(videosRes.videos || []),
      ];

      // Sort by date (newest first), prioritizing broadcast_date for episodes
      items.sort((a, b) => {
        let dateA: number, dateB: number;

        // For episodes, prioritize broadcast_date if available
        if (a.contentType === 'episodes') {
          const episodeA = a.metadata;
          dateA = episodeA?.broadcast_date
            ? new Date(episodeA.broadcast_date).getTime()
            : a.date
              ? new Date(a.date).getTime()
              : 0;
        } else {
          dateA = a.date ? new Date(a.date).getTime() : 0;
        }

        if (b.contentType === 'episodes') {
          const episodeB = b.metadata;
          dateB = episodeB?.broadcast_date
            ? new Date(episodeB.broadcast_date).getTime()
            : b.date
              ? new Date(b.date).getTime()
              : 0;
        } else {
          dateB = b.date ? new Date(b.date).getTime() : 0;
        }

        return dateB - dateA;
      });

      // Update instance state
      this.allContent = items;
      this.initFuse(items);
      this.contentLoaded = true;

      // Extract and update available filters
      this.updateFiltersFromContent(items);

      // Return first batch
      return {
        items: items.slice(0, limit),
        total: items.length,
        hasMore: items.length > limit,
        availableFilters: this.allFilters,
      };
    } catch (error) {
      console.error('Failed to fetch initial content:', error);
      throw error;
    }
  }

  /**
   * Get all available filters for category filtering
   */
  async getAvailableFilters(): Promise<Record<FilterCategory, FilterItem[]>> {
    // Disable cache: always fetch fresh filters
    // const cachedFilters = this.loadFromCache<Record<FilterCategory, FilterItem[]>>(FILTERS_CACHE_KEY);
    // if (cachedFilters && cachedFilters.genres?.length && cachedFilters.hosts?.length) {
    //   console.log(`Loaded filters from cache: ${cachedFilters.genres.length} genres, ${cachedFilters.hosts.length} hosts`);
    //   this.allFilters = cachedFilters;
    //   this.filtersLoaded = true;
    //   return cachedFilters;
    // }

    // Build content type filters
    const typeFilters: FilterItem[] = [
      { id: 'episodes', slug: 'episodes', title: 'Episodes', type: 'types' },
      { id: 'posts', slug: 'posts', title: 'Posts', type: 'types' },
      { id: 'videos', slug: 'videos', title: 'Videos', type: 'types' },
      { id: 'events', slug: 'events', title: 'Events', type: 'types' },
      { id: 'takeovers', slug: 'takeovers', title: 'Takeovers', type: 'types' },
    ];

    // Ensure content is loaded so we can extract filters
    if (!this.contentLoaded) {
      await this.getInitialContent(100);
    }

    // Update instance state and add content type filters
    this.allFilters.types = typeFilters;
    this.filtersLoaded = true;

    // Save to cache
    // this.saveToCache(FILTERS_CACHE_KEY, this.allFilters);

    return this.allFilters;
  }

  /**
   * Execute search with filters and options
   */
  async search(filters: SearchFilters, options: SearchOptions = {}): Promise<SearchResponse> {
    // Ensure content is loaded
    if (!this.contentLoaded) {
      await this.getInitialContent(100);
    }

    const { limit = DEFAULT_LIMIT, page = 1 } = options;

    // If search query or filters not provided, just paginate all content
    if (!filters.search && !this.hasActiveFilters(filters)) {
      return this.paginateResults(this.allContent, page, limit);
    }

    let results = this.allContent;

    // Apply content type filter if specified
    if (filters.contentType && filters.contentType.length > 0) {
      results = results.filter(item =>
        filters.contentType?.includes(item.contentType as ContentType)
      );
    }

    // Apply genre filters if specified
    if (filters.genres && filters.genres.length > 0) {
      results = results.filter(item =>
        item.genres.some(genre => filters.genres?.includes(genre.slug))
      );
    }

    // Apply location filters if specified
    if (filters.locations && filters.locations.length > 0) {
      results = results.filter(item =>
        item.locations.some(location => filters.locations?.includes(location.slug))
      );
    }

    // Apply host filters if specified
    if (filters.hosts && filters.hosts.length > 0) {
      results = results.filter(item => item.hosts.some(host => filters.hosts?.includes(host.slug)));
    }

    // Apply takeover filters if specified
    if (filters.takeovers && filters.takeovers.length > 0) {
      results = results.filter(item =>
        item.takeovers.some(takeover => filters.takeovers?.includes(takeover.slug))
      );
    }

    // Apply search query if specified
    if (filters.search && this.fuseInstance) {
      // Get fuzzy search results from Fuse
      const searchResults = this.fuseInstance.search(filters.search, { limit: 500 });

      // Keep only results that also match the other filters
      const searchedItems = searchResults.map(result => result.item);
      results = results.filter(item => searchedItems.some(searchItem => searchItem.id === item.id));

      // Sort by search score (best matches first)
      results = searchResults
        .filter(result => results.some(item => item.id === result.item.id))
        .sort((a, b) => (a.score || 1) - (b.score || 1))
        .map(result => result.item);
    }

    // Update available filters based on the filtered results
    const availableFilters = this.calculateAvailableFilters(results);

    // Return paginated results
    return this.paginateResults(results, page, limit, availableFilters);
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    try {
      // Check if we're in the browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
      }

      localStorage.removeItem(CONTENT_CACHE_KEY);
      localStorage.removeItem(FILTERS_CACHE_KEY);
      console.log('Search cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Initialize Fuse.js with content
   */
  private initFuse(items: SearchItem[]): void {
    this.fuseInstance = new Fuse(items, this.fuseOptions);
  }

  /**
   * Check if there are any active filters
   */
  private hasActiveFilters(filters: SearchFilters): boolean {
    return !!(
      (filters.contentType && filters.contentType.length > 0) ||
      (filters.genres && filters.genres.length > 0) ||
      (filters.locations && filters.locations.length > 0) ||
      (filters.hosts && filters.hosts.length > 0) ||
      (filters.takeovers && filters.takeovers.length > 0)
    );
  }

  /**
   * Calculate available filters based on the filtered results
   */
  private calculateAvailableFilters(results: SearchItem[]): Record<FilterCategory, FilterItem[]> {
    // Create maps to track filters with counts
    const genresMap = new Map<string, FilterItem & { count: number }>();
    const locationsMap = new Map<string, FilterItem & { count: number }>();
    const hostsMap = new Map<string, FilterItem & { count: number }>();
    const takeoversMap = new Map<string, FilterItem & { count: number }>();
    const typesMap = new Map<string, FilterItem & { count: number }>();

    // Initialize type filters
    this.allFilters.types.forEach(type => {
      typesMap.set(type.slug, { ...type, count: 0 });
    });

    // Count occurrences in results
    results.forEach(item => {
      // Count content types
      const typeKey = item.contentType;
      const typeItem = typesMap.get(typeKey);
      if (typeItem) {
        typeItem.count++;
      }

      // Count genres
      item.genres.forEach(genre => {
        if (!genresMap.has(genre.slug)) {
          genresMap.set(genre.slug, { ...genre, count: 1 });
        } else {
          const existing = genresMap.get(genre.slug)!;
          existing.count++;
        }
      });

      // Count locations
      item.locations.forEach(location => {
        if (!locationsMap.has(location.slug)) {
          locationsMap.set(location.slug, { ...location, count: 1 });
        } else {
          const existing = locationsMap.get(location.slug)!;
          existing.count++;
        }
      });

      // Count hosts
      item.hosts.forEach(host => {
        if (!hostsMap.has(host.slug)) {
          hostsMap.set(host.slug, { ...host, count: 1 });
        } else {
          const existing = hostsMap.get(host.slug)!;
          existing.count++;
        }
      });

      // Count takeovers
      item.takeovers.forEach(takeover => {
        if (!takeoversMap.has(takeover.slug)) {
          takeoversMap.set(takeover.slug, { ...takeover, count: 1 });
        } else {
          const existing = takeoversMap.get(takeover.slug)!;
          existing.count++;
        }
      });
    });

    // Sort filters by count (descending) then by title (ascending)
    const sortByCountAndTitle = (
      a: FilterItem & { count: number },
      b: FilterItem & { count: number }
    ) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.title.localeCompare(b.title);
    };

    // Convert maps to arrays and sort
    return {
      genres: Array.from(genresMap.values()).sort(sortByCountAndTitle),
      locations: Array.from(locationsMap.values()).sort(sortByCountAndTitle),
      hosts: Array.from(hostsMap.values()).sort(sortByCountAndTitle),
      takeovers: Array.from(takeoversMap.values()).sort(sortByCountAndTitle),
      types: Array.from(typesMap.values()).sort(sortByCountAndTitle),
    };
  }

  /**
   * Extract filters from content items
   */
  private updateFiltersFromContent(items: SearchItem[]): void {
    // Maps for deduplication
    const genresMap = new Map<string, FilterItem>();
    const locationsMap = new Map<string, FilterItem>();
    const hostsMap = new Map<string, FilterItem>();
    const takeoversMap = new Map<string, FilterItem>();

    // Extract filters from each item
    items.forEach(item => {
      // Add genres
      item.genres.forEach(genre => {
        if (!genresMap.has(genre.slug)) {
          genresMap.set(genre.slug, genre);
        }
      });

      // Add locations
      item.locations.forEach(location => {
        if (!locationsMap.has(location.slug)) {
          locationsMap.set(location.slug, location);
        }
      });

      // Add hosts
      item.hosts.forEach(host => {
        if (!hostsMap.has(host.slug)) {
          hostsMap.set(host.slug, host);
        }
      });

      // Add takeovers
      item.takeovers.forEach(takeover => {
        if (!takeoversMap.has(takeover.slug)) {
          takeoversMap.set(takeover.slug, takeover);
        }
      });
    });

    // Sort filters alphabetically
    const sortByTitle = (a: FilterItem, b: FilterItem) => a.title.localeCompare(b.title);

    // Update filter lists
    this.allFilters.genres = Array.from(genresMap.values()).sort(sortByTitle);
    this.allFilters.locations = Array.from(locationsMap.values()).sort(sortByTitle);
    this.allFilters.hosts = Array.from(hostsMap.values()).sort(sortByTitle);
    this.allFilters.takeovers = Array.from(takeoversMap.values()).sort(sortByTitle);
  }

  /**
   * Paginate results for the response
   */
  private paginateResults(
    results: SearchItem[],
    page: number,
    limit: number,
    availableFilters?: Record<FilterCategory, FilterItem[]>
  ): SearchResponse {
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedItems = results.slice(start, end);

    return {
      items: paginatedItems,
      total: results.length,
      hasMore: end < results.length,
      availableFilters: availableFilters || this.calculateAvailableFilters(results),
    };
  }

  /**
   * Load data from local storage cache
   */
  private loadFromCache<T>(key: string): T | null {
    try {
      // Check if we're in the browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return null;
      }

      const cachedData = localStorage.getItem(key);
      if (!cachedData) return null;

      const data = JSON.parse(cachedData);

      // Check if cache has expired
      if (data._timestamp && Date.now() - data._timestamp > DEFAULT_CACHE_EXPIRY) {
        console.log(`Cache expired for ${key}`);
        return null;
      }

      return data.value as T;
    } catch (error) {
      console.error(`Error loading from cache (${key}):`, error);
      return null;
    }
  }

  /**
   * Save data to local storage cache
   */
  private saveToCache(key: string, value: any): void {
    try {
      // Check if we're in the browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
      }

      const data = {
        _timestamp: Date.now(),
        value,
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving to cache (${key}):`, error);
    }
  }
}

/**
 * Helper function to map episodes to search items
 */
export function mapEpisodesToSearchItems(episodes: any[]): SearchItem[] {
  return episodes.map(episode => ({
    id: episode.id || episode.slug,
    title: episode.title || episode.name,
    slug: episode.slug,
    description: episode.description || '',
    excerpt: episode.description || episode.title || '',
    date: episode.created_time || episode.broadcast_date || episode.created_at,
    image: episode.pictures?.extra_large || episode.enhanced_image || '',
    contentType: 'episodes',
    genres: (episode.genres || episode.enhanced_genres || []).filter(Boolean).map((genre: any) => ({
      id: genre.id || genre.slug,
      slug: genre.slug || genre.title?.toLowerCase().replace(/\s+/g, '-') || '',
      title: genre.title || genre.name || '',
      type: 'genres',
    })),
    locations: (episode.locations || []).filter(Boolean).map((location: any) => ({
      id: location.id || location.slug,
      slug: location.slug || location.title?.toLowerCase().replace(/\s+/g, '-') || '',
      title: location.title || location.name || '',
      type: 'locations',
    })),
    hosts: (episode.hosts || episode.enhanced_hosts || episode.regular_hosts || [])
      .filter(Boolean)
      .map((host: any) => ({
        id: host.id || host.slug || host.username,
        slug: host.slug || host.username || '',
        title: host.title || host.name || '',
        type: 'hosts',
      })),
    takeovers: (episode.takeovers || []).filter(Boolean).map((takeover: any) => ({
      id: takeover.id || takeover.slug,
      slug: takeover.slug || '',
      title: takeover.title || takeover.name || '',
      type: 'takeovers',
    })),
    metadata: episode, // Store full episode for detail pages
  }));
}

/**
 * Helper function to map shows to search items (legacy function for backward compatibility)
 */
export function mapShowsToSearchItems(shows: any[]): SearchItem[] {
  return shows.map(show => {
    // Detect Mixcloud shows by presence of 'key' and 'name' fields
    const isMixcloud = typeof show.key === 'string' && typeof show.name === 'string';
    if (isMixcloud) {
      // Mixcloud show mapping
      return {
        id: show.key,
        title: show.name,
        slug: show.slug || (show.key ? show.key.split('/').pop() : ''),
        description: show.description || '',
        excerpt: show.name || '',
        date: show.created_time || undefined,
        image:
          show.pictures?.extra_large ||
          show.pictures?.large ||
          show.pictures?.medium ||
          show.pictures?.thumbnail ||
          '',
        contentType: 'episodes',
        genres: (show.tags || []).filter(Boolean).map((tag: any) => ({
          id: tag.key || tag.name,
          slug: tag.name?.toLowerCase().replace(/\s+/g, '-') || tag.key || '',
          title: tag.name || '',
          type: 'genres',
        })),
        locations: [],
        hosts: (show.hosts || []).filter(Boolean).map((host: any) => ({
          id: host.key || host.username,
          slug: host.username || host.key || '',
          title: host.name || host.username || '',
          type: 'hosts',
        })),
        takeovers: [],
        metadata: show, // Store full Mixcloud show for detail pages
      };
    } else {
      // Cosmic show mapping (as before)
      return {
        id: show.id,
        title: show.title,
        slug: show.slug,
        description: show.metadata?.description || '',
        excerpt: show.metadata?.subtitle || '',
        date: show.metadata?.broadcast_date || show.created_at,
        image:
          show.metadata?.external_image_url ||
          show.metadata?.image?.imgix_url ||
          show.metadata?.image?.url ||
          '',
        contentType: 'episodes',
        genres: mapFilterItems(show.metadata?.genres || [], 'genres'),
        locations: mapFilterItems(show.metadata?.locations || [], 'locations'),
        hosts: mapFilterItems(show.metadata?.regular_hosts || [], 'hosts'),
        takeovers: mapFilterItems(show.metadata?.takeovers || [], 'takeovers'),
        metadata: show.metadata,
      };
    }
  });
}

/**
 * Helper function to map posts to search items
 */
function mapPostsToSearchItems(posts: any[]): SearchItem[] {
  return posts.map(post => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    description: post.metadata?.description || '',
    excerpt: post.metadata?.excerpt || post.metadata?.content || '',
    date: post.metadata?.date || post.created_at,
    image:
      post.metadata?.external_image_url ||
      post.metadata?.image?.imgix_url ||
      post.metadata?.image?.url ||
      '',
    contentType: 'posts',
    genres: mapFilterItems(post.metadata?.categories || [], 'genres'),
    locations: [],
    hosts: [],
    takeovers: [],
    metadata: post.metadata,
  }));
}

/**
 * Helper function to map videos to search items
 */
function mapVideosToSearchItems(videos: any[]): SearchItem[] {
  return videos.map(video => ({
    id: video.id,
    title: video.title,
    slug: video.slug,
    description: video.metadata?.description || '',
    excerpt: video.metadata?.excerpt || '',
    date: video.metadata?.date || video.created_at,
    image:
      video.metadata?.external_image_url ||
      video.metadata?.image?.imgix_url ||
      video.metadata?.image?.url ||
      video.metadata?.thumbnail?.imgix_url ||
      '',
    contentType: 'videos',
    genres: mapFilterItems(video.metadata?.genres || [], 'genres'),
    locations: mapFilterItems(video.metadata?.locations || [], 'locations'),
    hosts: mapFilterItems(video.metadata?.hosts || [], 'hosts'),
    takeovers: [],
    metadata: video.metadata,
  }));
}

/**
 * Helper function to map filter items to our standard format
 */
function mapFilterItems(items: any[], type: FilterCategory): FilterItem[] {
  if (!items || !Array.isArray(items)) return [];

  return items
    .filter(item => item && (item.title || item.name))
    .map(item => ({
      id: item.id || item.slug || '',
      slug: item.slug || item.id || '',
      title: item.title || item.name || '',
      type,
    }));
}

// Create and export a singleton instance without preloading to avoid SSR issues
export const searchEngine = new WWFMSearchEngine(false);
