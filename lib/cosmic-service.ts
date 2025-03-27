import { createBucketClient } from "@cosmicjs/sdk";
import { CosmicResponse, RadioShowObject, CategoryObject, ScheduleObject, PostObject } from "./cosmic-config";

// Initialize Cosmic client
export const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
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
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
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
    if (error instanceof Error) {
    }
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
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
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
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
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
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    throw error;
  }
}

/**
 * Helper function to transform Cosmic data to the format used in the mock data
 */
export function transformShowToViewData(show: RadioShowObject) {
  const imageUrl = show.metadata?.image?.imgix_url || "/image-placeholder.svg";
  const transformed = {
    id: show.id,
    title: show.title,
    subtitle: show.metadata?.subtitle || "",
    description: show.metadata?.description || "",
    image: imageUrl,
    thumbnail: imageUrl ? `${imageUrl}?w=100&h=100&fit=crop` : "/image-placeholder.svg",
    slug: show.slug,
    broadcast_date: show.metadata?.broadcast_date || "",
    broadcast_time: show.metadata?.broadcast_time || "",
    broadcast_day: show.metadata?.broadcast_day || "",
    duration: show.metadata?.duration || "",
    player: show.metadata?.player || "",
    tracklist: show.metadata?.tracklist || "",
    body_text: show.metadata?.body_text || "",
  };
  return transformed;
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
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
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
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
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
    // Build the query
    let query: any = {
      type: "posts",
      status: params.status || "published",
    };

    // If featured flag is provided, add it to the query
    if (params.featured) {
      query["metadata.featured_on_homepage"] = true;
    }

    // If post type is provided, add it to the query
    if (params.post_type) {
      query["metadata.post_type"] = params.post_type;
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
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    throw error;
  }
}
