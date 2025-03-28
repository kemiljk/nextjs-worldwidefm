"use client";

import { createContext, useContext } from "react";

export type SearchResultType = "radio-shows" | "posts" | "events" | "videos" | "takovers";

export interface FilterItem {
  title: string;
  slug: string;
  type: string;
}

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  slug: string;
  description?: string;
  excerpt?: string;
  image?: string;
  date?: string;
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
  takovers: FilterItem[];
  post_type?: "article" | "video" | "event";
  featured?: boolean;
  metadata?: any;
}

export interface SearchFilters {
  type?: SearchResultType;
  genres?: string[];
  locations?: string[];
  hosts?: string[];
  takovers?: string[];
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
    genres: FilterItem[];
    locations: FilterItem[];
    hosts: FilterItem[];
    takovers: FilterItem[];
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
    hosts: [],
    takovers: [],
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
