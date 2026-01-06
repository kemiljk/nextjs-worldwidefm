import { cosmic, GenreObject, LocationObject, HostObject, TakeoverObject } from './cosmic-config';
import { FilterItem, SearchResultType } from './search/unified-types';
import { EpisodeObject } from './cosmic-types';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  slug: string;
  title: string;
  description?: string;
  excerpt?: string;
  image?: string;
  date?: string;
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
  takeovers: FilterItem[];
  featured?: boolean;
  metadata?: any;
}

// Helper to safely extract a string field
const safeString = (val: any): string | undefined =>
  typeof val === 'string' && val.trim() ? val : undefined;

// Helper to strip HTML tags for search indexing
const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getImage = (meta: any): string | undefined =>
  meta?.image?.imgix_url || meta?.image?.url || undefined;
const getGenres = (meta: any): FilterItem[] =>
  (meta?.categories || meta?.genres || []).filter(Boolean).map((cat: any) => ({
    title: cat.title,
    slug: cat.slug,
    type: 'genres',
  }));
const getLocations = (meta: any): FilterItem[] =>
  (meta?.locations || []).filter(Boolean).map((loc: any) => ({
    title: loc.title,
    slug: loc.slug,
    type: 'locations',
  }));
const getHosts = (meta: any): FilterItem[] =>
  (meta?.regular_hosts || []).filter(Boolean).map((host: any) => ({
    title: host.title,
    slug: host.slug,
    type: 'hosts',
  }));
const getTakeovers = (meta: any): FilterItem[] =>
  (meta?.takeovers || []).filter(Boolean).map((tk: any) => ({
    title: tk.title,
    slug: tk.slug,
    type: 'takeovers',
  }));
const getDate = (meta: any, fallback: string): string | undefined =>
  safeString(meta?.date) || fallback;

// Helper functions to convert Cosmic objects to FilterItems
const mapGenreToFilterItem = (genre: GenreObject): FilterItem => ({
  title: genre.title,
  slug: genre.slug,
  type: 'genres',
});

const mapLocationToFilterItem = (location: LocationObject): FilterItem => ({
  title: location.title,
  slug: location.slug,
  type: 'locations',
});

const mapHostToFilterItem = (host: HostObject): FilterItem => ({
  title: host.title,
  slug: host.slug,
  type: 'hosts',
});

const mapTakeoverToFilterItem = (takeover: TakeoverObject): FilterItem => ({
  title: takeover.title,
  slug: takeover.slug,
  type: 'takeovers',
});

// Fetch and normalize all content types from Cosmic
export async function fetchAllCosmicContent(): Promise<SearchResult[]> {
  const [showsRes, eventsRes, postsRes, videosRes, takeoversRes] = await Promise.all([
    cosmic.objects
      .find({
        type: 'episode',
        props: 'id,slug,title,metadata,created_at',
        status: 'published',
        limit: 1000,
      })
      .sort('-metadata.broadcast_date'),
    cosmic.objects.find({
      type: 'events',
      props: 'id,slug,title,metadata,created_at',
      status: 'published',
      limit: 1000,
    }),
    cosmic.objects.find({
      type: 'posts',
      props: 'id,slug,title,metadata,created_at',
      status: 'published',
      limit: 1000,
    }),
    cosmic.objects.find({
      type: 'videos',
      props: 'id,slug,title,metadata,created_at',
      status: 'published',
      limit: 1000,
    }),
    cosmic.objects.find({
      type: 'takeovers',
      props: 'id,slug,title,metadata,created_at',
      status: 'published',
      limit: 1000,
    }),
  ]);
  const shows = (showsRes.objects || [])
    .map((item: any) => {
      const meta = item.metadata || {};
      return {
        id: item.id,
        type: 'episodes' as SearchResultType,
        slug: item.slug,
        title: safeString(item.title) || '',
        description: stripHtmlTags(meta.description || meta.subtitle || ''),
        image: getImage(meta),
        date: getDate(meta, item.created_at),
        genres: getGenres(meta),
        locations: getLocations(meta),
        hosts: getHosts(meta),
        takeovers: getTakeovers(meta),
      };
    })
    .filter((item: any) => item.title);
  const events = (eventsRes.objects || [])
    .map((item: any) => {
      const meta = item.metadata || {};
      return {
        id: item.id,
        type: 'events' as SearchResultType,
        slug: item.slug,
        title: safeString(item.title) || '',
        description: safeString(meta.description),
        image: getImage(meta),
        date: getDate(meta, item.created_at),
        genres: getGenres(meta),
        locations: getLocations(meta),
        hosts: [],
        takeovers: [],
      };
    })
    .filter((item: any) => item.title);
  const posts = (postsRes.objects || [])
    .map((item: any) => {
      const meta = item.metadata || {};
      return {
        id: item.id,
        type: 'posts' as SearchResultType,
        slug: item.slug,
        title: safeString(item.title) || '',
        description: stripHtmlTags(meta.description || meta.excerpt || ''),
        image: getImage(meta),
        date: getDate(meta, item.created_at),
        genres: getGenres(meta),
        locations: getLocations(meta),
        hosts: [],
        takeovers: [],
      };
    })
    .filter((item: any) => item.title);
  const videos = (videosRes.objects || [])
    .map((item: any) => {
      const meta = item.metadata || {};
      return {
        id: item.id,
        type: 'videos' as SearchResultType,
        slug: item.slug,
        title: safeString(item.title) || '',
        description: safeString(meta.description),
        image: getImage(meta),
        date: getDate(meta, item.created_at),
        genres: getGenres(meta),
        locations: getLocations(meta),
        hosts: [],
        takeovers: [],
      };
    })
    .filter((item: any) => item.title);
  const takeovers = (takeoversRes.objects || [])
    .map((item: any) => {
      const meta = item.metadata || {};
      return {
        id: item.id,
        type: 'takeovers' as SearchResultType,
        slug: item.slug,
        title: safeString(item.title) || '',
        description: safeString(meta.description),
        image: getImage(meta),
        date: getDate(meta, item.created_at),
        genres: getGenres(meta),
        locations: getLocations(meta),
        hosts: [],
        takeovers: [],
      };
    })
    .filter((item: any) => item.title);
  return [...shows, ...events, ...posts, ...videos, ...takeovers];
}

// Fetch episodes from Cosmic and normalize for search
export async function fetchEpisodesForSearch(): Promise<SearchResult[]> {
  const { getEpisodes } = await import('./episode-service');
  const { episodes } = await getEpisodes({ limit: 1000 });

  return episodes
    .map((episode: EpisodeObject) => ({
      id: episode.id,
      type: 'episodes' as SearchResultType,
      slug: episode.slug,
      title: episode.title,
      description: stripHtmlTags(episode.metadata.description || episode.title),
      image: episode.metadata.external_image_url || episode.metadata.image?.imgix_url,
      date: episode.metadata.broadcast_date || episode.created_at,
      genres: episode.metadata.genres.map(mapGenreToFilterItem),
      locations: episode.metadata.locations.map(mapLocationToFilterItem),
      hosts: episode.metadata.regular_hosts.map(mapHostToFilterItem),
      takeovers: episode.metadata.takeovers.map(mapTakeoverToFilterItem),
      metadata: episode, // Store full episode for detail pages
    }))
    .filter(item => item.title);
}

// Fetch all filter facets
export async function fetchAllFilters(): Promise<{
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
}> {
  const [genresRes, locationsRes, hostsRes] = await Promise.all([
    cosmic.objects.find({ type: 'genres', props: 'id,slug,title', limit: 1000 }),
    cosmic.objects.find({ type: 'locations', props: 'id,slug,title', limit: 1000 }),
    cosmic.objects.find({ type: 'regular-hosts', props: 'id,slug,title', limit: 1000 }),
  ]);
  const genres = (genresRes.objects || []).map((g: any) => ({
    title: g.title,
    slug: g.slug,
    type: 'genres',
  }));
  const locations = (locationsRes.objects || []).map((l: any) => ({
    title: l.title,
    slug: l.slug,
    type: 'locations',
  }));
  const hosts = (hostsRes.objects || []).map((h: any) => ({
    title: h.title,
    slug: h.slug,
    type: 'hosts',
  }));
  return { genres, locations, hosts };
}

// Main function to get all search results and filters
export async function getAllSearchResultsAndFilters() {
  const [cosmicContent, episodes, filters] = await Promise.all([
    fetchAllCosmicContent(),
    fetchEpisodesForSearch(),
    fetchAllFilters(),
  ]);

  // Filter out legacy episodes from cosmic content and replace with episodes
  const otherContent = cosmicContent.filter(item => item.type !== 'episodes');

  return {
    results: [...episodes, ...otherContent],
    filters,
  };
}
