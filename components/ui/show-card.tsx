'use client';

import { Play, Pause, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMediaPlayer } from '../providers/media-player-provider';
import { GenreTag } from './genre-tag';
import { ResponsiveCardImage } from './optimized-image';
import type { CanonicalGenre } from '@/lib/get-canonical-genres';
import { getUKTimezoneAbbreviation } from '@/lib/date-utils';

interface ShowCardProps {
  show: any; // Using any to work with both episode and legacy show formats
  slug: string;
  className?: string;
  playable?: boolean;
  variant?: 'default' | 'light';
  canonicalGenres?: CanonicalGenre[];
  isSaved?: boolean;
}

export const ShowCard: React.FC<ShowCardProps> = ({
  show,
  slug,
  className = '',
  playable = true,
  variant = 'default',
  canonicalGenres = [],
  isSaved = false,
}) => {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const isEpisode = show?.__source === 'episode' || show?.episodeData || show?.type === 'episode';
  const hasAudioContent = show?.url || show?.player || show?.metadata?.player;
  const shouldShowPlayButton = playable && show?.metadata?.player;
  const { playShow, pauseShow, selectedShow, isArchivePlaying } = useMediaPlayer();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isCurrentShow = selectedShow?.key === show.key;
  const isCurrentlyPlaying = isCurrentShow && isArchivePlaying;
  const handlePlayPause = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // For episodes without player URL, try to play anyway (might have fallback logic)
    // For non-episodes, require audio content
    if (!isEpisode && !hasAudioContent) return;

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

  const getShowImage = (show: any) => {
    // Check external_image_url first (cold storage for old episodes)
    if (show.metadata?.external_image_url) {
      return show.metadata.external_image_url;
    }
    return show.metadata?.image?.imgix_url || show.metadata?.image?.url || '/image-placeholder.png';
  };

  const getShowTags = (show: any): Array<{ id: string; title: string }> => {
    // Try to get genre objects with IDs first
    if (show.metadata?.genres && Array.isArray(show.metadata.genres)) {
      return show.metadata.genres
        .filter((genre: any) => genre.id && genre.title)
        .slice(0, 3)
        .map((genre: any) => ({ id: genre.id, title: genre.title }));
    }
    if (show.enhanced_genres && Array.isArray(show.enhanced_genres)) {
      return show.enhanced_genres
        .filter((genre: any) => genre.id && genre.title)
        .slice(0, 3)
        .map((genre: any) => ({ id: genre.id, title: genre.title }));
    }
    if (show.genres && Array.isArray(show.genres)) {
      return show.genres
        .filter((genre: any) => genre.id && genre.title)
        .slice(0, 3)
        .map((genre: any) => ({ id: genre.id, title: genre.title }));
    }
    // Fallback to legacy tags format
    if (show.tags && Array.isArray(show.tags)) {
      return show.tags
        .filter((tag: any) => tag.name?.toLowerCase() !== 'worldwide fm')
        .slice(0, 3)
        .map((tag: any) => ({
          id: tag.key || tag.slug || tag.name || tag.title || tag,
          title: tag.name || tag.title || tag,
        }));
    }
    return [];
  };

  // Map genre IDs to canonical genre slugs for linking
  const getGenreLink = (genreId: string): string | undefined => {
    if (!canonicalGenres.length) return undefined;

    const canonicalGenre = canonicalGenres.find(genre => genre.id === genreId);

    return canonicalGenre ? `/genre/${canonicalGenre.slug}` : undefined;
  };

  const formatShowTime = (
    broadcastDate: string | undefined,
    broadcastTime: string | undefined
  ): string | null => {
    if (!broadcastDate) return null;

    // Combine date and time to create a valid datetime
    let dateString = broadcastDate;
    if (broadcastTime) {
      // If broadcastDate is just "YYYY-MM-DD", combine with time
      if (/^\d{4}-\d{2}-\d{2}$/.test(broadcastDate)) {
        dateString = `${broadcastDate}T${broadcastTime}:00Z`;
      } else if (broadcastDate.includes('T')) {
        // If it already has time info, use it
        dateString = broadcastDate;
      } else {
        dateString = `${broadcastDate}T${broadcastTime}:00Z`;
      }
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(broadcastDate)) {
      // If no time provided, use midnight UTC
      dateString = `${broadcastDate}T00:00:00Z`;
    }

    const date = new Date(dateString);

    // Validate date
    if (isNaN(date.getTime()) || !isFinite(date.getTime())) {
      return null;
    }

    const time = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
      hour12: false,
    });
    const timezone = getUKTimezoneAbbreviation(date);
    return `${time} ${timezone}`;
  };

  const showImage = getShowImage(show);
  const showTags = getShowTags(show);

  // Prefer broadcast_date for date display and created_time (combined with broadcast_time) for time display
  const broadcastDate: string | undefined =
    show.broadcast_date || show.metadata?.broadcast_date || show.date;
  const broadcastTime: string | undefined = show.metadata?.broadcast_time;
  const showName = show.name || show.title || 'Untitled Show';
  const showHost = show.user?.name || show.host || '';
  const formattedTime = formatShowTime(broadcastDate, broadcastTime);
  const formattedDate = broadcastDate
    ? (() => {
        // Handle date in YYYY-MM-DD format
        let date: Date;
        if (/^\d{4}-\d{2}-\d{2}$/.test(broadcastDate)) {
          date = new Date(`${broadcastDate}T00:00:00Z`);
        } else {
          date = new Date(broadcastDate);
        }

        // Validate date
        if (isNaN(date.getTime()) || !isFinite(date.getTime())) {
          return null;
        }

        const months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = months[date.getUTCMonth()];
        const year = date.getUTCFullYear();
        return `${day} ${month} ${year}`;
      })()
    : null;
  const primaryLocationName: string | undefined =
    show.location?.name ||
    show.location?.title ||
    show.metadata?.location?.name ||
    show.metadata?.location?.title ||
    show.metadata?.locations?.[0]?.title ||
    show.metadata?.locations?.[0]?.name ||
    show.locations?.[0]?.title ||
    show.locations?.[0]?.name;

  // Split showName for two-line title (Figma: first line main, second line host/guest)
  const [mainTitle, ...restTitle] = showName.split(':');
  let subtitle = restTitle.length > 0 ? restTitle.join(':').trim() : showHost;

  // Avoid duplication if title and host/subtitle are the same
  if (subtitle.toLowerCase() === mainTitle.trim().toLowerCase()) {
    subtitle = '';
  }

  // Helper to choose classes based on variant
  const borderClass = variant === 'light' ? 'border-black' : 'border-almostblack dark:border-white';
  const textClass = variant === 'light' ? 'text-black' : 'text-almostblack dark:text-white';
  const imageBorderClass =
    variant === 'light' ? 'border-black' : 'border-almostblack dark:border-0';
  const playButtonBgClass =
    variant === 'light'
      ? 'bg-black hover:bg-black/80 border-black'
      : 'bg-almostblack hover:bg-almostblack/80 dark:border-white';
  const playButtonIconClass = variant === 'light' ? 'text-white' : 'text-white';
  const genreTagVariant = variant === 'light' ? 'light' : undefined;

  return (
    <div className={`${borderClass} border p-2 ${className}`}>
      {/* Image and Play Button (hover group) */}
      <Link href={slug} className='block'>
        <div className='group relative aspect-square cursor-pointer'>
          {/* Overlay for dimming on hover */}
          <div className='absolute inset-0 bg-black opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none z-10' />
          <ResponsiveCardImage
            src={showImage}
            alt={showName}
            className={`object-cover border ${imageBorderClass} hover:cursor-pointer`}
            sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw'
            priority={false}
            aspectRatio='square'
          />
          {isSaved && (
            <div className='absolute top-2 right-2 z-20 bg-almostblack/80 dark:bg-white/80 p-1.5 rounded-full'>
              <Bookmark className='w-3 h-3 text-white dark:text-almostblack fill-current' />
            </div>
          )}
          {isMounted && shouldShowPlayButton && (
            <div className='absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20'>
              <button
                className={`${playButtonBgClass} rounded-full w-10 h-10 flex items-center justify-center transition-colors cursor-pointer`}
                style={{ minWidth: 40, minHeight: 40 }}
                onClick={handlePlayPause}
                aria-label={isCurrentlyPlaying ? 'Pause show' : 'Play show'}
              >
                {isCurrentlyPlaying ? (
                  <Pause fill='white' className={`w-4 h-4 ${playButtonIconClass}`} />
                ) : (
                  <Play fill='white' className={`w-4 h-4 ${playButtonIconClass} pl-0.5`} />
                )}
              </button>
            </div>
          )}
        </div>
      </Link>

      {/* Details */}
      <div className='flex flex-col justify-between pt-3 pb-1 h-30'>
        {/* Title */}
        <Link href={slug} className='block'>
          <div className='w-auto h-auto flex-1 gap-1 flex flex-col cursor-pointer'>
            <div
              className={`font-mono text-m8 sm:text-m6 uppercase w-full line-clamp-2 wrap-break-word pr-10 ${textClass}`}
            >
              {mainTitle}
              {subtitle ? `: ${subtitle}` : ''}
            </div>

            {(formattedDate || formattedTime || primaryLocationName) && (
              <span
                className={`block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-m8 uppercase pt-1 ${textClass}`}
              >
                {[formattedDate, formattedTime, primaryLocationName].filter(Boolean).join(' | ')}
              </span>
            )}
          </div>
        </Link>

        {/* Tags and Play Button */}
        <div className='flex flex-row w-full pr-1'>
          <div className='flex flex-row flex-wrap'>
            {showTags.map((tag, idx) => {
              const genreLink = getGenreLink(tag.id);
              return (
                <GenreTag
                  key={tag.id + idx}
                  variant={genreTagVariant as 'default' | 'transparent' | 'white' | 'light'}
                  onClick={e => {
                    if (genreLink) {
                      router.push(genreLink);
                    } else {
                      console.warn('No genre link found for tag:', tag);
                    }
                  }}
                >
                  {tag.title}
                </GenreTag>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
