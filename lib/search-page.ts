import { z } from 'zod';
import { cosmic } from './cosmic-config';
import { applySearchToQuery, SEARCH_INITIAL_SIZE, SEARCH_PAGE_SIZE } from './search-query';

const filters = z.array(z.string().min(1).max(100)).max(20).default([]);
export const searchPageSchema = z.object({
  type: z.enum(['episodes', 'posts', 'videos', 'takeovers', 'hosts-series']).default('episodes'),
  searchTerm: z.string().trim().max(200).default(''),
  genre: filters,
  location: filters,
  host: filters,
  limit: z.coerce.number().int().min(1).max(SEARCH_PAGE_SIZE).default(SEARCH_INITIAL_SIZE),
  after: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export type SearchPageParams = z.infer<typeof searchPageSchema>;

// Search cards do not need audio URLs, images, descriptions or full relationships.
export const SEARCH_RESULT_PROPS =
  'id,slug,title,created_at,metadata.broadcast_date,metadata.date,metadata.genres.id,metadata.genres.title,metadata.categories.id,metadata.categories.title,metadata.hosts.id,metadata.hosts.title';

export function buildSearchPageQuery(params: SearchPageParams, yesterday: string) {
  const types = {
    episodes: 'episode',
    posts: 'posts',
    videos: 'videos',
    takeovers: 'takeovers',
    'hosts-series': 'regular-hosts',
  };
  const query: Record<string, unknown> = { type: types[params.type], status: 'published' };
  applySearchToQuery(query, params.searchTerm);
  if (params.type === 'episodes') query['metadata.broadcast_date'] = { $lte: yesterday };
  if (['episodes', 'hosts-series', 'takeovers'].includes(params.type)) {
    // Keep the existing content-type-specific filter fields.
    const genreField = params.type === 'takeovers' ? 'metadata.genre.slug' : 'metadata.genres';
    const locationField =
      params.type === 'takeovers' ? 'metadata.location.slug' : 'metadata.locations';
    if (params.genre.length) query[genreField] = { $in: params.genre };
    if (params.location.length) query[locationField] = { $in: params.location };
    if (params.type !== 'hosts-series' && params.host.length)
      query['metadata.regular_hosts'] = { $in: params.host };
  }
  return query;
}

export async function getSearchPage(params: SearchPageParams, yesterday: string) {
  let request = cosmic.objects
    .find(buildSearchPageQuery(params, yesterday))
    .props(SEARCH_RESULT_PROPS)
    .limit(params.limit)
    .depth(1);
  request = params.after ? request.after(params.after) : request.skip(params.offset);
  if (params.type === 'episodes') request = request.sort('-metadata.broadcast_date');
  if (params.type === 'posts') request = request.sort('-metadata.date');
  // Videos often have no metadata.date; sorting null dates makes pagination unstable.
  if (params.type === 'videos') request = request.sort('-created_at');
  try {
    const response = await request;
    const results = response.objects || [];
    return {
      results,
      nextCursor: results.at(-1)?.id ?? null,
      hasNext:
        results.length === params.limit &&
        (response.total === undefined || params.offset + results.length < response.total),
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return { results: [], hasNext: false, nextCursor: null };
    }
    throw error;
  }
}
