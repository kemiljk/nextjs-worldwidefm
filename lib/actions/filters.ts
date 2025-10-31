'use server';

import { FilterItem } from '../search/unified-types';
import { cosmic } from '../cosmic-config';
import { deduplicateFilters } from '../filter-types';
import { getTags } from '../radiocult-service';

export async function getAllFilters() {
  try {
    const [genresRes, hostsRes, takeoversRes, locationsRes, featuredShowsRes, seriesRes] =
      await Promise.all([
        cosmic.objects.find({
          type: 'genres',
          props: 'id,slug,title,type,metadata',
          depth: 1,
          limit: 1000,
        }),
        cosmic.objects.find({
          type: 'regular-hosts',
          props: 'id,slug,title,type,metadata',
          depth: 1,
          limit: 1000,
        }),
        cosmic.objects.find({
          type: 'takeovers',
          props: 'id,slug,title,type,metadata',
          depth: 1,
          limit: 1000,
        }),
        cosmic.objects.find({
          type: 'locations',
          props: 'id,slug,title,type,metadata',
          depth: 1,
          limit: 1000,
        }),
        cosmic.objects.find({
          type: 'featured-shows',
          props: 'id,slug,title,type,metadata',
          depth: 1,
          limit: 1000,
        }),
        cosmic.objects.find({
          type: 'series',
          props: 'id,slug,title,type,metadata',
          depth: 1,
          limit: 1000,
        }),
      ]);

    const toFilterItems = (objects: any[] = [], type: string): FilterItem[] =>
      objects.map(obj => ({ id: obj.id, slug: obj.slug, title: obj.title, type }));

    const genres = toFilterItems(genresRes.objects || [], 'genres');
    const hosts = toFilterItems(hostsRes.objects || [], 'hosts');
    const takeovers = toFilterItems(takeoversRes.objects || [], 'takeovers');
    const locations = toFilterItems(locationsRes.objects || [], 'locations');
    const featuredShows = toFilterItems(featuredShowsRes.objects || [], 'featured-shows');
    const series = toFilterItems(seriesRes.objects || [], 'series');

    return { genres, hosts, takeovers, locations, featuredShows, series };
  } catch (error) {
    console.error('Error getting filters:', error);
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
    const safeFind = async (type: string) => {
      try {
        return await cosmic.objects.find({
          type,
          props: 'id,slug,title,type,metadata',
          depth: 1,
          limit: 1000,
        });
      } catch (error) {
        console.warn(`Failed to fetch ${type}:`, error);
        return { objects: [] };
      }
    };

    const [genresRes, hostsRes, takeoversRes, locationsRes] = await Promise.all([
      safeFind('genres'),
      safeFind('regular-hosts'),
      safeFind('takeovers'),
      safeFind('locations'),
    ]);

    const toShowsFilterItems = (objects: any[] = [], type: string) => {
      const items = objects.map(obj => ({
        id: obj.id,
        slug: obj.slug,
        title: obj.title,
        type: type,
        content: obj.content || '',
        status: obj.status || 'published',
        metadata: obj.metadata || null,
        created_at: obj.created_at,
        modified_at: obj.modified_at,
        published_at: obj.published_at,
      }));

      const deduplicated = deduplicateFilters(items);
      if (items.length !== deduplicated.length) {
        console.log(
          `${type}: Removed ${items.length - deduplicated.length} duplicates (${items.length} → ${deduplicated.length})`
        );
      }

      return deduplicated;
    };

    return {
      genres: toShowsFilterItems(genresRes.objects || [], 'genres'),
      hosts: toShowsFilterItems(hostsRes.objects || [], 'hosts'),
      takeovers: toShowsFilterItems(takeoversRes.objects || [], 'takeovers'),
      locations: toShowsFilterItems(locationsRes.objects || [], 'locations'),
      featuredShows: [],
      series: [],
    };
  } catch (error) {
    console.error('Error getting shows filters:', error);
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

export async function fetchTags() {
  try {
    const tags = await getTags();
    return tags || [];
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
}

export async function fetchGenres() {
  try {
    const response = await cosmic.objects.find({
      type: 'genres',
      status: 'published',
    });
    return response.objects || [];
  } catch (error) {
    console.error('Error fetching genres:', error);
    return [];
  }
}

