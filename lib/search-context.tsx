'use client';

import { createContext, useContext } from 'react';

export interface FilterItem {
  title: string;
  slug: string;
  type: string;
}

export type SearchResultType = 'posts' | 'episodes' | 'events' | 'videos' | 'takeovers';

export interface SearchResult {
  id: string;
  title: string;
  type: SearchResultType;
  description?: string;
  excerpt?: string;
  image?: string;
  slug: string;
  date?: string;
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];
  featured?: boolean;
  metadata?: any;
}

export interface SearchFilters {
  type?: SearchResultType;
  genres?: string[];
  locations?: string[];
  hosts?: string[];
  takeovers?: string[];
}

export interface SearchContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  results: SearchResult[];
  setResults: (results: SearchResult[]) => void;
  isLoading: boolean;
  performSearch: (term: string) => Promise<void>;
  availableFilters: {
    genres: FilterItem[];
    locations: FilterItem[];
    hosts: FilterItem[];
    takeovers: FilterItem[];
    types: FilterItem[];
  };
  toggleGenreFilter: (genre: FilterItem) => void;
  toggleLocationFilter: (location: FilterItem) => void;
  toggleHostFilter: (host: FilterItem) => void;
  toggleTakeoverFilter: (takeover: FilterItem) => void;
  toggleTypeFilter: (type: FilterItem) => void;
  allContent: SearchResult[];
  error: string | null;
}

export const SearchContext = createContext<SearchContextType>({
  searchTerm: '',
  setSearchTerm: () => {},
  filters: {},
  setFilters: () => {},
  results: [],
  setResults: () => {},
  isLoading: false,
  performSearch: () => Promise.resolve(),
  availableFilters: {
    genres: [],
    locations: [],
    hosts: [],
    takeovers: [],
    types: [],
  },
  toggleGenreFilter: () => {},
  toggleLocationFilter: () => {},
  toggleHostFilter: () => {},
  toggleTakeoverFilter: () => {},
  toggleTypeFilter: () => {},
  allContent: [],
  error: null,
});

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
