export interface FilterItem {
  title: string;
  slug: string;
  type: string;
}

export interface AvailableFilters {
  [key: string]: FilterItem[];
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];
}

export type FilterCategory = keyof AvailableFilters;

export function getFilterItemsFromShow(show: any): Partial<AvailableFilters> {
  const filters: Partial<AvailableFilters> = {};

  if (show.metadata?.genres) {
    filters.genres = show.metadata.genres.map((genre: any) => ({
      title: genre.title,
      slug: genre.slug,
      type: genre.type,
    }));
  }

  if (show.metadata?.locations) {
    filters.locations = show.metadata.locations.map((location: any) => ({
      title: location.title,
      slug: location.slug,
      type: location.type,
    }));
  }

  if (show.metadata?.regular_hosts) {
    filters.hosts = show.metadata.regular_hosts.map((host: any) => ({
      title: host.title,
      slug: host.slug,
      type: host.type,
    }));
  }

  if (show.metadata?.takeovers) {
    filters.takeovers = show.metadata.takeovers.map((takeover: any) => ({
      title: takeover.title,
      slug: takeover.slug,
      type: takeover.type,
    }));
  }

  return filters;
}

export function filterShowsByCategory(shows: any[], category: FilterCategory, subfilter?: string): any[] {
  return shows.filter((show) => {
    if (!show.metadata?.[category]) return false;
    if (!subfilter) return show.metadata[category].length > 0;
    return show.metadata[category].some((item: any) => item.slug === subfilter);
  });
}

export function deduplicateFilters(filters: FilterItem[]): FilterItem[] {
  const uniqueFilters = new Map<string, FilterItem>();
  filters.forEach((filter) => {
    uniqueFilters.set(filter.slug, filter);
  });
  return Array.from(uniqueFilters.values());
}
