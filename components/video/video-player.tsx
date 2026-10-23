'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { VideoObject } from '@/lib/cosmic-config';
import { cn } from '@/lib/utils';
import { buildImgixUrl, QUALITY_PRESETS, isImgixUrl, convertToImgixUrl } from '@/lib/image-utils';
import { getVideoThumbnailUrl } from '@/lib/video-thumbnail';

function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function getVimeoId(url: string): string | null {
  const regExp = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

function optimisePoster(url: string | undefined): string | undefined {
  return url && isImgixUrl(convertToImgixUrl(url))
    ? buildImgixUrl(url, { width: 1280, height: 720, quality: QUALITY_PRESETS.video })
    : url;
}

interface VideoPlayerProps {
  video: VideoObject;
  className?: string;
}

/**
 * YouTube and Vimeo videos open on the editor's thumbnail (or the provider's)
 * and only load the embed when played. A link to the provider sits below for
 * videos that can't play embedded, such as age-restricted YouTube uploads.
 */
export function VideoPlayer({ video, className }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoUrl = video.metadata?.video_url;

  if (!videoUrl) {
    return null;
  }

  const youtubeId = getYouTubeId(videoUrl);
  const vimeoId = getVimeoId(videoUrl);
  const poster = optimisePoster(getVideoThumbnailUrl(video.metadata) || undefined);

  if (youtubeId || vimeoId) {
    const provider = youtubeId ? 'YouTube' : 'Vimeo';
    const embedUrl = youtubeId
      ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`
      : `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0`;

    return (
      <div className={cn('w-full', className)}>
        <div className='relative aspect-video w-full bg-black'>
          {isPlaying ? (
            <iframe
              src={embedUrl}
              title={`${provider} video player`}
              allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
              allowFullScreen
              className='absolute inset-0 w-full h-full'
            />
          ) : (
            <button
              type='button'
              onClick={() => setIsPlaying(true)}
              className='group absolute inset-0 w-full h-full'
              aria-label={`Play ${video.title}`}
            >
              {poster && (
                <img src={poster} alt='' className='absolute inset-0 w-full h-full object-cover' />
              )}
              <span className='absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors'>
                <span className='flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white text-almostblack group-hover:scale-105 transition-transform'>
                  <Play className='h-7 w-7 sm:h-9 sm:w-9 ml-1' fill='currentColor' />
                </span>
              </span>
            </button>
          )}
        </div>
        <a
          href={videoUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-block mt-2 font-mono text-m8 uppercase text-white/70 hover:text-white underline underline-offset-2'
        >
          Watch on {provider}
        </a>
      </div>
    );
  }

  // Direct video files (Cosmic or other sources)
  return (
    <div className={cn('relative aspect-video w-full', className)}>
      <video className='w-full h-full object-cover' controls poster={poster}>
        <source src={videoUrl} type='video/mp4' />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
