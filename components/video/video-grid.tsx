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
  // Extract video ID from various YouTube URL formats
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`;
  }
  return '';
}

function getVimeoThumbnail(url: string): string {
  // Extract video ID from Vimeo URL
  const regExp = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
  const match = url.match(regExp);
  if (match && match[1]) {
    return `https://vumbnail.com/${match[1]}.jpg`;
  }
  return '';
}

export default function VideoGrid({ videos, availableCategories }: VideoGridProps) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3'>
      {videos.map((video, index) => {
        const youtubeId = video.metadata?.video_url
          ? getYouTubeThumbnail(video.metadata.video_url)
          : '';
        const vimeoId = video.metadata?.video_url
          ? getVimeoThumbnail(video.metadata.video_url)
          : '';
        const thumbnailUrl =
          video.metadata?.image?.imgix_url || youtubeId || vimeoId || '/image-placeholder.png';

        // Map category IDs to full objects
        const categoryObjects = Array.isArray(video.metadata.categories)
          ? video.metadata.categories
              .map(catId =>
                availableCategories.find(
                  cat => cat.id === (typeof catId === 'string' ? catId : catId?.id)
                )
              )
              .filter(Boolean)
          : [];

        console.log('Video categories for', video.title, ':', video.metadata.categories);

        return (
          <div key={`video-grid-${video.id}-${video.slug}-${video.metadata?.date || ''}-${index}`}>
            <Link href={`/videos/${video.slug}`} className='group block'>
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
                  <div className='relative border-t border-white flex-row flex justify-between pl-2 h-auto w-full bg-almostblack text-white items-center group-hover:bg-white group-hover:text-almostblack group-hover:border-almostblack'>
                    <h3 className='text-[25px] font-bold line-clamp-1 group-hover:text-almostblack'>
                      {video.title}
                    </h3>
                    <div className='border-l border-white text-[25px] px-3 pt-3 pb-2 group-hover:border-almostblack group-hover:text-almostblack select-none'>
                      ▶
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <div className='mt-2'>
              {video.metadata?.description && (
                <p className='text-sm text-muted-foreground line-clamp-2 mt-2'>
                  {video.metadata.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
