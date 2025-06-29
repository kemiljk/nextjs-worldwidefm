import { cosmic } from "./cosmic-config";
import { getMixcloudShows } from "./mixcloud-service";
import { FilterItem, SearchResultType } from "./search-context";

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
const safeString = (val: any): string | undefined => (typeof val === "string" && val.trim() ? val : undefined);
const getImage = (meta: any): string | undefined => meta?.image?.imgix_url || meta?.image?.url || undefined;
const getGenres = (meta: any): FilterItem[] =>
  (meta?.categories || meta?.genres || []).filter(Boolean).map((cat: any) => ({
    title: cat.title,
    slug: cat.slug,
    type: "genres",
  }));
const getLocations = (meta: any): FilterItem[] =>
  (meta?.locations || []).filter(Boolean).map((loc: any) => ({
    title: loc.title,
    slug: loc.slug,
    type: "locations",
  }));
const getHosts = (meta: any): FilterItem[] =>
  (meta?.regular_hosts || []).filter(Boolean).map((host: any) => ({
    title: host.title,
    slug: host.slug,
    type: "hosts",
  }));
const getTakeovers = (meta: any): FilterItem[] =>
  (meta?.takeovers || []).filter(Boolean).map((tk: any) => ({
    title: tk.title,
    slug: tk.slug,
    type: "takeovers",
  }));
const getDate = (meta: any, fallback: string): string | undefined => safeString(meta?.date) || fallback;

// Fetch and normalize all content types from Cosmic
export async function fetchAllCosmicContent(): Promise<SearchResult[]> {
  const [showsRes, eventsRes, postsRes, videosRes, takeoversRes] = await Promise.all([
    cosmic.objects.find({ type: "radio-shows", props: "id,slug,title,metadata,created_at", status: "published", limit: 1000 }),
    cosmic.objects.find({ type: "events", props: "id,slug,title,metadata,created_at", status: "published", limit: 1000 }),
    cosmic.objects.find({ type: "posts", props: "id,slug,title,metadata,created_at", status: "published", limit: 1000 }),
    cosmic.objects.find({ type: "videos", props: "id,slug,title,metadata,created_at", status: "published", limit: 1000 }),
    cosmic.objects.find({ type: "takeovers", props: "id,slug,title,metadata,created_at", status: "published", limit: 1000 }),
  ]);
  const shows = (showsRes.objects || [])
    .map((item: any) => {
      const meta = item.metadata || {};
      return {
        id: item.id,
        type: "radio-shows" as SearchResultType,
        slug: item.slug,
        title: safeString(item.title) || "",
        description: safeString(meta.description) || safeString(meta.subtitle),
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
        type: "events" as SearchResultType,
        slug: item.slug,
        title: safeString(item.title) || "",
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
        type: "posts" as SearchResultType,
        slug: item.slug,
        title: safeString(item.title) || "",
        description: safeString(meta.description) || safeString(meta.excerpt),
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
        type: "videos" as SearchResultType,
        slug: item.slug,
        title: safeString(item.title) || "",
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
        type: "takeovers" as SearchResultType,
        slug: item.slug,
        title: safeString(item.title) || "",
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

// Fetch Mixcloud radio shows and normalize
export async function fetchMixcloudRadioShows(): Promise<SearchResult[]> {
  const { shows } = await getMixcloudShows({ limit: 1000 });
  return shows
    .map((show: any) => ({
      id: show.key,
      type: "radio-shows" as SearchResultType,
      slug: show.key.split("/").pop() || show.key,
      title: safeString(show.name) || "",
      description: safeString(show.description) || safeString(show.name),
      image: show.pictures?.extra_large || undefined,
      date: safeString(show.created_time),
      genres: [], // Do not use Mixcloud tags as genres
      locations: [],
      hosts: (show.hosts || []).filter(Boolean).map((host: any) => ({
        title: host.name,
        slug: host.username,
        type: "hosts",
      })),
      takeovers: [],
    }))
    .filter((item: any) => item.title);
}

// De-duplicate radio shows by slug, prioritizing Mixcloud
export function dedupeRadioShows(mixcloud: SearchResult[], cosmic: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const result: SearchResult[] = [];
  for (const show of [...mixcloud, ...cosmic]) {
    if (!show.slug) continue;
    if (seen.has(show.slug)) continue;
    seen.add(show.slug);
    result.push(show);
  }
  return result;
}

// Fetch all filter facets
export async function fetchAllFilters(): Promise<{
  genres: FilterItem[];
  locations: FilterItem[];
  hosts: FilterItem[];
}> {
  const [genresRes, locationsRes, hostsRes] = await Promise.all([cosmic.objects.find({ type: "genres", props: "id,slug,title", limit: 1000 }), cosmic.objects.find({ type: "locations", props: "id,slug,title", limit: 1000 }), cosmic.objects.find({ type: "regular-hosts", props: "id,slug,title", limit: 1000 })]);
  const genres = (genresRes.objects || []).map((g: any) => ({ title: g.title, slug: g.slug, type: "genres" }));
  const locations = (locationsRes.objects || []).map((l: any) => ({ title: l.title, slug: l.slug, type: "locations" }));
  const hosts = (hostsRes.objects || []).map((h: any) => ({ title: h.title, slug: h.slug, type: "hosts" }));
  return { genres, locations, hosts };
}

// Main function to get all search results and filters
export async function getAllSearchResultsAndFilters() {
  const [cosmicContent, mixcloudShows, filters] = await Promise.all([fetchAllCosmicContent(), fetchMixcloudRadioShows(), fetchAllFilters()]);
  // De-dupe radio shows
  const cosmicRadioShows = cosmicContent.filter((item) => item.type === "radio-shows");
  const otherContent = cosmicContent.filter((item) => item.type !== "radio-shows");
  const radioShows = dedupeRadioShows(mixcloudShows, cosmicRadioShows);
  return {
    results: [...radioShows, ...otherContent],
    filters,
  };
}
