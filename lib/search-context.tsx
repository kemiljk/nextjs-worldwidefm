"use client";

import React, { createContext, useContext } from "react";

export type SearchResultType = "radio-shows" | "posts";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  slug: string;
  description?: string;
  excerpt?: string;
  image?: string;
  date?: string;
  genres: string[];
  locations: string[];
  series: string[];
  post_type?: "article" | "video" | "event";
  featured?: boolean;
}

export interface SearchFilters {
  type?: SearchResultType;
  genres?: string[];
  locations?: string[];
  series?: string[];
}

export interface SearchContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  results: SearchResult[];
  isLoading: boolean;
  performSearch: (term: string) => Promise<void>;
  availableFilters: {
    genres: string[];
    locations: string[];
    series: string[];
  };
}

const SearchContext = createContext<SearchContextType>({
  searchTerm: "",
  setSearchTerm: () => {},
  filters: {},
  setFilters: () => {},
  results: [],
  isLoading: false,
  performSearch: async () => {},
  availableFilters: {
    genres: [],
    locations: [],
    series: [],
  },
});

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
};

export { SearchContext };
