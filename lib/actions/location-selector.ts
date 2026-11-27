'use server';

import { getEpisodesForShows } from '@/lib/episode-service';
import { toShowCardData as transformShowToViewData } from '@/lib/show-card-data';

/** A handful of archived shows recorded or hosted in a location, for the homepage selector. */
export async function fetchShowsByLocation(locationId: string, limit: number = 10) {
  if (!locationId || typeof locationId !== 'string') return { shows: [], isEmpty: true };

  try {
    const response = await getEpisodesForShows({
      location: [locationId],
      random: true,
      // Listen-back only: every card here should be playable.
      listenBackOnly: true,
      limit: Math.min(Math.max(1, Math.floor(limit)), 20),
    });

    if (!response.shows || response.shows.length === 0) return { shows: [], isEmpty: true };

    return {
      shows: response.shows.map((show: any) => {
        const transformed = transformShowToViewData(show);
        return { ...transformed, key: transformed.slug };
      }),
      isEmpty: false,
    };
  } catch (error: any) {
    // Locations with no episodes answer 404; that is an empty result, not a failure.
    const is404 =
      error?.status === 404 ||
      error?.message?.includes('404') ||
      error?.message?.includes('No objects found');
    if (is404) return { shows: [], isEmpty: true };

    console.error('Error fetching shows by location:', error);
    return { shows: [], isEmpty: false, failed: true };
  }
}
