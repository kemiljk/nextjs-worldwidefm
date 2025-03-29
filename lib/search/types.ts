/**
 * Search system types for WorldwideFM
 *
 * This file contains all the type definitions for the search system.
 * These are designed to be flexible and support all content types.
 */

/**
 * ContentTypes represents all possible content types in the system
 */
export type ContentType = "radio-shows" | "posts" | "events" | "videos" | "takeovers";

/**
 * FilterCategories represents all possible filter categories
 */
export type FilterCategory = "genres" | "locations" | "hosts" | "takeovers" | "types";

/**
 * FilterItem represents a single filter option within a category
 */
export interface FilterItem {
  id: string; // Unique identifier
  slug: string; // URL-friendly identifier
  title: string; // Display name
  count?: number; // Optional count of matching items
  type: FilterCategory; // The category this filter belongs to
}

/**
 * SearchFilters represents the current set of filters applied to a search
 */
export interface SearchFilters {
  contentType?: ContentType[];
  genres?: string[]; // Array of genre slugs
  locations?: string[]; // Array of location slugs
  hosts?: string[]; // Array of host slugs
  takeovers?: string[]; // Array of takeover slugs
  search?: string; // Search query string
}

/**
 * SearchItem represents a single item in the search results
 */
export interface SearchItem {
  id: string;
  title: string;
  slug: string;
  description?: string;
  excerpt?: string;
  date?: string;
  image?: string;
  contentType: ContentType;

  // Filter related properties
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];

  // Original data (used for detailed searching)
  metadata?: Record<string, any>;
}

/**
 * SearchState represents the current state of the search
 */
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

/**
 * SearchOptions represents options for configuring the search
 */
export interface SearchOptions {
  limit?: number;
  page?: number;
  fuzzyThreshold?: number;
  loadFromCache?: boolean;
  saveToCacke?: boolean;
}

/**
 * SearchResponse represents the response from a search request
 */
export interface SearchResponse {
  items: SearchItem[];
  total: number;
  hasMore: boolean;
  availableFilters: Record<FilterCategory, FilterItem[]>;
}

/**
 * SearchEngine interface represents the methods required for a search implementation
 */
export interface SearchEngine {
  search(filters: SearchFilters, options?: SearchOptions): Promise<SearchResponse>;
  getInitialContent(limit?: number): Promise<SearchResponse>;
  getAvailableFilters(): Promise<Record<FilterCategory, FilterItem[]>>;
  clearCache(): void;
}
