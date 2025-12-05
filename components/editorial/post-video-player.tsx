'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PostObject } from '@/lib/cosmic-config';
import { cn } from '@/lib/utils';
import { getPostVideoUrl, getPostVideoThumbnail } from '@/lib/post-thumbnail-utils';

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

interface PostVideoPlayerProps {
  post: PostObject;
  className?: string;
}

export function PostVideoPlayer({ post, className }: PostVideoPlayerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const videoUrl = getPostVideoUrl(post);
  const thumbnail = getPostVideoThumbnail(post);
  const metadata = post.metadata;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !videoUrl) {
    return null;
  }

  const youtubeId = getYouTubeId(videoUrl);
  const vimeoId = getVimeoId(videoUrl);

  const potentialThumbnails = [
    metadata?.youtube_video_thumbnail?.imgix_url 
      ? `${metadata.youtube_video_thumbnail.imgix_url}?w=1200&h=675&fit=crop&auto=format,compress`
      : null,
    metadata?.youtube_video_thumbnail?.url,
    metadata?.video_thumbnail?.imgix_url
      ? `${metadata.video_thumbnail.imgix_url}?w=1200&h=675&fit=crop&auto=format,compress`
      : null,
    metadata?.video_thumbnail?.url,
  ];
  const providedThumbnail = potentialThumbnails.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
  const hasProvidedThumbnail = Boolean(providedThumbnail);

  // Debug logging
  console.log('PostVideoPlayer Debug:', {
    postTitle: post.title,
    youtubeId,
    hasProvidedThumbnail,
    providedThumbnail,
    youtube_video_thumbnail: metadata?.youtube_video_thumbnail,
    video_thumbnail: metadata?.video_thumbnail,
    metadataKeys: metadata ? Object.keys(metadata) : [],
  });

  // For YouTube videos, only show thumbnail with link if there's a provided thumbnail
  if (youtubeId && hasProvidedThumbnail && providedThumbnail) {
    return (
      <Link
        href={videoUrl}
        target='_blank'
        rel='noopener noreferrer'
        className={cn('relative aspect-video w-full group overflow-hidden block', className)}
      >
        <img
          src={providedThumbnail}
          alt={`${post.title || 'Video'} - Click to watch on YouTube`}
          className='w-full h-full object-cover'
        />
        <div className='absolute inset-0 group-hover:bg-black/20 transition-all flex items-center justify-center'>
          <div className='w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30 shadow-lg'>
            <svg
              className='w-8 h-8 text-white ml-0.5'
              fill='currentColor'
              viewBox='0 0 24 24'
            >
              <path d='M8 5v14l11-7z' />
            </svg>
          </div>
        </div>
      </Link>
    );
  }

  // If YouTube but no provided thumbnail, show embed
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

  return (
    <div className={cn('relative aspect-video w-full', className)}>
      <video
        className='w-full h-full object-cover'
        controls
        poster={thumbnail || undefined}
      >
        <source src={videoUrl} type='video/mp4' />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

