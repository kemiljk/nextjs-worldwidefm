"use server";

import { getPosts, getRadioShows, getSchedule, getEditorialHomepage, getRadioShowBySlug } from "./cosmic-service";
import { SearchResult, SearchResultType } from "./search-context";
import { PostObject, RadioShowObject, ScheduleObject, VideoObject } from "./cosmic-config";
import { transformShowToViewData } from "./cosmic-service";
import { cosmic } from "./cosmic-config";
import { addHours, isWithinInterval, isAfter } from "date-fns";

export async function getAllPosts(): Promise<PostObject[]> {
  try {
    const response = await getPosts({
      limit: 50,
      sort: "-created_at",
      status: "published",
    });
    return response.objects || [];
  } catch (error) {
    console.error("Error in getAllPosts:", error);
    return [];
  }
}

export async function getAllShows(): Promise<RadioShowObject[]> {
  try {
    const response = await getRadioShows({
      limit: 50,
      sort: "-metadata.broadcast_date",
      status: "published",
    });
    return response.objects || [];
  } catch (error) {
    console.error("Error in getAllShows:", error);
    return [];
  }
}

export async function getShowBySlug(slug: string): Promise<ReturnType<typeof transformShowToViewData> | null> {
  try {
    const response = await getRadioShowBySlug(slug);
    if (!response.object) {
      console.error(`No show found for slug: ${slug}`);
      return null;
    }
    return transformShowToViewData(response.object);
  } catch (error) {
    console.error("Error in getShowBySlug:", error);
    return null;
  }
}

export async function getScheduleData(slug: string = "main-schedule"): Promise<{
  schedule: ScheduleObject | null;
  currentShow: ReturnType<typeof transformShowToViewData> | null;
  upcomingShow: ReturnType<typeof transformShowToViewData> | null;
  upcomingShows: ReturnType<typeof transformShowToViewData>[];
}> {
  try {
    let schedule = null;
    let currentShow = null;
    let upcomingShow = null;
    let upcomingShows: ReturnType<typeof transformShowToViewData>[] = [];

    // Try to get schedule first
    const scheduleResponse = await getSchedule(slug);
    if (scheduleResponse.object) {
      schedule = scheduleResponse.object;
    } else {
      // Fallback to recent shows if schedule is empty
      const showsResponse = await getRadioShows({
        limit: 7, // Get enough for current, upcoming, and 5 more
        sort: "-metadata.broadcast_date",
        status: "published",
      });

      if (showsResponse.objects && showsResponse.objects.length > 0) {
        const now = new Date();
        const allShows = showsResponse.objects
          .filter((show) => show.metadata?.broadcast_date)
          .sort((a, b) => {
            const dateA = new Date(a.metadata.broadcast_date || "");
            const dateB = new Date(b.metadata.broadcast_date || "");
            if (isNaN(dateA.getTime())) return 1;
            if (isNaN(dateB.getTime())) return -1;
            return dateB.getTime() - dateA.getTime();
          });

        if (allShows.length > 0) {
          // Find current show (within last 2 hours)
          const currentShowObj = allShows.find((show) => {
            const startTime = new Date(show.metadata.broadcast_date || "");
            const endTime = addHours(startTime, 2);
            return isWithinInterval(now, { start: startTime, end: endTime });
          });

          if (currentShowObj) {
            currentShow = transformShowToViewData(currentShowObj);
          }

          // Get upcoming shows (future shows)
          const upcomingShowsList = allShows
            .filter((show) => {
              const startTime = new Date(show.metadata.broadcast_date || "");
              return isAfter(startTime, now) && (!currentShowObj || show.id !== currentShowObj.id);
            })
            .sort((a, b) => {
              const dateA = new Date(a.metadata.broadcast_date || "");
              const dateB = new Date(b.metadata.broadcast_date || "");
              return dateA.getTime() - dateB.getTime();
            });

          if (upcomingShowsList.length > 0) {
            upcomingShow = transformShowToViewData(upcomingShowsList[0]);
            if (upcomingShowsList.length > 1) {
              upcomingShows = upcomingShowsList.slice(1, 6).map(transformShowToViewData);
            }
          }
        }
      }
    }

    return {
      schedule,
      currentShow,
      upcomingShow,
      upcomingShows,
    };
  } catch (error) {
    console.error("Error in getScheduleData:", error);
    return {
      schedule: null,
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
    const editorialResponse = await getEditorialHomepage();
    let posts: PostObject[] = [];
    let featuredPosts: PostObject[] = [];

    // First try to get posts from editorial homepage
    if (editorialResponse.object?.metadata?.featured_posts) {
      posts = editorialResponse.object.metadata.featured_posts;
      featuredPosts = posts.slice(0, 3);
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

export async function getAllSearchableContent(): Promise<SearchResult[]> {
  try {
    const [posts, shows] = await Promise.all([getAllPosts(), getAllShows()]);

    const allContent: SearchResult[] = [
      ...posts.map((post) => ({
        id: post.id,
        title: post.title,
        type: "posts" as const,
        description: post.metadata.description || "",
        excerpt: post.metadata.content || "",
        image: post.metadata.image?.imgix_url || "/image-placeholder.svg",
        slug: post.slug,
        date: post.metadata.date || "",
        genres: [],
        locations: [],
        hosts: [],
        takovers: [],
        featured: post.metadata.featured_on_homepage,
      })),
      ...shows.map((show) => ({
        id: show.id,
        title: show.title,
        type: "radio-shows" as const,
        description: show.metadata.description || "",
        excerpt: show.metadata.subtitle || "",
        image: show.metadata.image?.imgix_url || "/image-placeholder.svg",
        slug: show.slug,
        date: show.metadata.broadcast_date || "",
        genres: show.metadata.genres || [],
        locations: show.metadata.locations || [],
        hosts: show.metadata.regular_hosts || [],
        takovers: show.metadata.takeovers || [],
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
