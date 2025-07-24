"use client";

import { ReactNode } from "react";
import { SearchResult, FilterItem, SearchContextType, SearchContext } from "@/lib/search-context";
import { useState, useCallback, useEffect } from "react";
import { getAllSearchResultsAndFilters } from "@/lib/search-engine";
import { SearchFilters } from "@/lib/search/types";
import { ContentType } from "@/lib/search/types";

interface SearchProviderProps {
  children: ReactNode;
}

export default function SearchProvider({ children }: SearchProviderProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allContent, setAllContent] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableFilters, setAvailableFilters] = useState<{
    genres: FilterItem[];
    locations: FilterItem[];
    hosts: FilterItem[];
    takeovers: FilterItem[];
    types: FilterItem[];
  }>({
    genres: [],
    locations: [],
    hosts: [],
    takeovers: [],
    types: [],
  });

  // Add a flag to track repeated failures
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Function to check if an item looks like a person name (copied from shows page)
  const isLikelyPerson = (title: string): boolean => {
    // Check for common patterns in people's names
    return (
      // Check for first and last name pattern (contains space and both parts start with capital)
      /^[A-Z][a-z]+ [A-Z][a-z]+/.test(title) ||
      // Check for titles with "DJ" prefix
      /^DJ /.test(title) ||
      // Names with middle initials
      /^[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+/.test(title)
    );
  };

  // Fetch all content and filters on mount
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    getAllSearchResultsAndFilters()
      .then(({ results, filters }) => {
        setAllContent(results);
        setResults(results);
        setAvailableFilters({
          genres: filters.genres,
          locations: filters.locations,
          hosts: filters.hosts,
          takeovers: [],
          types: [
            { slug: "episodes", title: "Episodes", type: "types" },
            { slug: "posts", title: "Posts", type: "types" },
            { slug: "events", title: "Events", type: "types" },
            { slug: "videos", title: "Videos", type: "types" },
            { slug: "takeovers", title: "Takeovers", type: "types" },
          ],
        });
      })
      .catch((error) => {
        setError("Failed to load content. Please try again later.");
        setAllContent([]);
        setResults([]);
        setAvailableFilters({ genres: [], locations: [], hosts: [], takeovers: [], types: [] });
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Perform search
  const performSearch = useCallback(
    async (term: string) => {
      console.log(`Performing search with term: "${term}"`);
      setIsLoading(true);
      setError(null);

      try {
        if (allContent.length > 0) {
          console.log(`Filtering existing ${allContent.length} items with term: "${term}" and filters:`, filters);

          let filtered = [...allContent];

          // Filter by search term if provided
          if (term) {
            const lowercaseTerm = term.toLowerCase();
            filtered = filtered.filter((item) => {
              const titleMatch = item.title?.toLowerCase().includes(lowercaseTerm) ?? false;
              const descriptionMatch = item.description?.toLowerCase().includes(lowercaseTerm) ?? false;
              const excerptMatch = item.excerpt?.toLowerCase().includes(lowercaseTerm) ?? false;

              const hostsMatch = Array.isArray(item.hosts) && item.hosts.some((host) => host.title?.toLowerCase().includes(lowercaseTerm));
              const takeoversMatch = Array.isArray(item.takeovers) && item.takeovers.some((takeover) => takeover.title?.toLowerCase().includes(lowercaseTerm));
              const genresMatch = Array.isArray(item.genres) && item.genres.some((genre) => genre.title?.toLowerCase().includes(lowercaseTerm));

              // Search metadata fields
              const metadataMatch = item.metadata && typeof item.metadata === "object" ? Object.entries(item.metadata).some(([_, value]) => typeof value === "string" && value.toLowerCase().includes(lowercaseTerm)) : false;

              // Check people-related fields in metadata
              let peopleMatch = false;
              if (item.metadata && typeof item.metadata === "object") {
                const peopleFields = ["regular_hosts", "guest_hosts", "guests", "artists", "people", "contributors"];
                peopleMatch = peopleFields.some((field) => {
                  const arr = Array.isArray(item.metadata[field]) ? item.metadata[field] : [];
                  return arr.some((person: any) => {
                    if (typeof person === "string") {
                      return person.toLowerCase().includes(lowercaseTerm);
                    } else if (person && typeof person === "object") {
                      return Object.values(person).some((val) => typeof val === "string" && val.toLowerCase().includes(lowercaseTerm));
                    }
                    return false;
                  });
                });
              }

              return titleMatch || descriptionMatch || excerptMatch || hostsMatch || takeoversMatch || genresMatch || metadataMatch || peopleMatch;
            });
          }

          // Apply filters
          if (Array.isArray(filters.contentType) && filters.contentType.length > 0) {
            filtered = filtered.filter((item) => filters.contentType?.includes(item.type));
          }

          if (Array.isArray(filters.genres) && filters.genres.length > 0) {
            filtered = filtered.filter((item) => Array.isArray(item.genres) && item.genres.some((genre) => filters.genres?.includes(genre.slug)));
          }

          if (Array.isArray(filters.locations) && filters.locations.length > 0) {
            filtered = filtered.filter((item) => Array.isArray(item.locations) && item.locations.some((location) => filters.locations?.includes(location.slug)));
          }

          if (Array.isArray(filters.hosts) && filters.hosts.length > 0) {
            filtered = filtered.filter((item) => Array.isArray(item.hosts) && item.hosts.some((host) => filters.hosts?.includes(host.slug)));
          }

          if (Array.isArray(filters.takeovers) && filters.takeovers.length > 0) {
            filtered = filtered.filter((item) => Array.isArray(item.takeovers) && item.takeovers.some((takeover) => filters.takeovers?.includes(takeover.slug)));
          }

          setResults(filtered);
        } else {
          // If we don't have content, fetch it from the API
          console.log("No cached content available, fetching from API");
          const content = await getAllSearchResultsAndFilters();
          setAllContent(content.results);

          if (term) {
            const lowercaseTerm = term.toLowerCase();
            const filtered = content.results.filter((item) => (item.title?.toLowerCase().includes(lowercaseTerm) ?? false) || (item.description?.toLowerCase().includes(lowercaseTerm) ?? false) || (item.excerpt?.toLowerCase().includes(lowercaseTerm) ?? false));
            setResults(filtered);
          } else {
            setResults(content.results);
          }
        }
      } catch (error) {
        console.error("Error performing search:", error);
        setError("Failed to perform search. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    },
    [allContent, filters]
  );

  // Toggle filter functions
  const toggleGenreFilter = useCallback((genre: FilterItem) => {
    setFilters((prev) => {
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
    setFilters((prev) => {
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
    setFilters((prev) => {
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
    setFilters((prev) => {
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

  const toggleTypeFilter = useCallback((type: FilterItem) => {
    setFilters((prev: SearchFilters) => {
      // Type is exclusive, so we set it directly
      if (prev.contentType && prev.contentType.includes(type.slug as ContentType)) {
        // Remove type if it's already set
        const { contentType: _, ...rest } = prev;
        return rest;
      } else {
        // Set type if it's not already set
        return {
          ...prev,
          contentType: [...(prev.contentType || []), type.slug as ContentType],
        };
      }
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
    performSearch,
    availableFilters,
    toggleGenreFilter,
    toggleLocationFilter,
    toggleHostFilter,
    toggleTakeoverFilter,
    toggleTypeFilter,
    allContent,
    error,
  };

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}
