'use client';

import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { useMediaPlayer } from '@/components/providers/media-player-provider';
import { cn } from '@/lib/utils';
import { usePlausible } from 'next-plausible';

interface PlayButtonProps {
  label?: boolean;
  show: any; // Using any to work with both episode and legacy show formats
  variant?: 'default' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function PlayButton({
  label = false,
  show,
  variant = 'default',
  size = 'default',
  className,
}: PlayButtonProps) {
  const { selectedShow, playShow, pauseShow, isArchivePlaying } = useMediaPlayer();
  const plausible = usePlausible();

  const isCurrentShow = selectedShow?.key === show.key;
  const isCurrentlyPlaying = isCurrentShow && isArchivePlaying;

  const handleClick = () => {
    if (isCurrentShow) {
      if (isCurrentlyPlaying) {
        plausible('Episode Paused', {
          props: {
            show: show.name || show.title || 'Unknown',
            slug: show.slug || '',
          },
        });
        pauseShow();
      } else {
        plausible('Episode Resumed', {
          props: {
            show: show.name || show.title || 'Unknown',
            slug: show.slug || '',
          },
        });
        playShow(show);
      }
    } else {
      plausible('Episode Play Button Clicked', {
        props: {
          show: show.name || show.title || 'Unknown',
          slug: show.slug || '',
        },
      });
      playShow(show);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(className, 'px-0')}
      aria-label={isCurrentlyPlaying ? `Pause ${show.name}` : `Play ${show.name}`}
    >
      {isCurrentlyPlaying ? (
        <Pause fill='white' className={size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'} />
      ) : (
        <Play fill='white' className={size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'} />
      )}
      {size !== 'icon' && label && (
        <span className='ml-2'>{isCurrentlyPlaying ? 'Pause' : 'Play'}</span>
      )}
    </Button>
  );
}
