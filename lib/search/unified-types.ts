export type SearchResultType =
  | 'posts'
  | 'episodes'
  | 'events'
  | 'videos'
  | 'takeovers'
  | 'hosts-series';

export interface FilterItem {
  title: string;
  slug: string;
  type: string;
}

interface BaseSearchResult {
  id: string;
  title: string;
  slug: string;
  image?: string;
  date?: string;
  featured?: boolean;
  metadata?: any;
}

export type SearchResult =
  | PostSearchResult
  | EpisodeSearchResult
  | EventSearchResult
  | VideoSearchResult
  | TakeoverSearchResult
  | HostSearchResult;

export interface PostSearchResult extends BaseSearchResult {
  type: 'posts';
  description?: string;
  excerpt?: string;
  categories: FilterItem[]; // Posts have categories, not genres
  author?: string;
  postType?: 'article' | 'video' | 'event';
}

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

export interface EventSearchResult extends BaseSearchResult {
  type: 'events';
  description?: string;
  location?: string;
  eventDate?: string;
  ticketLink?: string;
}

export interface VideoSearchResult extends BaseSearchResult {
  type: 'videos';
  description?: string;
  excerpt?: string;
  categories: FilterItem[]; // Videos have categories, not genres
  videoUrl?: string;
  duration?: string;
}

export interface TakeoverSearchResult extends BaseSearchResult {
  type: 'takeovers';
  description?: string;
  hosts: FilterItem[];
}

export interface HostSearchResult extends BaseSearchResult {
  type: 'hosts-series';
  description?: string;
  genres: FilterItem[];
  locations: FilterItem[];
}

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

export interface GenericSearchResult {
  type: string;
  genres?: FilterItem[];
  locations?: FilterItem[];
  hosts?: FilterItem[];
  takeovers?: FilterItem[];
  categories?: FilterItem[];
}

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

export interface SearchFilters {
  type?: SearchResultType[];
  genres?: string[];
  locations?: string[];
  hosts?: string[];
  takeovers?: string[];
  categories?: string[];
}

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
