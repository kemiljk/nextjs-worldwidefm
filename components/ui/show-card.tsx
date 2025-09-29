'use client';

import { Play, Pause } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMediaPlayer } from '../providers/media-player-provider';
import { GenreTag } from './genre-tag';

interface ShowCardProps {
  show: any; // Using any to work with both episode and legacy show formats
  slug: string;
  className?: string;
  playable?: boolean;
  variant?: 'default' | 'light';
}

export const ShowCard: React.FC<ShowCardProps> = ({
  show,
  slug,
  className = '',
  playable = true,
  variant = 'default',
}) => {
  // Since we now filter episodes at fetch level, all episodes have audio content
  // For other content, check if there's actual audio content
  const isEpisode = show?.__source === 'episode' || show?.episodeData || show?.type === 'episode';
  const hasAudioContent = show?.url || show?.player || show?.metadata?.player;
  const shouldShowPlayButton = playable && (isEpisode || hasAudioContent);
  const { playShow, pauseShow, selectedShow, isArchivePlaying } = useMediaPlayer();

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
    return (
      show.pictures?.large ||
      show.pictures?.extra_large ||
      show.enhanced_image ||
      show.imageUrl ||
      show.image ||
      show.metadata?.image?.imgix_url ||
      '/image-placeholder.svg'
    );
  };

  const getShowTags = (show: any): string[] => {
    if (show.tags && Array.isArray(show.tags)) {
      return show.tags
        .filter((tag: any) => tag.name?.toLowerCase() !== 'worldwide fm')
        .slice(0, 3)
        .map((tag: any) => tag.name || tag.title || tag);
    }
    if (show.enhanced_genres && Array.isArray(show.enhanced_genres)) {
      return show.enhanced_genres.slice(0, 3);
    }
    if (show.metadata?.genres && Array.isArray(show.metadata.genres)) {
      return show.metadata.genres.slice(0, 3);
    }
    if (show.genres && Array.isArray(show.genres)) {
      return show.genres.slice(0, 3);
    }
    return [];
  };

  const formatShowTime = (dateString: string | undefined): string | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return (
      date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/London',
        hour12: false,
      }) + ' [BST]'
    );
  };

  const showImage = getShowImage(show);
  const showTags = getShowTags(show);
  const createdTime = show.created_time || show.created_at || show.broadcast_date || show.date;
  const showName = show.name || show.title || 'Untitled Show';
  const showHost = show.user?.name || show.host || '';
  const formattedTime = formatShowTime(createdTime);

  // Split showName for two-line title (Figma: first line main, second line host/guest)
  const [mainTitle, ...restTitle] = showName.split(':');
  const subtitle = restTitle.length > 0 ? restTitle.join(':').trim() : showHost;

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
    <Link
      href={slug}
      className={`border ${borderClass} rounded-none overflow-hidden flex flex-col p-2 h-full w-auto showcard cursor-default ${className}`}
    >
      {/* Image */}
      <div className='relative flex-2'>
        <Image
          src={showImage}
          alt={showName}
          fill
          className={`object-cover border ${imageBorderClass} hover:cursor-pointer`}
          sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw'
          priority={false}
        />
      </div>

      {/* Details */}
      <div className='flex flex-col justify-between gap-1 flex-1 pt-3 pb-1'>
        {/* Title */}
        <div className='w-auto h-auto flex-1 gap-1 flex flex-col'>
          <div
            className={`font-mono text-m8 sm:text-m6 uppercase w-full line-clamp-2 break-words pr-10 ${textClass}`}
          >
            {mainTitle}
            {subtitle ? ': ' : ''} {subtitle}
          </div>

          {(formattedTime || show.location?.name) && (
            <div
              className={`flex flex-row items-center gap-2.5 font-mono text-xs uppercase pt-1 ${textClass}`}
            >
              {formattedTime && <span>{formattedTime}</span>}
              {formattedTime && show.location?.name && <span>|</span>}
              {show.location?.name && <span>{show.location?.name}</span>}
            </div>
          )}
        </div>

        {/* Tags and Play Button */}
        <div className='flex flex-row items-end justify-between w-full pr-1'>
          <div className='flex flex-row flex-wrap'>
            {showTags.map((tag, idx) => (
              <GenreTag
                key={tag + idx}
                variant={genreTagVariant as 'default' | 'transparent' | 'white'}
              >
                {tag}
              </GenreTag>
            ))}
          </div>

          {shouldShowPlayButton && (
            <button
              className={`${playButtonBgClass} rounded-full w-10 h-10 flex items-center justify-center ml-2 transition-colors cursor-pointer`}
              style={{ minWidth: 40, minHeight: 40 }}
              onClick={handlePlayPause}
              aria-label={isCurrentlyPlaying ? 'Pause show' : 'Play show'}
            >
              {isCurrentlyPlaying ? (
                <Pause
                  fill='white'
                  className={`w-4 h-4 ${playButtonIconClass}`}
                />
              ) : (
                <Play
                  fill='white'
                  className={`w-4 h-4 ${playButtonIconClass} pl-0.5`}
                />
              )}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
};
