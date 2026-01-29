import { Metadata } from 'next';
import { connection } from 'next/server';
import React from 'react';
import { notFound } from 'next/navigation';
import { cosmic } from '@/lib/cosmic-config';
import { getEpisodesForShows } from '@/lib/episode-service';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { transformShowToViewData } from '@/lib/cosmic-service';
import { EpisodeHero } from '@/components/homepage-hero';
import { SafeHtml } from '@/components/ui/safe-html';
import { GenreTag } from '@/components/ui/genre-tag';
import { Share2, MapPin } from 'lucide-react';
import { ShowCard } from '@/components/ui/show-card';
import { getCanonicalGenres } from '@/lib/get-canonical-genres';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const takeover = await getTakeoverBySlug(slug);

    if (takeover) {
      return generateBaseMetadata({
        title: `${takeover.title} - Takeover - Worldwide FM`,
        description:
          takeover.metadata?.description ||
          `Experience the ${takeover.title} takeover on Worldwide FM.`,
        image: takeover.metadata?.external_image_url || takeover.metadata?.image?.imgix_url,
        keywords: [
          'takeover',
          'guest programming',
          'curated music',
          'worldwide fm',
          takeover.title.toLowerCase(),
        ],
      });
    }

    return generateBaseMetadata({
      title: 'Takeover Not Found - Worldwide FM',
      description: 'The requested takeover could not be found.',
      noIndex: true,
    });
  } catch (error) {
    console.error('Error generating takeover metadata:', error);
    return generateBaseMetadata({
      title: 'Takeover Not Found - Worldwide FM',
      description: 'The requested takeover could not be found.',
      noIndex: true,
    });
  }
}

export async function generateStaticParams() {
  try {
    const response = await cosmic.objects
      .find({
        type: 'takeovers',
        status: 'published',
      })
      .props('slug')
      .limit(1000);

    const params =
      response.objects?.map((takeover: { slug: string }) => ({
        slug: takeover.slug,
      })) || [];

    return params;
  } catch (error) {
    console.error('Error generating static params for takeovers:', error);
    return [];
  }
}

async function getTakeoverBySlug(slug: string) {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'takeovers',
        slug: slug,
      })
      .props('id,slug,title,content,metadata')
      .depth(2);

    return response?.object || null;
  } catch (error) {
    console.error(`Error fetching takeover by slug ${slug}:`, error);
    return null;
  }
}

async function getRelatedEpisodes(takeover: any, limit: number = 12) {
  try {
    const result: any[] = [];
    const excludeIds: string[] = [];

    // 1. Get episodes for this takeover
    const response = await getEpisodesForShows({
      takeover: takeover.id,
      limit,
    });

    const takeoverShows = (response.shows || []).map(transformShowToViewData);
    result.push(...takeoverShows);
    excludeIds.push(...takeoverShows.map((s: any) => s.id));

    // 2. If we need more, fetch by genre
    if (result.length < limit) {
      const genreIds = takeover.metadata?.genres?.map((g: any) => g.id).filter(Boolean) || [];
      if (genreIds.length > 0) {
        const genreResponse = await getEpisodesForShows({
          genre: genreIds,
          limit: limit - result.length,
          exclude_ids: excludeIds,
        });

        const genreShows = (genreResponse.shows || []).map(transformShowToViewData);
        result.push(...genreShows);
      }
    }

    return result;
  } catch (error) {
    console.error(`Error fetching episodes for takeover ${takeover.id}:`, error);
    return [];
  }
}

export default async function TakeoverPage({ params }: { params: Promise<{ slug: string }> }) {
  // Opt into dynamic rendering - ensures time-based calculations use current time
  await connection();

  const { slug } = await params;

  const takeover = await getTakeoverBySlug(slug);

  if (!takeover) {
    notFound();
  }

  const relatedEpisodes = await getRelatedEpisodes(takeover, 12);

  const displayName = takeover.title || 'Untitled Takeover';
  const displayImage =
    takeover.metadata?.external_image_url ||
    takeover.metadata?.image?.imgix_url ||
    '/image-placeholder.png';

  const show = {
    id: takeover.id,
    slug: takeover.slug,
    title: takeover.title,
    url: null,
    metadata: takeover.metadata,
  };

  const canonicalGenres = await getCanonicalGenres();
  const getGenreLink = (genreId: string): string | undefined => {
    if (!canonicalGenres.length) return undefined;
    const canonicalGenre = canonicalGenres.find(genre => genre.id === genreId);
    return canonicalGenre ? `/genre/${canonicalGenre.slug}` : undefined;
  };

  return (
    <div className='pb-50'>
      <EpisodeHero
        displayName={displayName}
        displayImage={displayImage}
        showDate={''}
        show={show}
      />

      <div className='w-full flex flex-col md:flex-row justify-between gap-8 px-5 pt-8'>
        <div className='w-full md:w-[40%] lg:w-[35%] flex flex-col gap-3'>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center flex-wrap gap-2'>
              <h1 className='text-h7 font-bold tracking-tight'>{displayName}</h1>
              {takeover.metadata?.genres?.length > 0 && (
                <div className='flex flex-wrap'>
                  {takeover.metadata.genres.map((genre: any) => (
                    <GenreTag
                      key={genre.id || genre.slug}
                      href={genre.id ? getGenreLink(genre.id) : undefined}
                    >
                      {genre.title || genre.name}
                    </GenreTag>
                  ))}
                </div>
              )}
            </div>
          </div>
          {(takeover.metadata?.description || takeover.content) && (
            <div className='max-w-none'>
              <SafeHtml
                content={takeover.metadata?.description || takeover.content || ''}
                type='editorial'
                className='text-[16px]! leading-5 text-almostblack dark:text-white'
              />
            </div>
          )}

          {(takeover.metadata?.locations?.length > 0 || takeover.metadata?.location) && (
            <div className='flex items-center gap-1.5 text-almostblack/60 dark:text-white/60 my-2'>
              <MapPin className='h-4 w-4 shrink-0' />
              <div className='flex flex-wrap gap-x-1.5 gap-y-1 items-center'>
                {takeover.metadata?.locations?.length > 0 ? (
                  takeover.metadata.locations.map((loc: any, i: number) => (
                    <span key={loc.id || loc.slug} className='text-m8 font-mono uppercase tracking-wider'>
                      {loc.title}
                      {i < takeover.metadata.locations.length - 1 && <span className='mx-1'>•</span>}
                    </span>
                  ))
                ) : (
                  <span className='text-m8 font-mono uppercase tracking-wider'>
                    {typeof takeover.metadata.location === 'object' ? takeover.metadata.location.title : takeover.metadata.location}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {relatedEpisodes.length > 0 && (
        <div className='w-full px-5 pt-8'>
          <div>
            <h2 className='text-h8 uppercase md:text-h7 font-bold tracking-tight leading-none mb-3'>
              Related Episodes
            </h2>
            <div className='grid grid-cols-2 lg:grid-cols-4 md:grid-cols-3 gap-3'>
              {relatedEpisodes.map(relatedEpisode => {
                const slug = `/episode/${relatedEpisode.slug}`;
                return (
                  <ShowCard
                    key={relatedEpisode.id || relatedEpisode.slug}
                    show={relatedEpisode}
                    slug={slug}
                    playable
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
