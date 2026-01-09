import { Metadata } from 'next';
import { Suspense } from 'react';
import ShowsClient from './shows-client';
import { getCanonicalGenres } from '@/lib/get-canonical-genres';
import { getShowsFilters } from '@/lib/actions';
import { generateShowsMetadata } from '@/lib/metadata-utils';
import { getEpisodesForShows } from '@/lib/episode-service';
import { transformShowToViewData } from '@/lib/cosmic-service';
import { ShowsGridSkeleton } from '@/components/shows-grid-skeleton';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateShowsMetadata();
};

export default async function ShowsPage() {
  // Data fetching uses time-based caching (latest: 5min revalidation)
  // Content updates via revalidation or manual trigger at /api/revalidate

  const [canonicalGenres, availableFilters, initialShowsData] = await Promise.all([
    getCanonicalGenres(),
    getShowsFilters(),
    getEpisodesForShows({ limit: 20, offset: 0 }).catch(() => ({
      shows: [],
      total: 0,
      hasNext: false,
    })),
  ]);

  const initialShows = (initialShowsData.shows || []).map(show => {
    const transformed = transformShowToViewData(show);
    return {
      ...transformed,
      key: transformed.slug,
    };
  });

  return (
    <Suspense fallback={<ShowsGridSkeleton count={20} />}>
      <ShowsClient
        canonicalGenres={canonicalGenres}
        availableFilters={availableFilters}
        initialShows={initialShows}
        initialHasNext={initialShowsData.hasNext}
      />
    </Suspense>
  );
}
