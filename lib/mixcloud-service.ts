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

  // Add a getter for filtered tags
  filteredTags(): Array<{
    key: string;
    url: string;
    name: string;
  }>;
}

interface MixcloudResponse {
  data: MixcloudShow[];
  paging: {
    next?: string;
    previous?: string;
  };
  name: string;
}

interface MixcloudShowsParams {
  tag?: string;
  searchTerm?: string;
  isNew?: boolean;
  random?: boolean;
  limit?: number;
}

// Cache for Mixcloud shows with strong memoization
type CacheKey = string;
const showsCache = new Map<
  CacheKey,
  {
    shows: MixcloudShow[];
    timestamp: number;
  }
>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

// Helper to create a cache key from params
function createCacheKey(params: MixcloudShowsParams): CacheKey {
  return JSON.stringify(params || {});
}

// Update getRandomShowsFromMixcloud to use the API directly
async function getRandomShowsFromMixcloud(count: number = 4): Promise<MixcloudShow[]> {
  try {
    // Get a sample of shows from the API
    const shows = await getAllShowsFromMixcloud();

    // Shuffle and take the number requested
    const shuffled = [...shows].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  } catch (error) {
    console.error("Error getting random shows:", error);
    return [];
  }
}

// Update getMixcloudShows to use the archive for random shows
export async function getMixcloudShows(params: MixcloudShowsParams = {}, forceRefresh = false): Promise<{ shows: MixcloudShow[]; total: number }> {
  try {
    // If we're requesting random shows, use the archive
    if (params.random) {
      const randomShows = await getRandomShowsFromMixcloud(params.limit || 4);
      return {
        shows: randomShows,
        total: randomShows.length,
      };
    }

    const cacheKey = createCacheKey(params);
    const cached = showsCache.get(cacheKey);

    // Use cache if available and not expired
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return { shows: cached.shows, total: cached.shows.length };
    }

    // For non-random requests, fetch from Mixcloud API
    const limit = params.limit || 20;
    const response = await fetch(`https://api.mixcloud.com/worldwidefm/cloudcasts/?limit=${limit}`, {
      next: {
        revalidate: 900,
        tags: ["mixcloud"],
      },
    });

    if (!response.ok) {
      throw new Error(`Mixcloud API error: ${response.statusText}`);
    }

    const data: MixcloudResponse = await response.json();
    const shows = filterShows(data.data, params).shows;

    // Update cache
    showsCache.set(cacheKey, {
      shows,
      timestamp: Date.now(),
    });

    return { shows, total: shows.length };
  } catch (error) {
    console.error("Error fetching Mixcloud shows:", error);
    return { shows: [], total: 0 };
  }
}

export function filterWorldwideFMTags<T extends { name: string }>(tags: T[]): T[] {
  return tags.filter((tag) => tag.name.toLowerCase() !== "worldwide fm");
}

function filterShows(shows: MixcloudShow[], params: MixcloudShowsParams): { shows: MixcloudShow[]; total: number } {
  let filteredShows = [...shows];

  // Filter by tag
  if (params.tag) {
    filteredShows = filteredShows.filter((show) => filterWorldwideFMTags(show.tags).some((tag) => tag.name.toLowerCase() === params.tag?.toLowerCase()));
  }

  // Filter by search term
  if (params.searchTerm) {
    const searchLower = params.searchTerm.toLowerCase();
    filteredShows = filteredShows.filter((show) => show.name.toLowerCase().includes(searchLower) || filterWorldwideFMTags(show.tags).some((tag) => tag.name.toLowerCase().includes(searchLower)));
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

  // Filter out Worldwide FM from tags when creating genre objects
  const genreObjects: GenreObject[] = filterWorldwideFMTags(show.tags).map((tag) => ({
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
      regular_hosts: show.hosts.map((host) => ({
        id: host.name.toLowerCase().replace(/\s+/g, "-"),
        slug: host.username,
        title: host.name,
        content: "",
        bucket: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "",
        created_at: now,
        modified_at: now,
        published_at: now,
        status: "published",
        type: "hosts",
        metadata: null,
      })),
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
  try {
    // Make a single API call with a large limit to get a good sample
    const response = await fetch("https://api.mixcloud.com/worldwidefm/cloudcasts/?limit=100", {
      next: {
        revalidate: 900, // 15 minutes
        tags: ["mixcloud"],
      },
    });

    if (!response.ok) {
      throw new Error(`Mixcloud API error: ${response.statusText}`);
    }

    const data: MixcloudResponse = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching Mixcloud shows:", error);
    return [];
  }
}

export async function getShowBySlug(slug: string): Promise<MixcloudShow | null> {
  try {
    // Clean up the slug to get the show key
    const showKey = slug.startsWith("/") ? slug : `/${slug}`;

    // Make a direct API call to Mixcloud for this specific show
    const response = await fetch(`https://api.mixcloud.com${showKey}`, {
      next: {
        revalidate: 900, // 15 minutes
        tags: ["mixcloud"], // Use consistent tag for revalidation
      },
    });

    if (!response.ok) {
      console.error(`Mixcloud API error for show ${showKey}: ${response.statusText}`);
      return null;
    }

    const show = await response.json();
    console.log("Found show:", show.name);
    return show;
  } catch (error) {
    console.error("Error in getShowBySlug:", error);
    return null;
  }
}
