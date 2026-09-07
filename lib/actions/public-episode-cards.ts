'use server';

import { z } from 'zod';
import { getEpisodesForShows } from '../episode-service';
import { toShowCardData } from '../show-card-data';

const filter = z
  .array(z.string().trim().min(1).max(200))
  .max(100)
  .transform(values => [...new Set(values)].sort())
  .optional();
const parameters = z
  .object({
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).max(100000).default(0),
    searchTerm: z.string().trim().max(200).optional(),
    genre: filter,
    location: filter,
  })
  .strict();

/** Keep interactive browsing behind the same public cache as server-rendered cards. */
export async function getPublicEpisodeCards(input: z.input<typeof parameters> = {}) {
  const response = await getEpisodesForShows(parameters.parse(input));
  return { ...response, shows: response.shows.map(toShowCardData) };
}
