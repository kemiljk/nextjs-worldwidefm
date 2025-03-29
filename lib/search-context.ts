export interface FilterItem {
  title: string;
  slug: string;
  type: string;
}

export type SearchResultType = "posts" | "radio-shows" | "events" | "videos" | "takeovers";

export interface SearchResult {
  id: string;
  title: string;
  type: SearchResultType;
  description?: string;
  excerpt?: string;
  image?: string;
  slug: string;
  date?: string;
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];
  featured?: boolean;
  metadata?: any;
}
