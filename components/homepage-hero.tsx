'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateShort } from '@/lib/utils';
import { GenreObject } from '@/lib/cosmic-config';
import { PlayButton } from '@/components/play-button';
import { HighlightedText } from '@/components/ui/highlighted-text';
import { useMediaPlayer } from '@/components/providers/media-player-provider';
import { HeroImage, ResponsiveCardImage } from '@/components/ui/optimized-image';

// Using any for now since heroItems come from transformed show data
interface HomepageHeroProps {
  heroLayout: string;
  heroItems: any[];
}

const HeroItem = ({ item, isPriority }: { item: any; isPriority: boolean }) => {
  const { playShow, pauseShow, selectedShow, isArchivePlaying } = useMediaPlayer();

  const href =
    item.type === 'episode' || item.type === 'episodes'
      ? `/episode/${item.slug}`
      : item.type === 'posts'
        ? `/editorial/${item.slug}`
        : '#';

  // Check if this item has audio content and can be played
  const isEpisode = item.type === 'episode' || item.type === 'episodes';
  const hasAudioContent = item.url || item.metadata?.player;
  const shouldShowPlayButton = isEpisode && hasAudioContent;

  // Check if this specific episode is currently playing
  const isCurrentlyPlaying = isArchivePlaying && selectedShow?.slug === item.slug;

  const handlePlayPause = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isCurrentlyPlaying) {
      pauseShow();
    } else {
      playShow(item);
    }
  };

  return (
    <Card
      key={item.slug}
      className='overflow-hidden shadow-none rounded-none relative cursor-pointer m-0 h-full flex flex-col group'
    >
      <Link href={href} className='flex flex-col h-full'>
        <CardContent className='p-0 grow flex flex-col'>
          <div className='relative w-full h-[90vh] flex items-center justify-center'>
            <HeroImage
              src={
                item.metadata?.external_image_url ||
                item.metadata?.image?.imgix_url ||
                item.metadata?.image?.url ||
                '/image-placeholder.png'
              }
              alt={item.title || 'Hero item'}
              className='object-cover'
              priority={isPriority}
            />
            {/* Play button for episodes */}
            {shouldShowPlayButton && (
              <div className='absolute bottom-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity'>
                <button
                  onClick={handlePlayPause}
                  className='text-white bg-almostblack rounded-full w-12 h-12 flex items-center justify-center transition-colors hover:bg-almostblack/80'
                  aria-label={isCurrentlyPlaying ? 'Pause' : 'Play'}
                >
                  {isCurrentlyPlaying ? (
                    <svg className='w-5 h-5' fill='currentColor' viewBox='0 0 24 24'>
                      <path d='M6 4h4v16H6V4zm8 0h4v16h-4V4z' />
                    </svg>
                  ) : (
                    <svg className='w-5 h-5 ml-0.5' fill='currentColor' viewBox='0 0 24 24'>
                      <path d='M8 5v14l11-7z' />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
          <div className='absolute bottom-0 left-0 right-0 flex bg-linear-to-t from-almostblack to-transparent h-1/2 flex-col p-4 flex-1 justify-end'>
            <div className='bg-almostblack uppercase text-white w-fit text-h8 leading-none font-display pt-1 px-1 text-left'>
              {(item.metadata?.date && formatDateShort(item.metadata.date)) ||
                (item.metadata?.broadcast_date && formatDateShort(item.metadata.broadcast_date))}
            </div>
            <h3 className='text-h7 max-w-2xl leading-none font-display w-fit'>
              <HighlightedText variant='white'>{item.title}</HighlightedText>
            </h3>
            {item.metadata?.broadcast_time && (
              <p className='text-m5 font-mono text-white max-w-xl mt-2 line-clamp-3 text-left'>
                {item.metadata.broadcast_time}
              </p>
            )}
            {item.metadata?.genres && (
              <div className='flex items-center'>
                {item.metadata.genres.map((genre: GenreObject) => (
                  <p
                    key={genre.id}
                    className='text-m7 font-mono uppercase text-white border border-white rounded-full px-2 py-1 max-w-xl mt-2 line-clamp-3 text-left'
                  >
                    {genre.title}
                  </p>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
};

const renderHeroItem = (item: any, isPriority: boolean) => {
  return <HeroItem item={item} isPriority={isPriority} />;
};

const HomepageHero: React.FC<HomepageHeroProps> = ({ heroLayout, heroItems }) => {
  if (!heroItems || heroItems.length === 0) {
    return null; // Fallback to FeaturedSections is handled in page.tsx
  }

  if (heroLayout === 'Split') {
    const item1 = heroItems[0];
    const item2 = heroItems.length > 1 ? heroItems[1] : null;

    return (
      <div className='grid grid-cols-1 md:grid-cols-2 gap-3 pt-5 px-5 relative z-10'>
        <div className='flex flex-col h-full'>{item1 && renderHeroItem(item1, true)}</div>
        <div className='h-full'>
          <div className='flex flex-col h-full'>{item2 && renderHeroItem(item2, false)}</div>
        </div>
      </div>
    );
  } else if (heroLayout === 'Full Width' || heroLayout === 'FullWidth') {
    const item1 = heroItems[0];
    if (!item1) return null;
    return <div className='relative z-10 w-full'>{renderHeroItem(item1, true)}</div>;
  }

  console.warn(
    `HomepageHero: Encountered an unexpected or not-yet-implemented heroLayout: "${heroLayout}"`
  );
  return (
    <div>
      <h2 className='text-h7 font-display uppercase text-almostblack dark:text-white mb-2'>
        Hero Section (Layout: {heroLayout})
      </h2>
      <p className='text-red-500 font-semibold'>
        Warning: Layout '{heroLayout}' is not recognized or fully implemented for the Hero section.
      </p>
    </div>
  );
};

// New: EpisodeHero for episode pages
export const EpisodeHero = ({
  displayName,
  displayImage,
  showDate,
  show,
}: {
  displayName: string;
  displayImage: string;
  showDate: string;
  show: any;
}) => {
  if (!displayImage || !displayName) return null;

  // Since we now filter episodes at fetch level, all episodes have audio content
  // For other content, check if there's actual audio content
  const isEpisode = show?.__source === 'episode' || show?.episodeData || show?.type === 'episode';
  const hasAudioContent = show?.url || show?.player || show?.metadata?.player;

  return (
    <div className='relative w-full h-[80vh] sm:h-200 aspect-2/1 flex flex-col justify-center overflow-hidden'>
      {/* Overlay: soft blur + blend */}
      <div className='absolute inset-0 w-full h-full z-10 bg-blend-multiply backdrop-blur-[20px] pointer-events-none' />

      <div className='absolute inset-0 w-full h-full z-20 pointer-events-none'>
        <div
          className='w-full h-full'
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
            mixBlendMode: 'color-burn',
            opacity: '50%',
          }}
        />
      </div>
      <HeroImage
        src={displayImage}
        alt={displayName}
        className='object-cover object-center w-full h-full select-none pointer-events-none'
        priority
      />
      {/* Overlay: Play Button and Text - Always show artwork and title */}
      <div className='relative inset-0 flex justify-center pt-5 z-30'>
        <div className='flex flex-col md:max-w-full md:flex-row gap-10 px-10 items-start md:items-center '>
          <div className='relative w-[80vw] sm:w-[400px] md:w-[450px] lg:w-[600px] aspect-square border border-almostblack z-30'>
            <ResponsiveCardImage
              src={displayImage}
              alt={displayName}
              className='object-cover object-center w-full h-full select-none pointer-events-none'
              priority
              aspectRatio='square'
              sizes='(max-width: 640px) 80vw, (max-width: 768px) 400px, (max-width: 1024px) 450px, 600px'
            />
            {/* Only show play button if there's audio content */}
            {(isEpisode || hasAudioContent) && show?.metadata?.player && (
              <PlayButton
                show={show}
                variant='default'
                className='z-50 absolute bottom-0 right-0 m-5 rounded-full shadow-xl h-13 aspect-square flex items-center justify-center text-white bg-almostblack/90 hover:bg-almostblack hover:cursor-pointer'
                label={false}
              />
            )}
          </div>
          <div className='flex flex-col pb-2 md:flex-1  w-[80vw] sm:w-[400px] md:w-[500px]'>
            {showDate && (
              <span className='inline-block bg-almostblack text-white font-display text-h8 leading-none uppercase w-fit px-1 text-left shadow-lg border border-almostblack'>
                {showDate}
              </span>
            )}
            <span className='text-h7 leading-none font-display w-fit uppercase font-bold '>
              <HighlightedText variant='white'>{displayName}</HighlightedText>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomepageHero;
