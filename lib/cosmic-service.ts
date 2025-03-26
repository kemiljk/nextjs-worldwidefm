import { createBucketClient } from "@cosmicjs/sdk";
import { COSMIC_CONFIG, CosmicResponse, RadioShowObject, CategoryObject, ScheduleObject, WatchAndListenObject, ArticleObject, MoodObject, PostObject } from "./cosmic-config";

// Initialize the Cosmic SDK client
const cosmic = createBucketClient({
  bucketSlug: COSMIC_CONFIG.bucketSlug,
  readKey: COSMIC_CONFIG.readKey,
});

/**
 * Get all radio shows
 */
export async function getRadioShows(
  params: {
    limit?: number;
    skip?: number;
    sort?: string;
    status?: string;
    exclude_ids?: string[];
  } = {}
): Promise<CosmicResponse<RadioShowObject>> {
  try {
    // Start building the query
    let query: any = {
      type: "radio-shows",
      status: params.status || "published",
    };

    // If we have IDs to exclude, add them as a "not" condition
    if (params.exclude_ids && params.exclude_ids.length > 0) {
      query = {
        ...query,
        id: {
          $nin: params.exclude_ids,
        },
      };
    }

    const response = await cosmic.objects
      .find(query)
      .props("slug,title,metadata,type")
      .limit(params.limit || 10)
      .skip(params.skip || 0)
      .sort(params.sort || "-created_at")
      .depth(1);

    return response;
  } catch (error) {
    console.error("Error fetching radio shows:", error);
    throw error;
  }
}

/**
 * Get a single radio show by slug
 */
export async function getRadioShowBySlug(slug: string): Promise<CosmicResponse<RadioShowObject>> {
  try {
    const response = await cosmic.objects.find({ type: "radio-shows", slug }).props("id,slug,title,metadata,type").depth(1);

    return response;
  } catch (error) {
    console.error(`Error fetching radio show by slug ${slug}:`, error);
    throw error;
  }
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<CosmicResponse<CategoryObject>> {
  try {
    const response = await cosmic.objects.find({ type: "categories" }).props("slug,title,metadata,type").depth(1);

    return response;
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw error;
  }
}

/**
 * Get a single category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<CosmicResponse<CategoryObject>> {
  try {
    const response = await cosmic.objects.find({ type: "categories", slug }).props("slug,title,metadata,type").depth(1);

    return response;
  } catch (error) {
    console.error(`Error fetching category by slug ${slug}:`, error);
    throw error;
  }
}

/**
 * Get schedule data
 */
export async function getSchedule(slug: string = "main-schedule"): Promise<CosmicResponse<ScheduleObject>> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: "schedule",
        slug,
      })
      .props("slug,title,metadata,type")
      .depth(3); // Increased depth to get more deeply nested objects

    return response;
  } catch (error) {
    console.error(`Error fetching schedule ${slug}:`, error);
    throw error;
  }
}

/**
 * Helper function to transform Cosmic data to the format used in the mock data
 */
export function transformShowToViewData(show: RadioShowObject) {
  const imageUrl = show.metadata?.image?.imgix_url || "";

  return {
    id: show.id,
    title: show.title,
    subtitle: show.metadata?.subtitle || "",
    description: show.metadata?.description || "",
    image: imageUrl,
    thumbnail: imageUrl ? `${imageUrl}?w=100&h=100&fit=crop` : "",
    slug: show.slug,
    broadcast_date: show.metadata?.broadcast_date || "",
    broadcast_time: show.metadata?.broadcast_time || "",
    broadcast_day: show.metadata?.broadcast_day || "",
    duration: show.metadata?.duration || "",
    player: show.metadata?.player || "",
    tracklist: show.metadata?.tracklist || "",
    body_text: show.metadata?.body_text || "",
  };
}

/**
 * Get navigation data
 */
export async function getNavigation(slug: string = "navigation"): Promise<any> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: "navigation",
        slug,
      })
      .props("slug,title,metadata")
      .depth(1);

    return response;
  } catch (error) {
    console.error(`Error fetching navigation data:`, error);
    throw error;
  }
}

/**
 * Get editorial homepage data
 */
export async function getEditorialHomepage(): Promise<any> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: "editorial-homepage",
        slug: "editorial",
      })
      .props("slug,title,metadata")
      .depth(2); // Increased depth to get nested objects

    return response;
  } catch (error) {
    console.error(`Error fetching editorial homepage data:`, error);
    throw error;
  }
}

/**
 * Get watch and listen items
 */
export async function getWatchAndListenItems(
  params: {
    limit?: number;
    skip?: number;
    sort?: string;
    status?: string;
  } = {}
): Promise<CosmicResponse<WatchAndListenObject>> {
  try {
    const response = await cosmic.objects
      .find({
        type: "watch-and-listens",
        status: params.status || "published",
      })
      .props("slug,title,metadata,type")
      .limit(params.limit || 10)
      .skip(params.skip || 0)
      .sort(params.sort || "-created_at")
      .depth(1);

    return response;
  } catch (error) {
    console.error("Error fetching watch and listen items:", error);
    throw error;
  }
}

/**
 * Get articles
 */
export async function getArticles(
  params: {
    limit?: number;
    skip?: number;
    sort?: string;
    status?: string;
    featured?: boolean;
  } = {}
): Promise<CosmicResponse<ArticleObject>> {
  try {
    let query: any = {
      type: "articles",
      status: params.status || "published",
    };

    // If featured flag is provided, add it to the query
    if (params.featured !== undefined) {
      console.log("Adding featured filter to articles query:", params.featured);
      query = {
        ...query,
        "metadata.featured_on_homepage": params.featured,
      };
    }

    console.log("Article query:", JSON.stringify(query));

    const response = await cosmic.objects
      .find(query)
      .props("slug,title,metadata,type")
      .limit(params.limit || 10)
      .skip(params.skip || 0)
      .sort(params.sort || "-metadata.date")
      .depth(2); // Depth of 2 to get author information

    console.log(`Fetched ${response.objects?.length || 0} articles`);

    return response;
  } catch (error) {
    console.error("Error fetching articles:", error);
    throw error;
  }
}

/**
 * Get moods
 */
export async function getMoods(
  params: {
    limit?: number;
    skip?: number;
    sort?: string;
    status?: string;
    featured?: boolean;
  } = {}
): Promise<CosmicResponse<MoodObject>> {
  try {
    let query: any = {
      type: "moods",
      status: params.status || "published",
    };

    // If featured flag is provided, add it to the query
    if (params.featured !== undefined) {
      query = {
        ...query,
        "metadata.featured_on_homepage": params.featured,
      };
    }

    const response = await cosmic.objects
      .find(query)
      .props("id,slug,title,metadata,type")
      .limit(params.limit || 10)
      .skip(params.skip || 0)
      .sort(params.sort || "-created_at")
      .depth(1);

    return response;
  } catch (error) {
    console.error("Error fetching moods:", error);
    throw error;
  }
}

/**
 * Get posts (articles, videos, events)
 */
export async function getPosts(
  params: {
    limit?: number;
    skip?: number;
    sort?: string;
    status?: string;
    featured?: boolean;
    post_type?: "article" | "video" | "event";
  } = {}
): Promise<CosmicResponse<PostObject>> {
  try {
    console.log("[Cosmic] Building query for posts:", params);

    // Build the query
    let query: any = {
      type: "posts",
      status: params.status || "published",
    };

    // If featured flag is provided, add it to the query
    if (params.featured !== undefined) {
      query = {
        ...query,
        "metadata.featured_on_homepage": params.featured,
      };
    }

    // If post_type is provided, add it to the query
    if (params.post_type) {
      query = {
        ...query,
        "metadata.post_type": params.post_type,
      };
    }

    console.log("[Cosmic] Final query:", JSON.stringify(query, null, 2));

    // Make the request to Cosmic
    const response = await cosmic.objects
      .find(query)
      .props("id,slug,title,metadata,type")
      .limit(params.limit || 10)
      .skip(params.skip || 0)
      .sort(params.sort || "-metadata.date")
      .depth(2);

    console.log(`[Cosmic] Found ${response.objects?.length || 0} posts`);

    // If no posts found in the posts type, try fetching from articles
    if (!response.objects || response.objects.length === 0) {
      console.log("[Cosmic] No posts found, trying articles instead");

      const articlesResponse = await cosmic.objects
        .find({
          type: "articles",
          status: params.status || "published",
        })
        .props("id,slug,title,metadata,type")
        .limit(params.limit || 10)
        .skip(params.skip || 0)
        .sort(params.sort || "-metadata.date")
        .depth(2);

      console.log(`[Cosmic] Found ${articlesResponse.objects?.length || 0} articles`);

      // Convert articles to posts format
      if (articlesResponse.objects && articlesResponse.objects.length > 0) {
        return {
          objects: articlesResponse.objects.map((article: ArticleObject) => ({
            ...article,
            metadata: {
              ...article.metadata,
              post_type: "article",
            },
          })),
          total: articlesResponse.total,
        };
      }
    }

    return response;
  } catch (error) {
    console.error("[Cosmic] Error in getPosts:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      params,
    });

    // Return empty response instead of throwing
    return {
      objects: [],
      total: 0,
    };
  }
}
