import { COSMIC_CONFIG, CosmicResponse, RadioShowObject, CategoryObject, ScheduleObject } from "./cosmic-config";

/**
 * Base function to fetch data from Cosmic CMS
 */
async function fetchFromCosmic<T>(endpoint: string, query: Record<string, any> = {}): Promise<CosmicResponse<T>> {
  // Validate credentials are present
  if (!COSMIC_CONFIG.bucketSlug) {
    console.error("Missing Cosmic bucket slug. Please check your .env.local file.");
    throw new Error("Missing Cosmic bucket slug. Please set NEXT_PUBLIC_COSMIC_BUCKET_SLUG in your .env.local file.");
  }

  if (!COSMIC_CONFIG.readKey) {
    console.error("Missing Cosmic read key. Please check your .env.local file.");
    throw new Error("Missing Cosmic read key. Please set COSMIC_READ_KEY in your .env.local file.");
  }

  // Create clean query params object (remove undefined values)
  const cleanParams: Record<string, any> = {};

  // Add read_key first
  cleanParams.read_key = COSMIC_CONFIG.readKey;

  // Add all other provided params, filtering out undefined/null values
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      cleanParams[key] = value;
    }
  });

  // Build URL with params
  const params = new URLSearchParams(cleanParams);
  const url = `${COSMIC_CONFIG.apiUrl}/buckets/${COSMIC_CONFIG.bucketSlug}/${endpoint}?${params.toString()}`;

  try {
    console.log(`Fetching from Cosmic: ${url.replace(COSMIC_CONFIG.readKey, "[REDACTED]")}`);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Cosmic API error (${response.status}): ${errorText}`);

      throw new Error(`Cosmic API error: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching from Cosmic:", error);
    throw error;
  }
}

/**
 * Get all radio shows
 */
export async function getRadioShows(params: { limit?: number; skip?: number; sort?: string; status?: string } = {}): Promise<CosmicResponse<RadioShowObject>> {
  return fetchFromCosmic<RadioShowObject>("objects", {
    type: "radio-shows",
    limit: params.limit || 10,
    skip: params.skip || 0,
    sort: params.sort || "-created_at",
    status: params.status || "published",
  });
}

/**
 * Get a single radio show by slug
 */
export async function getRadioShowBySlug(slug: string): Promise<CosmicResponse<RadioShowObject>> {
  return fetchFromCosmic<RadioShowObject>("objects", {
    type: "radio-shows",
    slug,
  });
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<CosmicResponse<CategoryObject>> {
  return fetchFromCosmic<CategoryObject>("objects", {
    type: "categories",
  });
}

/**
 * Get a single category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<CosmicResponse<CategoryObject>> {
  return fetchFromCosmic<CategoryObject>("objects", {
    type: "categories",
    slug,
  });
}

/**
 * Get schedule data
 */
export async function getSchedule(slug: string = "main-schedule"): Promise<CosmicResponse<ScheduleObject>> {
  return fetchFromCosmic<ScheduleObject>("objects", {
    type: "schedule",
    slug,
  });
}

/**
 * Helper function to transform Cosmic data to the format used in the mock data
 */
export function transformShowToViewData(show: RadioShowObject) {
  return {
    title: show.title,
    subtitle: show.metadata.subtitle,
    description: show.metadata.description,
    image: show.metadata.image?.imgix_url,
    thumbnail: show.metadata.image?.imgix_url + "?w=100&h=100&fit=crop",
    slug: show.slug,
  };
}
