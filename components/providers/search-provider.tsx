"use client";

import { ReactNode } from "react";
import { SearchContext, SearchContextType, SearchFilters, SearchResult, FilterItem } from "@/lib/search-context";
import { useState, useCallback, useEffect } from "react";
import { getAllSearchableContent, getAllFilters } from "@/lib/actions";

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

  // Fetch all available filters on mount - this is separate from content
  useEffect(() => {
    const fetchAllFilters = async () => {
      try {
        console.log("Fetching all available filters...");

        // Check for cached filters in localStorage to improve performance
        let cachedFilters = null;
        try {
          const cachedData = localStorage.getItem("wwfm_filters");
          if (cachedData) {
            cachedFilters = JSON.parse(cachedData);
            const cacheTimestamp = cachedFilters._timestamp || 0;
            const cacheAge = Date.now() - cacheTimestamp;
            const CACHE_MAX_AGE = 3600000; // 1 hour

            // Use cache if it's less than 1 hour old
            if (cacheAge < CACHE_MAX_AGE && cachedFilters.genres?.length && cachedFilters.hosts?.length) {
              console.log("Using cached filters from localStorage");
              setAvailableFilters({
                genres: cachedFilters.genres || [],
                locations: cachedFilters.locations || [],
                hosts: cachedFilters.hosts || [],
                takeovers: cachedFilters.takeovers || [],
                types: cachedFilters.types || [],
              });
              return;
            }
          }
        } catch (cacheError) {
          console.error("Error parsing cached filters:", cacheError);
          // Continue with fresh fetch if cache parsing fails
        }

        // More robust error handling with timeout for the filters fetch
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error("Filter fetch timed out")), 15000);
        });

        // Fetch filters with timeout protection
        const filtersPromise = getAllFilters().catch((error) => {
          console.error("Error in filters API call:", error);
          // Return a default empty structure instead of throwing
          return {
            genres: [],
            locations: [],
            hosts: [],
            takeovers: [],
            types: [
              { slug: "radio-shows", title: "Radio Shows", type: "types" },
              { slug: "posts", title: "Posts", type: "types" },
              { slug: "events", title: "Events", type: "types" },
              { slug: "videos", title: "Videos", type: "types" },
              { slug: "takeovers", title: "Takeovers", type: "types" },
            ],
          };
        });

        const allFilters = (await Promise.race([filtersPromise, timeoutPromise])) as any;

        // If we got an empty response, use fallback or cached data
        if (!allFilters || ((!allFilters.genres || allFilters.genres.length === 0) && (!allFilters.hosts || allFilters.hosts.length === 0))) {
          console.log("Received empty filter data from API, using fallback");

          // Use hardcoded defaults
          const DEFAULT_TYPES = [
            { slug: "radio-shows", title: "Radio Shows", type: "types" },
            { slug: "posts", title: "Posts", type: "types" },
            { slug: "events", title: "Events", type: "types" },
            { slug: "videos", title: "Videos", type: "types" },
            { slug: "takeovers", title: "Takeovers", type: "types" },
          ];

          // Try to use cached data first even if it's old
          if (cachedFilters && cachedFilters.genres?.length && cachedFilters.hosts?.length) {
            console.log("Using older cached filters as fallback");
            setAvailableFilters({
              genres: cachedFilters.genres || [],
              locations: cachedFilters.locations || [],
              hosts: cachedFilters.hosts || [],
              takeovers: cachedFilters.takeovers || [],
              types: cachedFilters.types || DEFAULT_TYPES,
            });
            return;
          }

          // If we have content, try to extract filters
          if (allContent.length > 0) {
            console.log("Extracting filters from existing content");
            const extractedFilters = extractFiltersFromContent(allContent);
            setAvailableFilters({
              ...extractedFilters,
              types: DEFAULT_TYPES,
            });
            return;
          }

          // Ultimate fallback - empty arrays
          setAvailableFilters({
            genres: [],
            locations: [],
            hosts: [],
            takeovers: [],
            types: DEFAULT_TYPES,
          });
          return;
        }

        // Update available filters state
        const filterData = {
          genres: allFilters.genres || [],
          locations: allFilters.locations || [],
          hosts: allFilters.hosts || [],
          takeovers: allFilters.takeovers || [],
          types: allFilters.types || [],
          _timestamp: Date.now(), // Add timestamp for cache age checking
        };

        setAvailableFilters(filterData);

        // Cache the filters in localStorage
        try {
          localStorage.setItem("wwfm_filters", JSON.stringify(filterData));
        } catch (cacheError) {
          console.error("Error caching filters:", cacheError);
          // Continue even if caching fails
        }

        console.log(`Loaded all available filters: ${allFilters.genres.length} genres, ${allFilters.locations.length} locations, ${allFilters.hosts.length} hosts, ${allFilters.takeovers.length} takeovers, ${allFilters.types?.length || 0} types`);
      } catch (error) {
        console.error("Error fetching all filters:", error);

        // Use hardcoded defaults
        const DEFAULT_TYPES = [
          { slug: "radio-shows", title: "Radio Shows", type: "types" },
          { slug: "posts", title: "Posts", type: "types" },
          { slug: "events", title: "Events", type: "types" },
          { slug: "videos", title: "Videos", type: "types" },
          { slug: "takeovers", title: "Takeovers", type: "types" },
        ];

        // Try to extract filters from existing content
        if (allContent.length > 0) {
          console.log("Extracting filters from loaded content as fallback");
          const extractedFilters = extractFiltersFromContent(allContent);
          setAvailableFilters({
            ...extractedFilters,
            types: DEFAULT_TYPES,
          });
        } else {
          setError("Error loading filters. Some filter options may be unavailable.");
          setAvailableFilters({
            genres: [],
            locations: [],
            hosts: [],
            takeovers: [],
            types: DEFAULT_TYPES,
          });
        }
      }
    };

    fetchAllFilters();
  }, [allContent]);

  // Helper function to extract filters from content as a fallback
  const extractFiltersFromContent = (content: SearchResult[]) => {
    const genresMap = new Map<string, FilterItem>();
    const locationsMap = new Map<string, FilterItem>();
    const hostsMap = new Map<string, FilterItem>();
    const takeoversMap = new Map<string, FilterItem>();

    content.forEach((item) => {
      // Extract genres
      item.genres?.forEach((genre) => {
        if (!genresMap.has(genre.slug)) {
          genresMap.set(genre.slug, genre);
        }
      });

      // Extract locations
      item.locations?.forEach((location) => {
        if (!locationsMap.has(location.slug)) {
          locationsMap.set(location.slug, location);
        }
      });

      // Extract hosts
      item.hosts?.forEach((host) => {
        if (!hostsMap.has(host.slug)) {
          hostsMap.set(host.slug, host);
        }
      });

      // Extract takeovers
      item.takeovers?.forEach((takeover) => {
        if (!takeoversMap.has(takeover.slug)) {
          takeoversMap.set(takeover.slug, takeover);
        }
      });
    });

    return {
      genres: Array.from(genresMap.values()).sort((a, b) => a.title.localeCompare(b.title)),
      locations: Array.from(locationsMap.values()).sort((a, b) => a.title.localeCompare(b.title)),
      hosts: Array.from(hostsMap.values()).sort((a, b) => a.title.localeCompare(b.title)),
      takeovers: Array.from(takeoversMap.values()).sort((a, b) => a.title.localeCompare(b.title)),
    };
  };

  // Fetch limited content on mount (200 per type)
  useEffect(() => {
    const fetchLimitedContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("Fetching initial content...");

        // Check for cached content in localStorage to improve performance
        let cachedContent = null;
        try {
          const cachedData = localStorage.getItem("wwfm_content");
          if (cachedData) {
            const parsedCache = JSON.parse(cachedData);
            const cacheTimestamp = parsedCache._timestamp || 0;
            const cacheAge = Date.now() - cacheTimestamp;
            const CACHE_MAX_AGE = 3600000; // 1 hour

            if (cacheAge < CACHE_MAX_AGE && parsedCache.content?.length > 0) {
              console.log(`Using cached content with ${parsedCache.content.length} items`);
              setAllContent(parsedCache.content);
              setResults(parsedCache.content);
              setIsLoading(false);
              return;
            }
          }
        } catch (cacheError) {
          console.error("Error parsing cached content:", cacheError);
          // Continue with fresh fetch if cache parsing fails
        }

        // Set a timeout to handle server not responding
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error("Request timed out. The server is taking too long to respond.")), 30000);
        });

        // Fetch content with a timeout - increased from 50 to 200 to get more comprehensive data
        const contentPromise = getAllSearchableContent(200);
        const content = (await Promise.race([contentPromise, timeoutPromise])) as SearchResult[];

        console.log(`Fetched ${content.length} initial items`);

        // Set content and results
        setAllContent(content);
        setResults(content);

        // Cache the content in localStorage for next time
        try {
          localStorage.setItem(
            "wwfm_content",
            JSON.stringify({
              content,
              _timestamp: Date.now(),
            })
          );
        } catch (cacheError) {
          console.error("Error caching content:", cacheError);
          // Continue even if caching fails
        }
      } catch (error) {
        console.error("Error fetching initial content:", error);

        // Try to use cached content even if it's old as a fallback
        try {
          const cachedData = localStorage.getItem("wwfm_content");
          if (cachedData) {
            const parsedCache = JSON.parse(cachedData);
            if (parsedCache.content?.length > 0) {
              console.log(`Using older cached content as fallback with ${parsedCache.content.length} items`);
              setAllContent(parsedCache.content);
              setResults(parsedCache.content);
              setError("Using cached content. Latest data could not be loaded.");
              return;
            }
          }
        } catch (cacheError) {
          console.error("Error using cached content:", cacheError);
        }

        setError("Failed to load content. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLimitedContent();
  }, []);

  // Perform search
  const performSearch = useCallback(
    async (term: string) => {
      console.log(`Performing search with term: "${term}"`);
      setIsLoading(true);
      setError(null);

      try {
        // If we have content and we're just changing the filter, filter the existing content
        // This prevents unnecessary API calls and improves performance
        if (allContent.length > 0) {
          console.log(`Filtering existing ${allContent.length} items with term: "${term}" and filters:`, filters);

          let filtered = [...allContent];

          // Filter by search term if provided
          if (term) {
            // Make the search case-insensitive
            const lowercaseTerm = term.toLowerCase();

            // Use plain lowercase comparison for better matching
            filtered = filtered.filter((item) => {
              // Primary fields
              const titleMatch = item.title && item.title.toLowerCase().includes(lowercaseTerm);
              const descriptionMatch = item.description && item.description.toLowerCase().includes(lowercaseTerm);
              const excerptMatch = item.excerpt && item.excerpt.toLowerCase().includes(lowercaseTerm);

              // Search in all people-related fields for all content types
              const hostsMatch = item.hosts?.some((host) => {
                // Thoroughly check host names (both exact and partial matches)
                const match = host.title.toLowerCase().includes(lowercaseTerm);
                if (match) console.log(`🔍 Found "${term}" in hosts: "${host.title}" for item: ${item.title}`);
                return match;
              });

              const takeoversMatch = item.takeovers?.some((takeover) => {
                const match = takeover.title.toLowerCase().includes(lowercaseTerm);
                if (match) console.log(`🔍 Found "${term}" in takeovers: "${takeover.title}" for item: ${item.title}`);
                return match;
              });

              // Also search in genres - people are sometimes miscategorized
              const genresMatch = item.genres?.some((genre) => {
                const match = genre.title.toLowerCase().includes(lowercaseTerm);
                if (match) console.log(`🔍 Found "${term}" in genres: "${genre.title}" for item: ${item.title}`);
                return match;
              });

              // Search metadata if available - more thoroughly
              const metadataMatch = item.metadata
                ? // Look through all metadata fields that might contain text
                  Object.entries(item.metadata).some(([key, value]) => {
                    if (typeof value === "string" && value.toLowerCase().includes(lowercaseTerm)) {
                      console.log(`🔍 Found "${term}" in metadata.${key}: "${value}" for item: ${item.title}`);
                      return true;
                    }
                    return false;
                  })
                : false;

              // Check people arrays more thoroughly - sometimes nested objects might not be correctly structured
              let peopleMatch = false;
              if (item.metadata) {
                // Check all potential people-related fields
                const peopleFields = ["regular_hosts", "guest_hosts", "guests", "artists", "people", "contributors"];

                peopleMatch = peopleFields.some((field) => {
                  if (!item.metadata[field]) return false;

                  if (Array.isArray(item.metadata[field])) {
                    return item.metadata[field].some((person: any) => {
                      if (typeof person === "string") {
                        const match = person.toLowerCase().includes(lowercaseTerm);
                        if (match) console.log(`🔍 Found "${term}" in ${field} string: "${person}" for item: ${item.title}`);
                        return match;
                      } else if (person && typeof person === "object") {
                        // Check all properties of the person object
                        const match = Object.values(person).some((val) => typeof val === "string" && val.toLowerCase().includes(lowercaseTerm));
                        if (match) {
                          const matchedProp = Object.entries(person).find(([_, v]) => typeof v === "string" && v.toLowerCase().includes(lowercaseTerm));
                          console.log(`🔍 Found "${term}" in ${field} object: "${matchedProp?.[0]}: ${matchedProp?.[1]}" for item: ${item.title}`);
                        }
                        return match;
                      }
                      return false;
                    });
                  }
                  return false;
                });
              }

              const hasMatch = titleMatch || descriptionMatch || excerptMatch || hostsMatch || takeoversMatch || genresMatch || metadataMatch || peopleMatch;

              return hasMatch;
            });
          }

          // Apply filters
          if (filters.type) {
            filtered = filtered.filter((item) => item.type === filters.type);
          }

          if (filters.genres && filters.genres.length > 0) {
            filtered = filtered.filter((item) => {
              return item.genres.some((genre) => filters.genres?.includes(genre.slug));
            });
          }

          if (filters.locations && filters.locations.length > 0) {
            filtered = filtered.filter((item) => {
              return item.locations.some((location) => filters.locations?.includes(location.slug));
            });
          }

          if (filters.hosts && filters.hosts.length > 0) {
            filtered = filtered.filter((item) => {
              return item.hosts.some((host) => filters.hosts?.includes(host.slug));
            });
          }

          if (filters.takeovers && filters.takeovers.length > 0) {
            filtered = filtered.filter((item) => {
              return item.takeovers.some((takeover) => filters.takeovers?.includes(takeover.slug));
            });
          }

          console.log(`Search returned ${filtered.length} results`);
          setResults(filtered);
        } else {
          // If we don't have content, fetch it from the API
          console.log("No cached content available, fetching from API");
          const content = await getAllSearchableContent(200);
          setAllContent(content);

          // If there's a search term, filter the results
          if (term) {
            // Apply the same filtering logic as above
            const lowercaseTerm = term.toLowerCase();
            const filtered = content.filter((item) => item.title.toLowerCase().includes(lowercaseTerm) || (item.description && item.description.toLowerCase().includes(lowercaseTerm)) || (item.excerpt && item.excerpt.toLowerCase().includes(lowercaseTerm)));
            setResults(filtered);
          } else {
            // If no search term, use all content
            setResults(content);
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
    setFilters((prev) => {
      // Type is exclusive, so we set it directly
      if (prev.type === type.slug) {
        // Remove type if it's already set
        const { type: _, ...rest } = prev;
        return rest;
      } else {
        // Set type if it's not already set
        return {
          ...prev,
          type: type.slug as any,
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
