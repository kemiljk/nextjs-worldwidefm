/**
 * React hooks for using the search engine in components
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchFilters, SearchItem, SearchOptions, SearchState, FilterCategory, FilterItem, ContentType } from "./types";
import { searchEngine } from "./engine";

// Default search options
const DEFAULT_LIMIT = 20;

/**
 * Custom hook for using the search engine with React
 */
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

  // Main search state
  const [state, setState] = useState<SearchState>({
    items: [],
    filters: {},
    availableFilters: {
      genres: [],
      locations: [],
      hosts: [],
      takeovers: [],
      types: [],
    },
    loading: false,
    hasMore: false,
    total: 0,
    page: 1,
    error: null,
  });

  // Flag to track if initial content has been loaded
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  /**
   * Load initial content when component mounts
   */
  useEffect(() => {
    if (autoLoad && !initialLoadComplete) {
      // Try to load filters from URL if sync is enabled
      let initialFilters: SearchFilters = {};

      if (syncWithUrl) {
        initialFilters = getFiltersFromUrl(searchParams);
      }

      // Perform initial search with filters (if any)
      setState((prev) => ({ ...prev, loading: true }));

      if (Object.keys(initialFilters).length > 0) {
        // If we have filters from URL, perform a search
        searchEngine
          .search(initialFilters, { limit })
          .then((response) => {
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
          .catch((error) => {
            console.error("Error performing initial search:", error);
            setState((prev) => ({
              ...prev,
              loading: false,
              error: "Failed to load search results",
            }));
          })
          .finally(() => {
            setInitialLoadComplete(true);
          });
      } else {
        // No filters, just load initial content
        searchEngine
          .getInitialContent(limit)
          .then((response) => {
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
          .catch((error) => {
            console.error("Error loading initial content:", error);
            setState((prev) => ({
              ...prev,
              loading: false,
              error: "Failed to load content",
            }));
          })
          .finally(() => {
            setInitialLoadComplete(true);
          });
      }
    }
  }, [autoLoad, limit, searchParams, syncWithUrl, initialLoadComplete]);

  /**
   * Sync URL with current filters when they change (if enabled)
   */
  useEffect(() => {
    if (syncWithUrl && initialLoadComplete) {
      const url = buildUrlFromFilters(state.filters);
      router.replace(url, { scroll: false });
    }
  }, [syncWithUrl, state.filters, router, initialLoadComplete]);

  /**
   * Load more items (pagination)
   */
  const loadMore = useCallback(async () => {
    if (state.loading || !state.hasMore) return;

    setState((prev) => ({ ...prev, loading: true }));

    try {
      const nextPage = state.page + 1;
      const response = await searchEngine.search(state.filters, {
        page: nextPage,
        limit,
      });

      // Append new items to existing ones
      setState((prev) => ({
        ...prev,
        items: [...prev.items, ...response.items],
        hasMore: response.hasMore,
        page: nextPage,
        loading: false,
      }));
    } catch (error) {
      console.error("Error loading more items:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to load more content",
      }));
    }
  }, [state.loading, state.hasMore, state.filters, state.page, limit]);

  /**
   * Perform search with new filters
   */
  const search = useCallback(
    async (newFilters: SearchFilters) => {
      setState((prev) => ({
        ...prev,
        loading: true,
        filters: newFilters,
      }));

      try {
        const response = await searchEngine.search(newFilters, { limit });

        setState((prev) => ({
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
        console.error("Error performing search:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to perform search",
        }));
      }
    },
    [limit]
  );

  /**
   * Set search query and perform search
   */
  const setSearchQuery = useCallback(
    (query: string) => {
      const newFilters = {
        ...state.filters,
        search: query.trim() || undefined,
      };

      // Remove search property if empty
      if (!newFilters.search) {
        delete newFilters.search;
      }

      search(newFilters);
    },
    [state.filters, search]
  );

  /**
   * Toggle a filter value (add or remove)
   */
  const toggleFilter = useCallback(
    (category: FilterCategory, value: string) => {
      setState((prev) => {
        // Create a new filters object with the updated filters
        const newFilters = { ...prev.filters };

        // Convert category to corresponding filter property name
        const filterKey = category === "types" ? "contentType" : category === "genres" ? "genres" : category === "locations" ? "locations" : category === "hosts" ? "hosts" : category === "takeovers" ? "takeovers" : null;

        if (!filterKey) return prev;

        // Initialize array if it doesn't exist
        if (!newFilters[filterKey]) {
          newFilters[filterKey] = [];
        }

        // Get current values for this filter category
        const currentValues = newFilters[filterKey] as string[];

        // Check if value is already in the array
        const index = currentValues.indexOf(value);

        if (index === -1) {
          // Value not in array, add it
          newFilters[filterKey] = [...currentValues, value];
        } else {
          // Value in array, remove it
          newFilters[filterKey] = [...currentValues.slice(0, index), ...currentValues.slice(index + 1)];

          // Remove empty arrays
          if (newFilters[filterKey].length === 0) {
            delete newFilters[filterKey];
          }
        }

        return {
          ...prev,
          filters: newFilters,
          loading: true,
        };
      });

      // Perform search with new filters
      search(state.filters);
    },
    [state.filters, search]
  );

  /**
   * Reset all filters
   */
  const resetFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filters: {},
      loading: true,
    }));

    // Load initial content again
    searchEngine
      .getInitialContent(limit)
      .then((response) => {
        setState((prev) => ({
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
      .catch((error) => {
        console.error("Error resetting filters:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to reset filters",
        }));
      });
  }, [limit]);

  /**
   * Check if a filter value is currently active
   */
  const isFilterActive = useCallback(
    (category: FilterCategory, value: string): boolean => {
      const filterKey = category === "types" ? "contentType" : category === "genres" ? "genres" : category === "locations" ? "locations" : category === "hosts" ? "hosts" : category === "takeovers" ? "takeovers" : null;

      if (!filterKey || !state.filters[filterKey]) return false;

      return (state.filters[filterKey] as string[]).includes(value);
    },
    [state.filters]
  );

  /**
   * Get active filters as a human-readable object (for UI display)
   */
  const activeFilters = useMemo(() => {
    const result: Record<string, FilterItem[]> = {};

    // Process each filter category
    for (const [category, values] of Object.entries(state.filters)) {
      if (!values || (Array.isArray(values) && values.length === 0)) continue;

      // Skip search query
      if (category === "search") continue;

      // Map category name to filter category
      const filterCategory: FilterCategory = category === "contentType" ? "types" : category === "genres" ? "genres" : category === "locations" ? "locations" : category === "hosts" ? "hosts" : category === "takeovers" ? "takeovers" : null;

      if (!filterCategory) continue;

      // Find the FilterItem objects for each active value
      const filterValues = (values as string[]).map((value) => {
        const filterItem = state.availableFilters[filterCategory].find((item) => item.slug === value || item.id === value);

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
    // Search state
    items: state.items,
    loading: state.loading,
    hasMore: state.hasMore,
    total: state.total,
    error: state.error,

    // Available filters (for UI menus)
    availableFilters: state.availableFilters,

    // Current search filters
    filters: state.filters,
    activeFilters,

    // Search actions
    search,
    setSearchQuery,
    toggleFilter,
    resetFilters,
    loadMore,
    isFilterActive,

    // Utility values
    searchQuery: state.filters.search || "",
  };
}

/**
 * Extract search filters from URL search params
 */
function getFiltersFromUrl(searchParams: URLSearchParams): SearchFilters {
  const filters: SearchFilters = {};

  // Search query
  const search = searchParams.get("q");
  if (search) {
    filters.search = search;
  }

  // Content types
  const types = searchParams.getAll("type");
  if (types.length > 0) {
    filters.contentType = types as ContentType[];
  }

  // Genre filters
  const genres = searchParams.getAll("genre");
  if (genres.length > 0) {
    filters.genres = genres;
  }

  // Location filters
  const locations = searchParams.getAll("location");
  if (locations.length > 0) {
    filters.locations = locations;
  }

  // Host filters
  const hosts = searchParams.getAll("host");
  if (hosts.length > 0) {
    filters.hosts = hosts;
  }

  // Takeover filters
  const takeovers = searchParams.getAll("takeover");
  if (takeovers.length > 0) {
    filters.takeovers = takeovers;
  }

  return filters;
}

/**
 * Build URL from search filters
 */
function buildUrlFromFilters(filters: SearchFilters): string {
  const params = new URLSearchParams();

  // Add search query
  if (filters.search) {
    params.set("q", filters.search);
  }

  // Add content types
  if (filters.contentType) {
    filters.contentType.forEach((type) => {
      params.append("type", type);
    });
  }

  // Add genres
  if (filters.genres) {
    filters.genres.forEach((genre) => {
      params.append("genre", genre);
    });
  }

  // Add locations
  if (filters.locations) {
    filters.locations.forEach((location) => {
      params.append("location", location);
    });
  }

  // Add hosts
  if (filters.hosts) {
    filters.hosts.forEach((host) => {
      params.append("host", host);
    });
  }

  // Add takeovers
  if (filters.takeovers) {
    filters.takeovers.forEach((takeover) => {
      params.append("takeover", takeover);
    });
  }

  return `?${params.toString()}`;
}
