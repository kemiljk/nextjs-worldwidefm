/**
 * Same local bindings as `@/lib/actions`. Do not switch these back to
 * `export { fn } from ...`: Next.js 16.4 Turbopack drops that re-export's
 * server-action id and client calls throw `reading 'apply'`.
 */

'use server';

import {
  getPostsWithFilters as getPostsWithFiltersImpl,
  getAllPosts as getAllPostsImpl,
  getPostBySlug as getPostBySlugImpl,
  getRelatedPosts as getRelatedPostsImpl,
  getPostCategories as getPostCategoriesImpl,
  getEditorialContent as getEditorialContentImpl,
} from './posts';
import {
  getAllShows as getAllShowsImpl,
  getEnhancedShowBySlug as getEnhancedShowBySlugImpl,
  getShowBySlug as getShowBySlugImpl,
  getScheduleData as getScheduleDataImpl,
  searchEpisodes as searchEpisodesImpl,
  getFeaturedShows as getFeaturedShowsImpl,
  getSeries as getSeriesImpl,
  getRegularHosts as getRegularHostsImpl,
  getAllEvents as getAllEventsImpl,
  getTakeovers as getTakeoversImpl,
} from './shows';
import {
  getVideos as getVideosImpl,
  getVideoCategories as getVideoCategoriesImpl,
  getVideoBySlug as getVideoBySlugImpl,
} from './videos';
import {
  getAllSearchableContent as getAllSearchableContentImpl,
  searchContent as searchContentImpl,
} from './search';
import {
  getAllFilters as getAllFiltersImpl,
  getShowsFilters as getShowsFiltersImpl,
  fetchTags as fetchTagsImpl,
  fetchGenres as fetchGenresImpl,
} from './filters';
import {
  getCosmicHomepageData as getCosmicHomepageDataImpl,
  fetchCosmicObjectById as fetchCosmicObjectByIdImpl,
  createColouredSections as createColouredSectionsImpl,
} from './homepage';
import { getHostProfileUrl as getHostProfileUrlImpl } from './radiocult';

export const getPostsWithFilters = getPostsWithFiltersImpl;
export const getAllPosts = getAllPostsImpl;
export const getPostBySlug = getPostBySlugImpl;
export const getRelatedPosts = getRelatedPostsImpl;
export const getPostCategories = getPostCategoriesImpl;
export const getEditorialContent = getEditorialContentImpl;
export const getAllShows = getAllShowsImpl;
export const getEnhancedShowBySlug = getEnhancedShowBySlugImpl;
export const getShowBySlug = getShowBySlugImpl;
export const getScheduleData = getScheduleDataImpl;
export const searchEpisodes = searchEpisodesImpl;
export const getFeaturedShows = getFeaturedShowsImpl;
export const getSeries = getSeriesImpl;
export const getRegularHosts = getRegularHostsImpl;
export const getAllEvents = getAllEventsImpl;
export const getTakeovers = getTakeoversImpl;
export const getVideos = getVideosImpl;
export const getVideoCategories = getVideoCategoriesImpl;
export const getVideoBySlug = getVideoBySlugImpl;
export const getAllSearchableContent = getAllSearchableContentImpl;
export const searchContent = searchContentImpl;
export const getAllFilters = getAllFiltersImpl;
export const getShowsFilters = getShowsFiltersImpl;
export const fetchTags = fetchTagsImpl;
export const fetchGenres = fetchGenresImpl;
export const getCosmicHomepageData = getCosmicHomepageDataImpl;
export const fetchCosmicObjectById = fetchCosmicObjectByIdImpl;
export const createColouredSections = createColouredSectionsImpl;
export const getHostProfileUrl = getHostProfileUrlImpl;
