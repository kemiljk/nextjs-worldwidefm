import { RadioShowObject, CosmicImage, GenreObject, HostObject } from "./cosmic-config";

// Define the RadioCult API base URL
export const RADIOCULT_API_BASE_URL = "https://api.radiocult.fm";

// Station ID from environment variables
const STATION_ID = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID || "";

// API keys from environment variables
const RADIOCULT_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_RADIOCULT_PUBLISHABLE_KEY || "";
const RADIOCULT_SECRET_KEY = process.env.RADIOCULT_SECRET_KEY || "";

// Cache for RadioCult data with memoization
type CacheKey = string;
const dataCache = new Map<
  CacheKey,
  {
    data: any;
    timestamp: number;
  }
>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

// Helper to create a cache key from params
function createCacheKey(endpoint: string, params: Record<string, any> = {}): CacheKey {
  return `${endpoint}:${JSON.stringify(params)}`;
}

// RadioCult Artist interface
export interface RadioCultArtist {
  id: string;
  name: string;
  description?: string;
  slug: string;
  imageUrl?: string;
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
    website?: string;
    mixcloud?: string;
    soundcloud?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// RadioCult Show interface
export interface RadioCultShow {
  id: string;
  name: string;
  description?: string;
  slug: string;
  imageUrl?: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  artists: RadioCultArtist[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// RadioCult Event interface (a scheduled instance of a show)
export interface RadioCultEvent {
  id: string;
  showId: string;
  showName: string;
  description?: string;
  slug: string;
  imageUrl?: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  artists: RadioCultArtist[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// RadioCult Schedule Item interface from the API response
export interface RadioCultScheduleItem {
  id?: string;
  originalId?: string;
  title?: string;
  name?: string;
  slug?: string;
  showId?: string;
  description?: string;
  imageUrl?: string;
  image?: { url: string };
  startTime?: string;
  endTime?: string;
  start?: string;
  end?: string;
  duration?: number;
  artists?: RadioCultArtist[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  // Additional fields in the schedule response
  timezone?: string;
  media?: { type: string };
  entity?: string;
  doRecord?: boolean;
  exceptions?: any;
  isRecurring?: boolean;
  created?: string;
  rrule?: string;
  modified?: string;
  endDateUtc?: string;
  artistIds?: string[];
  startDateUtc?: string;
  stationId?: string;
  scheduleRangeStartUtc?: string;
  scheduleRangeEndUtc?: string;
}

// Interface for parameters to get shows
export interface RadioCultShowsParams {
  tag?: string;
  searchTerm?: string;
  artistId?: string;
  limit?: number;
  offset?: number;
}

// Interface for parameters to get scheduled events
export interface RadioCultEventsParams {
  startDate?: string; // ISO timestamp
  endDate?: string; // ISO timestamp
  artistId?: string;
  showId?: string;
  limit?: number;
  offset?: number;
}

// RadioCult Tag interface
export interface RadioCultTag {
  id: string;
  stationId: string;
  name: string;
  color: string;
}

// Helper function to make API requests to RadioCult
async function fetchFromRadioCult<T>(endpoint: string, options: RequestInit = {}, useSecretKey: boolean = false): Promise<T> {
  const apiKey = useSecretKey ? RADIOCULT_SECRET_KEY : RADIOCULT_PUBLISHABLE_KEY;

  if (!apiKey) {
    throw new Error(`RadioCult API key not provided. ${useSecretKey ? "Secret" : "Publishable"} key is required.`);
  }

  if (!STATION_ID) {
    throw new Error("RadioCult station ID not provided. Please set NEXT_PUBLIC_RADIOCULT_STATION_ID environment variable.");
  }

  const url = `${RADIOCULT_API_BASE_URL}${endpoint}`;

  const headers = {
    ...options.headers,
    "x-api-key": apiKey,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      next: {
        revalidate: 900, // 15 minutes
        tags: ["radiocult"],
      },
    });

    if (!response.ok) {
      console.error(`RadioCult API error: ${response.status} ${response.statusText} for endpoint ${endpoint}`);
      throw new Error(`RadioCult API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success === false) {
      console.error(`RadioCult API success=false for endpoint ${endpoint}: ${data.error || "Unknown error"}`);
      throw new Error(`RadioCult API error: ${data.error || "Unknown error"}`);
    }

    return data as T;
  } catch (error) {
    console.error(`Error fetching from RadioCult API (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Get artists from RadioCult
 */
export async function getArtists(forceRefresh = false): Promise<RadioCultArtist[]> {
  const endpoint = `/api/station/${STATION_ID}/artists`;
  const cacheKey = createCacheKey(endpoint);
  const cached = dataCache.get(cacheKey);

  // Use cache if available and not expired
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const data = await fetchFromRadioCult<{ artists: RadioCultArtist[] }>(endpoint);

    // Update cache
    dataCache.set(cacheKey, {
      data: data.artists,
      timestamp: Date.now(),
    });

    return data.artists;
  } catch (error) {
    console.error("Error fetching RadioCult artists:", error);
    return [];
  }
}

/**
 * Get a specific artist by ID or slug
 */
export async function getArtist(identifier: string, isSlug = false): Promise<RadioCultArtist | null> {
  const endpoint = `/api/station/${STATION_ID}/artists/${identifier}`;
  const cacheKey = createCacheKey(endpoint);
  const cached = dataCache.get(cacheKey);

  // Use cache if available and not expired
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const data = await fetchFromRadioCult<{ artist: RadioCultArtist }>(endpoint);

    // Update cache
    dataCache.set(cacheKey, {
      data: data.artist,
      timestamp: Date.now(),
    });

    return data.artist;
  } catch (error) {
    console.error(`Error fetching RadioCult artist (${identifier}):`, error);
    return null;
  }
}

/**
 * Get an artist's scheduled events
 */
export async function getArtistSchedule(artistId: string, startDate?: string, endDate?: string): Promise<RadioCultEvent[]> {
  const queryParams = new URLSearchParams();

  if (startDate) {
    queryParams.append("startDate", startDate);
  }

  if (endDate) {
    queryParams.append("endDate", endDate);
  }

  const endpoint = `/api/station/${STATION_ID}/artists/${artistId}/schedule?${queryParams}`;
  const cacheKey = createCacheKey(endpoint);
  const cached = dataCache.get(cacheKey);

  // Use cache if available and not expired
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const data = await fetchFromRadioCult<{ events: RadioCultEvent[] }>(endpoint);

    // Update cache
    dataCache.set(cacheKey, {
      data: data.events,
      timestamp: Date.now(),
    });

    return data.events;
  } catch (error) {
    console.error(`Error fetching RadioCult artist schedule (${artistId}):`, error);
    return [];
  }
}

/**
 * Get scheduled events from RadioCult
 */
export async function getEvents(params: RadioCultEventsParams = {}, forceRefresh = false): Promise<{ events: RadioCultEvent[]; total: number }> {
  // Early check for required environment variables
  if (!STATION_ID || !RADIOCULT_PUBLISHABLE_KEY) {
    console.log("RadioCult not configured, returning empty events");
    return { events: [], total: 0 };
  }

  const queryParams = new URLSearchParams();

  if (params.startDate) {
    queryParams.append("startDate", params.startDate);
  }

  if (params.endDate) {
    queryParams.append("endDate", params.endDate);
  }

  if (params.artistId) {
    queryParams.append("artistId", params.artistId);
  }

  if (params.showId) {
    queryParams.append("showId", params.showId);
  }

  if (params.limit) {
    queryParams.append("limit", params.limit.toString());
  }

  if (params.offset) {
    queryParams.append("offset", params.offset.toString());
  }

  // Use the schedule endpoint for all date-based requests according to RadioCult API
  const endpoint = `/api/station/${STATION_ID}/schedule?${queryParams}`;

  const cacheKey = createCacheKey(endpoint);
  const cached = dataCache.get(cacheKey);

  // Use cache if available and not expired
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Use the safer fetchFromRadioCult helper
    const data = await fetchFromRadioCult<any>(endpoint);

    // Different endpoints have different response formats
    let events: RadioCultEvent[] = [];
    let total = 0;

    // Handle the schedules array format
    if (data.schedules && Array.isArray(data.schedules)) {
      events = data.schedules.map((item: RadioCultScheduleItem) => ({
        id: item.id || item.originalId || item.slug || "",
        showId: item.showId || item.originalId || "",
        showName: item.title || item.name || "",
        description: item.description || "",
        slug: item.slug || "",
        imageUrl: item.imageUrl || item.image?.url || "",
        startTime: item.startTime || item.start || item.startDateUtc || "",
        endTime: item.endTime || item.end || item.endDateUtc || "",
        duration: item.duration || 0,
        artists: item.artists || [],
        tags: item.tags || [],
        createdAt: item.createdAt || item.created || "",
        updatedAt: item.updatedAt || item.modified || "",
      }));
      total = events.length;
    }
    // Handle events format
    else if (data.events && Array.isArray(data.events)) {
      events = data.events;
      total = data.total || events.length;
    }
    // Handle schedule array format
    else if (data.schedule && Array.isArray(data.schedule)) {
      events = data.schedule.map((item: RadioCultScheduleItem) => ({
        id: item.id || item.slug || "",
        showId: item.showId || "",
        showName: item.title || item.name || "",
        description: item.description || "",
        slug: item.slug || "",
        imageUrl: item.imageUrl || item.image?.url || "",
        startTime: item.startTime || item.start || "",
        endTime: item.endTime || item.end || "",
        duration: item.duration || 0,
        artists: item.artists || [],
        tags: item.tags || [],
        createdAt: item.createdAt || "",
        updatedAt: item.updatedAt || "",
      }));
      total = events.length;
    } else {
      console.error("Unexpected response format from schedule endpoint:", data);
      events = [];
      total = 0;
    }

    const result = { events, total };

    // Update cache
    dataCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    console.error("Error fetching RadioCult events:", error);
    return { events: [], total: 0 };
  }
}

/**
 * Get a specific event by slug
 */
export async function getEventBySlug(slug: string): Promise<RadioCultEvent | null> {
  try {
    // According to the documentation, we can look up events directly
    const endpoint = `/api/station/${STATION_ID}/events/${slug}`;
    const cacheKey = createCacheKey(endpoint);
    const cached = dataCache.get(cacheKey);

    // Use cache if available and not expired
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    // Make the API request to get the specific event
    const response = await fetch(`${RADIOCULT_API_BASE_URL}${endpoint}`, {
      headers: {
        "x-api-key": RADIOCULT_PUBLISHABLE_KEY,
      },
      next: {
        revalidate: 900, // 15 minutes
        tags: ["radiocult"],
      },
    });

    if (!response.ok) {
      console.error(`RadioCult API error for event lookup: ${response.status} ${response.statusText}`);
      throw new Error(`RadioCult API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Check if we got a valid response
    if (!data || data.success === false) {
      console.error("Failed to fetch event by slug:", data.error || "Unknown error");
      throw new Error(`Failed to fetch event: ${data.error || "Unknown error"}`);
    }

    // Extract the event from the response
    const event = data.event;

    if (!event) {
      console.error("No event data in response:", data);
      return null;
    }

    // Update cache
    dataCache.set(cacheKey, {
      data: event,
      timestamp: Date.now(),
    });

    return event;
  } catch (error) {
    console.error(`Error fetching event by slug (${slug}):`, error);

    // If the direct endpoint fails, try to get events from schedule as fallback
    try {
      // Get schedule for the next 30 days
      const now = new Date();
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + 30); // Look 30 days ahead

      const { events } = await getEvents({
        startDate: now.toISOString(),
        endDate: futureDate.toISOString(),
        limit: 100, // High limit to ensure we get all relevant events
      });

      // Find the event with matching slug
      const event = (events || []).find((e) => e && e.slug === slug);

      if (!event) {
        console.log(`No event found with slug "${slug}" in schedule`);
        return null;
      }

      return event;
    } catch (fallbackError) {
      console.error(`Fallback method for finding event by slug (${slug}) also failed:`, fallbackError);
      return null;
    }
  }
}

/**
 * Get current live and upcoming events
 */
export async function getScheduleData(): Promise<{
  currentEvent: RadioCultEvent | null;
  upcomingEvent: RadioCultEvent | null;
  upcomingEvents: RadioCultEvent[];
}> {
  try {
    // Get events for the next week
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7); // Look ahead 7 days for more upcoming content

    // Direct fetch to schedule endpoint
    const { events = [] } = await getEvents({
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      limit: 25, // Increased limit to get more upcoming shows
    });

    // Check if we have events
    if (!events || events.length === 0) {
      console.log("No events returned from schedule for upcoming shows");
      return {
        currentEvent: null,
        upcomingEvent: null,
        upcomingEvents: [],
      };
    }

    // Sort events by start time
    const sortedEvents = [...events].sort((a, b) => {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    // Find the current event (one that's currently running)
    const currentEvent =
      sortedEvents.find((event) => {
        const startTime = new Date(event.startTime);
        const endTime = new Date(event.endTime);
        return now >= startTime && now <= endTime;
      }) || null;

    // Find upcoming events (excluding the current one)
    const upcomingEvents = sortedEvents.filter((event) => {
      const startTime = new Date(event.startTime);
      return startTime > now && (!currentEvent || event.id !== currentEvent.id);
    });

    return {
      currentEvent,
      upcomingEvent: upcomingEvents[0] || null,
      upcomingEvents: upcomingEvents.slice(1),
    };
  } catch (error) {
    console.error("Error getting schedule data:", error);
    return {
      currentEvent: null,
      upcomingEvent: null,
      upcomingEvents: [],
    };
  }
}

/**
 * Transform RadioCult event to match the RadioShowObject format used in the app
 */
export function transformRadioCultEvent(event: RadioCultEvent): Partial<RadioShowObject> {
  const now = new Date().toISOString();

  const cosmicImage: CosmicImage | null = event.imageUrl
    ? {
        url: event.imageUrl,
        imgix_url: event.imageUrl,
      }
    : null;

  // Create genre objects from tags
  const genreObjects: GenreObject[] = event.tags.map((tag) => ({
    id: tag.toLowerCase().replace(/\s+/g, "-"),
    slug: tag.toLowerCase().replace(/\s+/g, "-"),
    title: tag,
    content: "",
    bucket: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "",
    created_at: now,
    modified_at: now,
    published_at: now,
    status: "published",
    type: "genres",
    metadata: null,
  }));

  // Create host objects from artists
  const hostObjects: HostObject[] = event.artists.map((artist) => ({
    id: artist.id,
    slug: artist.slug,
    title: artist.name,
    content: artist.description || "",
    bucket: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "",
    created_at: now,
    modified_at: now,
    published_at: now,
    status: "published",
    type: "hosts",
    metadata: {
      description: artist.description || null,
      image: artist.imageUrl
        ? {
            url: artist.imageUrl,
            imgix_url: artist.imageUrl,
          }
        : null,
    },
  }));

  // Calculate duration in MM:SS format
  const durationMinutes = Math.floor(event.duration);
  const duration = `${durationMinutes}:00`;

  return {
    id: event.id,
    title: event.showName,
    slug: event.slug,
    type: "episodes",
    metadata: {
      subtitle: event.showName,
      description: event.description || null,
      image: cosmicImage,
      broadcast_date: event.startTime,
      duration,
      player: null,
      genres: genreObjects,
      locations: [],
      regular_hosts: hostObjects,
      takeovers: [],
      featured_on_homepage: false,
      tracklist: null,
      body_text: null,
      broadcast_time: new Date(event.startTime).toLocaleTimeString(),
      broadcast_day: new Date(event.startTime).toLocaleDateString(),
      page_link: null,
      source: "radiocult",
    },
  };
}

/**
 * Get tags from RadioCult
 */
export async function getTags(forceRefresh = false, useSecretKey = false): Promise<RadioCultTag[]> {
  const endpoint = `/api/station/${STATION_ID}/media/tag`;
  const cacheKey = createCacheKey(endpoint);
  const cached = dataCache.get(cacheKey);

  // Use cache if available and not expired
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Use publishable key by default, secret key only when explicitly requested
    const data = await fetchFromRadioCult<{ success: boolean; tags: RadioCultTag[] }>(endpoint, {}, useSecretKey);

    // Update cache
    dataCache.set(cacheKey, {
      data: data.tags,
      timestamp: Date.now(),
    });

    return data.tags;
  } catch (error) {
    console.error("Error fetching RadioCult tags:", error);
    return [];
  }
}
