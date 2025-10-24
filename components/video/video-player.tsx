'use client';

import { useState, useEffect } from 'react';
import { VideoObject } from '@/lib/cosmic-config';
import { cn } from '@/lib/utils';

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

interface VideoPlayerProps {
  video: VideoObject;
  className?: string;
}

export function VideoPlayer({ video, className }: VideoPlayerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const videoUrl = video.metadata?.video_url;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !videoUrl) {
    return null;
  }

  const youtubeId = getYouTubeId(videoUrl);
  const vimeoId = getVimeoId(videoUrl);

  if (youtubeId) {
    return (
      <div className={cn('relative aspect-video w-full', className)}>
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0`}
          title='YouTube video player'
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
          allowFullScreen
          className='absolute inset-0 w-full h-full'
        />
      </div>
    );
  }

  if (vimeoId) {
    return (
      <div className={cn('relative aspect-video w-full', className)}>
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}?autoplay=0&title=0&byline=0&portrait=0`}
          title='Vimeo video player'
          allow='autoplay; fullscreen; picture-in-picture'
          allowFullScreen
          className='absolute inset-0 w-full h-full'
        />
      </div>
    );
  }

  // Handle direct video URLs (Cosmic or other sources)
  return (
    <div className={cn('relative aspect-video w-full', className)}>
      <video
        className='w-full h-full object-cover'
        controls
        poster={video.metadata?.image?.imgix_url}
      >
        <source src={videoUrl} type='video/mp4' />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
