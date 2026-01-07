'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { VideoObject } from '@/lib/cosmic-config';
import { VideoThumbnailImage } from '@/components/ui/optimized-image';

interface Video extends VideoObject {}

interface VideoSectionProps {
  videos: Video[];
  className?: string;
}

// Helper function to extract YouTube video ID from URL
function getYouTubeThumbnail(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);

  if (match && match[2].length === 11) {
    return `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`;
  }

  return null;
}

// Helper function to extract Vimeo video ID from URL
function getVimeoThumbnail(url: string) {
  const regExp = /vimeo\.com\/(\d+)/;
  const match = url.match(regExp);

  if (match) {
    return `https://vumbnail.com/${match[1]}.jpg`;
  }

  return null;
}

export default function VideoSection({ videos, className }: VideoSectionProps) {
  const latestVideos = videos.slice(-3);
  const isTwoVideos = latestVideos.length === 2;
  const firstVideo = latestVideos[0];
  const otherVideos = latestVideos.slice(1);

  return (
    <section className={cn('', 'bg-black mt-30 h-auto px-5 text-white pb-30', className)}>
      <div className='flex items-end justify-between pt-10 pb-4'>
        <h2 className='text-h8 md:text-h7 font-bold'>VIDEO</h2>
        <Link
          href='/videos'
          className='inline-flex items-center font-mono text-m8 sm:text-m7 uppercase whitespace-nowrap hover:underline transition-all'
        >
          View All
          <ChevronRight className='h-4 w-4 ml-1 transition-transform' />
        </Link>
      </div>
      <div className={isTwoVideos ? 'flex flex-col sm:flex-row gap-3 h-auto w-full' : 'flex flex-col sm:flex-row gap-3 h-auto w-full'}>
        {/* First video card - 65% width */}
        {firstVideo && (
          <div className={cn(isTwoVideos ? 'w-full sm:w-1/2 aspect-video' : 'w-full sm:w-[65%] h-full')}>
            <Link href={`/videos/${firstVideo.slug}`} className='w-full h-full'>
              <Card className='overflow-hidden transition-shadow border border-white group hover:bg-white hover:text-almostblack'>
                <CardContent className='p-0 flex flex-col aspect-video w-full'>
                  {/* Image takes remaining space */}
                  <div className='relative flex-1'>
                    <VideoThumbnailImage
                      src={
                        firstVideo.metadata?.external_image_url ||
                        firstVideo.metadata?.image?.imgix_url ||
                        (firstVideo.metadata?.video_url
                          ? getYouTubeThumbnail(firstVideo.metadata.video_url)
                          : null) ||
                        (firstVideo.metadata?.video_url
                          ? getVimeoThumbnail(firstVideo.metadata.video_url)
                          : null) ||
                        '/image-placeholder.png'
                      }
                      alt={firstVideo.title}
                      className='object-cover'
                      large
                    />
                  </div>

                  {/* Title & border */}
                  <div className='relative border-t border-white flex-row flex justify-between pl-2 h-auto w-full bg-almostblack text-white items-center group-hover:bg-white group-hover:text-almostblack group-hover:border-black'>
                    <h3 className='text-[25px] font-bold line-clamp-1 group-hover:text-almostblack'>
                      {firstVideo.title}
                    </h3>
                    <div className='border-l border-white text-[25px] px-3 pt-2 group-hover:border-almostblack group-hover:text-almostblack'>
                      {' '}
                      ▶{' '}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
        <div className={cn('flex gap-3 justify-between', isTwoVideos ? 'flex-row w-full sm:w-1/2 aspect-video' : 'w-full sm:w-[35%] flex-col h-full')}>
          {otherVideos.map(video => {
            const youtubeId = video.metadata?.video_url
              ? getYouTubeThumbnail(video.metadata.video_url)
              : '';
            const vimeoId = video.metadata?.video_url
              ? getVimeoThumbnail(video.metadata.video_url)
              : '';
            const thumbnailUrl =
              video.metadata?.external_image_url || video.metadata?.image?.imgix_url || youtubeId || vimeoId || '/image-placeholder.png';

            return (
              <Link key={video.id} href={`/videos/${video.slug}`} className='w-full flex-1'>
                <Card className='overflow-hidden transition-shadow border border-white group hover:bg-white hover:text-almostblack'>
                  <CardContent className='p-0 flex flex-col aspect-video h-auto w-full'>
                    <div className='relative flex-1'>
                      <VideoThumbnailImage src={thumbnailUrl} alt={video.title} className='object-cover' />
                    </div>
                    <div className='relative border-t border-white flex-row flex justify-between pl-2 h-auto w-auto bg-almostblack text-white items-center group-hover:bg-white group-hover:text-almostblack group-hover:border-black'>
                      <h3 className='text-[25px] font-bold line-clamp-1 group-hover:text-almostblack'>
                        {video.title}
                      </h3>
                      <div className='border-l border-white text-[25px] px-3 pt-2 group-hover:border-almostblack group-hover:text-almostblack'>
                        {' '}
                        ▶{' '}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
