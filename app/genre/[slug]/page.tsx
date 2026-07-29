import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { connection } from 'next/server';
import { getCanonicalGenres } from '@/lib/get-canonical-genres';
import GenreDetail from './genre-detail-client';
import { getEpisodesForShows, getRegularHosts, getTakeovers } from '@/lib/episode-service';
import { getAuthUser, getUserData } from '@/cosmic/blocks/user-management/actions';
import { generateBaseMetadata } from '@/lib/metadata-utils';

type ActiveType = 'all' | 'hosts-series' | 'takeovers';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canonicalGenres = await getCanonicalGenres();
  const genre = canonicalGenres.find(g => g.slug === slug);

  if (!genre) {
    return generateBaseMetadata({
      title: 'Genre Not Found - Worldwide FM',
      description: 'The requested genre could not be found.',
      noIndex: true,
    });
  }

  return generateBaseMetadata({
    title: `${genre.title} - Genre - Worldwide FM`,
    description: `Explore shows, hosts, and takeovers in ${genre.title} on Worldwide FM.`,
    keywords: ['genre', 'music', 'worldwide fm', genre.title.toLowerCase()],
  });
}

export default async function GenreDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ type?: string; page?: string }>;
}) {
  // Opt into dynamic rendering - ensures Cosmic changes show instantly
  await connection();

  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  const [canonicalGenres, user] = await Promise.all([getCanonicalGenres(), getAuthUser()]);
  const genre = canonicalGenres.find(g => g.slug === slug);
  if (!genre) {
    notFound();
  }

  let isFavorited = false;

  if (user) {
    try {
      const { data: userData } = await getUserData(user.id);
      if (userData?.metadata?.favourite_genres) {
        const favoriteGenreIds = userData.metadata.favourite_genres.map((g: any) =>
          typeof g === 'string' ? g : g.id
        );
        isFavorited = favoriteGenreIds.includes(genre.id);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  }

  const activeType: ActiveType =
    resolvedSearchParams?.type === 'hosts-series'
      ? 'hosts-series'
      : resolvedSearchParams?.type === 'takeovers'
        ? 'takeovers'
        : 'all';

  const currentPage = Math.max(parseInt(resolvedSearchParams?.page || '1', 10) || 1, 1);
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
      isFavorited={isFavorited}
    />
  );
}
