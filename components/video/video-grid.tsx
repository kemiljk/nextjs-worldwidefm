'use client';

import Image from 'next/image';
import Link from 'next/link';
import { VideoObject } from '@/lib/cosmic-config';

interface VideoGridProps {
  videos: VideoObject[];
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

export default function VideoGrid({ videos }: VideoGridProps) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
      {videos.map((video, index) => {
        const youtubeId = video.metadata?.video_url
          ? getYouTubeThumbnail(video.metadata.video_url)
          : '';
        const vimeoId = video.metadata?.video_url
          ? getVimeoThumbnail(video.metadata.video_url)
          : '';
        const thumbnailUrl =
          video.metadata?.image?.imgix_url || youtubeId || vimeoId || '/image-placeholder.svg';

        return (
          <Link
            key={`video-grid-${video.id}-${video.slug}-${video.metadata?.date || ''}-${index}`}
            href={`/videos/${video.slug}`}
          >
            <div className='group space-y-3'>
              <div className='relative aspect-[16/9] w-full overflow-hidden rounded-none'>
                <Image
                  src={thumbnailUrl}
                  alt={video.title}
                  fill
                  className='object-cover transition-transform duration-300 group-hover:scale-105'
                />
                <div className='absolute top-2 left-2'>
                  <div className='bg-black/80 text-white text-xs px-3 py-1'>VIDEO</div>
                </div>
              </div>
              <div className='space-y-2'>
                <h3 className='text-lg leading-tight line-clamp-2 group-hover:text-black dark:group-hover:text-white transition-colors'>
                  {video.title}
                </h3>
                {video.metadata?.description && (
                  <p className='text-sm text-muted-foreground line-clamp-2'>
                    {video.metadata.description}
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
