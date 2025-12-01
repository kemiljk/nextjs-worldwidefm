'use server';

import { getRadioShowBySlug } from '../cosmic-service';
import { getEventBySlug as getRadioCultEventBySlug, RadioCultEvent } from '../radiocult-service';
import { stripUrlsFromText } from '../utils';
import { EventType } from '../cosmic-types';

export interface EpisodeShowsFilters {
  genre?: string[];
  location?: string[];
  host?: string[];
  takeover?: string[];
  searchTerm?: string;
  limit?: number;
  offset?: number;
  random?: boolean;
}

export async function getAllShows(skip = 0, limit = 20, filters?: EpisodeShowsFilters) {
  try {
    const { getEpisodesForShows } = await import('../episode-service');
    const response = await getEpisodesForShows({
      offset: skip,
      limit,
      ...filters,
    });

    return {
      shows: response.shows,
      hasMore: response.hasNext,
      cosmicSkip: skip + response.shows.length,
      mixcloudSkip: 0,
    };
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return { shows: [], hasMore: false, cosmicSkip: skip, mixcloudSkip: 0 };
  }
}

export async function getEnhancedShowBySlug(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const { getEpisodeBySlug } = await import('../episode-service');
    const episode = await getEpisodeBySlug(slug);

    if (episode) {
      return episode;
    }
  } catch (error) {
    console.error('Error fetching episode from Cosmic:', error);
  }

  try {
    const radioCultEvent = await getRadioCultEventBySlug(slug);
    if (radioCultEvent) {
      return convertRadioCultEventToMixcloudFormat(radioCultEvent);
    }
  } catch (error) {
    console.error('Error fetching RadioCult event:', error);
  }

  return null;
}

export async function getShowBySlug(slug: string): Promise<Record<string, unknown> | null> {
  const slugVariants = [
    slug,
    slug.startsWith('/') ? slug.slice(1) : '/' + slug,
    slug.replace(/^\/+/, ''),
    slug.replace(/^\/worldwidefm\//, ''),
  ];

  for (const variant of slugVariants) {
    try {
      const { getEpisodeBySlug } = await import('../episode-service');
      const episode = await getEpisodeBySlug(variant);
      if (episode) {
        return episode;
      }
    } catch (error) {
      console.error(`Error fetching episode from Cosmic for variant '${variant}':`, error);
    }
  }

  for (const variant of slugVariants) {
    try {
      if (!variant.includes('/')) {
        const radioCultEvent = await getRadioCultEventBySlug(variant);
        if (radioCultEvent) {
          return convertRadioCultEventToMixcloudFormat(radioCultEvent);
        }
      }
    } catch (error) {
      console.error(`Error finding RadioCult event for slug variant '${variant}':`, error);
    }
  }

  for (const variant of slugVariants) {
    try {
      const cosmicResponse = await getRadioShowBySlug(variant);
      if (cosmicResponse?.object) {
        const show = cosmicResponse.object;
        return {
          key: show.slug,
          name: show.title,
          url: `/episode/${show.slug}`,
          pictures: {
            small: show.metadata?.image?.imgix_url || '/image-placeholder.png',
            thumbnail: show.metadata?.image?.imgix_url || '/image-placeholder.png',
            medium_mobile: show.metadata?.image?.imgix_url || '/image-placeholder.png',
            medium: show.metadata?.image?.imgix_url || '/image-placeholder.png',
            large: show.metadata?.image?.imgix_url || '/image-placeholder.png',
            '320wx320h': show.metadata?.image?.imgix_url || '/image-placeholder.png',
            extra_large: show.metadata?.image?.imgix_url || '/image-placeholder.png',
            '640wx640h': show.metadata?.image?.imgix_url || '/image-placeholder.png',
          },
          created_time: show.metadata?.broadcast_date || show.created_at,
          updated_time: show.modified_at,
          play_count: 0,
          favorite_count: 0,
          comment_count: 0,
          listener_count: 0,
          repost_count: 0,
          tags: (show.metadata?.genres || []).map(genre => ({
            key: genre.slug || genre.id || '',
            url: `/genres/${genre.slug || genre.id || ''}`,
            name: genre.title || '',
          })),
          slug: show.slug,
          hosts: (show.metadata?.regular_hosts || []).map(host => ({
            key: host.slug || host.id || '',
            url: `/hosts/${host.slug || host.id || ''}`,
            name: host.title || '',
            username: host.slug || host.id || '',
            pictures: {
              small: host.metadata?.image?.imgix_url || '/image-placeholder.png',
              thumbnail: host.metadata?.image?.imgix_url || '/image-placeholder.png',
              medium_mobile: host.metadata?.image?.imgix_url || '/image-placeholder.png',
              medium: host.metadata?.image?.imgix_url || '/image-placeholder.png',
              large: host.metadata?.image?.imgix_url || '/image-placeholder.png',
              '320wx320h': host.metadata?.image?.imgix_url || '/image-placeholder.png',
              extra_large: host.metadata?.image?.imgix_url || '/image-placeholder.png',
              '640wx640h': host.metadata?.image?.imgix_url || '/image-placeholder.png',
            },
          })),
          hidden_stats: false,
          audio_length: 0,
          description: show.metadata?.description || '',
          player: show.metadata?.player,
          __source: 'cosmic',
        };
      }
    } catch (error) {
      console.error(
        `Error fetching legacy radio-show from Cosmic for variant '${variant}':`,
        error
      );
    }
  }

  console.warn(`No show found for any slug variant: ${slugVariants.join(', ')}`);
  return null;
}

export async function getScheduleData(): Promise<{
  currentShow: unknown | null;
  upcomingShow: unknown | null;
  upcomingShows: unknown[];
}> {
  try {
    const radiocultService = await import('../radiocult-service');
    const getRadioCultScheduleData = radiocultService.getScheduleData;
    const { currentEvent, upcomingEvent, upcomingEvents } = await getRadioCultScheduleData();

    const adaptCurrentEvent = currentEvent
      ? convertRadioCultEventToMixcloudFormat(currentEvent)
      : null;
    const adaptUpcomingEvent = upcomingEvent
      ? convertRadioCultEventToMixcloudFormat(upcomingEvent)
      : null;
    const adaptUpcomingEvents = upcomingEvents.map(convertRadioCultEventToMixcloudFormat);

    return {
      currentShow: adaptCurrentEvent,
      upcomingShow: adaptUpcomingEvent,
      upcomingShows: adaptUpcomingEvents,
    };
  } catch (error) {
    console.error('Error getting RadioCult schedule data:', error);
    return {
      currentShow: null,
      upcomingShow: null,
      upcomingShows: [],
    };
  }
}

function convertRadioCultEventToMixcloudFormat(event: RadioCultEvent): Record<string, unknown> {
  return {
    key: event.slug,
    name: event.showName,
    url: `/shows/${event.slug}`,
    pictures: {
      small: event.imageUrl || '/image-placeholder.png',
      thumbnail: event.imageUrl || '/image-placeholder.png',
      medium_mobile: event.imageUrl || '/image-placeholder.png',
      medium: event.imageUrl || '/image-placeholder.png',
      large: event.imageUrl || '/image-placeholder.png',
      '320wx320h': event.imageUrl || '/image-placeholder.png',
      extra_large: event.imageUrl || '/image-placeholder.png',
      '640wx640h': event.imageUrl || '/image-placeholder.png',
      '768wx768h': event.imageUrl || '/image-placeholder.png',
      '1024wx1024h': event.imageUrl || '/image-placeholder.png',
    },
    created_time: event.startTime,
    updated_time: event.updatedAt,
    play_count: 0,
    favorite_count: 0,
    comment_count: 0,
    listener_count: 0,
    repost_count: 0,
    tags: [],
    slug: event.slug,
    user: {
      key: 'radiocult',
      url: '/',
      name: 'RadioCult',
      username: 'radiocult',
      pictures: {
        small: '/logo.svg',
        thumbnail: '/logo.svg',
        medium_mobile: '/logo.svg',
        medium: '/logo.svg',
        large: '/logo.svg',
        '320wx320h': '/logo.svg',
        extra_large: '/logo.svg',
        '640wx640h': '/logo.svg',
      },
    },
    hosts: event.artists.map(artist => ({
      key: artist.id,
      url: `/artists/${artist.slug}`,
      name: artist.name,
      username: artist.slug,
      pictures: {
        small: artist.imageUrl || '/image-placeholder.png',
        thumbnail: artist.imageUrl || '/image-placeholder.png',
        medium_mobile: artist.imageUrl || '/image-placeholder.png',
        medium: artist.imageUrl || '/image-placeholder.png',
        large: artist.imageUrl || '/image-placeholder.png',
        '320wx320h': artist.imageUrl || '/image-placeholder.png',
        extra_large: artist.imageUrl || '/image-placeholder.png',
        '640wx640h': artist.imageUrl || '/image-placeholder.png',
      },
    })),
    hidden_stats: false,
    audio_length: event.duration * 60,
    endTime: event.endTime,
    description:
      typeof event.description === 'string'
        ? stripUrlsFromText(event.description)
        : event.description,
    __source: 'radiocult',
  };
}

export async function getAllEvents({
  limit = 20,
  offset = 0,
  searchTerm,
}: { limit?: number; offset?: number; searchTerm?: string } = {}): Promise<{
  events: EventType[];
  hasNext: boolean;
}> {
  try {
    const query: Record<string, unknown> = {
      type: 'events',
      status: 'published',
      sort: '-metadata.event_date',
      props: 'id,slug,title,type,metadata,created_at',
      limit,
      skip: offset,
    };

    if (searchTerm && searchTerm.trim()) {
      query.title = { $regex: searchTerm.trim(), $options: 'i' };
    }

    const cosmicImport = await import('../cosmic-config');
    const response = await cosmicImport.cosmic.objects.find(query).depth(1);
    const events = (response.objects || []) as EventType[];
    const hasNext = events.length === limit;

    return { events, hasNext };
  } catch (error) {
    console.error('Error in getAllEvents:', error);
    return { events: [], hasNext: false };
  }
}

export async function getTakeovers({
  limit = 20,
  offset = 0,
  genre,
  location,
}: {
  limit?: number;
  offset?: number;
  genre?: string[];
  location?: string[];
  letter?: string;
} = {}): Promise<{ shows: unknown[]; hasNext: boolean }> {
  try {
    const { getTakeovers: getTakeoversFromService } = await import('../episode-service');
    const response = await getTakeoversFromService({
      limit,
      offset,
      genre,
      location,
    });

    return {
      shows: response.shows || [],
      hasNext: response.hasNext || false,
    };
  } catch (error) {
    console.error('Error in getTakeovers:', error);
    return { shows: [], hasNext: false };
  }
}

export async function getFeaturedShows({
  limit = 20,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<{
  shows: unknown[];
  hasNext: boolean;
}> {
  try {
    const { cosmic } = await import('../cosmic-config');
    const response = await cosmic.objects
      .find({
        type: 'episode',
        status: 'published',
        'metadata.featured_on_homepage': true,
        limit,
        skip: offset,
        sort: '-metadata.broadcast_date',
      })
      .depth(2);

    return {
      shows: response.objects || [],
      hasNext: (response.objects || []).length === limit,
    };
  } catch (error) {
    console.error('Error in getFeaturedShows:', error);
    return { shows: [], hasNext: false };
  }
}

export async function getSeries({
  limit = 20,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<{
  shows: unknown[];
  hasNext: boolean;
}> {
  try {
    const cosmicImport = await import('../cosmic-config');
    const response = await cosmicImport.cosmic.objects.find({
      type: 'series',
      status: 'published',
      limit,
      skip: offset,
    });

    return {
      shows: response.objects || [],
      hasNext: (response.objects || []).length === limit,
    };
  } catch (error) {
    console.error('Error in getSeries:', error);
    return { shows: [], hasNext: false };
  }
}

export async function getRegularHosts({
  limit = 20,
  offset = 0,
  genre,
  location,
  letter,
}: {
  limit?: number;
  offset?: number;
  genre?: string[];
  location?: string[];
  letter?: string;
} = {}): Promise<{ shows: unknown[]; hasNext: boolean }> {
  try {
    const cosmicImport = await import('../cosmic-config');
    const query: Record<string, unknown> = {
      type: 'regular-hosts',
      status: 'published',
      limit,
      skip: offset,
    };

    if (genre && genre.length > 0) {
      query['metadata.genres.id'] = { $in: genre };
    }
    if (location && location.length > 0) {
      query['metadata.locations.id'] = { $in: location };
    }
    if (letter) {
      query.title = { $regex: `^${letter}`, $options: 'i' };
    }

    const response = await cosmicImport.cosmic.objects.find(query).depth(2);
    return {
      shows: response.objects || [],
      hasNext: (response.objects || []).length === limit,
    };
  } catch (error) {
    console.error('Error in getRegularHosts:', error);
    return { shows: [], hasNext: false };
  }
}

export async function getMixcloudShows(
  filters: EpisodeShowsFilters = {}
): Promise<{ shows: Record<string, unknown>[]; total: number }> {
  try {
    const { getEpisodesForShows } = await import('../episode-service');
    const response = await getEpisodesForShows({
      limit: filters.limit || 20,
      offset: filters.offset || 0,
      genre: filters.genre,
      location: filters.location,
      host: filters.host,
      takeover: filters.takeover,
      searchTerm: filters.searchTerm,
      random: filters.random,
    });

    return {
      shows: response.shows || [],
      total: response.total || 0,
    };
  } catch (error) {
    console.error('Error in getMixcloudShows:', error);
    return { shows: [], total: 0 };
  }
}

export async function searchEpisodes(params: {
  searchTerm?: string;
  genre?: string[];
  location?: string[];
  limit?: number;
  offset?: number;
}): Promise<{ shows: Record<string, unknown>[]; hasNext: boolean }> {
  try {
    const { getEpisodesForShows } = await import('../episode-service');
    const response = await getEpisodesForShows({
      searchTerm: params.searchTerm,
      genre: params.genre,
      location: params.location,
      limit: params.limit || 20,
      offset: params.offset || 0,
    });

    return {
      shows: response.shows || [],
      hasNext: response.hasNext || false,
    };
  } catch (error) {
    console.error('Error in searchEpisodes:', error);
    return { shows: [], hasNext: false };
  }
}
