/**
 * @deprecated This file is maintained for backward compatibility.
 * New code should import directly from the modular actions:
 * - import { getPostsWithFilters } from '@/lib/actions/posts'
 * - import { getAllShows } from '@/lib/actions/shows'
 *
 * Actions are assigned locally instead of re-exported. Next.js 16.4's Turbopack
 * turns `export { fn } from ...` into a compact re-export, and the server-action
 * id for that binding is missing when a client calls it
 * (`Cannot read properties of undefined (reading 'apply')`).
 */

'use server';

import {
  getPostsWithFilters as getPostsWithFiltersImpl,
  getAllPosts as getAllPostsImpl,
  getPostBySlug as getPostBySlugImpl,
  getRelatedPosts as getRelatedPostsImpl,
  getPostCategories as getPostCategoriesImpl,
  getEditorialContent as getEditorialContentImpl,
} from './actions/posts';
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
} from './actions/shows';
import {
  getVideos as getVideosImpl,
  getVideoCategories as getVideoCategoriesImpl,
  getVideoBySlug as getVideoBySlugImpl,
} from './actions/videos';
import {
  getAllSearchableContent as getAllSearchableContentImpl,
  searchContent as searchContentImpl,
} from './actions/search';
import {
  getAllFilters as getAllFiltersImpl,
  getShowsFilters as getShowsFiltersImpl,
  fetchTags as fetchTagsImpl,
  fetchGenres as fetchGenresImpl,
} from './actions/filters';
import {
  getCosmicHomepageData as getCosmicHomepageDataImpl,
  fetchCosmicObjectById as fetchCosmicObjectByIdImpl,
  createColouredSections as createColouredSectionsImpl,
} from './actions/homepage';
import { getHostProfileUrl as getHostProfileUrlImpl } from './actions/radiocult';
import {
  getEditorialPageConfig as getEditorialPageConfigImpl,
  getVideosPageConfig as getVideosPageConfigImpl,
} from './actions/page-config';

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
export const getEditorialPageConfig = getEditorialPageConfigImpl;
export const getVideosPageConfig = getVideosPageConfigImpl;
