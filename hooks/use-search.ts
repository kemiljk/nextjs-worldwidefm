import { useState, useCallback, useEffect } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { SearchResult, FilterItem } from '@/lib/search-context';
import { searchContent } from '@/lib/actions';
import { getFilterItems } from '@/lib/search/unified-types';

interface UseSearchReturn {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  results: SearchResult[];
  setResults: (results: SearchResult[]) => void;
  isLoading: boolean;
  performSearch: (term: string) => Promise<void>;
  filters: {
    genres: string[];
    locations: string[];
    hosts: string[];
    takeovers: string[];
    types: string[];
    categories: string[];
  };
  availableFilters: {
    genres: FilterItem[];
    locations: FilterItem[];
    hosts: FilterItem[];
    takeovers: FilterItem[];
    types: FilterItem[];
    categories: FilterItem[];
  };
  toggleGenreFilter: (genre: FilterItem) => void;
  toggleLocationFilter: (location: FilterItem) => void;
  toggleHostFilter: (host: FilterItem) => void;
  toggleTakeoverFilter: (takeover: FilterItem) => void;
  toggleTypeFilter: (type: FilterItem) => void;
  allContent: SearchResult[];
  setAllContent: (content: SearchResult[]) => void;
  error: string | null;
}

export function useSearch(): UseSearchReturn {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allContent, setAllContent] = useState<SearchResult[]>([]);
  const [filters, setFilters] = useState({
    genres: [] as string[],
    locations: [] as string[],
    hosts: [] as string[],
    takeovers: [] as string[],
    types: [] as string[],
    categories: [] as string[],
  });
  const [availableFilters, setAvailableFilters] = useState({
    genres: [] as FilterItem[],
    locations: [] as FilterItem[],
    hosts: [] as FilterItem[],
    takeovers: [] as FilterItem[],
    categories: [] as FilterItem[],
    types: [] as FilterItem[],
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Extract available filters from content
  useEffect(() => {
    if (allContent.length > 0) {
      const newFilters = {
        genres: new Map<string, FilterItem>(),
        locations: new Map<string, FilterItem>(),
        hosts: new Map<string, FilterItem>(),
        takeovers: new Map<string, FilterItem>(),
        categories: new Map<string, FilterItem>(),
      };

      allContent.forEach(item => {
        const filterItems = getFilterItems(item);
        filterItems.genres.forEach(genre => {
          if (genre.slug && !newFilters.genres.has(genre.slug)) {
            newFilters.genres.set(genre.slug, genre);
          }
        });

        filterItems.locations.forEach(location => {
          if (location.slug && !newFilters.locations.has(location.slug)) {
            newFilters.locations.set(location.slug, location);
          }
        });

        filterItems.hosts.forEach(host => {
          if (host.slug && !newFilters.hosts.has(host.slug)) {
            newFilters.hosts.set(host.slug, host);
          }
        });

        filterItems.takeovers.forEach(takeover => {
          if (takeover.slug && !newFilters.takeovers.has(takeover.slug)) {
            newFilters.takeovers.set(takeover.slug, takeover);
          }
        });

        filterItems.categories.forEach(category => {
          if (category.slug && !newFilters.categories.has(category.slug)) {
            newFilters.categories.set(category.slug, category);
          }
        });
      });

      // Sort filters alphabetically by title
      const sortedFilters = Object.fromEntries(
        Object.entries(newFilters).map(([key, map]) => [
          key,
          Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title)),
        ])
      ) as {
        genres: FilterItem[];
        locations: FilterItem[];
        hosts: FilterItem[];
        takeovers: FilterItem[];
        categories: FilterItem[];
      };

      setAvailableFilters(prev => ({
        ...prev,
        ...sortedFilters,
      }));
    }
  }, [allContent]);

  const performSearch = useCallback(async (term: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!term || term.trim().length === 0) {
        setResults([]);
        return;
      }
      // Use server action instead of API route
      const results = await searchContent(term, 'cosmic', 100);
      setResults(Array.isArray(results) ? results : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger search on debounced input
  useEffect(() => {
    const term = debouncedSearchTerm.trim();
    if (term.length >= 2) {
      performSearch(term);
    } else {
      setResults([]);
    }
  }, [debouncedSearchTerm, performSearch]);

  const toggleFilter = useCallback((filter: FilterItem, type: keyof typeof filters) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (newFilters[type].includes(filter.slug)) {
        newFilters[type] = newFilters[type].filter(f => f !== filter.slug);
      } else {
        newFilters[type] = [...newFilters[type], filter.slug];
      }
      return newFilters;
    });
  }, []);

  const toggleGenreFilter = useCallback(
    (genre: FilterItem) => {
      toggleFilter(genre, 'genres');
    },
    [toggleFilter]
  );

  const toggleLocationFilter = useCallback(
    (location: FilterItem) => {
      toggleFilter(location, 'locations');
    },
    [toggleFilter]
  );

  const toggleHostFilter = useCallback(
    (host: FilterItem) => {
      toggleFilter(host, 'hosts');
    },
    [toggleFilter]
  );

  const toggleTakeoverFilter = useCallback(
    (takeover: FilterItem) => {
      toggleFilter(takeover, 'takeovers');
    },
    [toggleFilter]
  );

  const toggleTypeFilter = useCallback(
    (type: FilterItem) => {
      toggleFilter(type, 'types');
    },
    [toggleFilter]
  );

  return {
    searchTerm,
    setSearchTerm,
    results,
    setResults,
    isLoading,
    performSearch,
    filters,
    availableFilters,
    toggleGenreFilter,
    toggleLocationFilter,
    toggleHostFilter,
    toggleTakeoverFilter,
    toggleTypeFilter,
    allContent,
    setAllContent,
    error,
  };
}
