import { RadioShowObject, CosmicImage, GenreObject } from "./cosmic-config";

export interface MixcloudShow {
  key: string;
  name: string;
  url: string;
  pictures: {
    small: string;
    thumbnail: string;
    medium_mobile: string;
    medium: string;
    large: string;
    "320wx320h": string;
    extra_large: string;
    "640wx640h": string;
    "768wx768h": string;
    "1024wx1024h": string;
  };
  created_time: string;
  updated_time: string;
  play_count: number;
  favorite_count: number;
  comment_count: number;
  listener_count: number;
  repost_count: number;
  tags: Array<{
    key: string;
    url: string;
    name: string;
  }>;
  slug: string;
  user: {
    key: string;
    url: string;
    name: string;
    username: string;
    pictures: {
      small: string;
      thumbnail: string;
      medium_mobile: string;
      medium: string;
      large: string;
      "320wx320h": string;
      extra_large: string;
      "640wx640h": string;
    };
  };
  hosts: Array<{
    key: string;
    url: string;
    name: string;
    username: string;
    pictures: {
      small: string;
      thumbnail: string;
      medium_mobile: string;
      medium: string;
      large: string;
      "320wx320h": string;
      extra_large: string;
      "640wx640h": string;
    };
  }>;
  hidden_stats: boolean;
  audio_length: number;
}

interface MixcloudResponse {
  data: MixcloudShow[];
  paging: {
    next?: string;
    previous?: string;
  };
  name: string;
}

// Cache configuration
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes
let cache: { data: MixcloudShow[]; timestamp: number } | null = null;

interface MixcloudShowsParams {
  tag?: string;
  searchTerm?: string;
  isNew?: boolean;
}

export async function getMixcloudShows(params: MixcloudShowsParams = {}, forceRefresh = false): Promise<{ shows: MixcloudShow[]; total: number }> {
  // Check cache first
  if (!forceRefresh && cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return filterShows(cache.data, params);
  }

  try {
    // Only fetch the first page of shows (most recent)
    const response = await fetch("https://api.mixcloud.com/worldwidefm/cloudcasts/");
    if (!response.ok) {
      throw new Error(`Mixcloud API error: ${response.statusText}`);
    }

    const data: MixcloudResponse = await response.json();
    console.log("Fetched shows:", data.data.length);

    // Update cache
    cache = {
      data: data.data,
      timestamp: Date.now(),
    };

    return filterShows(data.data, params);
  } catch (error) {
    console.error("Error fetching Mixcloud shows:", error);
    // Return cached data if available, even if expired
    if (cache) {
      return filterShows(cache.data, params);
    }
    return { shows: [], total: 0 };
  }
}

function filterShows(shows: MixcloudShow[], params: MixcloudShowsParams): { shows: MixcloudShow[]; total: number } {
  let filteredShows = [...shows];

  // Filter by tag
  if (params.tag) {
    filteredShows = filteredShows.filter((show) => show.tags.some((tag) => tag.name.toLowerCase() === params.tag?.toLowerCase()));
  }

  // Filter by search term
  if (params.searchTerm) {
    const searchLower = params.searchTerm.toLowerCase();
    filteredShows = filteredShows.filter((show) => show.name.toLowerCase().includes(searchLower) || show.tags.some((tag) => tag.name.toLowerCase().includes(searchLower)));
  }

  // Filter by isNew (shows from last 30 days)
  if (params.isNew) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    filteredShows = filteredShows.filter((show) => new Date(show.created_time) > thirtyDaysAgo);
  }

  return {
    shows: filteredShows,
    total: filteredShows.length,
  };
}

export function transformMixcloudShow(show: MixcloudShow): Partial<RadioShowObject> {
  const now = new Date().toISOString();
  const cosmicImage: CosmicImage = {
    url: show.pictures.large,
    imgix_url: show.pictures.large,
  };

  const genreObjects: GenreObject[] = show.tags.map((tag) => ({
    id: tag.name.toLowerCase().replace(/\s+/g, "-"),
    slug: tag.name.toLowerCase().replace(/\s+/g, "-"),
    title: tag.name,
    content: "",
    bucket: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "",
    created_at: now,
    modified_at: now,
    published_at: now,
    status: "published",
    type: "genres",
    metadata: null,
  }));

  // Extract hosts from the show name and hosts array
  const hostNames = show.hosts.map((host) => host.name);
  const hostObjects = hostNames.map((name) => ({
    id: name.toLowerCase().replace(/\s+/g, "-"),
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    title: name,
    content: "",
    bucket: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "",
    created_at: now,
    modified_at: now,
    published_at: now,
    status: "published",
    type: "hosts",
    metadata: null,
  }));

  return {
    id: show.key,
    title: show.name,
    slug: show.key,
    type: "radio-shows",
    metadata: {
      subtitle: show.name,
      description: show.name,
      image: cosmicImage,
      broadcast_date: show.created_time,
      duration: `${Math.floor(show.audio_length / 60)}:${(show.audio_length % 60).toString().padStart(2, "0")}`,
      player: show.url,
      genres: genreObjects,
      locations: [],
      regular_hosts: hostObjects,
      takeovers: [],
      featured_on_homepage: false,
      tracklist: null,
      body_text: null,
      broadcast_time: null,
      broadcast_day: null,
      page_link: null,
      source: null,
    },
  };
}

export async function getAllShowsFromMixcloud(): Promise<MixcloudShow[]> {
  const shows = await getMixcloudShows();
  return shows;
}
