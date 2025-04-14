import { createBucketClient } from "@cosmicjs/sdk";
import { CosmicResponse, RadioShowObject, CategoryObject, PostObject, AboutObject } from "./cosmic-config";

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
});

export interface TimelineItem {
  year: string;
  title: string;
  content: string;
}

export interface AboutMetadata {
  hero_title: string;
  hero_subtitle: string;
  mission_content: string;
  connect_title: string;
  connect_content: string;
  social_links: {
    id: string;
    slug: string;
    title: string;
    content: string;
    bucket: string;
    created_at: string;
    modified_at: string;
    status: string;
    published_at: string;
    type: string;
    metadata: {
      instagram: string;
      twitter: string;
      facebook: string;
    };
  };
  contact_info: {
    id: string;
    slug: string;
    title: string;
    content: string;
    bucket: string;
    created_at: string;
    modified_at: string;
    status: string;
    published_at: string;
    type: string;
    metadata: {
      email: string;
      phone: string;
      location: string;
    };
  };
  partner_with_us_title: string;
  partner_with_us_description: string;
  partner_with_us: PartnerWithUs[];
}

export interface PartnerWithUs {
  logo: {
    url: string;
    imgix_url: string;
  };
  name: string;
}

export interface AboutPage {
  slug: string;
  title: string;
  type: string;
  metadata: AboutMetadata;
}

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
    filters?: {
      genre?: string;
      host?: string;
      takeover?: string;
      isNew?: boolean;
    };
  } = {}
): Promise<{ objects: RadioShowObject[]; total: number }> {
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

    // Add filter conditions
    if (params.filters) {
      const { genre, host, takeover, isNew } = params.filters;

      if (isNew) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = {
          ...query,
          "metadata.broadcast_date": {
            $gte: thirtyDaysAgo.toISOString(),
          },
        };
      }

      if (genre) {
        query = {
          ...query,
          "metadata.genres.id": genre,
        };
      }

      if (host) {
        query = {
          ...query,
          "metadata.regular_hosts.id": host,
        };
      }

      if (takeover) {
        query = {
          ...query,
          "metadata.takeovers.id": takeover,
        };
      }
    }

    const response = await cosmic.objects
      .find(query)
      .props("slug,title,metadata,type")
      .limit(params.limit || 10)
      .skip(params.skip || 0)
      .sort(params.sort || "-created_at")
      .depth(1);

    return {
      objects: response.objects || [],
      total: response.total || 0,
    };
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
    const response = await cosmic.objects.findOne({ type: "radio-shows", slug }).props("id,slug,title,metadata,type").depth(1);
    return response;
  } catch (error) {
    console.error(`Error fetching radio show by slug ${slug}:`, error);
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

interface ScheduleShow {
  show_key: string;
  show_time: string;
  show_day: string;
  name: string;
  url: string;
  picture: string;
  created_time: string;
  tags: string[];
  hosts: string[];
  duration: number;
  play_count: number;
  favorite_count: number;
  comment_count: number;
  listener_count: number;
  repost_count: number;
}

interface Schedule {
  id: string;
  title: string;
  slug: string;
  metadata: {
    shows: ScheduleShow[];
    is_active: string;
  };
}

export async function getSchedule(): Promise<CosmicResponse<Schedule> | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: "schedule",
        slug: "schedule",
      })
      .props("id,title,slug,metadata");

    return response;
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return null;
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
    type: show.type,
    subtitle: show.metadata?.subtitle || "",
    description: show.metadata?.description || "",
    featured_on_homepage: show.metadata?.featured_on_homepage || false,
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
    page_link: show.metadata?.page_link || "",
    source: show.metadata?.source || "",
    // Map all metadata fields with their full object structure
    genres: (show.metadata?.genres || []).map((genre) => ({
      id: genre.id,
      slug: genre.slug,
      title: genre.title,
      content: genre.content || "",
      type: genre.type,
      status: genre.status,
      metadata: genre.metadata || null,
      created_at: genre.created_at,
      modified_at: genre.modified_at,
      published_at: genre.published_at,
    })),
    locations: (show.metadata?.locations || []).map((location) => ({
      id: location.id,
      slug: location.slug,
      title: location.title,
      content: location.content || "",
      type: location.type,
      status: location.status,
      metadata: location.metadata || null,
      created_at: location.created_at,
      modified_at: location.modified_at,
      published_at: location.published_at,
    })),
    regular_hosts: (show.metadata?.regular_hosts || []).map((host) => ({
      id: host.id,
      slug: host.slug,
      title: host.title,
      content: host.content || "",
      type: host.type,
      status: host.status,
      metadata: host.metadata || null,
      created_at: host.created_at,
      modified_at: host.modified_at,
      published_at: host.published_at,
    })),
    takeovers: (show.metadata?.takeovers || []).map((takeover) => ({
      id: takeover.id,
      slug: takeover.slug,
      title: takeover.title,
      content: takeover.content || "",
      type: takeover.type,
      status: takeover.status,
      metadata: takeover.metadata || null,
      created_at: takeover.created_at,
      modified_at: takeover.modified_at,
      published_at: takeover.published_at,
    })),
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
    id?: string;
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
      .props("id,slug,title,metadata,type")
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
 * Get About page data
 */
export async function getAboutPage(): Promise<AboutPage> {
  const { object } = await cosmic.objects
    .findOne({
      type: "about",
      slug: "about",
    })
    .props("metadata")
    .depth(2);

  return object;
}
