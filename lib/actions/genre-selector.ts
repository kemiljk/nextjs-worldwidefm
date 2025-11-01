'use server';

import { getEpisodesForShows } from '@/lib/episode-service';
import { transformShowToViewData } from '@/lib/cosmic-service';

export async function fetchShowsByGenre(genreId: string, limit: number = 10) {
  try {
    const response = await getEpisodesForShows({
      genre: [genreId],
      random: true,
      limit,
    });

    if (!response.shows || response.shows.length === 0) {
      return { shows: [], isEmpty: true };
    }

    const transformedShows = response.shows.map((show: any) => {
      const transformed = transformShowToViewData(show);
      return {
        ...transformed,
        key: transformed.slug,
      };
    });

    return { shows: transformedShows, isEmpty: false };
  } catch (error: any) {
    // Handle 404s gracefully - genres with no episodes
    const is404 =
      error?.status === 404 ||
      error?.message?.includes('404') ||
      error?.message?.includes('No objects found');
    
    if (is404) {
      return { shows: [], isEmpty: true };
    }

    console.error('Error fetching shows by genre:', error);
    return { shows: [], isEmpty: false };
  }
}

