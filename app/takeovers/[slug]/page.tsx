import { Metadata } from 'next';
import React from 'react';
import { notFound } from 'next/navigation';
import { cosmic } from '@/lib/cosmic-config';
import { getEpisodesForShows } from '@/lib/episode-service';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { transformShowToViewData } from '@/lib/cosmic-service';
import { EpisodeHero } from '@/components/homepage-hero';
import { SafeHtml } from '@/components/ui/safe-html';
import { GenreTag } from '@/components/ui/genre-tag';
import TakeoverClient from './takeover-client';

export const revalidate = 300; // 5 minutes - takeover profiles change infrequently

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const takeover = await getTakeoverBySlug(slug);

    if (takeover) {
      const ogImage = takeover.metadata?.image?.imgix_url
        ? `${takeover.metadata.image.imgix_url}?w=1200&h=630&fit=crop&auto=format,compress`
        : undefined;
      return generateBaseMetadata({
        title: `${takeover.title} - Takeover - Worldwide FM`,
        description:
          takeover.metadata?.description ||
          `Experience the ${takeover.title} takeover on Worldwide FM.`,
        image: ogImage,
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

async function getTakeoverEpisodes(takeoverId: string, limit: number = 20, retries: number = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await getEpisodesForShows({
        takeover: takeoverId,
        limit,
      });

      return (response.shows || []).map(transformShowToViewData);
    } catch (error) {
      const isLastAttempt = attempt === retries;
      if (isLastAttempt) {
        console.error(`Error fetching episodes for takeover ${takeoverId} after ${retries} attempts:`, error);
        return [];
      }
      // Exponential backoff: 500ms, 1000ms, 2000ms
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
    }
  }
  return [];
}

export default async function TakeoverPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const takeover = await getTakeoverBySlug(slug);

  if (!takeover) {
    notFound();
  }

  const initialEpisodes = await getTakeoverEpisodes(takeover.id, 20);

  const displayName = takeover.title || 'Untitled Takeover';
  const baseImageUrl = takeover.metadata?.image?.imgix_url;
  const displayImage = baseImageUrl 
    ? `${baseImageUrl}?w=1200&auto=format,compress`
    : '/image-placeholder.png';

  const show = {
    id: takeover.id,
    slug: takeover.slug,
    title: takeover.title,
    url: null,
    metadata: takeover.metadata,
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
          {(takeover.metadata?.description || takeover.content) && (
            <div className='max-w-none'>
              <SafeHtml
                content={takeover.metadata?.description || takeover.content || ''}
                type='editorial'
                className='!text-[16px] leading-5 text-almostblack dark:text-white'
              />
            </div>
          )}

          {takeover.metadata?.genres?.length > 0 && (
            <div>
              <div className='flex flex-wrap select-none cursor-default my-3'>
                {takeover.metadata.genres.map(
                  (genre: { id?: string; slug?: string; title?: string; name?: string }) => (
                    <GenreTag key={genre.id || genre.slug} variant='large'>
                      {genre.title || genre.name}
                    </GenreTag>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className='w-full px-5 pt-8'>
        <TakeoverClient takeoverId={takeover.id} takeoverTitle={takeover.title} initialShows={initialEpisodes} />
      </div>
    </div>
  );
}
