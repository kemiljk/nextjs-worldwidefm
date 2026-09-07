'use server';

import { getPublicFacet } from '../public-facets';
import { getTags } from '../radiocult-service';

export async function getShowsFilters() {
  const [genres, hosts, takeovers, locations] = await Promise.all([
    getPublicFacet('genres'),
    getPublicFacet('regular-hosts'),
    getPublicFacet('takeovers'),
    getPublicFacet('locations'),
  ]);
  return { genres, hosts, takeovers, locations, featuredShows: [], series: [] };
}

export async function getAllFilters() {
  const [filters, featuredShows, series] = await Promise.all([
    getShowsFilters(),
    getPublicFacet('featured-shows'),
    getPublicFacet('series'),
  ]);
  return { ...filters, featuredShows, series };
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
    return { success: true, genres: await getPublicFacet('genres') };
  } catch (error) {
    console.error('Error fetching genres:', error);
    return { success: false, genres: [] };
  }
}
