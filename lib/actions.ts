"use server";

import { getPosts, getEditorialHomepage, getRadioShowBySlug } from "./cosmic-service";
import { SearchResult, FilterItem } from "./search-context";
import { PostObject, VideoObject } from "./cosmic-config";
import { cosmic } from "./cosmic-config";
import { getEventBySlug as getRadioCultEventBySlug, getEvents as getRadioCultEvents, RadioCultEvent, getScheduleData as getRadioCultScheduleData, getTags } from "./radiocult-service";
import FormData from "form-data";
import { CosmicHomepageData, HomepageSectionItem, CosmicAPIObject, ProcessedHomepageSection } from "./cosmic-types";
import { stripUrlsFromText } from "./utils";
import { deduplicateFilters } from "./filter-types";

export async function getAllPosts({ limit = 20, offset = 0, tag, searchTerm }: { limit?: number; offset?: number; tag?: string; searchTerm?: string } = {}): Promise<{ posts: PostObject[]; hasNext: boolean }> {
  try {
    const filters: any = {
      limit,
      skip: offset,
      sort: "-metadata.date",
      status: "published",
    };
    if (tag) {
      filters["metadata.categories"] = tag;
    }
    if (searchTerm) {
      filters["title"] = searchTerm;
    }
    const response = await getPosts(filters);
    const posts = response.objects || [];
    const hasNext = posts.length === limit;
    return { posts, hasNext };
  } catch (error) {
    console.error("Error in getAllPosts:", error);
    return { posts: [], hasNext: false };
  }
}

export async function getAllShows(skip = 0, limit = 20, filters?: any) {
  try {
    // Get episodes from Cosmic using the episode service
    const { getEpisodesForShows } = await import("./episode-service");
    const response = await getEpisodesForShows({
      offset: skip,
      limit,
      ...filters,
    });

    return {
      shows: response.shows,
      hasMore: response.hasNext,
      cosmicSkip: skip + response.shows.length,
      mixcloudSkip: 0, // Deprecated but kept for compatibility
    };
  } catch (error) {
    console.error("Error fetching episodes:", error);
    return { shows: [], hasMore: false, cosmicSkip: skip, mixcloudSkip: 0 };
  }
}

/**
 * Enhanced function that gets episode data from Cosmic, with fallback to RadioCult for live shows
 */
export async function getEnhancedShowBySlug(slug: string): Promise<any | null> {
  // First try to get episode from Cosmic
  try {
    const { getEpisodeBySlug, transformEpisodeToShowFormat } = await import("./episode-service");
    const episode = await getEpisodeBySlug(slug);

    if (episode) {
      return transformEpisodeToShowFormat(episode);
    }
  } catch (error) {
    console.error("Error fetching episode from Cosmic:", error);
  }

  // If no episode found in Cosmic, try RadioCult for live shows
  try {
    const radioCultEvent = await getRadioCultEventBySlug(slug);
    if (radioCultEvent) {
      return convertRadioCultEventToMixcloudFormat(radioCultEvent);
    }
  } catch (error) {
    console.error("Error fetching RadioCult event:", error);
  }

  return null;
}

export async function getShowBySlug(slug: string): Promise<any | null> {
  // Normalize slug variants
  const slugVariants = [slug, slug.startsWith("/") ? slug.slice(1) : "/" + slug, slug.replace(/^\/+/, ""), slug.replace(/^\/worldwidefm\//, "")];

  // First, try to get episode from Cosmic
  for (const variant of slugVariants) {
    try {
      const { getEpisodeBySlug, transformEpisodeToShowFormat } = await import("./episode-service");
      const episode = await getEpisodeBySlug(variant);
      if (episode) {
        return transformEpisodeToShowFormat(episode);
      }
    } catch (error) {
      console.error(`Error fetching episode from Cosmic for variant '${variant}':`, error);
    }
  }

  // If no episode found in Cosmic, try RadioCult for live shows
  for (const variant of slugVariants) {
    try {
      // Only try RadioCult if it looks like a live show slug
      if (!variant.includes("/")) {
        const radioCultEvent = await getRadioCultEventBySlug(variant);
        if (radioCultEvent) {
          return convertRadioCultEventToMixcloudFormat(radioCultEvent);
        }
      }
    } catch (error) {
      console.error(`Error finding RadioCult event for slug variant '${variant}':`, error);
    }
  }

  // Finally, try legacy episodes from Cosmic (for backward compatibility)
  for (const variant of slugVariants) {
    try {
      const cosmicResponse = await getRadioShowBySlug(variant);
      if (cosmicResponse?.object) {
        const show = cosmicResponse.object;
        // Transform legacy radio-show to compatible format
        return {
          key: show.slug,
          name: show.title,
          url: `/episode/${show.slug}`,
          pictures: {
            small: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            thumbnail: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            medium_mobile: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            medium: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            large: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            "320wx320h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            extra_large: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            "640wx640h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            "768wx768h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
            "1024wx1024h": show.metadata?.image?.imgix_url || "/image-placeholder.svg",
          },
          created_time: show.metadata?.broadcast_date || show.created_at,
          updated_time: show.modified_at,
          play_count: 0,
          favorite_count: 0,
          comment_count: 0,
          listener_count: 0,
          repost_count: 0,
          tags: (show.metadata?.genres || []).map((genre: any) => ({
            key: genre.slug || genre.id,
            url: `/genres/${genre.slug || genre.id}`,
            name: genre.title,
          })),
          slug: show.slug,
          hosts: (show.metadata?.regular_hosts || []).map((host: any) => ({
            key: host.slug || host.id,
            url: `/hosts/${host.slug || host.id}`,
            name: host.title,
            username: host.slug || host.id,
            pictures: {
              small: host.image?.imgix_url || "/image-placeholder.svg",
              thumbnail: host.image?.imgix_url || "/image-placeholder.svg",
              medium_mobile: host.image?.imgix_url || "/image-placeholder.svg",
              medium: host.image?.imgix_url || "/image-placeholder.svg",
              large: host.image?.imgix_url || "/image-placeholder.svg",
              "320wx320h": host.image?.imgix_url || "/image-placeholder.svg",
              extra_large: host.image?.imgix_url || "/image-placeholder.svg",
              "640wx640h": host.image?.imgix_url || "/image-placeholder.svg",
            },
          })),
          hidden_stats: false,
          audio_length: 0,
          description: show.metadata?.description || "",
          player: show.metadata?.player,
          __source: "cosmic",
        };
      }
    } catch (error) {
      console.error(`Error fetching legacy radio-show from Cosmic for variant '${variant}':`, error);
    }
  }

  console.warn(`No show found for any slug variant: ${slugVariants.join(", ")}`);
  return null;
}

export async function getScheduleData(): Promise<{
  currentShow: any | null;
  upcomingShow: any | null;
  upcomingShows: any[];
}> {
  try {
    // Get schedule data from RadioCult
    const { currentEvent, upcomingEvent, upcomingEvents } = await getRadioCultScheduleData();

    // Convert RadioCult events to show format
    const adaptCurrentEvent = currentEvent ? convertRadioCultEventToMixcloudFormat(currentEvent) : null;
    const adaptUpcomingEvent = upcomingEvent ? convertRadioCultEventToMixcloudFormat(upcomingEvent) : null;
    const adaptUpcomingEvents = upcomingEvents.map(convertRadioCultEventToMixcloudFormat);

    return {
      currentShow: adaptCurrentEvent,
      upcomingShow: adaptUpcomingEvent,
      upcomingShows: adaptUpcomingEvents,
    };
  } catch (error) {
    console.error("Error getting RadioCult schedule data:", error);
    return {
      currentShow: null,
      upcomingShow: null,
      upcomingShows: [],
    };
  }
}

// Helper to convert RadioCult event to Mixcloud format
function convertRadioCultEventToMixcloudFormat(event: RadioCultEvent): any {
  return {
    key: event.slug,
    name: event.showName,
    url: `/shows/${event.slug}`,
    pictures: {
      small: event.imageUrl || "/image-placeholder.svg",
      thumbnail: event.imageUrl || "/image-placeholder.svg",
      medium_mobile: event.imageUrl || "/image-placeholder.svg",
      medium: event.imageUrl || "/image-placeholder.svg",
      large: event.imageUrl || "/image-placeholder.svg",
      "320wx320h": event.imageUrl || "/image-placeholder.svg",
      extra_large: event.imageUrl || "/image-placeholder.svg",
      "640wx640h": event.imageUrl || "/image-placeholder.svg",
      "768wx768h": event.imageUrl || "/image-placeholder.svg",
      "1024wx1024h": event.imageUrl || "/image-placeholder.svg",
    },
    created_time: event.startTime,
    updated_time: event.updatedAt,
    play_count: 0,
    favorite_count: 0,
    comment_count: 0,
    listener_count: 0,
    repost_count: 0,
    tags: event.tags.map((tag) => ({
      key: tag.toLowerCase().replace(/\s+/g, "-"),
      url: `/tags/${tag.toLowerCase().replace(/\s+/g, "-")}`,
      name: tag,
    })),
    slug: event.slug,
    user: {
      key: "radiocult",
      url: "/",
      name: "RadioCult",
      username: "radiocult",
      pictures: {
        small: "/logo.svg",
        thumbnail: "/logo.svg",
        medium_mobile: "/logo.svg",
        medium: "/logo.svg",
        large: "/logo.svg",
        "320wx320h": "/logo.svg",
        extra_large: "/logo.svg",
        "640wx640h": "/logo.svg",
      },
    },
    hosts: event.artists.map((artist) => ({
      key: artist.id,
      url: `/artists/${artist.slug}`,
      name: artist.name,
      username: artist.slug,
      pictures: {
        small: artist.imageUrl || "/image-placeholder.svg",
        thumbnail: artist.imageUrl || "/image-placeholder.svg",
        medium_mobile: artist.imageUrl || "/image-placeholder.svg",
        medium: artist.imageUrl || "/image-placeholder.svg",
        large: artist.imageUrl || "/image-placeholder.svg",
        "320wx320h": artist.imageUrl || "/image-placeholder.svg",
        extra_large: artist.imageUrl || "/image-placeholder.svg",
        "640wx640h": artist.imageUrl || "/image-placeholder.svg",
      },
    })),
    hidden_stats: false,
    audio_length: event.duration * 60, // convert minutes to seconds
    endTime: event.endTime, // Add endTime for RadioCult events
    description: typeof event.description === "string" ? stripUrlsFromText(event.description) : event.description, // Add description for RadioCult events
    __source: "radiocult", // Add a source marker to identify RadioCult events
  };
}

export async function getEditorialContent(): Promise<{
  posts: PostObject[];
  featuredPosts: PostObject[];
}> {
  try {
    let posts: PostObject[] = [];
    let featuredPosts: PostObject[] = [];

    // Try to get posts from editorial homepage first
    try {
      const editorialResponse = await getEditorialHomepage();
      if (editorialResponse.object?.metadata?.featured_posts) {
        posts = editorialResponse.object.metadata.featured_posts;
        featuredPosts = posts.slice(0, 3);
      }
    } catch (error) {
      // If editorial homepage doesn't exist or has no posts, continue to fetch posts directly
      console.log("No editorial homepage found, fetching posts directly");
    }

    // If we don't have enough posts, fetch more
    if (posts.length < 6) {
      const postsResponse = await getPosts({
        limit: 6 - posts.length,
        sort: "-metadata.date",
        status: "published",
      });

      if (postsResponse.objects && postsResponse.objects.length > 0) {
        posts = [...posts, ...postsResponse.objects];
      }
    }

    // If we still don't have any posts, fetch all posts
    if (posts.length === 0) {
      const allPostsResponse = await getPosts({
        limit: 6,
        sort: "-metadata.date",
        status: "published",
      });

      if (allPostsResponse.objects && allPostsResponse.objects.length > 0) {
        posts = allPostsResponse.objects;
        featuredPosts = posts.slice(0, 3);
      }
    }

    // Sort all posts by date to ensure correct order
    posts.sort((a, b) => {
      const dateA = a.metadata?.date ? new Date(a.metadata.date).getTime() : 0;
      const dateB = b.metadata?.date ? new Date(b.metadata.date).getTime() : 0;
      return dateB - dateA;
    });

    return {
      posts,
      featuredPosts,
    };
  } catch (error) {
    console.error("Error in getEditorialContent:", error);
    return {
      posts: [],
      featuredPosts: [],
    };
  }
}

export async function getAllSearchableContent(limit?: number): Promise<SearchResult[]> {
  try {
    // Use the limit parameter for shows if provided
    const showsLimit = limit ?? 1000;
    const [postsResponse, showsResponse] = await Promise.all([getAllPosts(), getAllShows(0, showsLimit)]);

    // Helper to ensure filter items have correct structure
    const normalizeFilterItems = (items: any[] = []): FilterItem[] => {
      return items.filter(Boolean).map((item: { title?: string; slug?: string; id?: string; type?: string }) => ({
        title: item.title || "",
        slug: item.slug || item.id || "",
        type: item.type || "",
      }));
    };

    const allContent: SearchResult[] = [
      ...postsResponse.posts.map((post: PostObject) => {
        // For posts, categories may be stored differently than in shows
        // We'll extract categories from post.metadata.categories if available
        const categories = post.metadata?.categories || [];

        // Create empty arrays for filter types that posts might not have
        return {
          id: post.id,
          title: post.title,
          type: "posts" as const,
          description: post.metadata?.description || "",
          excerpt: post.metadata?.content || "",
          image: post.metadata?.image?.imgix_url || "/image-placeholder.svg",
          slug: post.slug,
          date: post.metadata?.date || "",
          // Map categories to their appropriate filter arrays based on category type if known
          // For simplicity, we'll just put all categories in genres for now
          genres: normalizeFilterItems(categories),
          locations: [], // Posts typically don't have locations
          hosts: [], // Posts typically don't have hosts
          takeovers: [], // Posts typically don't have takeovers
          featured: post.metadata?.featured_on_homepage,
        };
      }),
      ...showsResponse.shows.map((show) => ({
        id: show.id,
        title: show.title,
        type: "episodes" as const,
        description: show.metadata?.description || "",
        excerpt: show.metadata?.subtitle || "",
        image: show.metadata?.image?.imgix_url || "/image-placeholder.svg",
        slug: show.slug,
        date: show.metadata?.broadcast_date || "",
        genres: normalizeFilterItems(show.metadata?.genres || []),
        locations: normalizeFilterItems(show.metadata?.locations || []),
        hosts: normalizeFilterItems(show.metadata?.regular_hosts || []),
        takeovers: normalizeFilterItems(show.metadata?.takeovers || []),
        metadata: show.metadata,
      })),
    ].sort((a, b) => {
      const dateA = new Date(a.date || "");
      const dateB = new Date(b.date || "");
      return dateB.getTime() - dateA.getTime();
    });

    return allContent;
  } catch (error) {
    console.error("Error in getAllSearchableContent:", error);
    return [];
  }
}

export async function getVideos({ limit = 20, offset = 0, tag, searchTerm }: { limit?: number; offset?: number; tag?: string; searchTerm?: string } = {}): Promise<{ videos: VideoObject[]; hasNext: boolean }> {
  try {
    const filters: any = {
      type: "videos",
      limit,
      skip: offset,
      sort: "-metadata.date",
      status: "published",
      props: "id,slug,title,metadata,created_at",
      depth: 3,
    };
    if (tag) {
      filters["metadata.categories"] = tag;
    }
    if (searchTerm) {
      filters["title"] = searchTerm;
    }
    const response = await cosmic.objects.find(filters);
    const videos = response.objects || [];
    const hasNext = videos.length === limit;
    return { videos, hasNext };
  } catch (error) {
    console.error("Error in getVideos:", error);
    return { videos: [], hasNext: false };
  }
}

export async function getVideoCategories(): Promise<any[]> {
  try {
    const response = await cosmic.objects.find({
      type: "video-categories",
      props: "id,slug,title,content,bucket,created_at,modified_at,status,published_at,modified_by,created_by,type,metadata",
      depth: 1,
    });
    return response.objects || [];
  } catch (error) {
    console.error("Error in getVideoCategories:", error);
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<{ object: PostObject } | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: "posts",
        slug: slug,
      })
      .props("id,title,slug,type,created_at,metadata")
      .depth(2);

    if (!response) {
      return null;
    }

    return response;
  } catch (error) {
    console.error("Error fetching post:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    return null;
  }
}

export async function getRelatedPosts(post: PostObject): Promise<PostObject[]> {
  try {
    // Check if post and metadata exist
    if (!post?.metadata?.categories) {
      return [];
    }

    // Get the categories from the current post
    const categories = post.metadata.categories.map((cat) => cat.slug);

    if (categories.length === 0) {
      return [];
    }

    // Fetch posts that share at least one category with the current post
    const relatedPosts = await cosmic.objects
      .find({
        type: "posts",
        "metadata.categories.slug": {
          $in: categories,
        },
      })
      .props("id,title,slug,type,created_at,metadata")
      .limit(3)
      .depth(2);

    // Filter out the current post from related posts and extract the objects from the response
    return (relatedPosts.objects || []).filter((relatedPost: PostObject) => relatedPost.slug !== post.slug).map((post: any) => post.object || post); // Handle both direct objects and nested ones
  } catch (error) {
    console.error("Error fetching related posts:", error);
    return [];
  }
}

export async function getAllFilters() {
  try {
    // Fetch all filter collections in parallel from Cosmic
    const [genresRes, hostsRes, takeoversRes, locationsRes, featuredShowsRes, seriesRes] = await Promise.all([
      cosmic.objects.find({ type: "genres", props: "id,slug,title,type,metadata", depth: 1, limit: 1000 }),
      cosmic.objects.find({ type: "regular-hosts", props: "id,slug,title,type,metadata", depth: 1, limit: 1000 }),
      cosmic.objects.find({ type: "takeovers", props: "id,slug,title,type,metadata", depth: 1, limit: 1000 }),
      cosmic.objects.find({ type: "locations", props: "id,slug,title,type,metadata", depth: 1, limit: 1000 }),
      cosmic.objects.find({ type: "featured-shows", props: "id,slug,title,type,metadata", depth: 1, limit: 1000 }),
      cosmic.objects.find({ type: "series", props: "id,slug,title,type,metadata", depth: 1, limit: 1000 }),
    ]);

    const toFilterItems = (objects: any[] = [], type: string): FilterItem[] => objects.map((obj) => ({ id: obj.id, slug: obj.slug, title: obj.title, type }));

    const genres = toFilterItems(genresRes.objects || [], "genres");
    const hosts = toFilterItems(hostsRes.objects || [], "hosts");
    const takeovers = toFilterItems(takeoversRes.objects || [], "takeovers");
    const locations = toFilterItems(locationsRes.objects || [], "locations");
    const featuredShows = toFilterItems(featuredShowsRes.objects || [], "featured-shows");
    const series = toFilterItems(seriesRes.objects || [], "series");

    return { genres, hosts, takeovers, locations, featuredShows, series };
  } catch (error) {
    console.error("Error getting filters:", error);
    return {
      genres: [],
      hosts: [],
      takeovers: [],
      locations: [],
      featuredShows: [],
      series: [],
    };
  }
}

export async function getShowsFilters() {
  try {
    // Helper function to safely fetch objects
    const safeFind = async (type: string) => {
      try {
        return await cosmic.objects.find({ type, props: "id,slug,title,type,metadata", depth: 1, limit: 1000 });
      } catch (error) {
        console.warn(`Failed to fetch ${type}:`, error);
        return { objects: [] };
      }
    };

    // Fetch only the filter collections we actually need
    const [genresRes, hostsRes, takeoversRes, locationsRes] = await Promise.all([safeFind("genres"), safeFind("regular-hosts"), safeFind("takeovers"), safeFind("locations")]);

    // Convert to FilterItem type with id property for shows page
    const toShowsFilterItems = (objects: any[] = [], type: string) => {
      const items = objects.map((obj) => ({
        id: obj.id,
        slug: obj.slug,
        title: obj.title,
        type: type,
        content: obj.content || "",
        status: obj.status || "published",
        metadata: obj.metadata || null,
        created_at: obj.created_at,
        modified_at: obj.modified_at,
        published_at: obj.published_at,
      }));

      const deduplicated = deduplicateFilters(items);
      if (items.length !== deduplicated.length) {
        console.log(`${type}: Removed ${items.length - deduplicated.length} duplicates (${items.length} → ${deduplicated.length})`);
      }

      return deduplicated;
    };

    return {
      genres: toShowsFilterItems(genresRes.objects || [], "genres"),
      hosts: toShowsFilterItems(hostsRes.objects || [], "hosts"),
      takeovers: toShowsFilterItems(takeoversRes.objects || [], "takeovers"),
      locations: toShowsFilterItems(locationsRes.objects || [], "locations"),
      featuredShows: [], // Remove this since we don't need it
      series: [], // Remove this since we don't need it
    };
  } catch (error) {
    console.error("Error getting shows filters:", error);
    return {
      genres: [],
      hosts: [],
      takeovers: [],
      locations: [],
      featuredShows: [],
      series: [],
    };
  }
}

interface EpisodeShowsFilters {
  genre?: string | string[];
  host?: string | string[];
  takeover?: string | string[];
  searchTerm?: string;
  isNew?: boolean;
  skip?: number;
  limit?: number;
  random?: boolean;
}

export async function getMixcloudShows(filters: EpisodeShowsFilters = {}): Promise<{ shows: any[]; total: number }> {
  try {
    // Get episodes from Cosmic
    const { getEpisodesForShows } = await import("./episode-service");
    const episodeResponse = await getEpisodesForShows({
      offset: filters.skip || 0,
      limit: filters.limit || 20,
      genre: filters.genre,
      host: filters.host,
      searchTerm: filters.searchTerm,
      isNew: filters.isNew,
      random: filters.random,
    });

    let allShows = episodeResponse.shows;

    // Get RadioCult live events if we want recent/live content
    if (!filters.random && (!filters.skip || filters.skip === 0)) {
      try {
        const { events: radioCultEvents } = await getRadioCultEvents({ limit: 10 });

        // Convert RadioCult events to show format
        const adaptedEvents = radioCultEvents.map((event) => ({
          key: event.slug,
          name: event.showName,
          title: event.showName,
          slug: event.slug,
          url: `/episode/${event.slug}`,
          pictures: {
            small: event.imageUrl || "/image-placeholder.svg",
            thumbnail: event.imageUrl || "/image-placeholder.svg",
            medium_mobile: event.imageUrl || "/image-placeholder.svg",
            medium: event.imageUrl || "/image-placeholder.svg",
            large: event.imageUrl || "/image-placeholder.svg",
            "320wx320h": event.imageUrl || "/image-placeholder.svg",
            extra_large: event.imageUrl || "/image-placeholder.svg",
            "640wx640h": event.imageUrl || "/image-placeholder.svg",
            "768wx768h": event.imageUrl || "/image-placeholder.svg",
            "1024wx1024h": event.imageUrl || "/image-placeholder.svg",
          },
          created_time: event.startTime,
          updated_time: event.updatedAt,
          play_count: 0,
          favorite_count: 0,
          comment_count: 0,
          listener_count: 0,
          repost_count: 0,
          tags: event.tags.map((tag) => ({
            key: tag.toLowerCase().replace(/\s+/g, "-"),
            url: `/tags/${tag.toLowerCase().replace(/\s+/g, "-")}`,
            name: tag,
          })),
          hosts: event.artists.map((artist) => ({
            key: artist.id,
            url: `/artists/${artist.slug}`,
            name: artist.name,
            username: artist.slug,
            pictures: {
              small: artist.imageUrl || "/image-placeholder.svg",
              thumbnail: artist.imageUrl || "/image-placeholder.svg",
              medium_mobile: artist.imageUrl || "/image-placeholder.svg",
              medium: artist.imageUrl || "/image-placeholder.svg",
              large: artist.imageUrl || "/image-placeholder.svg",
              "320wx320h": artist.imageUrl || "/image-placeholder.svg",
              extra_large: artist.imageUrl || "/image-placeholder.svg",
              "640wx640h": artist.imageUrl || "/image-placeholder.svg",
            },
          })),
          hidden_stats: false,
          audio_length: event.duration * 60,
          __source: "radiocult",
        }));

        // Add RadioCult events at the beginning for live content
        allShows = [...adaptedEvents, ...allShows];
      } catch (error) {
        console.error("Error fetching RadioCult events:", error);
        // Continue with just episode data
      }
    }

    // Apply additional filtering if needed
    let filteredShows = allShows;

    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filteredShows = filteredShows.filter((show) => show.name?.toLowerCase().includes(searchTerm) || show.title?.toLowerCase().includes(searchTerm) || (show.tags || []).some((tag: any) => tag.name?.toLowerCase().includes(searchTerm)) || (show.genres || []).some((genre: any) => genre.title?.toLowerCase().includes(searchTerm)));
    }

    return {
      shows: filteredShows,
      total: filteredShows.length,
    };
  } catch (error) {
    console.error("Error in getMixcloudShows (now using episodes):", error);
    return { shows: [], total: 0 };
  }
}

export async function searchContent(query?: string, source?: string, limit: number = 100): Promise<SearchResult[]> {
  try {
    // Helper to safely extract a string field
    const safeString = (val: any): string | undefined => (typeof val === "string" && val.trim() ? val : undefined);
    // Helper to get best image url
    const getImage = (meta: any): string | undefined => meta?.image?.imgix_url || meta?.image?.url || undefined;
    // Helper to get genres from categories
    const getGenres = (meta: any): FilterItem[] => (meta?.categories || []).filter(Boolean).map((cat: any) => ({ slug: cat.slug, title: cat.title, type: "genres" }));
    // Helper to get date
    const getDate = (meta: any, fallback: string): string | undefined => safeString(meta?.date) || fallback;

    if (source === "cosmic") {
      const [postsResponse, eventsResponse, videosResponse, takeoversResponse] = await Promise.all([
        cosmic.objects.find({ type: "posts", ...(query && { q: query }), props: "id,title,slug,metadata,created_at", limit, status: "published" }),
        cosmic.objects.find({ type: "events", ...(query && { q: query }), props: "id,title,slug,metadata,created_at", limit, status: "published" }),
        cosmic.objects.find({ type: "videos", ...(query && { q: query }), props: "id,title,slug,metadata,created_at", limit, status: "published" }),
        cosmic.objects.find({ type: "takeovers", ...(query && { q: query }), props: "id,title,slug,metadata,created_at", limit, status: "published" }),
      ]);
      const posts = postsResponse.objects || [];
      const events = eventsResponse.objects || [];
      const videos = videosResponse.objects || [];
      const takeovers = takeoversResponse.objects || [];
      return [
        ...posts
          .map((item: any) => {
            const meta = item.metadata || {};
            return {
              id: item.id,
              type: "posts",
              slug: item.slug,
              title: safeString(item.title),
              description: safeString(meta.description) || safeString(meta.excerpt),
              image: getImage(meta),
              date: getDate(meta, item.created_at),
              genres: getGenres(meta),
            };
          })
          .filter((item: any) => item.title),
        ...events
          .map((item: any) => {
            const meta = item.metadata || {};
            return {
              id: item.id,
              type: "events",
              slug: item.slug,
              title: safeString(item.title),
              description: safeString(meta.description) || safeString(meta.excerpt),
              image: getImage(meta),
              date: getDate(meta, item.created_at),
              genres: getGenres(meta),
            };
          })
          .filter((item: any) => item.title),
        ...videos
          .map((item: any) => {
            const meta = item.metadata || {};
            return {
              id: item.id,
              type: "videos",
              slug: item.slug,
              title: safeString(item.title),
              description: safeString(meta.description),
              image: getImage(meta),
              date: getDate(meta, item.created_at),
              genres: getGenres(meta),
            };
          })
          .filter((item: any) => item.title),
        ...takeovers
          .map((item: any) => {
            const meta = item.metadata || {};
            return {
              id: item.id,
              type: "takeovers",
              slug: item.slug,
              title: safeString(item.title),
              description: safeString(meta.description) || safeString(meta.excerpt),
              image: getImage(meta),
              date: getDate(meta, item.created_at),
              genres: getGenres(meta),
            };
          })
          .filter((item: any) => item.title),
      ];
    }

    // If no source specified, search in both and combine results
    const [episodesResponse, postsResponse, eventsResponse, videosResponse, takeoversResponse] = await Promise.all([
      import("./episode-service").then((m) => m.getEpisodesForShows({ searchTerm: query, limit })),
      cosmic.objects.find({ type: "posts", ...(query && { q: query }), props: "id,title,slug,metadata,created_at", limit, status: "published" }),
      cosmic.objects.find({ type: "events", ...(query && { q: query }), props: "id,title,slug,metadata,created_at", limit, status: "published" }),
      cosmic.objects.find({ type: "videos", ...(query && { q: query }), props: "id,title,slug,metadata,created_at", limit, status: "published" }),
      cosmic.objects.find({ type: "takeovers", ...(query && { q: query }), props: "id,title,slug,metadata,created_at", limit, status: "published" }),
    ]);
    const episodes = episodesResponse.shows || [];
    const posts = postsResponse.objects || [];
    const events = eventsResponse.objects || [];
    const videos = videosResponse.objects || [];
    const takeovers = takeoversResponse.objects || [];
    const results = [
      // Radio Shows (Episodes from Cosmic)
      ...episodes
        .slice(0, limit)
        .map((episode: any) => {
          return {
            id: episode.id || episode.slug,
            type: "episodes",
            slug: episode.slug,
            title: safeString(episode.title || episode.name),
            description: safeString(episode.description) || safeString(episode.title || episode.name),
            image: episode.pictures?.extra_large || episode.enhanced_image || undefined,
            date: safeString(episode.created_time || episode.broadcast_date),
            genres: (episode.genres || episode.enhanced_genres || []).filter(Boolean).map((genre: any) => ({
              slug: genre.slug || genre.title?.toLowerCase().replace(/\s+/g, "-"),
              title: genre.title || genre.name,
              type: "genres",
            })),
            hosts: (episode.hosts || episode.enhanced_hosts || episode.regular_hosts || []).filter(Boolean).map((host: any) => ({
              slug: host.slug || host.username,
              title: host.title || host.name,
              type: "hosts",
            })),
            locations: episode.locations || [],
            takeovers: episode.takeovers || [],
          };
        })
        .filter((item: any) => item.title),
      // Posts
      ...posts
        .map((item: any) => {
          const meta = item.metadata || {};
          return {
            id: item.id,
            type: "posts",
            slug: item.slug,
            title: safeString(item.title),
            description: safeString(meta.description) || safeString(meta.excerpt),
            image: getImage(meta),
            date: getDate(meta, item.created_at),
            genres: getGenres(meta),
            hosts: [],
            locations: [],
            takeovers: [],
          };
        })
        .filter((item: any) => item.title),
      // Events
      ...events
        .map((item: any) => {
          const meta = item.metadata || {};
          return {
            id: item.id,
            type: "events",
            slug: item.slug,
            title: safeString(item.title),
            description: safeString(meta.description) || safeString(meta.excerpt),
            image: getImage(meta),
            date: getDate(meta, item.created_at),
            genres: getGenres(meta),
            hosts: [],
            locations: [],
            takeovers: [],
          };
        })
        .filter((item: any) => item.title),
      // Videos
      ...videos
        .map((item: any) => {
          const meta = item.metadata || {};
          return {
            id: item.id,
            type: "videos",
            slug: item.slug,
            title: safeString(item.title),
            description: safeString(meta.description),
            image: getImage(meta),
            date: getDate(meta, item.created_at),
            genres: getGenres(meta),
            hosts: [],
            locations: [],
            takeovers: [],
          };
        })
        .filter((item: any) => item.title),
      // Takeovers
      ...takeovers
        .map((item: any) => {
          const meta = item.metadata || {};
          return {
            id: item.id,
            type: "takeovers",
            slug: item.slug,
            title: safeString(item.title),
            description: safeString(meta.description) || safeString(meta.excerpt),
            image: getImage(meta),
            date: getDate(meta, item.created_at),
            genres: getGenres(meta),
            hosts: [],
            locations: [],
            takeovers: [],
          };
        })
        .filter((item: any) => item.title),
    ];
    return results.slice(0, limit);
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
}

// Server action to fetch tags
export async function fetchTags() {
  "use server";

  try {
    const tags = await getTags(false, true); // Use secret key for server-side operations
    return { success: true, tags };
  } catch (error) {
    console.error("Error fetching tags:", error);
    return { success: false, error: "Failed to fetch tags" };
  }
}

export async function uploadMediaToRadioCultAndCosmic(file: File, metadata: Record<string, any> = {}) {
  // Upload to RadioCult
  const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
  const secretKey = process.env.RADIOCULT_SECRET_KEY;
  if (!stationId || !secretKey) {
    throw new Error("Missing RadioCult station ID or secret key");
  }

  // Prepare form data for RadioCult
  const rcForm = new FormData();
  rcForm.append("stationMedia", file as any); // Node.js: use createReadStream, but File is fine in edge/serverless
  rcForm.append("metadata", JSON.stringify(metadata));

  const rcRes = await fetch(`https://api.radiocult.fm/api/station/${stationId}/media/track`, {
    method: "POST",
    headers: {
      ...rcForm.getHeaders?.(),
      "x-api-key": secretKey,
    },
    body: rcForm as any,
  });
  if (!rcRes.ok) {
    throw new Error("Failed to upload to RadioCult");
  }
  const rcJson = await rcRes.json();
  const radiocultMediaId = rcJson.track?.id;

  // Upload to Cosmic
  // (Assume you have a helper for this, e.g. createObject or a direct upload endpoint)
  // If using REST API:
  const cosmicForm = new FormData();
  cosmicForm.append("media", file as any);
  const cosmicRes = await fetch(`https://api.cosmicjs.com/v2/buckets/${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.COSMIC_WRITE_KEY}`,
      ...cosmicForm.getHeaders?.(),
    },
    body: cosmicForm as any,
  });
  if (!cosmicRes.ok) {
    throw new Error("Failed to upload to Cosmic");
  }
  const cosmicJson = await cosmicRes.json();
  const cosmicMedia = cosmicJson.media;

  return {
    radiocultMediaId,
    cosmicMedia,
  };
}

/**
 * Helper function to get host profile URL if it exists
 */
export async function getHostProfileUrl(hostName: string): Promise<string | null> {
  try {
    const { getHostByName, getHosts } = await import("./cosmic-service");

    // First try to find by exact name match
    let host = await getHostByName(hostName);

    if (!host) {
      // Try to find by similar name
      const allHosts = await getHosts({ limit: 1000 });
      host = allHosts.objects.find((h) => h.title.toLowerCase().includes(hostName.toLowerCase()) || hostName.toLowerCase().includes(h.title.toLowerCase()));
    }

    return host ? `/hosts/${host.slug}` : null;
  } catch (error) {
    console.error("Error getting host profile URL:", error);
    return null;
  }
}

// Add: Fetch Cosmic homepage data
export async function getCosmicHomepageData(): Promise<CosmicHomepageData | null> {
  const COSMIC_BUCKET_SLUG = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG;
  const COSMIC_READ_KEY = process.env.NEXT_PUBLIC_COSMIC_READ_KEY;
  const COSMIC_HOMEPAGE_ID = process.env.NEXT_PUBLIC_COSMIC_HOMEPAGE_ID;
  const url = `https://api.cosmicjs.com/v3/buckets/${COSMIC_BUCKET_SLUG}/objects/${COSMIC_HOMEPAGE_ID}?pretty=true&read_key=${COSMIC_READ_KEY}&depth=2&props=slug,title,metadata,type`;
  try {
    const response = await fetch(url, { next: { revalidate: 10 } });
    if (!response.ok) {
      console.error("Failed to fetch Cosmic homepage data:", response.status, await response.text());
      return null;
    }
    const data: CosmicAPIObject<CosmicHomepageData> = await response.json();
    return data.object;
  } catch (error) {
    console.error("Error fetching Cosmic homepage data:", error);
    return null;
  }
}

// Add: Fetch a single Cosmic object by ID
export async function fetchCosmicObjectById(id: string): Promise<HomepageSectionItem | null> {
  const COSMIC_BUCKET_SLUG = process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG;
  const COSMIC_READ_KEY = process.env.NEXT_PUBLIC_COSMIC_READ_KEY;
  const url = `https://api.cosmicjs.com/v3/buckets/${COSMIC_BUCKET_SLUG}/objects/${id}?read_key=${COSMIC_READ_KEY}&props=slug,title,metadata,type`;
  try {
    const response = await fetch(url, { next: { revalidate: 10 } });
    if (!response.ok) {
      console.error(`Failed to fetch Cosmic object ${id}:`, response.status, await response.text());
      return null;
    }
    const data: CosmicAPIObject<HomepageSectionItem> = await response.json();
    return data.object;
  } catch (error) {
    console.error(`Error fetching Cosmic object ${id}:`, error);
    return null;
  }
}

export async function getEvents({ limit = 20, offset = 0, tag, searchTerm }: { limit?: number; offset?: number; tag?: string; searchTerm?: string } = {}): Promise<{ events: any[]; hasNext: boolean }> {
  try {
    const filters: any = {
      type: "events",
      limit,
      skip: offset,
      sort: "-metadata.date",
      status: "published",
      props: "id,slug,title,metadata,created_at",
    };
    if (tag) {
      filters["metadata.categories"] = tag;
    }
    if (searchTerm) {
      filters["title"] = searchTerm;
    }
    const response = await cosmic.objects.find(filters);
    const events = response.objects || [];
    const hasNext = events.length === limit;
    return { events, hasNext };
  } catch (error) {
    console.error("Error in getEvents:", error);
    return { events: [], hasNext: false };
  }
}

export async function getTakeovers({ limit = 20, offset = 0, tag, searchTerm }: { limit?: number; offset?: number; tag?: string; searchTerm?: string } = {}): Promise<{ takeovers: any[]; hasNext: boolean }> {
  try {
    const filters: any = {
      type: "takeovers",
      limit,
      skip: offset,
      sort: "-metadata.date",
      status: "published",
      props: "id,slug,title,metadata,created_at",
    };
    if (tag) {
      filters["metadata.categories"] = tag;
    }
    if (searchTerm) {
      filters["title"] = searchTerm;
    }
    const response = await cosmic.objects.find(filters);
    const takeovers = response.objects || [];
    const hasNext = takeovers.length === limit;
    return { takeovers, hasNext };
  } catch (error) {
    console.error("Error in getTakeovers:", error);
    return { takeovers: [], hasNext: false };
  }
}

export async function getFeaturedShows({ limit = 20, offset = 0, tag, searchTerm }: { limit?: number; offset?: number; tag?: string; searchTerm?: string } = {}): Promise<{ featuredShows: any[]; hasNext: boolean }> {
  try {
    const filters: any = {
      type: "featured-shows",
      limit,
      skip: offset,
      sort: "-metadata.date",
      status: "published",
      props: "id,slug,title,metadata,created_at",
    };
    if (tag) {
      filters["metadata.categories"] = tag;
    }
    if (searchTerm) {
      filters["title"] = searchTerm;
    }
    const response = await cosmic.objects.find(filters);
    const featuredShows = response.objects || [];
    const hasNext = featuredShows.length === limit;
    return { featuredShows, hasNext };
  } catch (error) {
    console.error("Error in getFeaturedShows:", error);
    return { featuredShows: [], hasNext: false };
  }
}

export async function getSeries({ limit = 20, offset = 0, tag, searchTerm }: { limit?: number; offset?: number; tag?: string; searchTerm?: string } = {}): Promise<{ series: any[]; hasNext: boolean }> {
  try {
    const filters: any = {
      type: "series",
      limit,
      skip: offset,
      sort: "-metadata.date",
      status: "published",
      props: "id,slug,title,metadata,created_at",
    };
    if (tag) {
      filters["metadata.categories"] = tag;
    }
    if (searchTerm) {
      filters["title"] = searchTerm;
    }
    const response = await cosmic.objects.find(filters);
    const series = response.objects || [];
    const hasNext = series.length === limit;
    return { series, hasNext };
  } catch (error) {
    console.error("Error in getSeries:", error);
    return { series: [], hasNext: false };
  }
}

export async function getRegularHosts({ limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<{ hosts: any[]; hasNext: boolean }> {
  try {
    const response = await cosmic.objects
      .find({
        type: "regular-hosts",
        status: "published",
      })
      .props("id,slug,title,metadata")
      .limit(limit)
      .skip(offset)
      .sort("title")
      .depth(1);

    const hosts = response.objects || [];
    const hasNext = hosts.length === limit;

    return { hosts, hasNext };
  } catch (error) {
    console.error("Error in getRegularHosts:", error);
    return { hosts: [], hasNext: false };
  }
}

export async function createColouredSections(homepageData: any): Promise<ProcessedHomepageSection[]> {
  const colouredSections: ProcessedHomepageSection[] = [];

  if (!homepageData?.metadata?.coloured_sections) {
    return colouredSections;
  }

  const colors = ["#F8971D", "#88CA4F", "#A97AFF", "#1DA0F8"];

  for (let i = 0; i < homepageData.metadata.coloured_sections.length; i++) {
    const colouredSection = homepageData.metadata.coloured_sections[i];
    try {
      let shows: any[] = [];

      try {
        // Fetch recent episodes as content for colored sections
        const { getEpisodesForShows } = await import("./episode-service");
        const { shows: recentShows } = await getEpisodesForShows({ limit: 8 });
        shows = recentShows.slice(0, 8);
      } catch (episodeError) {
        console.warn(`Failed to fetch episodes for coloured section "${colouredSection.title}":`, episodeError);
        // Continue with empty shows array - the section will be skipped
        continue;
      }

      if (shows.length === 0) {
        continue;
      }

      // Convert shows to HomepageSectionItem format
      const showItems: HomepageSectionItem[] = shows.map((show: any) => ({
        slug: show.key,
        title: show.name,
        type: "episodes",
        metadata: {
          subtitle: null,
          featured_on_homepage: false,
          image: { url: show.pictures?.large || "/image-placeholder.svg", imgix_url: show.pictures?.large || "/image-placeholder.svg" },
          tags: show.tags || [],
          genres: [],
          locations: [],
          regular_hosts: [],
          takeovers: [],
          description: show.description || "",
          page_link: null,
          source: null,
          broadcast_date: show.created_time || "",
          broadcast_time: "",
          duration: "",
          player: null,
          tracklist: null,
          body_text: null,
          radiocult_media_id: null,
          media_file: null,
        },
      }));

      // Assign colors sequentially: orange, green, purple, blue, then repeat
      const colorIndex = i % colors.length;
      const sectionColor = colors[colorIndex];

      const section: ProcessedHomepageSection = {
        is_active: true,
        title: colouredSection.title,
        type: "episodes",
        layout: "Unique",
        itemsPerRow: 4,
        items: showItems,
        color: sectionColor,
        subtitle: colouredSection.time,
        description: colouredSection.description,
      };

      colouredSections.push(section);
    } catch (error) {
      console.error(`Error creating coloured section for ${colouredSection.title}:`, error);
    }
  }

  return colouredSections;
}
