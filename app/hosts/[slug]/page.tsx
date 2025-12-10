import { Metadata } from 'next';
import React from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { getRadioShows, transformShowToViewData } from '@/lib/cosmic-service';
import { cosmic } from '@/lib/cosmic-config';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { EpisodeHero } from '@/components/homepage-hero';
import { SafeHtml } from '@/components/ui/safe-html';
import { GenreTag } from '@/components/ui/genre-tag';
import { getAuthUser, getUserData } from '@/cosmic/blocks/user-management/actions';
import { FavoriteButton } from '@/components/favorite-button';
import { getCanonicalGenres } from '@/lib/get-canonical-genres';
import HostClient from './host-client';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const host = await getHostBySlug(slug);

    if (host) {
      const ogImage = host.metadata?.image?.imgix_url
        ? `${host.metadata.image.imgix_url}?w=1200&h=630&fit=crop&auto=format,compress`
        : undefined;
      return generateBaseMetadata({
        title: `${host.title} - Host - Worldwide FM`,
        description:
          host.metadata?.description || `Listen to shows hosted by ${host.title} on Worldwide FM.`,
        image: ogImage,
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

async function getHostEpisodes(hostId: string, limit: number = 20) {
  try {
    const response = await getRadioShows({
      filters: { host: hostId },
      limit,
      sort: '-metadata.broadcast_date',
    });

    return (response.objects || []).map(transformShowToViewData);
  } catch (error: any) {
    // 404 means no episodes for this host - expected, return empty array
    if (error?.status === 404 || error?.message?.includes('404') || error?.message?.includes('No objects found')) {
      return [];
    }
    // Only log unexpected errors
    console.error(`Error fetching episodes for host ${hostId}:`, error);
    return [];
  }
}

export default async function HostPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  
  const { slug } = await params;

  const host = await getHostBySlug(slug);

  if (!host) {
    notFound();
  }

  const initialEpisodes = await getHostEpisodes(host.id, 20);

  const user = await getAuthUser();
  let isFavorited = false;

  if (user) {
    try {
      const { data: userData } = await getUserData(user.id);
      if (userData?.metadata?.favourite_hosts) {
        const favoriteHostIds = userData.metadata.favourite_hosts.map((h: any) =>
          typeof h === 'string' ? h : h.id
        );
        isFavorited = favoriteHostIds.includes(host.id);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  }

  const displayName = host.title || 'Untitled Host';
  const baseImageUrl = host.metadata?.image?.imgix_url;
  const displayImage = baseImageUrl 
    ? `${baseImageUrl}?w=1200&auto=format,compress`
    : '/image-placeholder.png';

  const canonicalGenres = await getCanonicalGenres();
  const getGenreLink = (genreId: string): string | undefined => {
    if (!canonicalGenres.length) return undefined;
    const canonicalGenre = canonicalGenres.find(genre => genre.id === genreId);
    return canonicalGenre ? `/genre/${canonicalGenre.slug}` : undefined;
  };

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
          <div className='flex items-center justify-between mb-2'>
            <h1 className='text-h6 font-bold tracking-tight'>{displayName}</h1>
            <FavoriteButton item={host as any} type='host' isFavorited={isFavorited} />
          </div>
          {(host.metadata?.description || host.content) && (
            <div className='max-w-none'>
              <SafeHtml
                content={host.metadata?.description || host.content || ''}
                type='editorial'
                className='text-[16px]! leading-5 text-almostblack dark:text-white'
              />
            </div>
          )}

          {host.metadata?.genres?.length > 0 && (
            <div>
              <div className='flex flex-wrap my-3'>
                {host.metadata.genres.map(
                  (genre: { id?: string; slug?: string; title?: string; name?: string }) => {
                    const genreLink = genre.id ? getGenreLink(genre.id) : undefined;
                    return (
                      <GenreTag key={genre.id || genre.slug} variant='large' href={genreLink}>
                        {genre.title || genre.name}
                      </GenreTag>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className='w-full px-5 pt-8'>
        <HostClient hostId={host.id} hostTitle={host.title} initialShows={initialEpisodes} />
      </div>
    </div>
  );
}
