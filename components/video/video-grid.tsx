'use client';

import Image from 'next/image';
import Link from 'next/link';
import { VideoObject } from '@/lib/cosmic-config';
import { GenreTag } from '@/components/ui/genre-tag';
import { Card, CardContent } from '@/components/ui/card';

interface VideoGridProps {
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

function getGridClasses(featuredSize?: { key: string; value: string }): string {
  switch (featuredSize?.key) {
    case 'large':
      return 'md:col-span-2 md:row-span-2';
    case 'medium':
      return 'md:col-span-2';
    default:
      return '';
  }
}

function getAspectRatioClass(
  aspectRatio?: { key: string; value: string },
  featuredSize?: { key: string; value: string }
): string {
  if (aspectRatio?.key === 'portrait') {
    return 'aspect-[3/4]';
  }
  if (aspectRatio?.key === 'square') {
    return 'aspect-square';
  }
  if (featuredSize?.key === 'large') {
    return 'aspect-[16/9]';
  }
  return 'aspect-video';
}

export default function VideoGrid({ videos, availableCategories }: VideoGridProps) {
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

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
      {sortedVideos.map((video, index) => {
        const youtubeId = video.metadata?.video_url
          ? getYouTubeThumbnail(video.metadata.video_url)
          : '';
        const vimeoId = video.metadata?.video_url
          ? getVimeoThumbnail(video.metadata.video_url)
          : '';
        const thumbnailUrl =
          video.metadata?.image?.imgix_url || youtubeId || vimeoId || '/image-placeholder.png';

        const categoryObjects = Array.isArray(video.metadata.categories)
          ? video.metadata.categories
              .map(catId =>
                availableCategories.find(
                  cat => cat.id === (typeof catId === 'string' ? catId : catId?.id)
                )
              )
              .filter(Boolean)
          : [];

        const gridClasses = getGridClasses(video.metadata.featured_size);
        const aspectRatioClass = getAspectRatioClass(
          video.metadata.image_aspect_ratio,
          video.metadata.featured_size
        );
        const isLarge = video.metadata.featured_size?.key === 'large';
        const isMedium = video.metadata.featured_size?.key === 'medium';

        return (
          <div
            key={`video-grid-${video.id}-${video.slug}-${video.metadata?.date || ''}-${index}`}
            className={gridClasses}
          >
            <Link href={`/videos/${video.slug}`} className='group block h-full'>
              <Card className='flex flex-col h-full'>
                <CardContent className='flex flex-col flex-1 p-0 border border-white group-hover:border-almostblack'>
                  <div className={`relative ${aspectRatioClass}`}>
                    <Image src={thumbnailUrl} alt={video.title} fill className='object-cover' />
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
                  <div className='relative border-t border-white flex-row flex justify-between pl-2 h-auto w-full bg-almostblack text-white items-center group-hover:bg-white group-hover:text-almostblack group-hover:border-almostblack'>
                    <h3
                      className={`font-bold line-clamp-1 group-hover:text-almostblack ${isLarge ? 'text-[32px] md:text-[40px]' : isMedium ? 'text-[28px]' : 'text-[25px]'}`}
                    >
                      {video.title}
                    </h3>
                    <div
                      className={`border-l border-white px-3 pt-3 pb-2 group-hover:border-almostblack group-hover:text-almostblack select-none ${isLarge ? 'text-[32px] md:text-[40px]' : isMedium ? 'text-[28px]' : 'text-[25px]'}`}
                    >
                      ▶
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            {video.metadata?.description && (
              <div className='mt-2'>
                <p
                  className={`text-muted-foreground ${isLarge ? 'text-base' : 'text-sm line-clamp-2'} mt-2`}
                >
                  {video.metadata.description}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
