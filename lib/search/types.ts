export type ContentType = 'episodes' | 'posts' | 'events' | 'videos' | 'takeovers' | 'hosts-series';

export type FilterCategory =
  | 'genres'
  | 'locations'
  | 'hosts'
  | 'takeovers'
  | 'types'
  | 'categories';

export interface FilterItem {
  id: string;
  slug: string;
  title: string;
  count?: number;
  type: FilterCategory;
}

export interface SearchFilters {
  contentType?: ContentType[];
  genres?: string[];
  locations?: string[];
  hosts?: string[];
  takeovers?: string[];
  categories?: string[];
  search?: string;
}

export interface SearchItem {
  id: string;
  title: string;
  slug: string;
  description?: string;
  excerpt?: string;
  date?: string;
  image?: string;
  contentType: ContentType;

  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];

  // Original data (used for detailed searching)
  metadata?: Record<string, any>;
}

export interface SearchState {
  items: SearchItem[];
  filters: SearchFilters;
  availableFilters: Record<FilterCategory, FilterItem[]>;
  loading: boolean;
  hasMore: boolean;
  total: number;
  page: number;
  error: string | null;
}

export interface SearchOptions {
  limit?: number;
  page?: number;
  fuzzyThreshold?: number;
  loadFromCache?: boolean;
  saveToCacke?: boolean;
}

export interface SearchResponse {
  items: SearchItem[];
  total: number;
  hasMore: boolean;
  availableFilters: Record<FilterCategory, FilterItem[]>;
}

export interface SearchEngine {
  search(filters: SearchFilters, options?: SearchOptions): Promise<SearchResponse>;
  getInitialContent(limit?: number): Promise<SearchResponse>;
  getAvailableFilters(): Promise<Record<FilterCategory, FilterItem[]>>;
  clearCache(): void;
}
