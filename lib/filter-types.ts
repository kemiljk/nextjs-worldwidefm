export interface FilterItem {
  id: string;
  slug: string;
  title: string;
  content?: string;
  type?: string;
  status?: string;
  metadata?: any;
  created_at?: string;
  modified_at?: string;
  published_at?: string;
}

export interface AvailableFilters {
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];
  featuredShows: FilterItem[];
  series: FilterItem[];
  [key: string]: FilterItem[];
}

export type FilterCategory = keyof AvailableFilters;

export function getFilterItemsFromShow(show: any): AvailableFilters {
  return {
    genres: show.metadata?.genres || [],
    locations: show.metadata?.locations || [],
    hosts: show.metadata?.regular_hosts || [],
    takeovers: show.metadata?.takeovers || [],
    featuredShows: show.metadata?.featured_shows || [],
    series: show.metadata?.series || [],
  };
}

export function filterShowsByCategory(
  shows: any[],
  category: FilterCategory,
  subfilter?: string
): any[] {
  return shows.filter(show => {
    if (!show.metadata?.[category]) return false;
    if (!subfilter) return show.metadata[category].length > 0;
    return show.metadata[category].some((item: any) => item.id === subfilter);
  });
}

export function deduplicateFilters(filters: FilterItem[]): FilterItem[] {
  const seenIds = new Set();
  const seenTitles = new Set();

  return filters.filter(filter => {
    // Check for duplicate IDs
    if (seenIds.has(filter.id)) {
      return false;
    }

    // Check for duplicate titles (case-insensitive)
    const normalizedTitle = filter.title?.toLowerCase().trim();
    if (normalizedTitle && seenTitles.has(normalizedTitle)) {
      return false;
    }

    // Add to seen sets
    seenIds.add(filter.id);
    if (normalizedTitle) {
      seenTitles.add(normalizedTitle);
    }

    return true;
  });
}
