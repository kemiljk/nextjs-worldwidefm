import { useState, useCallback, useEffect } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { SearchResult, FilterItem } from '@/lib/search-context';
import { searchContent } from '@/lib/actions';

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
  };
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
  });
  const [availableFilters, setAvailableFilters] = useState({
    genres: [] as FilterItem[],
    locations: [] as FilterItem[],
    hosts: [] as FilterItem[],
    takeovers: [] as FilterItem[],
    types: [] as FilterItem[],
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Extract available filters from content
  useEffect(() => {
    if (allContent.length > 0) {
      const newFilters = {
        genres: [] as FilterItem[],
        locations: [] as FilterItem[],
        hosts: [] as FilterItem[],
        takeovers: [] as FilterItem[],
        types: [] as FilterItem[],
      };

      allContent.forEach(item => {
        // Add genres
        item.genres?.forEach(genre => {
          if (!newFilters.genres.some(g => g.slug === genre.slug)) {
            newFilters.genres.push(genre);
          }
        });

        // Add locations
        item.locations?.forEach(location => {
          if (!newFilters.locations.some(l => l.slug === location.slug)) {
            newFilters.locations.push(location);
          }
        });

        // Add hosts
        item.hosts?.forEach(host => {
          if (!newFilters.hosts.some(h => h.slug === host.slug)) {
            newFilters.hosts.push(host);
          }
        });

        // Add takeovers
        item.takeovers?.forEach(takeover => {
          if (!newFilters.takeovers.some(t => t.slug === takeover.slug)) {
            newFilters.takeovers.push(takeover);
          }
        });
      });

      // Sort filters alphabetically by title
      Object.keys(newFilters).forEach(key => {
        newFilters[key as keyof typeof newFilters].sort((a, b) => a.title.localeCompare(b.title));
      });

      setAvailableFilters(newFilters);
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
