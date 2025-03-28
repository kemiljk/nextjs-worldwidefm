"use server";

import { getPosts, getRadioShows, getSchedule, getEditorialHomepage, getRadioShowBySlug } from "./cosmic-service";
import { SearchResult, SearchResultType } from "./search-context";
import { PostObject, RadioShowObject, ScheduleObject, VideoObject } from "./cosmic-config";
import { transformShowToViewData } from "./cosmic-service";
import { cosmic } from "./cosmic-service";

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
    const response = await getSchedule(slug);
    let currentShow = null;
    let upcomingShow = null;
    let upcomingShows: ReturnType<typeof transformShowToViewData>[] = [];
    let schedule: ScheduleObject | null = null;

    if (response.object) {
      schedule = response.object;
      if (schedule.metadata?.shows && schedule.metadata.shows.length > 0) {
        const scheduleShows = schedule.metadata.shows;

        // Current show is the first in the schedule
        currentShow = transformShowToViewData(scheduleShows[0]);

        // Next show is the second in the schedule
        if (scheduleShows.length > 1) {
          upcomingShow = transformShowToViewData(scheduleShows[1]);
        }

        // Get the next 5 shows for the upcoming section
        if (scheduleShows.length > 2) {
          upcomingShows = scheduleShows.slice(2, 7).map(transformShowToViewData);
        }
      } else {
        // Fallback to recent shows if schedule is empty
        const showsResponse = await getRadioShows({
          limit: 7, // Get enough for current, upcoming, and 5 more
          sort: "-metadata.broadcast_date",
          status: "published",
        });

        if (showsResponse.objects && showsResponse.objects.length > 0) {
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
            currentShow = transformShowToViewData(allShows[0]);

            if (allShows.length > 1) {
              upcomingShow = transformShowToViewData(allShows[1]);
            }

            if (allShows.length > 2) {
              upcomingShows = allShows.slice(2, 7).map(transformShowToViewData);
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
        description: post.metadata.description,
        excerpt: post.metadata.content || "",
        image: post.metadata.image?.imgix_url || "/image-placeholder.svg",
        slug: post.slug,
        date: post.metadata.date || "",
        genres: [],
        locations: [],
        hosts: [],
        takovers: [],
        post_type: post.metadata.post_type,
        featured: post.metadata.featured_on_homepage,
      })),
      ...shows.map((show) => ({
        id: show.id,
        title: show.title,
        type: "radio-shows" as const,
        description: show.metadata.description,
        excerpt: show.metadata.subtitle || "",
        image: show.metadata.image?.imgix_url || "/image-placeholder.svg",
        slug: show.slug,
        date: show.metadata.broadcast_date || "",
        genres: show.metadata.genres.map((genre) => genre.slug),
        locations: show.metadata.locations.map((location) => location.slug),
        hosts: show.metadata.regular_hosts.map((host) => host.slug),
        takovers: show.metadata.takeovers.map((takover) => takover.slug),
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
