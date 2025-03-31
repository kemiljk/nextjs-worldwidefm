"use server";

import { getPosts, getRadioShows, getSchedule, getEditorialHomepage, getRadioShowBySlug } from "./cosmic-service";
import { SearchResult, SearchResultType, FilterItem } from "./search-context";
import { PostObject, RadioShowObject, ScheduleObject, VideoObject } from "./cosmic-config";
import { transformShowToViewData } from "./cosmic-service";
import { cosmic } from "./cosmic-config";
import { addHours, isWithinInterval, isAfter } from "date-fns";
import { getAllShowsFromMixcloud } from "./mixcloud-service";
import { MixcloudShow } from "./mixcloud-service";

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

export async function getShowBySlug(slug: string): Promise<MixcloudShow | null> {
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
    console.log("Found show:", show.name);
    return show;
  } catch (error) {
    console.error("Error in getShowBySlug:", error);
    return null;
  }
}

export async function getScheduleData(): Promise<{
  currentShow: MixcloudShow | null;
  upcomingShow: MixcloudShow | null;
  upcomingShows: MixcloudShow[];
}> {
  try {
    // Get all shows from Mixcloud
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
      return items.filter(Boolean).map((item) => ({
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

    // Extract unique tags from all shows
    const tagMap = new Map<string, { name: string; count: number }>();
    shows.forEach((show) => {
      show.tags.forEach((tag) => {
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

export async function getMixcloudShows(filters: MixcloudShowsFilters = {}): Promise<{ shows: MixcloudShow[]; total: number }> {
  try {
    // Get all shows from Mixcloud
    const mixcloudResult = await getAllShowsFromMixcloud();

    // Ensure we have a valid array of shows
    const mixcloudShows = Array.isArray(mixcloudResult) ? mixcloudResult : [];

    console.log("Fetched shows:", mixcloudShows.length);

    // Apply filters
    let filteredShows = [...mixcloudShows];

    // Handle isNew filter
    if (filters.isNew) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filteredShows = filteredShows.filter((show) => {
        const showDate = new Date(show.created_time);
        return showDate > thirtyDaysAgo;
      });
    }

    // Handle genre filter
    if (filters.genre) {
      const genreSlugs = Array.isArray(filters.genre) ? filters.genre : [filters.genre];
      if (genreSlugs.length > 0) {
        filteredShows = filteredShows.filter((show) => show.tags && Array.isArray(show.tags) && show.tags.some((tag) => genreSlugs.includes(tag.name.toLowerCase().replace(/\s+/g, "-"))));
      }
    }

    // Handle host filter
    if (filters.host) {
      const hostSlugs = Array.isArray(filters.host) ? filters.host : [filters.host];
      if (hostSlugs.length > 0) {
        filteredShows = filteredShows.filter((show) => show.hosts && Array.isArray(show.hosts) && show.hosts.some((host) => hostSlugs.includes(host.name.toLowerCase().replace(/\s+/g, "-"))));
      }
    }

    // Handle takeover filter
    if (filters.takeover) {
      const takeoverSlugs = Array.isArray(filters.takeover) ? filters.takeover : [filters.takeover];
      if (takeoverSlugs.length > 0) {
        filteredShows = filteredShows.filter((show) => show.name && show.name.toLowerCase().includes("takeover") && takeoverSlugs.some((slug: string) => show.name.toLowerCase().includes(slug.replace(/-/g, " "))));
      }
    }

    // Handle search term
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filteredShows = filteredShows.filter((show) => (show.name && show.name.toLowerCase().includes(searchTerm)) || (show.hosts && Array.isArray(show.hosts) && show.hosts.some((host) => host.name.toLowerCase().includes(searchTerm))) || (show.tags && Array.isArray(show.tags) && show.tags.some((tag) => tag.name.toLowerCase().includes(searchTerm))));
    }

    // Apply pagination
    const skip = filters.skip || 0;
    const limit = filters.limit || 20;
    const paginatedShows = filteredShows.slice(skip, skip + limit);

    // Return the shows
    return {
      shows: paginatedShows,
      total: filteredShows.length,
    };
  } catch (error) {
    console.error("Error fetching Mixcloud shows:", error);
    return { shows: [], total: 0 };
  }
}

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
      ...posts.map((item) => ({
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
      ...videos.map((item) => ({
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
