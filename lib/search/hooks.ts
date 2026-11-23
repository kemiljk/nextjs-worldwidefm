import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchFilters, SearchState, FilterCategory, FilterItem, ContentType } from './types';
import { searchEngine } from './engine';

const DEFAULT_LIMIT = 20;

export function useSearch(
  initialOptions: {
    autoLoad?: boolean;
    syncWithUrl?: boolean;
    limit?: number;
  } = {}
) {
  const { autoLoad = true, syncWithUrl = true, limit = DEFAULT_LIMIT } = initialOptions;

  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<SearchState>({
    items: [],
    filters: {},
    availableFilters: {
      genres: [],
      locations: [],
      hosts: [],
      takeovers: [],
      types: [],
      categories: [],
    },
    loading: false,
    hasMore: false,
    total: 0,
    page: 1,
    error: null,
  });

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    if (autoLoad && !initialLoadComplete) {
      let initialFilters: SearchFilters = {};

      if (syncWithUrl) {
        initialFilters = getFiltersFromUrl(searchParams);
      }

      setState(prev => ({ ...prev, loading: true }));

      if (Object.keys(initialFilters).length > 0) {
        searchEngine
          .search(initialFilters, { limit })
          .then(response => {
            setState({
              items: response.items,
              filters: initialFilters,
              availableFilters: response.availableFilters,
              loading: false,
              hasMore: response.hasMore,
              total: response.total,
              page: 1,
              error: null,
            });
          })
          .catch(error => {
            console.error('Error performing initial search:', error);
            setState(prev => ({
              ...prev,
              loading: false,
              error: 'Failed to load search results',
            }));
          })
          .finally(() => {
            setInitialLoadComplete(true);
          });
      } else {
        searchEngine
          .getInitialContent(limit)
          .then(response => {
            setState({
              items: response.items,
              filters: {},
              availableFilters: response.availableFilters,
              loading: false,
              hasMore: response.hasMore,
              total: response.total,
              page: 1,
              error: null,
            });
          })
          .catch(error => {
            console.error('Error loading initial content:', error);
            setState(prev => ({
              ...prev,
              loading: false,
              error: 'Failed to load content',
            }));
          })
          .finally(() => {
            setInitialLoadComplete(true);
          });
      }
    }
  }, [autoLoad, limit, searchParams, syncWithUrl, initialLoadComplete]);

  useEffect(() => {
    if (syncWithUrl && initialLoadComplete) {
      const url = buildUrlFromFilters(state.filters);
      router.replace(url, { scroll: false });
    }
  }, [syncWithUrl, state.filters, router, initialLoadComplete]);

  const loadMore = useCallback(async () => {
    if (state.loading || !state.hasMore) return;

    setState(prev => ({ ...prev, loading: true }));

    try {
      const nextPage = state.page + 1;
      const response = await searchEngine.search(state.filters, {
        page: nextPage,
        limit,
      });

      setState(prev => ({
        ...prev,
        items: [...prev.items, ...response.items],
        hasMore: response.hasMore,
        page: nextPage,
        loading: false,
      }));
    } catch (error) {
      console.error('Error loading more items:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load more content',
      }));
    }
  }, [state.loading, state.hasMore, state.filters, state.page, limit]);

  const search = useCallback(
    async (newFilters: SearchFilters) => {
      setState(prev => ({
        ...prev,
        loading: true,
        filters: newFilters,
      }));

      try {
        const response = await searchEngine.search(newFilters, { limit });

        setState(prev => ({
          ...prev,
          items: response.items,
          availableFilters: response.availableFilters,
          total: response.total,
          hasMore: response.hasMore,
          page: 1,
          loading: false,
          error: null,
        }));
      } catch (error) {
        console.error('Error performing search:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to perform search',
        }));
      }
    },
    [limit]
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      const newFilters = {
        ...state.filters,
        search: query.trim() || undefined,
      };

      if (!newFilters.search) {
        delete newFilters.search;
      }

      search(newFilters);
    },
    [state.filters, search]
  );

  const toggleFilter = useCallback(
    (category: FilterCategory, value: string) => {
      setState(prev => {
        const newFilters = { ...prev.filters };

        const filterKey =
          category === 'types'
            ? 'contentType'
            : category === 'genres'
              ? 'genres'
              : category === 'locations'
                ? 'locations'
                : category === 'hosts'
                  ? 'hosts'
                  : category === 'takeovers'
                    ? 'takeovers'
                    : null;

        if (!filterKey) return prev;

        if (!newFilters[filterKey]) {
          newFilters[filterKey] = [];
        }

        const currentValues = newFilters[filterKey] as string[];

        const index = currentValues.indexOf(value);

        if (index === -1) {
          if (filterKey === 'contentType') {
            newFilters[filterKey] = [...(currentValues as ContentType[]), value as ContentType];
          } else {
            newFilters[filterKey] = [...currentValues, value];
          }
        } else {
          const updated = [...currentValues.slice(0, index), ...currentValues.slice(index + 1)];

          if (filterKey === 'contentType') {
            newFilters[filterKey] = updated as ContentType[];
          } else {
            newFilters[filterKey] = updated;
          }

          if ((newFilters[filterKey] as any).length === 0) {
            delete newFilters[filterKey];
          }
        }

        return {
          ...prev,
          filters: newFilters,
          loading: true,
        };
      });

      search(state.filters);
    },
    [state.filters, search]
  );

  const resetFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      filters: {},
      loading: true,
    }));

    searchEngine
      .getInitialContent(limit)
      .then(response => {
        setState(prev => ({
          ...prev,
          items: response.items,
          availableFilters: response.availableFilters,
          total: response.total,
          hasMore: response.hasMore,
          page: 1,
          loading: false,
          error: null,
        }));
      })
      .catch(error => {
        console.error('Error resetting filters:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to reset filters',
        }));
      });
  }, [limit]);

  const isFilterActive = useCallback(
    (category: FilterCategory, value: string): boolean => {
      const filterKey =
        category === 'types'
          ? 'contentType'
          : category === 'genres'
            ? 'genres'
            : category === 'locations'
              ? 'locations'
              : category === 'hosts'
                ? 'hosts'
                : category === 'takeovers'
                  ? 'takeovers'
                  : null;

      if (!filterKey || !state.filters[filterKey]) return false;

      return (state.filters[filterKey] as string[]).includes(value);
    },
    [state.filters]
  );

  const activeFilters = useMemo(() => {
    const result: Record<string, FilterItem[]> = {};

    for (const [category, values] of Object.entries(state.filters)) {
      if (!values || (Array.isArray(values) && values.length === 0)) continue;

      if (category === 'search') continue;

      const filterCategory: FilterCategory | null =
        category === 'contentType'
          ? 'types'
          : category === 'genres'
            ? 'genres'
            : category === 'locations'
              ? 'locations'
              : category === 'hosts'
                ? 'hosts'
                : category === 'takeovers'
                  ? 'takeovers'
                  : null;

      if (!filterCategory) continue;

      const filterValues = (values as string[]).map(value => {
        const filterItem = state.availableFilters[filterCategory].find(
          item => item.slug === value || item.id === value
        );

        return (
          filterItem || {
            id: value,
            slug: value,
            title: value,
            type: filterCategory,
          }
        );
      });

      if (filterValues.length > 0) {
        result[filterCategory] = filterValues;
      }
    }

    return result;
  }, [state.filters, state.availableFilters]);

  return {
    items: state.items,
    loading: state.loading,
    hasMore: state.hasMore,
    total: state.total,
    error: state.error,

    availableFilters: state.availableFilters,

    filters: state.filters,
    activeFilters,

    search,
    setSearchQuery,
    toggleFilter,
    resetFilters,
    loadMore,
    isFilterActive,

    searchQuery: state.filters.search || '',
  };
}

function getFiltersFromUrl(searchParams: URLSearchParams): SearchFilters {
  const filters: SearchFilters = {};

  const search = searchParams.get('q');
  if (search) {
    filters.search = search;
  }

  const types = searchParams.getAll('type');
  if (types.length > 0) {
    filters.contentType = types as ContentType[];
  }

  const genres = searchParams.getAll('genre');
  if (genres.length > 0) {
    filters.genres = genres;
  }

  const locations = searchParams.getAll('location');
  if (locations.length > 0) {
    filters.locations = locations;
  }

  const hosts = searchParams.getAll('host');
  if (hosts.length > 0) {
    filters.hosts = hosts;
  }

  const takeovers = searchParams.getAll('takeover');
  if (takeovers.length > 0) {
    filters.takeovers = takeovers;
  }

  return filters;
}

function buildUrlFromFilters(filters: SearchFilters): string {
  const params = new URLSearchParams();

  if (filters.search) {
    params.set('q', filters.search);
  }

  if (filters.contentType) {
    filters.contentType.forEach(type => {
      params.append('type', type);
    });
  }

  if (filters.genres) {
    filters.genres.forEach(genre => {
      params.append('genre', genre);
    });
  }

  if (filters.locations) {
    filters.locations.forEach(location => {
      params.append('location', location);
    });
  }

  if (filters.hosts) {
    filters.hosts.forEach(host => {
      params.append('host', host);
    });
  }

  if (filters.takeovers) {
    filters.takeovers.forEach(takeover => {
      params.append('takeover', takeover);
    });
  }

  return `?${params.toString()}`;
}
