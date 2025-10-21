'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { GenreTag } from '@/components/ui/genre-tag';
import { HighlightedText } from '@/components/ui/highlighted-text';
import { formatDateShort } from '@/lib/utils';
import { PlayButton } from './play-button';
import { useMediaPlayer } from './providers/media-player-provider';

interface FeaturedCardProps {
  show: any; // can type more strictly if you have a Show type
  priority?: boolean;
  className?: string;
  href?: string;
  slug: string;
  playable?: boolean;
}

export function FeaturedCard({ show, priority = false, className = '', href }: FeaturedCardProps) {
  const { playShow, pauseShow, selectedShow, isArchivePlaying } = useMediaPlayer();

  const isCurrentShow = selectedShow?.key === show.key;
  const isCurrentlyPlaying = isCurrentShow && isArchivePlaying;

  const handlePlayPause = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isCurrentShow) {
      if (isCurrentlyPlaying) {
        pauseShow();
      } else {
        playShow(show);
      }
    } else {
      playShow(show);
    }
  };

  return (
    <Link
      href={href || `/episode/${show.slug}`}
      className={`block aspect-square ${className}`}
    >
      <Card className='aspect-square overflow-hidden shadow-none relative cursor-pointer border border-almostblack dark:border-white hover:shadow-lg transition-shadow w-full h-full'>
        <CardContent className='p-0 h-full'>
          <div className='relative group w-full h-full'>
            <Image
              src={
                show.metadata?.image?.imgix_url ||
                show.metadata?.image?.url ||
                show.imgix_url ||
                '/image-placeholder.png'
              }
              alt={show.title || show.name || 'Show'}
              fill
              className='object-cover'
              sizes='(max-width: 768px) 100vw, 50vw'
              priority={priority}
              onError={(e: any) => {
                if (e?.currentTarget) {
                  try {
                    e.currentTarget.src = '/image-placeholder.png';
                  } catch {}
                }
              }}
            />
            <div className='absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none z-10' />

            <div className='absolute bottom-0 left-0 right-0 h-1/2 bg-linear-to-t from-almostblack to-transparent flex flex-col justify-end p-4 z-20'>
              <div className='bg-almostblack p-0.5 text-h9 lg:text-h8 leading-none font-display uppercase w-fit'>
                <HighlightedText variant='default'>
                  {show.metadata?.broadcast_date
                    ? formatDateShort(show.metadata.broadcast_date)
                    : 'RECENT SHOW'}
                </HighlightedText>
              </div>
              <h3 className='text-h8 lg:text-h7 xl:text-h6 max-w-[80%] leading-none font-display w-fit'>
                <HighlightedText variant='white'>{show.title}</HighlightedText>
              </h3>
              <div className='flex flex-wrap mt-4'>
                {(show.metadata?.genres || []).slice(0, 3).map((genre: any, genreIndex: number) => (
                  <GenreTag
                    key={genre.id || genreIndex}
                    variant='white'
                  >
                    {genre.title}
                  </GenreTag>
                ))}
                {show?.metadata?.player && (
                  <div className='absolute bottom-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity'>
                    <button
                      onClick={handlePlayPause}
                      className='text-white bg-almostblack rounded-full w-10 h-10 flex items-center justify-center ml-2 transition-colors hover:bg-almostblack/80'
                      aria-label={isCurrentlyPlaying ? 'Pause' : 'Play'}
                    >
                      {isCurrentlyPlaying ? (
                        <svg
                          className='w-4 h-4'
                          fill='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path d='M6 4h4v16H6V4zm8 0h4v16h-4V4z' />
                        </svg>
                      ) : (
                        <svg
                          className='w-4 h-4 ml-0.5'
                          fill='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path d='M8 5v14l11-7z' />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
