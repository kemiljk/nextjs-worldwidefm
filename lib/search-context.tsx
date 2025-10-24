'use client';

import { createContext, useContext } from 'react';
import { SearchContextType as UnifiedSearchContextType } from './search/unified-types';

// Re-export types for backward compatibility
export type { SearchResult, SearchFilters, FilterItem } from './search/unified-types';

// Use the unified search context type
export type SearchContextType = UnifiedSearchContextType;

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
    categories: [],
    types: [],
  },
  toggleGenreFilter: () => {},
  toggleLocationFilter: () => {},
  toggleHostFilter: () => {},
  toggleTakeoverFilter: () => {},
  toggleCategoryFilter: () => {},
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
