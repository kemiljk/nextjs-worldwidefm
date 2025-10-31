import { Metadata } from 'next';
import React from 'react';
import { notFound } from 'next/navigation';
import { getRadioShows } from '@/lib/cosmic-service';
import { cosmic } from '@/lib/cosmic-config';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { transformShowToViewData } from '@/lib/cosmic-service';
import { EpisodeHero } from '@/components/homepage-hero';
import { SafeHtml } from '@/components/ui/safe-html';
import { GenreTag } from '@/components/ui/genre-tag';
import { ShowCard } from '@/components/ui/show-card';

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const host = await getHostBySlug(slug);

    if (host) {
      return generateBaseMetadata({
        title: `${host.title} - Host - Worldwide FM`,
        description:
          host.metadata?.description || `Listen to shows hosted by ${host.title} on Worldwide FM.`,
        image: host.metadata?.image?.imgix_url,
        keywords: ['host', 'dj', 'presenter', 'radio', 'worldwide fm', host.title.toLowerCase()],
      });
    }

    return generateBaseMetadata({
      title: 'Host Not Found - Worldwide FM',
      description: 'The requested host could not be found.',
      noIndex: true,
    });
  } catch (error) {
    console.error('Error generating host metadata:', error);
    return generateBaseMetadata({
      title: 'Host Not Found - Worldwide FM',
      description: 'The requested host could not be found.',
      noIndex: true,
    });
  }
}

export async function generateStaticParams() {
  try {
    const response = await cosmic.objects
      .find({
        type: 'regular-hosts',
        status: 'published',
      })
      .props('slug')
      .limit(1000);

    const params =
      response.objects?.map((host: { slug: string }) => ({
        slug: host.slug,
      })) || [];

    return params;
  } catch (error) {
    console.error('Error generating static params for hosts:', error);
    return [];
  }
}

async function getHostBySlug(slug: string) {
  try {
    const response = await cosmic.objects
      .findOne({
        type: 'regular-hosts',
        slug: slug,
      })
      .props('id,slug,title,content,metadata')
      .depth(2);

    return response?.object || null;
  } catch (error) {
    console.error(`Error fetching host by slug ${slug}:`, error);
    return null;
  }
}

async function getRelatedShows(hostId: string, limit: number = 12) {
  try {
    const response = await getRadioShows({
      filters: { host: hostId },
      limit,
      sort: '-metadata.broadcast_date',
    });

    return (response.objects || []).map(transformShowToViewData);
  } catch (error) {
    console.error(`Error fetching related shows for host ${hostId}:`, error);
    return [];
  }
}

export default async function HostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const host = await getHostBySlug(slug);

  if (!host) {
    notFound();
  }

  const relatedShows = await getRelatedShows(host.id, 12);

  const displayName = host.title || 'Untitled Host';
  const displayImage = host.metadata?.image?.imgix_url || '/image-placeholder.png';

  const show = {
    id: host.id,
    slug: host.slug,
    title: host.title,
    url: null,
    metadata: host.metadata,
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
          {(host.metadata?.description || host.content) && (
            <div className='max-w-none'>
              <SafeHtml
                content={host.metadata?.description || host.content || ''}
                type='editorial'
                className='!text-[16px] leading-5 text-almostblack dark:text-white'
              />
            </div>
          )}

          {host.metadata?.genres?.length > 0 && (
            <div>
              <div className='flex flex-wrap select-none cursor-default my-3'>
                {host.metadata.genres.map(
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

      {relatedShows.length > 0 && (
        <div className='w-full px-5 pt-8'>
          <div>
            <h2 className='text-h8 md:text-h7 font-bold tracking-tight leading-none mb-3'>
              RELATED EPISODES
            </h2>
            <div className='grid grid-cols-2 lg:grid-cols-4 md:grid-cols-3 gap-3'>
              {relatedShows.map(relatedShow => {
                const slug = `/episode/${relatedShow.slug}`;
                return (
                  <ShowCard
                    key={relatedShow.id || relatedShow.slug}
                    show={relatedShow}
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
