'use client';

import { ReactNode, useCallback, useRef, useState } from 'react';
import {
  FilterItem,
  SearchContextType,
  SearchContext,
  AnySearchResult,
} from '@/lib/search-context';
import { getAllSearchResultsAndFilters } from '@/lib/search-engine';
import { getFilterItems, SearchFilters, SearchResultType } from '@/lib/search/unified-types';

interface SearchProviderProps {
  children: ReactNode;
}

const TYPE_FILTERS: FilterItem[] = [
  { slug: 'episodes', title: 'Episodes', type: 'types' },
  { slug: 'posts', title: 'Posts', type: 'types' },
  { slug: 'events', title: 'Events', type: 'types' },
  { slug: 'videos', title: 'Videos', type: 'types' },
  { slug: 'takeovers', title: 'Takeovers', type: 'types' },
  { slug: 'hosts-series', title: 'Hosts & Series', type: 'types' },
];

export default function SearchProvider({ children }: SearchProviderProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<AnySearchResult[]>([]);
  const [allContent, setAllContent] = useState<AnySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef(false);
  const [availableFilters, setAvailableFilters] = useState<{
    genres: FilterItem[];
    locations: FilterItem[];
    hosts: FilterItem[];
    takeovers: FilterItem[];
    categories: FilterItem[];
    types: FilterItem[];
  }>({
    genres: [],
    locations: [],
    hosts: [],
    takeovers: [],
    categories: [],
    types: TYPE_FILTERS,
  });

  // Lazy initialization - only fetch when search is first used
  const initializeSearch = useCallback(async () => {
    // Skip if already initialized or currently initializing
    if (isInitialized || initializingRef.current) return;

    initializingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const { results, filters } = await getAllSearchResultsAndFilters();
      setAllContent(results);
      setResults(results);
      setAvailableFilters(prev => ({
        genres: filters.genres,
        locations: filters.locations,
        hosts: filters.hosts,
        takeovers: prev.takeovers,
        categories: prev.categories,
        types: prev.types.length ? prev.types : TYPE_FILTERS,
      }));
      setIsInitialized(true);
    } catch {
      setError('Failed to load content. Please try again later.');
      setAllContent([]);
      setResults([]);
      setAvailableFilters({
        genres: [],
        locations: [],
        hosts: [],
        takeovers: [],
        categories: [],
        types: TYPE_FILTERS,
      });
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  }, [isInitialized]);

  // Perform search - automatically initializes if needed
  const performSearch = useCallback(
    async (term: string) => {
      // Auto-initialize if not yet initialized
      if (!isInitialized && !initializingRef.current) {
        await initializeSearch();
      }

      console.log(`Performing search with term: "${term}"`);
      setIsLoading(true);
      setError(null);

      try {
        if (allContent.length > 0) {
          console.log(
            `Filtering existing ${allContent.length} items with term: "${term}" and filters:`,
            filters
          );

          let filtered = [...allContent];

          // Filter by search term if provided
          if (term) {
            const lowercaseTerm = term.toLowerCase();
            filtered = filtered.filter(item => {
              const titleMatch = item.title?.toLowerCase().includes(lowercaseTerm) ?? false;
              const descriptionMatch =
                item.description?.toLowerCase().includes(lowercaseTerm) ?? false;
              const excerptMatch = (
                'excerpt' in item && typeof item.excerpt === 'string'
                  ? item.excerpt.toLowerCase()
                  : ''
              ).includes(lowercaseTerm);

              const filterItems = getFilterItems(item);
              const hostsMatch = filterItems.hosts.some(host =>
                host.title?.toLowerCase().includes(lowercaseTerm)
              );
              const takeoversMatch = filterItems.takeovers.some(takeover =>
                takeover.title?.toLowerCase().includes(lowercaseTerm)
              );
              const genresMatch = filterItems.genres.some(genre =>
                genre.title?.toLowerCase().includes(lowercaseTerm)
              );

              // Search metadata fields
              const metadataMatch =
                item.metadata && typeof item.metadata === 'object'
                  ? Object.entries(item.metadata).some(
                      ([_, value]) =>
                        typeof value === 'string' && value.toLowerCase().includes(lowercaseTerm)
                    )
                  : false;

              // Check people-related fields in metadata
              let peopleMatch = false;
              if (item.metadata && typeof item.metadata === 'object') {
                const peopleFields = [
                  'regular_hosts',
                  'guest_hosts',
                  'guests',
                  'artists',
                  'people',
                  'contributors',
                ];
                peopleMatch = peopleFields.some(field => {
                  const arr = Array.isArray(item.metadata[field]) ? item.metadata[field] : [];
                  return arr.some((person: any) => {
                    if (typeof person === 'string') {
                      return person.toLowerCase().includes(lowercaseTerm);
                    } else if (person && typeof person === 'object') {
                      return Object.values(person).some(
                        val => typeof val === 'string' && val.toLowerCase().includes(lowercaseTerm)
                      );
                    }
                    return false;
                  });
                });
              }

              return (
                titleMatch ||
                descriptionMatch ||
                excerptMatch ||
                hostsMatch ||
                takeoversMatch ||
                genresMatch ||
                metadataMatch ||
                peopleMatch
              );
            });
          }

          // Apply filters
          if (Array.isArray(filters.type) && filters.type.length > 0) {
            filtered = filtered.filter(item =>
              filters.type?.includes(item.type as SearchResultType)
            );
          }

          if (Array.isArray(filters.genres) && filters.genres.length > 0) {
            filtered = filtered.filter(item =>
              getFilterItems(item).genres.some(genre => filters.genres?.includes(genre.slug))
            );
          }

          if (Array.isArray(filters.locations) && filters.locations.length > 0) {
            filtered = filtered.filter(item =>
              getFilterItems(item).locations.some(location =>
                filters.locations?.includes(location.slug)
              )
            );
          }

          if (Array.isArray(filters.hosts) && filters.hosts.length > 0) {
            filtered = filtered.filter(item =>
              getFilterItems(item).hosts.some(host => filters.hosts?.includes(host.slug))
            );
          }

          if (Array.isArray(filters.takeovers) && filters.takeovers.length > 0) {
            filtered = filtered.filter(item =>
              getFilterItems(item).takeovers.some(takeover =>
                filters.takeovers?.includes(takeover.slug)
              )
            );
          }

          if (Array.isArray(filters.categories) && filters.categories.length > 0) {
            filtered = filtered.filter(item =>
              getFilterItems(item).categories.some(category =>
                filters.categories?.includes(category.slug)
              )
            );
          }

          setResults(filtered);
        } else {
          // If we don't have content, fetch it from the API
          console.log('No cached content available, fetching from API');
          const content = await getAllSearchResultsAndFilters();
          setAllContent(content.results);

          if (term) {
            const lowercaseTerm = term.toLowerCase();
            const filtered = content.results.filter(
              item =>
                (item.title?.toLowerCase().includes(lowercaseTerm) ?? false) ||
                (item.description?.toLowerCase().includes(lowercaseTerm) ?? false) ||
                (item.excerpt?.toLowerCase().includes(lowercaseTerm) ?? false)
            );
            setResults(filtered);
          } else {
            setResults(content.results);
          }
        }
      } catch (error) {
        console.error('Error performing search:', error);
        setError('Failed to perform search. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    },
    [allContent, filters, isInitialized, initializeSearch]
  );

  // Toggle filter functions
  const toggleGenreFilter = useCallback((genre: FilterItem) => {
    setFilters(prev => {
      const genreFilters = prev.genres || [];
      const genreIndex = genreFilters.indexOf(genre.slug);

      if (genreIndex > -1) {
        // Remove genre if it exists
        return {
          ...prev,
          genres: genreFilters.filter((_, index) => index !== genreIndex),
        };
      } else {
        // Add genre if it doesn't exist
        return {
          ...prev,
          genres: [...genreFilters, genre.slug],
        };
      }
    });
  }, []);

  const toggleLocationFilter = useCallback((location: FilterItem) => {
    setFilters(prev => {
      const locationFilters = prev.locations || [];
      const locationIndex = locationFilters.indexOf(location.slug);

      if (locationIndex > -1) {
        // Remove location if it exists
        return {
          ...prev,
          locations: locationFilters.filter((_, index) => index !== locationIndex),
        };
      } else {
        // Add location if it doesn't exist
        return {
          ...prev,
          locations: [...locationFilters, location.slug],
        };
      }
    });
  }, []);

  const toggleHostFilter = useCallback((host: FilterItem) => {
    setFilters(prev => {
      const hostFilters = prev.hosts || [];
      const hostIndex = hostFilters.indexOf(host.slug);

      if (hostIndex > -1) {
        // Remove host if it exists
        return {
          ...prev,
          hosts: hostFilters.filter((_, index) => index !== hostIndex),
        };
      } else {
        // Add host if it doesn't exist
        return {
          ...prev,
          hosts: [...hostFilters, host.slug],
        };
      }
    });
  }, []);

  const toggleTakeoverFilter = useCallback((takeover: FilterItem) => {
    setFilters(prev => {
      const takeoverFilters = prev.takeovers || [];
      const takeoverIndex = takeoverFilters.indexOf(takeover.slug);

      if (takeoverIndex > -1) {
        // Remove takeover if it exists
        return {
          ...prev,
          takeovers: takeoverFilters.filter((_, index) => index !== takeoverIndex),
        };
      } else {
        // Add takeover if it doesn't exist
        return {
          ...prev,
          takeovers: [...takeoverFilters, takeover.slug],
        };
      }
    });
  }, []);

  const toggleCategoryFilter = useCallback((category: FilterItem) => {
    setFilters(prev => {
      const categoryFilters = prev.categories || [];
      const categoryIndex = categoryFilters.indexOf(category.slug);

      if (categoryIndex > -1) {
        return {
          ...prev,
          categories: categoryFilters.filter((_, index) => index !== categoryIndex),
        };
      }

      return {
        ...prev,
        categories: [...categoryFilters, category.slug],
      };
    });
  }, []);

  const toggleTypeFilter = useCallback((type: FilterItem) => {
    setFilters(prev => {
      const currentTypes = prev.type || [];
      if (currentTypes.includes(type.slug as SearchResultType)) {
        const nextTypes = currentTypes.filter(t => t !== type.slug);
        const { type: _, ...rest } = prev;
        return nextTypes.length ? { ...prev, type: nextTypes } : rest;
      }

      return {
        ...prev,
        type: [...currentTypes, type.slug as SearchResultType],
      };
    });
  }, []);

  const value: SearchContextType = {
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    results,
    setResults,
    isLoading,
    isInitialized,
    initializeSearch,
    performSearch,
    availableFilters,
    toggleGenreFilter,
    toggleLocationFilter,
    toggleHostFilter,
    toggleTakeoverFilter,
    toggleCategoryFilter,
    toggleTypeFilter,
    allContent,
    error,
  };

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}
