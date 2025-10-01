import { notFound } from 'next/navigation';
import { getCanonicalGenres } from '@/lib/get-canonical-genres';
import GenreDetail from './genre-detail-client';
import { getEpisodesForShows, getRegularHosts, getTakeovers } from '@/lib/episode-service';

type ActiveType = 'all' | 'hosts-series' | 'takeovers';

export default async function GenreDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { type?: string; page?: string };
}) {
  const { slug } = params;

  const canonicalGenres = await getCanonicalGenres();
  const genre = canonicalGenres.find((g) => g.slug === slug);
  if (!genre) {
    notFound();
  }

  const activeType: ActiveType =
    searchParams?.type === 'hosts-series'
      ? 'hosts-series'
      : searchParams?.type === 'takeovers'
        ? 'takeovers'
        : 'all';

  const currentPage = Math.max(parseInt(searchParams?.page || '1', 10) || 1, 1);
  const PAGE_SIZE = 20;
  const offset = (currentPage - 1) * PAGE_SIZE;

  let response:
    | Awaited<ReturnType<typeof getEpisodesForShows>>
    | Awaited<ReturnType<typeof getRegularHosts>>
    | Awaited<ReturnType<typeof getTakeovers>>;

  if (activeType === 'hosts-series') {
    response = await getRegularHosts({ genre: [genre.id], limit: PAGE_SIZE, offset });
  } else if (activeType === 'takeovers') {
    response = await getTakeovers({ genre: [genre.id], limit: PAGE_SIZE, offset });
  } else {
    response = await getEpisodesForShows({ genre: [genre.id], limit: PAGE_SIZE, offset });
  }

  return (
    <GenreDetail
      genre={genre}
      canonicalGenres={canonicalGenres}
      shows={response.shows}
      hasNext={response.hasNext}
      activeType={activeType}
      currentPage={currentPage}
    />
  );
}

export async function generateStaticParams() {
  const canonicalGenres = await getCanonicalGenres();
  return canonicalGenres.map((genre) => ({ slug: genre.slug }));
}
