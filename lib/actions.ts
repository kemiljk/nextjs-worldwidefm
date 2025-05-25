"use server";

import { getPosts, getRadioShows, getEditorialHomepage } from "./cosmic-service";
import { SearchResult, FilterItem } from "./search-context";
import { PostObject, RadioShowObject, VideoObject } from "./cosmic-config";
import { cosmic } from "./cosmic-config";
import { addHours, isWithinInterval, isAfter } from "date-fns";
import { getAllShowsFromMixcloud } from "./mixcloud-service";
import { MixcloudShow } from "./mixcloud-service";
import { filterWorldwideFMTags } from "./mixcloud-service";
import { getEventBySlug as getRadioCultEventBySlug, getEvents as getRadioCultEvents, RadioCultEvent, getScheduleData as getRadioCultScheduleData, getTags } from "./radiocult-service";
import FormData from "form-data";

export async function getAllPosts(): Promise<PostObject[]> {
  try {
    const response = await getPosts({
      limit: 50,
      sort: "-metadata.date",
      status: "published",
    });
    return response.objects || [];
  } catch (error) {
    console.error("Error in getAllPosts:", error);
    return [];
  }
}

export async function getAllShows(skip = 0, limit = 20, filters?: any) {
  try {
    console.log("Filters received:", JSON.stringify(filters, null, 2));

    // Basic query params with smaller page size and field selection
    const queryParams: any = {
      skip,
      limit,
      sort: "-created_at",
      status: "published",
      type: "radio-shows",
      props: "id,title,slug,metadata.image,metadata.description,metadata.broadcast_date,metadata.genres,metadata.regular_hosts,metadata.takeovers,metadata.locations",
      cache: true,
      cache_ttl: 3600, // 1 hour cache
    };

    // Build query based on filter types
    const query: any = {};

    // Handle isNew filter
    if (filters?.isNew) {
      console.log("Adding isNew filter condition");
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query.created_at = { $gt: thirtyDaysAgo.toISOString() };
    }

    // Set up a single $or array for all genre filters
    const genreConditions: { [key: string]: any }[] = [];
    // Handle genre filter(s)
    if (filters?.genre) {
      console.log("Adding genre filter condition", filters.genre);
      // Support both single value and array
      const genreSlugs = Array.isArray(filters.genre) ? filters.genre : [filters.genre];
      if (genreSlugs.length > 0) {
        // Add each genre as its own condition - matching ANY will satisfy
        genreSlugs.forEach((slug: string) => {
          genreConditions.push({ "metadata.genres.slug": slug });
        });
      }
    }

    // Set up a single $or array for all host filters
    const hostConditions: { [key: string]: any }[] = [];
    // Handle host filter(s)
    if (filters?.host) {
      console.log("Adding host filter condition", filters.host);
      // Support both single value and array
      const hostSlugs = Array.isArray(filters.host) ? filters.host : [filters.host];
      if (hostSlugs.length > 0) {
        // Add each host as its own condition - matching ANY will satisfy
        hostSlugs.forEach((slug: string) => {
          hostConditions.push({ "metadata.regular_hosts.slug": slug });
        });
      }
    }

    // Set up a single $or array for all takeover filters
    const takeoverConditions: { [key: string]: any }[] = [];
    // Handle takeover filter(s)
    if (filters?.takeover) {
      console.log("Adding takeover filter condition", filters.takeover);
      // Support both single value and array
      const takeoverSlugs = Array.isArray(filters.takeover) ? filters.takeover : [filters.takeover];
      if (takeoverSlugs.length > 0) {
        // Add each takeover as its own condition - matching ANY will satisfy
        takeoverSlugs.forEach((slug: string) => {
          takeoverConditions.push({ "metadata.takeovers.slug": slug });
        });
      }
    }

    // Apply search term if provided
    if (filters?.searchTerm) {
      console.log("Adding search filter condition", filters.searchTerm);
      query.$or = [{ title: { $regex: filters.searchTerm, $options: "i" } }, { "metadata.description": { $regex: filters.searchTerm, $options: "i" } }, { "metadata.regular_hosts.title": { $regex: filters.searchTerm, $options: "i" } }];
    }

    // Build a master $and query from all our conditions
    const masterConditions = [];

    // Add the base query if we have conditions
    if (Object.keys(query).length > 0) {
      masterConditions.push(query);
    }

    // Add genre conditions as an OR group if we have any
    if (genreConditions.length > 0) {
      masterConditions.push({ $or: genreConditions });
    }

    // Add host conditions as an OR group if we have any
    if (hostConditions.length > 0) {
      masterConditions.push({ $or: hostConditions });
    }

    // Add takeover conditions as an OR group if we have any
    if (takeoverConditions.length > 0) {
      masterConditions.push({ $or: takeoverConditions });
    }

    // Apply the final query if we have any conditions
    if (masterConditions.length > 0) {
      queryParams.query = masterConditions.length === 1 ? masterConditions[0] : { $and: masterConditions };
    }

    console.log("Final query params:", JSON.stringify(queryParams, null, 2));

    // Add a timeout to the API request
    const timeoutPromise = new Promise<{ objects: RadioShowObject[]; total: number }>((_, reject) => {
      setTimeout(() => reject(new Error("API request timed out")), 30000);
    });

    // Fetch content with timeout protection
    const responsePromise = getRadioShows(queryParams).catch((error) => {
      console.error("Error in getRadioShows API call:", error);
      // Return a default empty structure instead of throwing
      return { objects: [] as RadioShowObject[], total: 0 };
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    console.log(`Retrieved ${response.objects?.length || 0} shows out of ${response.total || 0} total`);

    return {
      shows: response.objects || [],
      total: response.total || 0,
    };
  } catch (error) {
    console.error("Error fetching shows:", error);
    return { shows: [], total: 0 };
  }
}

export async function getShowBySlug(slug: string): Promise<MixcloudShow | RadioCultEvent | null> {
  // First try RadioCult
  try {
    // If this is a full Mixcloud path with multiple segments, don't try RadioCult
    if (slug.includes("/")) {
      // This is a Mixcloud path, skip RadioCult lookup
    } else {
      const radioCultEvent = await getRadioCultEventBySlug(slug);
      if (radioCultEvent) {
        // Convert RadioCult event to a format similar to MixcloudShow for compatibility
        const adaptedEvent: any = {
          key: radioCultEvent.slug,
          name: radioCultEvent.showName,
          url: `/shows/${radioCultEvent.slug}`,
          pictures: {
            small: radioCultEvent.imageUrl || "/image-placeholder.svg",
            thumbnail: radioCultEvent.imageUrl || "/image-placeholder.svg",
            medium_mobile: radioCultEvent.imageUrl || "/image-placeholder.svg",
            medium: radioCultEvent.imageUrl || "/image-placeholder.svg",
            large: radioCultEvent.imageUrl || "/image-placeholder.svg",
            "320wx320h": radioCultEvent.imageUrl || "/image-placeholder.svg",
            extra_large: radioCultEvent.imageUrl || "/image-placeholder.svg",
            "640wx640h": radioCultEvent.imageUrl || "/image-placeholder.svg",
            "768wx768h": radioCultEvent.imageUrl || "/image-placeholder.svg",
            "1024wx1024h": radioCultEvent.imageUrl || "/image-placeholder.svg",
          },
          created_time: radioCultEvent.startTime,
          updated_time: radioCultEvent.updatedAt,
          play_count: 0,
          favorite_count: 0,
          comment_count: 0,
          listener_count: 0,
          repost_count: 0,
          tags: radioCultEvent.tags.map((tag) => ({
            key: tag.toLowerCase().replace(/\s+/g, "-"),
            url: `/tags/${tag.toLowerCase().replace(/\s+/g, "-")}`,
            name: tag,
          })),
          slug: radioCultEvent.slug,
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
          hosts: radioCultEvent.artists.map((artist) => ({
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
          audio_length: radioCultEvent.duration * 60, // convert minutes to seconds
          endTime: radioCultEvent.endTime, // Add endTime for RadioCult events
          description: radioCultEvent.description, // Add description for RadioCult events
          __source: "radiocult", // Add a source marker to identify RadioCult events
        };

        console.log("Found RadioCult event:", adaptedEvent.name);
        return adaptedEvent;
      }
    }
  } catch (error) {
    console.error("Error finding RadioCult event:", error);
    // Continue to try Mixcloud
  }

  // Then try Mixcloud
  try {
    // Clean up the slug to get the show key
    const showKey = slug.startsWith("/") ? slug : `/${slug}`;

    // Make a direct API call to Mixcloud for this specific show
    const response = await fetch(`https://api.mixcloud.com${showKey}`, {
      next: {
        revalidate: 900, // 15 minutes
        tags: ["shows"],
      },
    });

    if (!response.ok) {
      console.error(`Mixcloud API error for show ${showKey}: ${response.statusText}`);
      return null;
    }

    const show = await response.json();
    console.log("Found Mixcloud show:", show.name);
    return show;
  } catch (error) {
    console.error("Error in getShowBySlug:", error);
    return null;
  }
}

export async function getScheduleData(): Promise<{
  currentShow: MixcloudShow | any | null;
  upcomingShow: MixcloudShow | any | null;
  upcomingShows: (MixcloudShow | any)[];
}> {
  try {
    // First try to get data from RadioCult
    try {
      const { currentEvent, upcomingEvent, upcomingEvents } = await getRadioCultScheduleData();

      // Convert RadioCult events to MixcloudShow format
      const adaptCurrentEvent = currentEvent ? convertRadioCultEventToMixcloudFormat(currentEvent) : null;
      const adaptUpcomingEvent = upcomingEvent ? convertRadioCultEventToMixcloudFormat(upcomingEvent) : null;
      const adaptUpcomingEvents = upcomingEvents.map(convertRadioCultEventToMixcloudFormat);

      return {
        currentShow: adaptCurrentEvent,
        upcomingShow: adaptUpcomingEvent,
        upcomingShows: adaptUpcomingEvents,
      };
    } catch (error) {
      console.error("Error getting RadioCult schedule data, falling back to Mixcloud:", error);
      // Fall back to Mixcloud data
    }

    // Get all shows from Mixcloud as fallback
    const mixcloudShows = await getAllShowsFromMixcloud();

    const now = new Date();

    // Sort shows by created_time
    const sortedShows = [...mixcloudShows].sort((a, b) => {
      const dateA = new Date(a.created_time);
      const dateB = new Date(b.created_time);
      return dateB.getTime() - dateA.getTime();
    });

    // Find current show (within last 2 hours)
    const currentShow =
      sortedShows.find((show) => {
        const startTime = new Date(show.created_time);
        const endTime = addHours(startTime, 2);
        return isWithinInterval(now, { start: startTime, end: endTime });
      }) || null;

    // Get upcoming shows (future shows)
    const futureShows = sortedShows
      .filter((show) => {
        const startTime = new Date(show.created_time);
        return isAfter(startTime, now) && (!currentShow || show.key !== currentShow.key);
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_time);
        const dateB = new Date(b.created_time);
        return dateA.getTime() - dateB.getTime();
      });

    return {
      currentShow,
      upcomingShow: futureShows[0] || null,
      upcomingShows: futureShows.slice(1, 6),
    };
  } catch (error) {
    console.error("Error in getScheduleData:", error);
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
    description: event.description, // Add description for RadioCult events
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
    const [posts, showsResponse] = await Promise.all([getAllPosts(), getAllShows(0, showsLimit)]);

    // Helper to ensure filter items have correct structure
    const normalizeFilterItems = (items: any[] = []): FilterItem[] => {
      return items.filter(Boolean).map((item: { title?: string; slug?: string; id?: string; type?: string }) => ({
        title: item.title || "",
        slug: item.slug || item.id || "",
        type: item.type || "",
      }));
    };

    const allContent: SearchResult[] = [
      ...posts.map((post) => {
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
        type: "radio-shows" as const,
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

export async function getVideos(limit: number = 4): Promise<VideoObject[]> {
  try {
    const response = await cosmic.objects.find({
      type: "videos",
      limit,
      props: "slug,title,metadata,type",
      depth: 1,
    });
    return response.objects || [];
  } catch (error) {
    console.error("Error in getVideos:", error);
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
    const { shows } = await getMixcloudShows();

    // Extract unique tags from all shows, filtering out "Worldwide FM"
    const tagMap = new Map<string, { name: string; count: number }>();
    shows.forEach((show) => {
      filterWorldwideFMTags(show.tags).forEach((tag) => {
        const existing = tagMap.get(tag.name);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(tag.name, { name: tag.name, count: 1 });
        }
      });
    });

    // Convert to sorted array
    const tags = Array.from(tagMap.values())
      .sort((a, b) => b.count - a.count)
      .map((tag) => ({
        id: tag.name.toLowerCase().replace(/\s+/g, "-"),
        slug: tag.name.toLowerCase().replace(/\s+/g, "-"),
        title: tag.name,
        content: "",
        bucket: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || "",
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        status: "published",
        type: "genres",
        metadata: null,
      }));

    return {
      genres: tags,
      hosts: [], // We'll handle hosts separately if needed
      takeovers: [], // We'll handle takeovers separately if needed
      locations: [], // Not available from Mixcloud
    };
  } catch (error) {
    console.error("Error getting filters:", error);
    return {
      genres: [],
      hosts: [],
      takeovers: [],
      locations: [],
    };
  }
}

interface MixcloudShowsFilters {
  genre?: string | string[];
  host?: string | string[];
  takeover?: string | string[];
  searchTerm?: string;
  isNew?: boolean;
  skip?: number;
  limit?: number;
}

export async function getMixcloudShows(filters: MixcloudShowsFilters = {}): Promise<{ shows: (MixcloudShow | any)[]; total: number }> {
  try {
    // Get Mixcloud shows
    const { shows: mixcloudShows } = await getMixcloudShowsOriginal(filters);

    // Get RadioCult events
    const { events: radioCultEvents } = await getRadioCultEvents({ limit: 100 });

    // Convert RadioCult events to MixcloudShow format
    const adaptedEvents = radioCultEvents.map((event) => ({
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
      __source: "radiocult", // Add a source marker to identify RadioCult events
    }));

    // Combine shows from both sources
    const combinedShows = [...mixcloudShows, ...adaptedEvents];

    // Apply any filtering if needed
    let filteredShows = combinedShows;

    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filteredShows = filteredShows.filter((show) => show.name.toLowerCase().includes(searchTerm) || show.tags.some((tag: any) => tag.name.toLowerCase().includes(searchTerm)));
    }

    if (filters.genre) {
      const genres = Array.isArray(filters.genre) ? filters.genre : [filters.genre];
      filteredShows = filteredShows.filter((show) => show.tags.some((tag: any) => genres.includes(tag.name.toLowerCase())));
    }

    if (filters.host) {
      const hosts = Array.isArray(filters.host) ? filters.host : [filters.host];
      filteredShows = filteredShows.filter((show) => show.hosts.some((host: any) => hosts.includes(host.name.toLowerCase())));
    }

    if (filters.isNew) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filteredShows = filteredShows.filter((show) => new Date(show.created_time) > thirtyDaysAgo);
    }

    // Sort by created_time (newest first)
    filteredShows.sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime());

    // Apply pagination
    const skip = filters.skip || 0;
    const limit = filters.limit || 20;
    const paginatedShows = filteredShows.slice(skip, skip + limit);

    return {
      shows: paginatedShows,
      total: filteredShows.length,
    };
  } catch (error) {
    console.error("Error in getMixcloudShows:", error);

    // Try to return just Mixcloud shows if RadioCult fails
    try {
      return await getMixcloudShowsOriginal(filters);
    } catch (e) {
      console.error("Fallback to original Mixcloud shows failed:", e);
      return { shows: [], total: 0 };
    }
  }
}

// Rename the original function to avoid conflicts
const getMixcloudShowsOriginal = async (filters: MixcloudShowsFilters = {}): Promise<{ shows: MixcloudShow[]; total: number }> => {
  try {
    // Convert the simplified filter object to Mixcloud params
    const params: {
      limit: number;
      isNew?: boolean;
      searchTerm?: string;
      tag?: string;
    } = {
      limit: filters.limit || 20,
    };

    if (filters.genre && typeof filters.genre === "string") {
      params.tag = filters.genre;
    }

    if (filters.searchTerm) {
      params.searchTerm = filters.searchTerm;
    }

    if (filters.isNew) {
      params.isNew = true;
    }

    // Get shows from Mixcloud
    const response = await fetch(`https://api.mixcloud.com/worldwidefm/cloudcasts/?limit=${params.limit}${params.tag ? `&tag=${params.tag}` : ""}${params.searchTerm ? `&q=${params.searchTerm}` : ""}`, {
      next: {
        revalidate: 900, // 15 minutes
        tags: ["mixcloud"],
      },
    });

    if (!response.ok) {
      throw new Error(`Mixcloud API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Filter the shows if needed
    let filteredShows = data.data;

    // If isNew is set, filter to shows from the last 30 days
    if (params.isNew) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filteredShows = filteredShows.filter((show: MixcloudShow) => new Date(show.created_time) > thirtyDaysAgo);
    }

    return {
      shows: filteredShows,
      total: filteredShows.length,
    };
  } catch (error) {
    console.error("Error fetching from Mixcloud:", error);
    return { shows: [], total: 0 };
  }
};

export async function searchContent(query?: string, source?: string, limit: number = 100): Promise<SearchResult[]> {
  try {
    // If source is mixcloud, search only in mixcloud
    if (source === "mixcloud") {
      const shows = await getAllShowsFromMixcloud();
      let filteredShows = shows;

      if (query) {
        const searchTerm = query.toLowerCase();
        filteredShows = shows.filter((show) => {
          return show.name.toLowerCase().includes(searchTerm) || show.tags.some((tag) => tag.name.toLowerCase().includes(searchTerm)) || (show.hosts && show.hosts.some((host) => host.name.toLowerCase().includes(searchTerm)));
        });
      }

      // Transform shows to SearchResult format
      return filteredShows.slice(0, limit).map((show) => ({
        id: show.key,
        type: "radio-shows",
        slug: show.key.split("/").pop() || "",
        title: show.name,
        description: show.name,
        image: show.pictures.extra_large,
        date: show.created_time,
        genres: show.tags.map((tag) => ({ slug: tag.name.toLowerCase().replace(/\s+/g, "-"), title: tag.name, type: "genres" })),
        hosts: show.hosts?.map((host) => ({ slug: host.username, title: host.name, type: "hosts" })) || [],
        locations: [],
        takeovers: [],
      }));
    }

    // If source is cosmic, search only in cosmic
    if (source === "cosmic") {
      // Search in posts, videos, and events
      const [postsResponse, videosResponse] = await Promise.all([
        cosmic.objects.find({
          type: "posts",
          ...(query && {
            q: query,
          }),
          props: "id,title,slug,metadata,created_at",
          limit,
          status: "published",
        }),
        cosmic.objects.find({
          type: "videos",
          ...(query && {
            q: query,
          }),
          props: "id,title,slug,metadata,created_at",
          limit,
          status: "published",
        }),
      ]);

      const posts = postsResponse.objects || [];
      const videos = videosResponse.objects || [];

      // Transform and combine results
      return [...posts, ...videos].map((item) => ({
        id: item.id,
        type: item.type === "posts" ? item.metadata.post_type || "posts" : "videos",
        slug: item.slug,
        title: item.title,
        description: item.metadata.description || item.metadata.excerpt || "",
        image: item.metadata.image?.imgix_url || item.metadata.image?.url || null,
        date: item.metadata.date || item.created_at,
        genres: (item.metadata.categories || []).map((cat: any) => ({
          slug: cat.slug,
          title: cat.title,
          type: "genres",
        })),
        hosts: [],
        locations: [],
        takeovers: [],
      }));
    }

    // If no source specified, search in both and combine results
    const [mixcloudShows, postsResponse, videosResponse] = await Promise.all([
      getAllShowsFromMixcloud(),
      cosmic.objects.find({
        type: "posts",
        ...(query && {
          q: query,
        }),
        props: "id,title,slug,metadata,created_at",
        limit,
        status: "published",
      }),
      cosmic.objects.find({
        type: "videos",
        ...(query && {
          q: query,
        }),
        props: "id,title,slug,metadata,created_at",
        limit,
        status: "published",
      }),
    ]);

    let filteredShows = mixcloudShows;
    if (query) {
      const searchTerm = query.toLowerCase();
      filteredShows = mixcloudShows.filter((show) => {
        return show.name.toLowerCase().includes(searchTerm) || show.tags.some((tag) => tag.name.toLowerCase().includes(searchTerm)) || (show.hosts && show.hosts.some((host) => host.name.toLowerCase().includes(searchTerm)));
      });
    }

    const posts = postsResponse.objects || [];
    const videos = videosResponse.objects || [];

    // Transform and combine all results
    const results = [
      ...filteredShows.slice(0, limit).map((show) => ({
        id: show.key,
        type: "radio-shows",
        slug: show.key.split("/").pop() || "",
        title: show.name,
        description: show.name,
        image: show.pictures.extra_large,
        date: show.created_time,
        genres: show.tags.map((tag) => ({ slug: tag.name.toLowerCase().replace(/\s+/g, "-"), title: tag.name, type: "genres" })),
        hosts: show.hosts?.map((host) => ({ slug: host.username, title: host.name, type: "hosts" })) || [],
        locations: [],
        takeovers: [],
      })),
      ...posts.map((item: any) => ({
        id: item.id,
        type: item.metadata.post_type || "posts",
        slug: item.slug,
        title: item.title,
        description: item.metadata.description || item.metadata.excerpt || "",
        image: item.metadata.image?.imgix_url || item.metadata.image?.url || null,
        date: item.metadata.date || item.created_at,
        genres: (item.metadata.categories || []).map((cat: any) => ({
          slug: cat.slug,
          title: cat.title,
          type: "genres",
        })),
        hosts: [],
        locations: [],
        takeovers: [],
      })),
      ...videos.map((item: any) => ({
        id: item.id,
        type: "videos",
        slug: item.slug,
        title: item.title,
        description: item.metadata.description || "",
        image: item.metadata.image?.imgix_url || item.metadata.image?.url || null,
        date: item.metadata.date || item.created_at,
        genres: (item.metadata.categories || []).map((cat: any) => ({
          slug: cat.slug,
          title: cat.title,
          type: "genres",
        })),
        hosts: [],
        locations: [],
        takeovers: [],
      })),
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
