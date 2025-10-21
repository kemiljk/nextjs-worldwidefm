import { cosmic } from "./cosmic-config";
import { EpisodeObject } from "./cosmic-types";

export interface EpisodeParams {
  limit?: number;
  offset?: number;
  random?: boolean;
  searchTerm?: string;
  isNew?: boolean;
  genre?: string | string[];
  host?: string | string[] | "*";
  takeover?: string | string[] | "*";
  location?: string | string[];
  showType?: string | string[];
}

export interface EpisodeResponse {
  episodes: EpisodeObject[];
  total: number;
  hasNext: boolean;
}

/**
 * Simplified episode service that works directly with Cosmic data
 */
export async function getEpisodes(params: EpisodeParams = {}): Promise<EpisodeResponse> {
  const baseLimit = params.limit || 20;
  const offset = params.offset || 0;

  try {
    // Handle random episodes
    if (params.random) {
      const response = await cosmic.objects
        .find({
          type: "episode",
          status: "published",
        })
        .limit(Math.min(baseLimit * 5, 200))
        .depth(2);

      const episodes = response.objects || [];
      const shuffled = [...episodes].sort(() => Math.random() - 0.5);
      const randomEpisodes = shuffled.slice(0, baseLimit);

      return {
        episodes: randomEpisodes,
        total: randomEpisodes.length,
        hasNext: false,
      };
    }

    // Build query for Cosmic
    const query: any = {
      type: "episode",
      status: "published",
    };

    // Add filters
    if (params.genre) {
      const genres = Array.isArray(params.genre) ? params.genre : [params.genre];
      const validGenres = genres.filter(Boolean);
      if (validGenres.length > 0) {
        query["metadata.genres.id"] = { $in: validGenres };
        console.log("[getEpisodes] Genre filter applied:", {
          "metadata.genres.id": { $in: validGenres },
        });
      }
    }

    if (params.location) {
      const locations = Array.isArray(params.location) ? params.location : [params.location];
      query["metadata.locations.id"] = { $in: locations };
    }

    if (params.host) {
      if (params.host === "*") {
        query["metadata.regular_hosts"] = { $exists: true, $ne: [] };
      } else {
        const hosts = Array.isArray(params.host) ? params.host : [params.host];
        query["metadata.regular_hosts.id"] = { $in: hosts };
      }
    }

    if (params.takeover) {
      if (params.takeover === "*") {
        query["metadata.takeovers"] = { $exists: true, $ne: [] };
      } else {
        const takeovers = Array.isArray(params.takeover) ? params.takeover : [params.takeover];
        query["metadata.takeovers.id"] = { $in: takeovers };
      }
    }

    if (params.showType) {
      const showTypes = Array.isArray(params.showType) ? params.showType : [params.showType];
      query["metadata.type.id"] = { $in: showTypes };
    }

    if (params.searchTerm) {
      const term = String(params.searchTerm).trim();
      if (term) {
        query.title = { $regex: term, $options: "i" };
      }
    }

    if (params.isNew) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query["metadata.broadcast_date"] = { $gte: thirtyDaysAgo.toISOString().slice(0, 10) };
    }

    // Fetch episodes from Cosmic
    const response = await cosmic.objects.find(query).limit(baseLimit).skip(offset).sort("-order").depth(2);

    const episodes = response.objects || [];
    const total = response.total || episodes.length;
    const hasNext = episodes.length === baseLimit && offset + baseLimit < total;

    return {
      episodes,
      total,
      hasNext,
    };
  } catch (error) {
    console.error("Error fetching episodes:", error);
    return {
      episodes: [],
      total: 0,
      hasNext: false,
    };
  }
}

/**
 * Get episodes formatted for the Shows page - returns direct Cosmic objects
 */
export async function getEpisodesForShows(params: EpisodeParams = {}): Promise<{
  shows: any[];
  total: number;
  hasNext: boolean;
}> {
  const result = await getEpisodes(params);

  // Return episodes directly from Cosmic - no transformation needed
  return {
    shows: result.episodes,
    total: result.total,
    hasNext: result.hasNext,
  };
}

/**
 * Get regular hosts from Cosmic
 */
export async function getRegularHosts(): Promise<any[]> {
  try {
    const response = await cosmic.objects
      .find({
        type: "regular-hosts",
        status: "published",
      })
      .limit(100)
      .depth(1);

    return response.objects || [];
  } catch (error) {
    console.error("Error fetching regular hosts:", error);
    return [];
  }
}

/**
 * Get takeovers from Cosmic
 */
export async function getTakeovers(): Promise<any[]> {
  try {
    const response = await cosmic.objects
      .find({
        type: "takeovers",
        status: "published",
      })
      .limit(100)
      .depth(1);

    return response.objects || [];
  } catch (error) {
    console.error("Error fetching takeovers:", error);
    return [];
  }
}

/**
 * Get episode by slug
 */
export async function getEpisodeBySlug(slug: string): Promise<any | null> {
  try {
    const response = await cosmic.objects
      .findOne({
        type: "episode",
        slug: slug,
        status: "published",
      })
      .depth(2);

    return response.object || null;
  } catch (error) {
    console.error("Error fetching episode by slug:", error);
    return null;
  }
}

/**
 * Get related episodes based on shared genres and hosts
 */
export async function getRelatedEpisodes(episodeId: string, limit: number = 5): Promise<any[]> {
  try {
    // First get the current episode to extract its genres and hosts
    const currentEpisode = await cosmic.objects
      .findOne({
        type: "episode",
        id: episodeId,
        status: "published",
      })
      .depth(2);

    if (!currentEpisode?.object) {
      return [];
    }

    const episode = currentEpisode.object;
    const genres = episode.metadata?.genres?.map((g: any) => g.id) || [];
    const hosts = episode.metadata?.regular_hosts?.map((h: any) => h.id) || [];

    // If no genres or hosts, fall back to random episodes
    if (genres.length === 0 && hosts.length === 0) {
      const response = await cosmic.objects
        .find({
          type: "episode",
          status: "published",
          id: { $ne: episodeId },
        })
        .limit(limit)
        .depth(2);

      return response.objects || [];
    }

    // Build query to find episodes with shared genres or hosts
    const query: any = {
      type: "episode",
      status: "published",
      id: { $ne: episodeId },
    };

    // Add genre or host filters
    if (genres.length > 0) {
      query["metadata.genres.id"] = { $in: genres };
    }
    if (hosts.length > 0) {
      query["metadata.regular_hosts.id"] = { $in: hosts };
    }

    // If we have both genres and hosts, use OR logic
    if (genres.length > 0 && hosts.length > 0) {
      query.$or = [{ "metadata.genres.id": { $in: genres } }, { "metadata.regular_hosts.id": { $in: hosts } }];
      delete query["metadata.genres.id"];
      delete query["metadata.regular_hosts.id"];
    }

    const response = await cosmic.objects
      .find(query)
      .limit(limit * 2) // Get more to ensure we have enough after filtering
      .depth(2);

    const episodes = response.objects || [];

    // If we don't have enough episodes with shared genres/hosts, fill with random ones
    if (episodes.length < limit) {
      const randomResponse = await cosmic.objects
        .find({
          type: "episode",
          status: "published",
          id: { $nin: [episodeId, ...episodes.map((e: EpisodeObject) => e.id)] },
        })
        .limit(limit - episodes.length)
        .depth(2);
      const randomEpisodes = randomResponse.objects || [];
      episodes.push(...randomEpisodes);
    }

    return episodes.slice(0, limit) as EpisodeObject[];
  } catch (error) {
    console.error("Error fetching related episodes:", error);
    return [];
  }
}
