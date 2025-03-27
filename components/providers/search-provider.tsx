"use client";

import { ReactNode } from "react";
import { SearchContext, SearchContextType, SearchFilters, SearchResult } from "@/lib/search-context";
import { useState, useCallback, useEffect } from "react";
import { getAllSearchableContent } from "@/lib/actions";

interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableFilters, setAvailableFilters] = useState<{
    genres: string[];
    locations: string[];
    series: string[];
  }>({
    genres: [],
    locations: [],
    series: [],
  });

  // Fetch all content on mount
  useEffect(() => {
    const fetchContent = async () => {
      setIsLoading(true);
      try {
        const content = await getAllSearchableContent();
        setResults(content);

        // Extract available filters from content
        setAvailableFilters({
          genres: Array.from(new Set(content.flatMap((item) => item.genres))),
          locations: Array.from(new Set(content.flatMap((item) => item.locations))),
          series: Array.from(new Set(content.flatMap((item) => item.series))),
        });
      } catch (error) {
        console.error("Error fetching content:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, []);

  const performSearch = useCallback(
    async (term: string) => {
      setIsLoading(true);
      try {
        const content = await getAllSearchableContent();

        // Filter content based on search term and filters
        const filteredContent = content.filter((item) => {
          // Text search
          const searchRegex = new RegExp(term, "i");
          const matchesSearch = searchRegex.test(item.title) || searchRegex.test(item.description || "") || searchRegex.test(item.excerpt || "");

          // Type filter
          const matchesType = !filters.type || item.type === filters.type;

          // Genre filter
          const matchesGenre = !filters.genres?.length || filters.genres.some((genre) => item.genres.includes(genre));

          // Location filter
          const matchesLocation = !filters.locations?.length || filters.locations.some((location) => item.locations.includes(location));

          // Series filter
          const matchesSeries = !filters.series?.length || filters.series.some((series) => item.series.includes(series));

          return matchesSearch && matchesType && matchesGenre && matchesLocation && matchesSeries;
        });

        setResults(filteredContent);
      } catch (error) {
        console.error("Error performing search:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [filters]
  );

  const value: SearchContextType = {
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    results,
    isLoading,
    performSearch,
    availableFilters,
  };

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}
