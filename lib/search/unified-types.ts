/**
 * Unified search types for WorldwideFM
 *
 * This file provides a type-safe, maintainable approach to search results
 * using discriminated unions for different content types.
 */

export type SearchResultType = 'posts' | 'episodes' | 'events' | 'videos' | 'takeovers' | 'hosts-series';

export interface FilterItem {
  title: string;
  slug: string;
  type: string;
}

// Base interface with common properties
interface BaseSearchResult {
  id: string;
  title: string;
  slug: string;
  image?: string;
  date?: string;
  featured?: boolean;
  metadata?: any;
}

// Discriminated union for different content types
export type SearchResult =
  | PostSearchResult
  | EpisodeSearchResult
  | EventSearchResult
  | VideoSearchResult
  | TakeoverSearchResult
  | HostSearchResult;

// Post-specific search result
export interface PostSearchResult extends BaseSearchResult {
  type: 'posts';
  description?: string;
  excerpt?: string;
  categories: FilterItem[]; // Posts have categories, not genres
  author?: string;
  postType?: 'article' | 'video' | 'event';
}

// Episode-specific search result
export interface EpisodeSearchResult extends BaseSearchResult {
  type: 'episodes';
  description?: string;
  excerpt?: string;
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];
  duration?: string;
  broadcastTime?: string;
}

// Event-specific search result
export interface EventSearchResult extends BaseSearchResult {
  type: 'events';
  description?: string;
  location?: string;
  eventDate?: string;
  ticketLink?: string;
}

// Video-specific search result
export interface VideoSearchResult extends BaseSearchResult {
  type: 'videos';
  description?: string;
  excerpt?: string;
  categories: FilterItem[]; // Videos have categories, not genres
  videoUrl?: string;
  duration?: string;
}

// Takeover-specific search result
export interface TakeoverSearchResult extends BaseSearchResult {
  type: 'takeovers';
  description?: string;
  hosts: FilterItem[];
}

// Host-specific search result
export interface HostSearchResult extends BaseSearchResult {
  type: 'hosts-series';
  description?: string;
  genres: FilterItem[];
  locations: FilterItem[];
}

// Type guards for type-safe handling
export function isPostSearchResult(result: SearchResult): result is PostSearchResult {
  return result.type === 'posts';
}

export function isEpisodeSearchResult(result: SearchResult): result is EpisodeSearchResult {
  return result.type === 'episodes';
}

export function isEventSearchResult(result: SearchResult): result is EventSearchResult {
  return result.type === 'events';
}

export function isVideoSearchResult(result: SearchResult): result is VideoSearchResult {
  return result.type === 'videos';
}

export function isTakeoverSearchResult(result: SearchResult): result is TakeoverSearchResult {
  return result.type === 'takeovers';
}

export function isHostSearchResult(result: SearchResult): result is HostSearchResult {
  return result.type === 'hosts-series';
}

// Generic result type that works with both discriminated union and simple interface
export interface GenericSearchResult {
  type: string;
  genres?: FilterItem[];
  locations?: FilterItem[];
  hosts?: FilterItem[];
  takeovers?: FilterItem[];
  categories?: FilterItem[];
}

// Helper function to get filter items - accepts both SearchResult types
export function getFilterItems(result: GenericSearchResult): {
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];
  categories: FilterItem[];
} {
  return {
    genres: result.genres || [],
    locations: result.locations || [],
    hosts: result.hosts || [],
    takeovers: result.takeovers || [],
    categories: result.categories || [],
  };
}

// Search filters interface
export interface SearchFilters {
  type?: SearchResultType[];
  genres?: string[];
  locations?: string[];
  hosts?: string[];
  takeovers?: string[];
  categories?: string[];
}

// Generic search result for context (compatible with both type systems)
export interface AnySearchResult extends GenericSearchResult {
  id: string;
  slug: string;
  title: string;
  description?: string;
  excerpt?: string;
  image?: string;
  date?: string;
  featured?: boolean;
  metadata?: any;
}

// Search context interface
export interface SearchContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  results: AnySearchResult[];
  setResults: (results: AnySearchResult[]) => void;
  isLoading: boolean;
  isInitialized: boolean;
  initializeSearch: () => Promise<void>;
  performSearch: (term: string) => Promise<void>;
  availableFilters: {
    genres: FilterItem[];
    locations: FilterItem[];
    hosts: FilterItem[];
    takeovers: FilterItem[];
    categories: FilterItem[];
    types: FilterItem[];
  };
  toggleGenreFilter: (genre: FilterItem) => void;
  toggleLocationFilter: (location: FilterItem) => void;
  toggleHostFilter: (host: FilterItem) => void;
  toggleTakeoverFilter: (takeover: FilterItem) => void;
  toggleCategoryFilter: (category: FilterItem) => void;
  toggleTypeFilter: (type: FilterItem) => void;
  allContent: AnySearchResult[];
  error: string | null;
}
