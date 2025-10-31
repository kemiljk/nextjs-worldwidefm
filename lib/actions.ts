/**
 * @deprecated This file is maintained for backward compatibility.
 * New code should import directly from the modular actions:
 * - import { getPostsWithFilters } from '@/lib/actions/posts'
 * - import { getAllShows } from '@/lib/actions/shows'
 *
 * All exports are re-exported directly from individual modules.
 */

'use server';

// Import from posts
import {
  getPostsWithFilters,
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  getPostCategories,
  getEditorialContent,
} from './actions/posts';

// Import from shows
import {
  getAllShows,
  getEnhancedShowBySlug,
  getShowBySlug,
  getScheduleData,
  getMixcloudShows,
  searchEpisodes,
  getFeaturedShows,
  getSeries,
  getRegularHosts,
  getAllEvents,
  getTakeovers,
} from './actions/shows';

// Import from videos
import { getVideos, getVideoCategories, getVideoBySlug } from './actions/videos';

// Import from search
import { getAllSearchableContent, searchContent } from './actions/search';

// Import from filters
import { getAllFilters, getShowsFilters, fetchTags, fetchGenres } from './actions/filters';

// Import from homepage
import {
  getCosmicHomepageData,
  fetchCosmicObjectById,
  createColouredSections,
} from './actions/homepage';

// Import from radiocult
import { uploadMediaToRadioCultAndCosmic, getHostProfileUrl } from './actions/radiocult';

// Export all imported async functions
export {
  getPostsWithFilters,
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  getPostCategories,
  getEditorialContent,
  getAllShows,
  getEnhancedShowBySlug,
  getShowBySlug,
  getScheduleData,
  getMixcloudShows,
  searchEpisodes,
  getFeaturedShows,
  getSeries,
  getRegularHosts,
  getAllEvents,
  getTakeovers,
  getVideos,
  getVideoCategories,
  getVideoBySlug,
  getAllSearchableContent,
  searchContent,
  getAllFilters,
  getShowsFilters,
  fetchTags,
  fetchGenres,
  getCosmicHomepageData,
  fetchCosmicObjectById,
  createColouredSections,
  uploadMediaToRadioCultAndCosmic,
  getHostProfileUrl,
};
