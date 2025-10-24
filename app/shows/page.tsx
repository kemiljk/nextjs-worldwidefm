import { Metadata } from 'next';
import { Suspense } from 'react';
import ShowsClient from './shows-client';
import { getCanonicalGenres } from '@/lib/get-canonical-genres';
import { getShowsFilters } from '@/lib/actions';
import { generateShowsMetadata } from '@/lib/metadata-utils';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateShowsMetadata();
};

// Force dynamic mode to prevent the issue with ISR and repeated POST requests
export const dynamic = 'force-dynamic';

export default async function ShowsPage() {
  const [canonicalGenres, availableFilters] = await Promise.all([
    getCanonicalGenres(),
    getShowsFilters(),
  ]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShowsClient canonicalGenres={canonicalGenres} availableFilters={availableFilters} />
    </Suspense>
  );
}
