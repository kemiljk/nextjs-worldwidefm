'use client';

import Link from 'next/link';
import { VideoObject } from '@/lib/cosmic-config';
import { GenreTag } from '@/components/ui/genre-tag';
import { Card, CardContent } from '@/components/ui/card';

interface FeaturedVideoContentProps {
  videos: VideoObject[];
  availableCategories: { id: string; title: string }[];
}

function getYouTubeThumbnail(url: string): string {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`;
  }
  return '';
}

function getVimeoThumbnail(url: string): string {
  const regExp = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
  const match = url.match(regExp);
  if (match && match[1]) {
    return `https://vumbnail.com/${match[1]}.jpg`;
  }
  return '';
}

export default function FeaturedVideoContent({
  videos,
  availableCategories,
}: FeaturedVideoContentProps) {
  if (!videos.length) return null;

  const sortedVideos = [...videos].sort((a, b) => {
    const aSize =
      a.metadata.featured_size?.key === 'large'
        ? 3
        : a.metadata.featured_size?.key === 'medium'
          ? 2
          : 1;
    const bSize =
      b.metadata.featured_size?.key === 'large'
        ? 3
        : b.metadata.featured_size?.key === 'medium'
          ? 2
          : 1;
    return bSize - aSize;
  });

  const featuredVideo = sortedVideos[0];
  const youtubeId = featuredVideo.metadata?.video_url
    ? getYouTubeThumbnail(featuredVideo.metadata.video_url)
    : '';
  const vimeoId = featuredVideo.metadata?.video_url
    ? getVimeoThumbnail(featuredVideo.metadata.video_url)
    : '';
  const thumbnailUrl =
    featuredVideo.metadata?.image?.imgix_url || youtubeId || vimeoId || '/image-placeholder.png';

  const categoryObjects = Array.isArray(featuredVideo.metadata.categories)
    ? featuredVideo.metadata.categories
        .map(catId =>
          availableCategories.find(
            cat => cat.id === (typeof catId === 'string' ? catId : catId?.id)
          )
        )
        .filter(Boolean)
    : [];

  const aspectRatioClass =
    featuredVideo.metadata.image_aspect_ratio?.key === 'portrait'
      ? 'aspect-[3/4]'
      : featuredVideo.metadata.image_aspect_ratio?.key === 'square'
        ? 'aspect-square'
        : 'aspect-video';

  return (
    <div className='py-10 w-full items-center justify-center flex h-auto'>
      <div className='w-full max-w-4xl'>
        <Link href={`/videos/${featuredVideo.slug}`} className='group block'>
          <Card className='flex flex-col h-full'>
            <CardContent className='flex flex-col flex-1 p-0 border border-white group-hover:border-almostblack'>
              <div className={`relative ${aspectRatioClass} w-full`}>
                <img
                  src={thumbnailUrl}
                  alt={featuredVideo.title}
                  className='absolute inset-0 w-full h-full object-cover'
                />
                {categoryObjects.length > 0 && (
                  <div className='absolute top-3 left-3 flex flex-wrap gap-1'>
                    {categoryObjects.map(cat =>
                      cat ? (
                        <GenreTag key={cat.id} className='border-white text-white'>
                          {cat.title}
                        </GenreTag>
                      ) : null
                    )}
                  </div>
                )}
              </div>
              <div className='relative border-t border-white flex-row flex justify-between pl-4 min-h-[60px] w-full bg-almostblack text-white items-stretch group-hover:bg-white group-hover:text-almostblack group-hover:border-almostblack'>
                <h3 className='text-[24px] sm:text-[28px] md:text-[32px] lg:text-[40px] font-bold py-3 pr-4 flex-1 leading-tight group-hover:text-almostblack'>
                  {featuredVideo.title}
                </h3>
                <div className='border-l border-white text-[24px] sm:text-[28px] md:text-[32px] lg:text-[40px] px-4 flex items-center group-hover:border-almostblack group-hover:text-almostblack select-none shrink-0'>
                  ▶
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        {featuredVideo.metadata?.description && (
          <p className='text-base text-muted-foreground mt-4'>
            {featuredVideo.metadata.description}
          </p>
        )}
      </div>
    </div>
  );
}

