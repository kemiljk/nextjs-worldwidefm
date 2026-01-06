'use client';

import Image from 'next/image';
import Link from 'next/link';
import { VideoObject } from '@/lib/cosmic-config';
import { GenreTag } from '@/components/ui/genre-tag';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface VideoCategorySectionProps {
  title: string;
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

export default function VideoCategorySection({
  title,
  videos,
  availableCategories,
}: VideoCategorySectionProps) {
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

  return (
    <section className='mb-12'>
      <h3 className='text-h8 md:text-[32px] tracking-tight font-display uppercase font-normal text-almostblack dark:text-white mb-4 border-b border-almostblack/20 dark:border-white/20 pb-2'>
        {title}
      </h3>
      <div className='relative'>
        <Carousel
          opts={{
            align: 'start',
            loop: false,
          }}
          className='w-full'
        >
          <CarouselContent className='-ml-3'>
            {sortedVideos.map((video, index) => {
              const youtubeId = video.metadata?.video_url
                ? getYouTubeThumbnail(video.metadata.video_url)
                : '';
              const vimeoId = video.metadata?.video_url
                ? getVimeoThumbnail(video.metadata.video_url)
                : '';
              const thumbnailUrl =
                video.metadata?.external_image_url || video.metadata?.image?.imgix_url || youtubeId || vimeoId || '/image-placeholder.png';

              const categoryObjects = Array.isArray(video.metadata.categories)
                ? video.metadata.categories
                    .map(catId =>
                      availableCategories.find(
                        cat => cat.id === (typeof catId === 'string' ? catId : catId?.id)
                      )
                    )
                    .filter(Boolean)
                : [];

              return (
                <CarouselItem
                  key={`video-cat-${video.id}-${video.slug}-${index}`}
                  className='pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3'
                >
                  <Link href={`/videos/${video.slug}`} className='group block h-full'>
                    <Card className='flex flex-col h-full'>
                      <CardContent className='flex flex-col flex-1 p-0 border border-white group-hover:border-almostblack'>
                        <div className='relative aspect-video'>
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
                        <div className='relative border-t border-white flex-row flex justify-between pl-2 min-h-[48px] w-full bg-almostblack text-white items-stretch group-hover:bg-white group-hover:text-almostblack group-hover:border-almostblack'>
                          <h3 className='font-bold py-2 pr-2 flex-1 leading-tight text-[18px] sm:text-[20px] group-hover:text-almostblack'>
                            {video.title}
                          </h3>
                          <div className='border-l border-white px-3 flex items-center group-hover:border-almostblack group-hover:text-almostblack select-none shrink-0 text-[18px] sm:text-[20px]'>
                            ▶
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          {sortedVideos.length > 3 && (
            <>
              <CarouselPrevious className='hidden sm:flex -left-4 bg-white dark:bg-almostblack border-almostblack dark:border-white' />
              <CarouselNext className='hidden sm:flex -right-4 bg-white dark:bg-almostblack border-almostblack dark:border-white' />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
}
